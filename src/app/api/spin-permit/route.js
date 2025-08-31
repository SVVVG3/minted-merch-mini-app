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
  verifyingContract: process.env.SPIN_REGISTRY_CONTRACT // We'll set this after deployment
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
  const pstOffset = -8; // PST is UTC-8, PDT is UTC-7 (but we'll use -8 for consistency)
  
  // Convert to PST
  const pstTime = new Date(now.getTime() + (pstOffset * 60 * 60 * 1000));
  
  // Set to 8 AM PST today
  const dayStart = new Date(pstTime.getFullYear(), pstTime.getMonth(), pstTime.getDate(), 8, 0, 0, 0);
  
  // If it's before 8 AM PST today, use yesterday's 8 AM
  if (pstTime.getHours() < 8) {
    dayStart.setDate(dayStart.getDate() - 1);
  }
  
  // Convert back to UTC timestamp
  return Math.floor((dayStart.getTime() - (pstOffset * 60 * 60 * 1000)) / 1000);
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

    // Check if user has already spun today
    const { data: existingSpin, error: checkError } = await supabase
      .from('point_transactions')
      .select('*')
      .eq('user_fid', fid)
      .eq('transaction_type', 'daily_checkin')
      .gte('created_at', new Date(dayStart * 1000).toISOString())
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Database error:', checkError);
      return NextResponse.json({ 
        success: false, 
        error: 'Database error' 
      }, { status: 500 });
    }

    if (existingSpin && (existingSpin.spin_reserved_at || existingSpin.spin_confirmed_at)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Already spun today',
        nextSpinAt: new Date((dayStart + 24 * 60 * 60) * 1000).toISOString()
      }, { status: 400 });
    }

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
    const signerKey = process.env.SPIN_SIGNER_PRIVATE_KEY || process.env.BACKEND_SIGNER_PRIVATE_KEY;
    if (!signerKey) {
      console.error('❌ Missing signing key. Need SPIN_SIGNER_PRIVATE_KEY or BACKEND_SIGNER_PRIVATE_KEY');
      return NextResponse.json({ 
        success: false, 
        error: 'Signing key not configured' 
      }, { status: 500 });
    }

    console.log('✅ Signing key found, creating wallet...');
    const wallet = new ethers.Wallet(signerKey);
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
