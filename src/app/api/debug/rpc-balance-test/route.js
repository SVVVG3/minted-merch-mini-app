import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet') || '0x380d89b06a1a596a2c4f788daaabc2dcc6493888'; // Default to one of SVVVG3's wallets
    
    console.log(`🧪 Testing RPC balance check for wallet: ${walletAddress}`);

    const rpcUrl = 'https://mainnet.base.org';
    const contractAddress = '0x774EAeFE73Df7959496Ac92a77279A8D7d690b07'; // $MINTEDMERCH
    
    // ERC-20 balanceOf function call
    const data = `0x70a08231${walletAddress.slice(2).padStart(64, '0')}`;
    
    console.log('🔗 RPC Call Details:', {
      rpcUrl,
      contractAddress,
      walletAddress,
      functionData: data
    });

    const requestBody = {
      jsonrpc: '2.0',
      method: 'eth_call',
      params: [
        {
          to: contractAddress,
          data: data
        },
        'latest'
      ],
      id: 1
    };

    console.log('📤 Request body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    console.log('📥 Response status:', response.status, response.statusText);

    const result = await response.json();
    console.log('📥 Raw response:', JSON.stringify(result, null, 2));

    let balance = 0;
    let balanceHex = null;
    let balanceWei = null;
    let error = null;

    if (result.result && result.result !== '0x') {
      try {
        balanceHex = result.result;
        balanceWei = BigInt(balanceHex);
        balance = Number(balanceWei) / Math.pow(10, 18);
        
        console.log('💰 Balance calculation:', {
          hex: balanceHex,
          wei: balanceWei.toString(),
          tokens: balance
        });
      } catch (parseError) {
        error = `Error parsing balance: ${parseError.message}`;
        console.error('❌ Parse error:', parseError);
      }
    } else {
      console.log('ℹ️ No balance found (result was 0x or null)');
    }

    return NextResponse.json({
      success: true,
      test: {
        walletAddress,
        contractAddress,
        rpcUrl,
        request: requestBody,
        response: result,
        parsed: {
          balanceHex,
          balanceWei: balanceWei?.toString(),
          balanceTokens: balance,
          error
        }
      }
    });

  } catch (error) {
    console.error('❌ RPC test error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
