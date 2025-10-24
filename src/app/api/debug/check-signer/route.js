import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { withAdminAuth } from '@/lib/adminAuth';

export async function GET() {
  try {
    // Contract details
    const contractAddress = process.env.NEXT_PUBLIC_SPIN_REGISTRY_CONTRACT_ADDRESS || '0xe424E28FCDE2E009701F7d592842C56f7E041a3f';
    const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
    
    // Simple ABI to get signer
    const abi = [
      "function signer() view returns (address)",
      "function owner() view returns (address)"
    ];
    
    const contract = new ethers.Contract(contractAddress, abi, provider);
    
    // Get contract signer and owner
    const contractSigner = await contract.signer();
    const contractOwner = await contract.owner();
    
    // Get our backend signer addresses
    const spinSignerKey = process.env.SPIN_SIGNER_PRIVATE_KEY;
    const backendSignerKey = process.env.BACKEND_SIGNER_PRIVATE_KEY;
    
    let spinSignerAddress = null;
    let backendSignerAddress = null;
    
    if (spinSignerKey) {
      const wallet = new ethers.Wallet(spinSignerKey);
      spinSignerAddress = wallet.address;
    }
    
    if (backendSignerKey) {
      const wallet = new ethers.Wallet(backendSignerKey);
      backendSignerAddress = wallet.address;
    }
    
    const result = {
      contractAddress,
      contractSigner,
      contractOwner,
      spinSignerAddress,
      backendSignerAddress,
      signerMatch: {
        spinSigner: spinSignerAddress && contractSigner.toLowerCase() === spinSignerAddress.toLowerCase(),
        backendSigner: backendSignerAddress && contractSigner.toLowerCase() === backendSignerAddress.toLowerCase()
      },
      recommendation: null
    };
    
    // Determine which key to use
    if (result.signerMatch.spinSigner) {
      result.recommendation = 'Use SPIN_SIGNER_PRIVATE_KEY - it matches the contract signer';
    } else if (result.signerMatch.backendSigner) {
      result.recommendation = 'Use BACKEND_SIGNER_PRIVATE_KEY - it matches the contract signer';
    } else {
      result.recommendation = 'ERROR: Neither key matches the contract signer. Need to update contract or keys.';
    }
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('❌ Signer check error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
