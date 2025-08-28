import { NextResponse } from 'next/server';
import { checkTokenBalanceDirectly } from '@/lib/blockchainAPI';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid') || '466111';
    
    console.log(`🔍 Testing balance comparison for FID: ${fid}`);

    // Test with SVVVG3's known wallet addresses
    const testWallets = [
      '0x44d4c58efcbb44639d64420175cf519aa3191a86',
      '0x380d89b06a1a596a2c4f788daaabc2dcc6493888',
      '0xf631eae9033f881a35091f221ac20ee0c6b05310',
      '0xbb14db9f60e806846335f79481d998abc66efc20',
      '0x2f528b5ad9f5dd221894251fd716b8b37e423c81'
    ];

    console.log('🧪 Testing with wallets:', testWallets);

    // Test 1: Call checkTokenBalanceDirectly exactly as it would be called
    let test1Balance = 0;
    let test1Error = null;
    
    try {
      console.log('🧪 Test 1: Calling checkTokenBalanceDirectly...');
      test1Balance = await checkTokenBalanceDirectly(
        testWallets,
        ['0x774EAeFE73Df7959496Ac92a77279A8D7d690b07'],
        8453
      );
      console.log(`✅ Test 1 result: ${test1Balance}`);
    } catch (error) {
      console.error('❌ Test 1 error:', error);
      test1Error = error.message;
    }

    // Test 2: Call it again to see if there's any caching/timing issue
    let test2Balance = 0;
    let test2Error = null;
    
    try {
      console.log('🧪 Test 2: Calling checkTokenBalanceDirectly again...');
      test2Balance = await checkTokenBalanceDirectly(
        testWallets,
        ['0x774EAeFE73Df7959496Ac92a77279A8D7d690b07'],
        8453
      );
      console.log(`✅ Test 2 result: ${test2Balance}`);
    } catch (error) {
      console.error('❌ Test 2 error:', error);
      test2Error = error.message;
    }

    // Test 3: Test individual wallets to see which ones have tokens
    const individualResults = [];
    for (const wallet of testWallets) {
      try {
        console.log(`🧪 Testing individual wallet: ${wallet}`);
        const balance = await checkTokenBalanceDirectly(
          [wallet],
          ['0x774EAeFE73Df7959496Ac92a77279A8D7d690b07'],
          8453
        );
        individualResults.push({
          wallet,
          balance,
          error: null
        });
        console.log(`💰 ${wallet}: ${balance} tokens`);
      } catch (error) {
        console.error(`❌ Error for ${wallet}:`, error);
        individualResults.push({
          wallet,
          balance: 0,
          error: error.message
        });
      }
    }

    const totalFromIndividual = individualResults.reduce((sum, result) => sum + result.balance, 0);

    return NextResponse.json({
      success: true,
      fid: parseInt(fid),
      tests: {
        batchTest1: {
          balance: test1Balance,
          error: test1Error
        },
        batchTest2: {
          balance: test2Balance,
          error: test2Error
        },
        individualTests: individualResults,
        totalFromIndividual,
        comparison: {
          batchVsIndividual: test1Balance === totalFromIndividual,
          batch1VsBatch2: test1Balance === test2Balance
        }
      }
    });

  } catch (error) {
    console.error('❌ Balance comparison test error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
