import { NextResponse } from 'next/server';

/**
 * DEBUG ENDPOINT: Manually check a wallet's token balance
 * This endpoint helps diagnose why a wallet is showing 0 balance
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet') || '0x103396d1d28e787e5a0f99acc03d20a407ca8f11';
    const contractAddress = searchParams.get('contract') || '0x774EAeFE73Df7959496Ac92a77279A8D7d690b07';
    
    console.log('🔍 DEBUG: Manual wallet balance check');
    console.log('Wallet:', walletAddress);
    console.log('Contract:', contractAddress);
    
    // Try multiple RPC endpoints to see if we get different results
    const rpcUrls = [
      'https://mainnet.base.org',
      'https://base.publicnode.com',
      'https://base.llamarpc.com',
      'https://1rpc.io/base',
      'https://base.meowrpc.com'
    ];
    
    const results = [];
    
    // ERC-20 balanceOf call
    const data = `0x70a08231${walletAddress.slice(2).padStart(64, '0')}`;
    
    for (const rpcUrl of rpcUrls) {
      try {
        console.log(`\n🔗 Trying RPC: ${rpcUrl}`);
        
        const response = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_call',
            params: [
              {
                to: contractAddress,
                data: data
              },
              'latest'
            ],
            id: Date.now()
          })
        });
        
        const result = await response.json();
        console.log('Response:', result);
        
        let balance = 0;
        if (result.result && result.result !== '0x' && result.result !== '0x0') {
          const balanceWei = BigInt(result.result);
          balance = Number(balanceWei) / Math.pow(10, 18);
        }
        
        results.push({
          rpc: rpcUrl,
          success: !result.error,
          rawResult: result.result,
          balanceTokens: balance,
          error: result.error?.message || null
        });
        
        console.log(`Balance: ${balance} tokens`);
        
      } catch (error) {
        console.error(`Error with ${rpcUrl}:`, error);
        results.push({
          rpc: rpcUrl,
          success: false,
          error: error.message
        });
      }
    }
    
    // Summary
    const nonZeroResults = results.filter(r => r.balanceTokens > 0);
    const allSameBalance = results.every(r => r.balanceTokens === results[0].balanceTokens);
    
    return NextResponse.json({
      success: true,
      wallet: walletAddress,
      contract: contractAddress,
      chain: 'Base (8453)',
      results,
      summary: {
        totalRpcsTested: results.length,
        successfulCalls: results.filter(r => r.success).length,
        failedCalls: results.filter(r => !r.success).length,
        nonZeroBalances: nonZeroResults.length,
        allAgree: allSameBalance,
        consensusBalance: allSameBalance ? results[0].balanceTokens : 'NO CONSENSUS'
      },
      diagnosis: nonZeroResults.length === 0 
        ? '🚨 ALL RPCs returning 0 - Either wallet has no tokens or wrong contract address'
        : nonZeroResults.length === results.length
        ? `✅ All RPCs agree: Wallet has ${nonZeroResults[0].balanceTokens.toLocaleString()} tokens`
        : `⚠️ INCONSISTENT: ${nonZeroResults.length}/${results.length} RPCs show non-zero balance`
    });
    
  } catch (error) {
    console.error('❌ Debug endpoint error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

