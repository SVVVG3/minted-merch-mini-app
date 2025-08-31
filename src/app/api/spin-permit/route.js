import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// EIP-712 Domain
const DOMAIN = {
  name: 'MintedMerchSpins',
  version: '1',
  chainId: 8453, // Base mainnet
  verifyingContract: process.env.SPIN_REGISTRY_CONTRACT_ADDRESS || process.env.SPIN_REGISTRY_CONTRACT || '0xe424E28FCDE2E009701F7d592842C56f7E041a3f'
};

// EIP-712 Types
const TYPES = {
  SpinPermit: [
    { name: 'user', type: 'address' },
    { name: 'dayStart', type: 'uint256' },
    { name: 'expiresAt', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' }
  ]
};

// Helper function to get PST day start (8 AM PST/PDT)
function getPSTDayStart() {
  const now = new Date();
  
  // Use month-based DST detection (same as dashboard)
  const month = now.getMonth(); // 0-11
  const isDST = month >= 2 && month <= 10; // March (2) through November (10)
  
  // Use correct offset: PDT = UTC-7, PST = UTC-8  
  const pacificOffset = isDST ? 7 * 60 * 60 * 1000 : 8 * 60 * 60 * 1000;
  const pacificNow = new Date(now.getTime() - pacificOffset);
  
  // Get today's date in Pacific timezone
  const year = pacificNow.getUTCFullYear();
  const month_utc = pacificNow.getUTCMonth();
  const date = pacificNow.getUTCDate();
  const hour = pacificNow.getUTCHours();
  
  // Create 8 AM Pacific today
  let dayStart = new Date(Date.UTC(year, month_utc, date, 8, 0, 0, 0));
  
  // If it's before 8 AM Pacific, use yesterday's 8 AM Pacific
  if (hour < 8) {
    dayStart = new Date(Date.UTC(year, month_utc, date - 1, 8, 0, 0, 0));
  }
  
  // Convert to UTC and return as Unix timestamp
  const utcDayStart = new Date(dayStart.getTime() + pacificOffset);
  
  console.log('🕐 Pacific Day Start Calculation:', {
    nowUTC: now.toISOString(),
    nowPacific: pacificNow.toISOString(),
    pacificHour: hour,
    timezone: isDST ? 'PDT (UTC-7)' : 'PST (UTC-8)',
    dayStartPacific: dayStart.toISOString(),
    dayStartUTC: utcDayStart.toISOString(),
    unixTimestamp: Math.floor(utcDayStart.getTime() / 1000)
  });
  
  return Math.floor(utcDayStart.getTime() / 1000);
}

export async function POST(request) {
  try {
    const { walletAddress, fid } = await request.json();
    
    if (!walletAddress || !fid) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing walletAddress or fid' 
      }, { status: 400 });
    }

    // Get today's PST day start (8 AM PST boundary)
    const dayStart = getPSTDayStart();
    
    console.log('🎰 Spin permit request:', {
      fid,
      walletAddress,
      dayStart: new Date(dayStart * 1000).toISOString()
    });

    // Check if user has already spun today (look for on-chain spins specifically)
    const { data: existingSpin, error: checkError } = await supabase
      .from('point_transactions')
      .select('*')
      .eq('user_fid', fid)
      .eq('transaction_type', 'daily_checkin')
      .gte('created_at', new Date(dayStart * 1000).toISOString())
      .single();

    console.log('🔍 Existing spin check:', { 
      existingSpin: existingSpin ? {
        id: existingSpin.id,
        created_at: existingSpin.created_at,
        spin_reserved_at: existingSpin.spin_reserved_at,
        spin_confirmed_at: existingSpin.spin_confirmed_at,
        spin_tx_hash: existingSpin.spin_tx_hash
      } : null,
      checkError: checkError?.code
    });

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Database error:', checkError);
      return NextResponse.json({ 
        success: false, 
        error: 'Database error' 
      }, { status: 500 });
    }

    // Handle existing spins
    if (existingSpin) {
      // If there's a confirmed spin (completed), block
      if (existingSpin.spin_confirmed_at && existingSpin.spin_tx_hash) {
        console.log('🚫 User has completed spin today:', {
          id: existingSpin.id,
          created_at: existingSpin.created_at,
          spin_confirmed_at: existingSpin.spin_confirmed_at,
          spin_tx_hash: existingSpin.spin_tx_hash
        });
        return NextResponse.json({ 
          success: false, 
          error: 'Already spun today',
          nextSpinAt: new Date((dayStart + 24 * 60 * 60) * 1000).toISOString()
        }, { status: 400 });
      }
      
      // If there's a reserved spin that's expired (>1 minute old), clean it up
      if (existingSpin.spin_reserved_at && !existingSpin.spin_confirmed_at) {
        const reservedTime = new Date(existingSpin.spin_reserved_at).getTime();
        const now = Date.now();
        const oneMinute = 1 * 60 * 1000;
        
        if (now - reservedTime > oneMinute) {
          console.log('🧹 Cleaning up expired spin reservation:', {
            id: existingSpin.id,
            reservedAt: existingSpin.spin_reserved_at,
            ageMinutes: Math.floor((now - reservedTime) / (60 * 1000))
          });
          
          // Delete the expired reservation
          await supabase
            .from('point_transactions')
            .delete()
            .eq('id', existingSpin.id);
            
          console.log('✅ Expired reservation cleaned up, proceeding with new spin');
        } else {
          console.log('⏳ Recent spin reservation still pending:', {
            id: existingSpin.id,
            reservedAt: existingSpin.spin_reserved_at,
            ageMinutes: Math.floor((now - reservedTime) / (60 * 1000)),
            ageSeconds: Math.floor((now - reservedTime) / 1000)
          });
          return NextResponse.json({ 
            success: false, 
            error: 'Spin already in progress, please wait 1 minute',
            nextSpinAt: new Date((dayStart + 24 * 60 * 60) * 1000).toISOString(),
            retryAfter: new Date(reservedTime + oneMinute).toISOString()
          }, { status: 400 });
        }
      }
      
      // If there's a regular off-chain check-in, block (one per day rule)
      if (!existingSpin.spin_reserved_at && !existingSpin.spin_confirmed_at) {
        console.log('🚫 User has off-chain check-in today:', {
          id: existingSpin.id,
          created_at: existingSpin.created_at,
          description: existingSpin.description
        });
        return NextResponse.json({ 
          success: false, 
          error: 'Already checked in today (off-chain)',
          nextSpinAt: new Date((dayStart + 24 * 60 * 60) * 1000).toISOString()
        }, { status: 400 });
      }
    }

    console.log('✅ No existing check-in found for today, proceeding with spin permit');

    // Generate secure nonce (prevents accidental reuse)
    const backendRandom = crypto.randomBytes(32);
    const nonce = ethers.keccak256(
      ethers.solidityPacked(
        ['address', 'uint256', 'bytes32'],
        [walletAddress, dayStart, '0x' + backendRandom.toString('hex')]
      )
    );
    const expiresAt = Math.floor(Date.now() / 1000) + (2 * 60); // 2 minutes from now

    // Create the permit
    const permit = {
      user: walletAddress,
      dayStart,
      expiresAt,
      nonce
    };

    // Sign the permit with backend private key
    const signerKey = process.env.BACKEND_SIGNER_PRIVATE_KEY || process.env.SPIN_SIGNER_PRIVATE_KEY;
    if (!signerKey) {
      console.error('❌ Missing signing key. Need BACKEND_SIGNER_PRIVATE_KEY or SPIN_SIGNER_PRIVATE_KEY');
      return NextResponse.json({ 
        success: false, 
        error: 'Signing key not configured' 
      }, { status: 500 });
    }

    const keyType = process.env.BACKEND_SIGNER_PRIVATE_KEY ? 'BACKEND_SIGNER_PRIVATE_KEY' : 'SPIN_SIGNER_PRIVATE_KEY';
    console.log('✅ Signing key found, creating wallet...', { keyType });
    const wallet = new ethers.Wallet(signerKey);
    console.log('🔑 Wallet address:', wallet.address);
    console.log('🏗️ EIP-712 Domain:', DOMAIN);
    const signature = await wallet.signTypedData(DOMAIN, TYPES, permit);

    // Generate anonymous ID for privacy (hash of fid + dayStart + wallet)
    const anonId = ethers.keccak256(
      ethers.solidityPacked(
        ['uint256', 'uint256', 'address'],
        [fid, dayStart, walletAddress]
      )
    );

    // Reserve the spin in database (create a pending transaction record)
    const { error: reserveError } = await supabase
      .from('point_transactions')
      .insert({
        user_fid: fid,
        transaction_type: 'daily_checkin',
        points_earned: 0, // Will be updated after successful blockchain transaction
        points_before: 0, // Will be updated after successful blockchain transaction
        points_after: 0,  // Will be updated after successful blockchain transaction
        description: 'Pending on-chain spin transaction',
        spin_reserved_at: new Date().toISOString(),
        spin_nonce: nonce,
        wallet_address: walletAddress
      });

    if (reserveError) {
      console.error('Failed to reserve spin:', reserveError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to reserve spin' 
      }, { status: 500 });
    }

    console.log('✅ Spin permit issued:', {
      fid,
      nonce: nonce.slice(0, 10) + '...',
      expiresAt: new Date(expiresAt * 1000).toISOString()
    });

    return NextResponse.json({
      success: true,
      permit,
      signature,
      anonId,
      contractAddress: process.env.SPIN_REGISTRY_CONTRACT
    });

  } catch (error) {
    console.error('Spin permit error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
