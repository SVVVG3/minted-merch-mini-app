import { NextResponse } from 'next/server';
import { ethers } from 'ethers';

/**
 * DEBUG ENDPOINT: Check smart contract state for a user's last spin
 * Helps diagnose "Already spun" errors when database shows they haven't
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet') || '0xE3b811AA0AC620dcc6a27B767eB0d73ae9C56d12';
    
    console.log('🔍 DEBUG: Checking smart contract state for wallet:', walletAddress);
    
    // Contract address and ABI
    const contractAddress = '0xe424E28FCDE2E009701F7d592842C56f7E041a3f';
    const contractABI = [
      'function lastDayStart(address user) external view returns (uint256)',
      'function lastSpinTime(address user) external view returns (uint256)'
    ];
    
    // Connect to Base mainnet
    const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
    const contract = new ethers.Contract(contractAddress, contractABI, provider);
    
    // Query contract state
    const lastDayStartRaw = await contract.lastDayStart(walletAddress);
    const lastSpinTimeRaw = await contract.lastSpinTime(walletAddress);
    
    const lastDayStart = Number(lastDayStartRaw);
    const lastSpinTime = Number(lastSpinTimeRaw);
    
    // Convert to human-readable dates
    const lastDayStartDate = lastDayStart > 0 ? new Date(lastDayStart * 1000) : null;
    const lastSpinTimeDate = lastSpinTime > 0 ? new Date(lastSpinTime * 1000) : null;
    
    // Calculate current app-day start (8 AM PST)
    const now = new Date();
    const pstOffset = -8 * 60; // PST is UTC-8
    const nowPST = new Date(now.getTime() + (pstOffset * 60 * 1000));
    const currentDayStartPST = new Date(nowPST);
    currentDayStartPST.setHours(8, 0, 0, 0);
    if (nowPST.getHours() < 8) {
      currentDayStartPST.setDate(currentDayStartPST.getDate() - 1);
    }
    const currentDayStartUTC = new Date(currentDayStartPST.getTime() - (pstOffset * 60 * 1000));
    const currentDayStart = Math.floor(currentDayStartUTC.getTime() / 1000);
    
    const canSpinToday = lastDayStart < currentDayStart;
    
    return NextResponse.json({
      success: true,
      wallet: walletAddress,
      contract: contractAddress,
      chain: 'Base (8453)',
      contractState: {
        lastDayStart: {
          unix: lastDayStart,
          date: lastDayStartDate ? lastDayStartDate.toISOString() : 'Never spun',
          dateUTC: lastDayStartDate ? lastDayStartDate.toUTCString() : 'Never',
          datePST: lastDayStartDate ? new Date(lastDayStartDate.getTime() - (8 * 60 * 60 * 1000)).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }) : 'Never'
        },
        lastSpinTime: {
          unix: lastSpinTime,
          date: lastSpinTimeDate ? lastSpinTimeDate.toISOString() : 'Never spun',
          dateUTC: lastSpinTimeDate ? lastSpinTimeDate.toUTCString() : 'Never',
          datePST: lastSpinTimeDate ? new Date(lastSpinTimeDate.getTime() - (8 * 60 * 60 * 1000)).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }) : 'Never'
        }
      },
      currentAppDay: {
        dayStart: {
          unix: currentDayStart,
          date: currentDayStartUTC.toISOString(),
          dateUTC: currentDayStartUTC.toUTCString(),
          datePST: currentDayStartPST.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })
        }
      },
      diagnosis: {
        canSpinToday,
        reason: canSpinToday 
          ? `✅ Contract allows spin (lastDayStart ${lastDayStart} < currentDayStart ${currentDayStart})`
          : `❌ Contract blocks spin (lastDayStart ${lastDayStart} >= currentDayStart ${currentDayStart})`,
        issue: !canSpinToday && lastDayStart > 0
          ? `User's last spin on contract was for app-day ${lastDayStartDate?.toISOString()}. Check if database has this record.`
          : null
      }
    });
    
  } catch (error) {
    console.error('❌ Debug endpoint error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}

