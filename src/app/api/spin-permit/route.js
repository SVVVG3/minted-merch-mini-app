import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';
import crypto from 'crypto';
import { getCurrent8AMPST, getNext8AMPST } from '@/lib/timezone.js';

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

// DEPRECATED: Use getCurrent8AMPST() from @/lib/timezone.js instead
// This function had a bug where it created 8 AM UTC instead of 8 AM Pacific
// Keeping for reference only - NOT USED ANYMORE
function getPSTDayStart_DEPRECATED() {
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
  
  // Create 8 AM Pacific today (need to add offset to get back to UTC)
  // PDT: 8 AM Pacific = 15:00 UTC (8 + 7)
  // PST: 8 AM Pacific = 16:00 UTC (8 + 8)
  const utcHour = 8 + (isDST ? 7 : 8);
  let dayStart = new Date(Date.UTC(year, month_utc, date, utcHour, 0, 0, 0));
  
  // If it's before 8 AM Pacific, use yesterday's 8 AM Pacific
  if (hour < 8) {
    dayStart = new Date(Date.UTC(year, month_utc, date - 1, utcHour, 0, 0, 0));
  }
  
  // dayStart is now correctly set to 8 AM Pacific (in UTC)
  // BUGFIX: Was creating 8 AM UTC instead of 8 AM Pacific
  
  console.log('🕐 Pacific Day Start Calculation:', {
    nowUTC: now.toISOString(),
    nowPacific: pacificNow.toISOString(),
    pacificHour: hour,
    timezone: isDST ? 'PDT (UTC-7)' : 'PST (UTC-8)',
    dayStart: dayStart.toISOString(),
    unixTimestamp: Math.floor(dayStart.getTime() / 1000)
  });
  
  return Math.floor(dayStart.getTime() / 1000);
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

    // Get today's PST day start (8 AM PST boundary) using timezone utility
    const dayStartDate = getCurrent8AMPST();
    const dayStart = Math.floor(dayStartDate.getTime() / 1000); // Unix timestamp
    
    console.log('🎰 Spin permit request:', {
      fid,
      walletAddress,
      dayStart: dayStartDate.toISOString(),
      dayStartUnix: dayStart
    });

    // Check if user has already completed a spin today (only confirmed spins count)
    const { data: existingSpin, error: checkError } = await supabase
      .from('point_transactions')
      .select('*')
      .eq('user_fid', fid)
      .eq('transaction_type', 'daily_checkin')
      .gte('created_at', dayStartDate.toISOString())
      .gt('points_earned', 0) // Only count completed spins with points
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

    // Handle existing completed spins (we only query for completed spins with points > 0 now)
    if (existingSpin) {
      console.log('🚫 User has already completed spin today:', {
        id: existingSpin.id,
        created_at: existingSpin.created_at,
        points_earned: existingSpin.points_earned
      });
      return NextResponse.json({ 
        success: false, 
        error: 'Already spun today',
        nextSpinAt: getNext8AMPST().toISOString()
      }, { status: 400 });
    }

    console.log('✅ No completed check-in found for today, proceeding with spin permit');

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

    // NOTE: We no longer create a database entry here to prevent stuck pending states
    // The database entry will be created only when the transaction is confirmed
    // in the /api/points/checkin endpoint after successful blockchain submission

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
