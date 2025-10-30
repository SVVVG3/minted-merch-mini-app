/**
 * Deployment script for SpinRegistry contract
 * 
 * Usage:
 * 1. Set SPIN_SIGNER_PRIVATE_KEY in your .env file
 * 2. Fund the deployer wallet with ETH on Base
 * 3. Run: node scripts/deploy-spin-registry.js
 */

const { ethers } = require('ethers');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

// Base network configuration
const BASE_RPC_URL = 'https://mainnet.base.org';
const BASE_CHAIN_ID = 8453;

async function deploySpinRegistry() {
  try {
    console.log('🚀 Deploying SpinRegistry to Base network...\n');

    // Validate environment variables
    if (!process.env.SPIN_SIGNER_PRIVATE_KEY) {
      throw new Error('SPIN_SIGNER_PRIVATE_KEY not set in environment');
    }

    if (!process.env.DEPLOYER_PRIVATE_KEY) {
      throw new Error('DEPLOYER_PRIVATE_KEY not set in environment');
    }

    // Connect to Base network
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
    const signerWallet = new ethers.Wallet(process.env.SPIN_SIGNER_PRIVATE_KEY);

    console.log('📋 Deployment Configuration:');
    console.log('Network:', 'Base Mainnet');
    console.log('Chain ID:', BASE_CHAIN_ID);
    console.log('Deployer:', deployer.address);
    console.log('Backend Signer:', signerWallet.address);

    // Check deployer balance
    const balance = await provider.getBalance(deployer.address);
    console.log('Deployer Balance:', ethers.formatEther(balance), 'ETH');

    if (balance < ethers.parseEther('0.001')) {
      throw new Error('Insufficient ETH for deployment. Need at least 0.001 ETH');
    }

    // Read contract source (using secure version)
    const contractSource = fs.readFileSync('./contracts/SpinRegistrySecure.sol', 'utf8');
    
    // Compile contract (you'll need to install solc: npm install solc)
    const solc = require('solc');
    
    const input = {
      language: 'Solidity',
      sources: {
        'SpinRegistrySecure.sol': {
          content: contractSource,
        },
      },
      settings: {
        outputSelection: {
          '*': {
            '*': ['abi', 'evm.bytecode'],
          },
        },
        optimizer: {
          enabled: true,
          runs: 200,
        },
      },
    };

    console.log('\n🔨 Compiling contract...');
    const output = JSON.parse(solc.compile(JSON.stringify(input)));

    if (output.errors) {
      output.errors.forEach(error => {
        if (error.severity === 'error') {
          console.error('❌ Compilation error:', error.formattedMessage);
        } else {
          console.warn('⚠️ Compilation warning:', error.formattedMessage);
        }
      });
      
      if (output.errors.some(error => error.severity === 'error')) {
        throw new Error('Contract compilation failed');
      }
    }

    const contract = output.contracts['SpinRegistrySecure.sol']['SpinRegistrySecure'];
    const abi = contract.abi;
    const bytecode = contract.evm.bytecode.object;

    console.log('✅ Contract compiled successfully');

    // Deploy contract
    console.log('\n📤 Deploying contract...');
    const contractFactory = new ethers.ContractFactory(abi, bytecode, deployer);
    
    // Constructor parameter: backend signer address
    const deployedContract = await contractFactory.deploy(signerWallet.address, {
      gasLimit: 2000000, // Set reasonable gas limit
    });

    console.log('⏳ Waiting for deployment transaction...');
    await deployedContract.waitForDeployment();

    const contractAddress = await deployedContract.getAddress();
    const deploymentTx = deployedContract.deploymentTransaction();

    console.log('\n🎉 Deployment successful!');
    console.log('Contract Address:', contractAddress);
    console.log('Transaction Hash:', deploymentTx.hash);
    console.log('Gas Used:', deploymentTx.gasLimit.toString());

    // Verify deployment
    console.log('\n🔍 Verifying deployment...');
    const deployedSigner = await deployedContract.signer();
    const owner = await deployedContract.owner();
    
    console.log('Contract Signer:', deployedSigner);
    console.log('Contract Owner:', owner);
    console.log('Expected Signer:', signerWallet.address);
    console.log('Expected Owner:', deployer.address);

    if (deployedSigner.toLowerCase() !== signerWallet.address.toLowerCase()) {
      throw new Error('Signer mismatch in deployed contract');
    }

    if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
      throw new Error('Owner mismatch in deployed contract');
    }

    // Save deployment info
    const deploymentInfo = {
      network: 'base-mainnet',
      chainId: BASE_CHAIN_ID,
      contractAddress,
      deploymentTx: deploymentTx.hash,
      deployer: deployer.address,
      signer: signerWallet.address,
      deployedAt: new Date().toISOString(),
      abi
    };

    fs.writeFileSync('./deployment-info.json', JSON.stringify(deploymentInfo, null, 2));
    console.log('\n💾 Deployment info saved to deployment-info.json');

    console.log('\n📝 Next Steps:');
    console.log('1. Add to your .env file:');
    console.log(`   SPIN_REGISTRY_CONTRACT=${contractAddress}`);
    console.log('2. Run the database migration:');
    console.log('   psql -f database/migrations/add_spin_tracking.sql');
    console.log('3. Test the /api/spin-permit endpoint');
    console.log('4. Integrate frontend wallet connection');

    return {
      contractAddress,
      abi,
      deploymentTx: deploymentTx.hash
    };

  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

// Run deployment if called directly
if (require.main === module) {
  deploySpinRegistry();
}

module.exports = { deploySpinRegistry };
