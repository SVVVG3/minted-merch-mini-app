'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFarcaster } from '@/lib/useFarcaster';
import { shareToFarcaster } from '@/lib/farcasterShare';
import Image from 'next/image';

/**
 * MintPageClient - Main UI for NFT Mint Campaign
 * 
 * User Flow:
 * 1. Load campaign data + auto-register user
 * 2. Mint NFT (WalletConnect)
 * 3. MANDATORY share to Farcaster
 * 4. Claim tokens (after share)
 * 5. Show staking teaser + CTA to shop
 */
export default function MintPageClient({ slug }) {
  const router = useRouter();
  const { user: farcasterUser, sessionToken, isInFarcaster, isReady } = useFarcaster();

  // Campaign data
  const [campaign, setCampaign] = useState(null);
  const [userStatus, setUserStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Mint state
  const [isMinting, setIsMinting] = useState(false);
  const [mintError, setMintError] = useState(null);
  const [claimId, setClaimId] = useState(null);

  // Share state
  const [showShareModal, setShowShareModal] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [hasShared, setHasShared] = useState(false);

  // Claim state
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimError, setClaimError] = useState(null);
  const [hasClaimed, setHasClaimed] = useState(false);

  // Staking teaser
  const [showStakingTeaser, setShowStakingTeaser] = useState(false);

  // Auto-register user on page load
  useEffect(() => {
    if (farcasterUser && sessionToken) {
      console.log('📝 Auto-registering user...');
      
      fetch('/api/register-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          fid: farcasterUser.fid,
          username: farcasterUser.username,
          displayName: farcasterUser.displayName || farcasterUser.username,
          bio: farcasterUser.bio || null,
          pfpUrl: farcasterUser.pfpUrl || null
        })
      })
        .then(res => res.json())
        .then(data => {
          console.log('✅ User registered/updated:', data);
        })
      .catch(err => {
        console.error('⚠️  Profile registration failed (non-blocking):', err);
      });
    }
  }, [farcasterUser, sessionToken]);

  // Fetch campaign data
  useEffect(() => {
    async function fetchCampaign() {
      try {
        setLoading(true);
        
        const headers = {};
        if (sessionToken) {
          headers['Authorization'] = `Bearer ${sessionToken}`;
        }

        const response = await fetch(`/api/nft-mints/${slug}`, { headers });
        
        if (!response.ok) {
          throw new Error('Campaign not found');
        }

        const data = await response.json();
        console.log('📋 Campaign data:', data);
        
        setCampaign(data.campaign);
        setUserStatus(data.userStatus);
        
        // Set initial state based on user status
        if (data.userStatus.claimId) {
          setClaimId(data.userStatus.claimId);
        }
        if (data.userStatus.hasShared) {
          setHasShared(true);
        }
        if (data.userStatus.hasClaimed) {
          setHasClaimed(true);
          setShowStakingTeaser(true);
        }
        
      } catch (err) {
        console.error('❌ Error fetching campaign:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (slug) {
      fetchCampaign();
    }
  }, [slug, sessionToken]);

  // Handle NFT mint
  const handleMint = async () => {
    console.log('🎨 Mint button clicked');
    console.log('👤 Farcaster User:', farcasterUser);
    console.log('🔑 Session Token:', sessionToken ? `${sessionToken.substring(0, 20)}...` : 'UNDEFINED');
    console.log('🔍 Is In Farcaster:', isInFarcaster);
    console.log('🔍 Is Ready:', isReady);
    
    if (!farcasterUser) {
      setMintError('Please sign in to mint - User not found');
      return;
    }
    
    if (!sessionToken) {
      setMintError('Session token not available. Please refresh the page and try again.');
      return;
    }

    try {
      setIsMinting(true);
      setMintError(null);

      console.log('🎨 Starting mint process...');

      // Get wallet address from Farcaster SDK
      const { sdk } = await import('@farcaster/miniapp-sdk');
      const accounts = await sdk.wallet.ethProvider.request({
        method: 'eth_requestAccounts'
      });
      
      if (!accounts || !accounts[0]) {
        throw new Error('No wallet connected');
      }

      const walletAddress = accounts[0];
      console.log('💳 Wallet address:', walletAddress);

      // 🎨 MINT NFT ON-CHAIN USING THIRDWEB
      console.log('🔗 Minting NFT on-chain...');
      console.log('📋 Contract:', campaign.contractAddress);
      console.log('🎫 Token ID:', campaign.tokenId);
      console.log('⛓️  Chain:', campaign.chainId || 8453); // Base mainnet

      // Import Thirdweb SDK components
      const { prepareContractCall, getContract, defineChain, encode } = await import('thirdweb');
      const { claimTo } = await import('thirdweb/extensions/erc1155');
      const { client } = await import('@/lib/thirdwebClient');

      try {
        // Define chain (Base mainnet = 8453)
        const chain = defineChain(campaign.chainId || 8453);

        // Get contract instance
        const contract = getContract({
          client,
          chain,
          address: campaign.contractAddress
        });

        // Prepare claim transaction for ERC1155
        console.log('📝 Preparing claim transaction...');
        console.log('   Token ID:', campaign.tokenId || 0);
        console.log('   Quantity:', 1);
        console.log('   Recipient:', walletAddress);
        
        const transaction = claimTo({
          contract,
          to: walletAddress,
          tokenId: BigInt(campaign.tokenId || 0),
          quantity: BigInt(1)
        });

        // Encode the transaction data
        const encodedData = await encode(transaction);

        // Send transaction using Farcaster wallet provider (like payment.js)
        console.log('📤 Sending transaction via Farcaster wallet...');
        const transactionHash = await sdk.wallet.ethProvider.request({
          method: 'eth_sendTransaction',
          params: [{
            from: walletAddress,
            to: campaign.contractAddress,
            data: encodedData,
            value: '0x0' // Free mint
          }]
        });

        console.log('✅ NFT minted! TX:', transactionHash);

        // Record mint in backend with real transaction hash
        console.log('💾 Recording mint in database...');
        const recordResponse = await fetch(`/api/nft-mints/${slug}/mint`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`
          },
          body: JSON.stringify({
            transactionHash,
            walletAddress,
            tokenId: campaign.tokenId || '0'
          })
        });

        if (!recordResponse.ok) {
          const errorData = await recordResponse.json();
          throw new Error(errorData.error || 'Failed to record mint');
        }

        const recordData = await recordResponse.json();
        console.log('✅ Mint recorded:', recordData);

        // Update state with claim ID and force userStatus update
        setClaimId(recordData.claimId);
        setUserStatus(prev => ({ ...prev, hasMinted: true, canMint: false }));
        setShowShareModal(true);

      } catch (mintError) {
        console.error('❌ Minting failed:', mintError);
        throw new Error(`Minting failed: ${mintError.message}`);
      }

    } catch (err) {
      console.error('❌ Mint error:', err);
      setMintError(err.message || 'Failed to mint NFT');
    } finally {
      setIsMinting(false);
    }
  };

  // Handle share to Farcaster
  const handleShare = async () => {
    console.log('🔘 Share button clicked!');
    console.log('   Claim ID:', claimId);
    console.log('   Session Token:', sessionToken ? 'Present' : 'Missing');
    console.log('   Campaign:', campaign?.slug);
    
    if (!claimId) {
      console.error('❌ No claim ID available');
      setMintError('Claim ID not found. Please refresh and try again.');
      return;
    }

    if (!sessionToken) {
      console.error('❌ No session token available');
      setMintError('Session token not found. Please refresh and try again.');
      return;
    }

    try {
      setIsSharing(true);
      setMintError(null);

      // Get share config from campaign metadata
      const shareText = campaign.metadata?.shareText || 
        `Just minted ${campaign.title}! 🎨\n\nMint yours and claim tokens 👇`;
      
      // Prepend mint page URL to show custom OG image
      const mintPageUrl = `${window.location.origin}/mint/${slug}`;
      const additionalEmbeds = campaign.metadata?.shareEmbeds || [];
      const shareEmbeds = [mintPageUrl, ...additionalEmbeds];

      console.log('📤 Sharing to Farcaster...');
      console.log('   Text:', shareText);
      console.log('   Embeds:', shareEmbeds);

      // Open Farcaster compose window
      const shareResult = await shareToFarcaster({
        text: shareText,
        embeds: shareEmbeds,
        isInFarcaster
      });

      console.log('🔍 Share result:', shareResult);

      if (shareResult) {
        console.log('✅ Share window opened');

        // Mark as shared in backend (unlocks claim button)
        const markSharedResponse = await fetch(`/api/nft-mints/claims/${claimId}/mark-shared`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`
          },
          body: JSON.stringify({})
        });

        if (markSharedResponse.ok) {
          console.log('✅ Marked as shared');
          setHasShared(true);
          setShowShareModal(false); // Close modal
        } else {
          const errorData = await markSharedResponse.json();
          console.error('❌ Failed to mark as shared:', errorData);
          setMintError(`Failed to mark share: ${errorData.error || 'Unknown error'}`);
        }
      } else {
        console.log('ℹ️ Share window not opened (user may have cancelled)');
      }

    } catch (err) {
      console.error('❌ Share error:', err);
      setMintError(`Share failed: ${err.message}`);
    } finally {
      setIsSharing(false);
    }
  };

  // Handle token claim
  const handleClaim = async () => {
    console.log('💰 Claim button clicked!');
    console.log('   Claim ID:', claimId);
    console.log('   Session Token:', sessionToken ? 'Present' : 'Missing');
    
    if (!claimId || !sessionToken) {
      console.error('❌ Missing claim ID or session token');
      setClaimError('Missing claim data. Please refresh and try again.');
      return;
    }

    try {
      setIsClaiming(true);
      setClaimError(null);

      console.log('📡 Fetching claim data from API...');

      // Get claim signature and params from backend
      const claimDataResponse = await fetch(`/api/nft-mints/claims/${claimId}/claim-data`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });

      if (!claimDataResponse.ok) {
        const errorData = await claimDataResponse.json();
        throw new Error(errorData.error || 'Failed to fetch claim data');
      }

      const { claimData } = await claimDataResponse.json();
      console.log('✅ Claim data received:', claimData);

      // Import Farcaster SDK
      const { sdk } = await import('@/lib/frame');

      // Get wallet address
      const accounts = await sdk.wallet.ethProvider.request({
        method: 'eth_requestAccounts'
      });
      
      if (!accounts || !accounts[0]) {
        throw new Error('No wallet connected');
      }

      const walletAddress = accounts[0];
      console.log('💳 Wallet address:', walletAddress);

      // 💰 CLAIM TOKENS ON-CHAIN USING THIRDWEB AIRDROP CONTRACT
      console.log('🔗 Claiming tokens on-chain...');
      console.log('📋 Contract:', claimData.contractAddress);
      console.log('💎 Amount:', claimData.req.contents[0].amount);
      console.log('🔍 Claim request:', claimData.req);

      // Prepare airdrop contract call data
      // Function: airdropERC20WithSignature(AirdropRequest req, bytes signature)
      const { Interface, getAddress } = await import('ethers');
      
      const airdropABI = [
        'function airdropERC20WithSignature((bytes32 uid, address tokenAddress, uint256 expirationTimestamp, (address recipient, uint256 amount)[] contents) req, bytes signature)'
      ];
      
      const iface = new Interface(airdropABI);
      
      // Normalize addresses to proper checksum format (ethers is strict about this)
      const normalizedReq = {
        uid: claimData.req.uid,
        tokenAddress: getAddress(claimData.req.tokenAddress), // Proper checksum
        expirationTimestamp: claimData.req.expirationTimestamp,
        contents: claimData.req.contents.map(item => ({
          recipient: getAddress(item.recipient), // Proper checksum
          amount: item.amount
        }))
      };
      
      console.log('📝 Normalized request:', normalizedReq);
      
      // Encode the function call
      const encodedData = iface.encodeFunctionData('airdropERC20WithSignature', [
        normalizedReq,
        claimData.signature
      ]);

      console.log('📝 Encoded transaction data');

      // Send transaction using Farcaster wallet provider (like NFT minting)
      console.log('📤 Sending transaction via Farcaster wallet...');
      const transactionHash = await sdk.wallet.ethProvider.request({
        method: 'eth_sendTransaction',
        params: [{
          from: walletAddress,
          to: claimData.contractAddress,
          data: encodedData,
          value: '0x0' // No ETH value needed
        }]
      });

      console.log('✅ Tokens claimed! TX:', transactionHash);

      // Mark as claimed in backend
      console.log('💾 Marking claim as complete in database...');
      const markClaimedResponse = await fetch(`/api/nft-mints/claims/${claimId}/mark-claimed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          transactionHash
        })
      });

      if (!markClaimedResponse.ok) {
        const errorData = await markClaimedResponse.json();
        console.error('⚠️  Failed to mark as claimed:', errorData);
        // Still show success since the on-chain claim worked
      }

      console.log('✅ Claim complete!');
      setHasClaimed(true);
      setShowStakingTeaser(true);

    } catch (err) {
      console.error('❌ Claim error:', err);
      setClaimError(err.message || 'Failed to claim tokens');
    } finally {
      setIsClaiming(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading campaign...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !campaign) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-500 text-xl mb-4">❌ {error || 'Campaign not found'}</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-white text-black rounded-lg hover:bg-gray-200"
          >
            Back to Shop
          </button>
        </div>
      </div>
    );
  }

  // Calculate if user can mint
  // Default to true if userStatus hasn't loaded yet, or use the API value
  const canMint = (userStatus?.canMint !== false) && !isMinting;

  return (
    <div className="min-h-screen bg-black text-white px-4 py-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-2 text-center">
        <button
          onClick={() => router.push('/')}
          className="text-gray-400 hover:text-white inline-block"
        >
          ← Back to Shop
        </button>
      </div>

      {/* Header Image */}
      <div className="mb-2 relative h-24 rounded-xl overflow-hidden">
        <Image
          src="/BeeperXmintedmerch.png"
          alt="Beeper x Minted Merch"
          fill
          className="object-contain"
          priority
        />
      </div>

      {/* NFT Image */}
      <div className="mb-8 relative aspect-square rounded-2xl overflow-hidden bg-gray-900">
        <Image
          src={campaign.imageUrl}
          alt={campaign.title}
          fill
          className="object-cover"
          priority
        />
      </div>

      {/* Campaign Info */}
      <div className="mb-8 space-y-4">
        <h1 className="text-3xl font-bold text-center">{campaign.title}</h1>
        <p className="text-gray-300 text-lg">{campaign.description}</p>
      </div>

      {/* About Minted Merch Section - Moved above mint button */}
      <div className="border border-gray-800 rounded-xl p-6 mb-8 space-y-4">
        {/* Spinner Logo */}
        <div className="flex justify-center">
          <Image
            src="/MintedMerchSpinnerLogo.png"
            alt="Minted Merch"
            width={240}
            height={240}
            className="object-contain"
          />
        </div>
        
        <div className="space-y-3 text-gray-300 text-center">
          <p className="text-lg font-bold text-white">Where Tokens Meet Merch</p>
          
          <div className="space-y-2 text-left">
            <div className="flex items-start gap-2">
              <span className="text-sm">✅</span>
              <span className="text-sm">Exclusive collabs & drops</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-sm">✅</span>
              <span className="text-sm">Shop with 1200+ coins across 20+ chains</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-sm">✅</span>
              <span className="text-sm">Daily spins w/ leaderboard & raffles</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-sm">✅</span>
              <span className="text-sm">Win $mintedmerch, gift cards, & merch</span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-gray-900 rounded-lg space-y-2">
          <h3 className="text-lg font-bold text-center">Become a Merch Mogul 🤌</h3>
          <ul className="text-sm text-gray-400 space-y-1 ml-4">
            <li>• Exclusive Collab Partner Access</li>
            <li>• Custom Merch Orders</li>
            <li>• Group Chat Access</li>
            <li>• 15% off store wide</li>
            <li>• Ambassador Program</li>
          </ul>
        </div>
      </div>

      {/* Main Action Section */}
      <div className="space-y-4 mb-12">
        {/* STATE 1: Not Minted - Show Mint Button */}
        {!userStatus?.hasMinted && (
          <>
            <button
              onClick={handleMint}
              disabled={!canMint}
              className={`w-full py-4 rounded-xl text-xl font-bold transition-all ${
                canMint
                  ? 'bg-white text-black hover:bg-gray-200 hover:scale-105'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isMinting ? 'Minting...' : canMint ? 'Mint' : '❌ Mint Unavailable'}
            </button>
            
            {mintError && (
              <div className="p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200">
                {mintError}
              </div>
            )}

            {!canMint && campaign.maxSupply && campaign.totalMints >= campaign.maxSupply && (
              <p className="text-center text-gray-400">
                Maximum supply reached ({campaign.maxSupply} mints)
              </p>
            )}
          </>
        )}

        {/* STATE 2: Minted but not shared - Show Share Button (REQUIRED) */}
        {userStatus?.hasMinted && !hasShared && !showShareModal && (
          <div className="p-6 bg-gradient-to-r from-purple-900/50 to-blue-900/50 border border-purple-500 rounded-xl space-y-4">
            <div className="text-center space-y-2">
              <div className="text-4xl">🎉</div>
              <h3 className="text-2xl font-bold">NFT Minted!</h3>
              <p className="text-gray-300">Share your mint to claim $mintedmerch</p>
            </div>
            
            <button
              onClick={handleShare}
              disabled={isSharing}
              className="w-full py-4 bg-[#6A3CFF] text-white rounded-xl font-bold hover:bg-[#5A2FE6] disabled:bg-gray-600 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3"
            >
              {isSharing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Opening Share...
                </>
              ) : (
                <>
                  {/* Official Farcaster Logo (2024 rebrand) */}
                  <svg className="w-5 h-5" viewBox="0 0 520 457" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M519.801 0V61.6809H458.172V123.31H477.054V123.331H519.801V456.795H416.57L416.507 456.49L363.832 207.03C358.81 183.251 345.667 161.736 326.827 146.434C307.988 131.133 284.255 122.71 260.006 122.71H259.8C235.551 122.71 211.818 131.133 192.979 146.434C174.139 161.736 160.996 183.259 155.974 207.03L103.239 456.795H0V123.323H42.7471V123.31H61.6262V61.6809H0V0H519.801Z" fill="currentColor"/>
                  </svg>
                  Share to Farcaster (Required)
                </>
              )}
            </button>
          </div>
        )}

        {/* STATE 3: Shared but not claimed - Show Claim Button */}
        {userStatus?.hasMinted && hasShared && !hasClaimed && (
          <>
            <button
              onClick={handleClaim}
              disabled={isClaiming}
              className="w-full py-4 bg-[#3eb489] hover:bg-[#359970] text-white rounded-xl text-xl font-bold disabled:bg-gray-600 disabled:cursor-not-allowed transition-all"
            >
              {isClaiming ? 'Claiming...' : 'Claim $mintedmerch'}
            </button>

            {claimError && (
              <div className="p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200">
                {claimError}
              </div>
            )}
          </>
        )}

        {/* STATE 4: Claimed - Show Staking Teaser + Shop CTA */}
        {hasClaimed && showStakingTeaser && (
          <div className="space-y-4">
            {/* Success Message */}
            <div className="p-6 bg-gradient-to-r from-green-900/50 to-emerald-900/50 border border-green-500 rounded-xl text-center space-y-2">
              <div className="text-4xl">✅</div>
              <h3 className="text-2xl font-bold">Tokens Claimed!</h3>
              <p className="text-lg">You received 100,000 $MINTEDMERCH</p>
            </div>

            {/* Staking Teaser */}
            <div className="p-6 bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/50 rounded-xl space-y-3">
              <div className="text-3xl text-center">💎</div>
              <h4 className="text-xl font-bold text-center">Hold These Tokens!</h4>
              <p className="text-center text-gray-300">
                <strong>STAKING coming soon!</strong><br />
                Earn rewards by holding your $MINTEDMERCH
              </p>
            </div>

            {/* Start Shopping CTA */}
            <button
              onClick={() => router.push('/')}
              className="w-full py-4 bg-white text-black rounded-xl text-xl font-bold hover:bg-gray-200 hover:scale-105 transition-all"
            >
              🛍️ Start Shopping
            </button>
          </div>
        )}
      </div>


      {/* Share Modal (Displayed as overlay when showShareModal is true) */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50">
          <div className="bg-black border border-gray-800 rounded-2xl p-8 max-w-md w-full space-y-6">
            <div className="text-center space-y-2">
              <div className="text-5xl">🎉</div>
              <h3 className="text-2xl font-bold">You Minted!</h3>
              <p className="text-gray-300">Share to unlock $mintedmerch</p>
            </div>

            <button
              onClick={handleShare}
              disabled={isSharing}
              className="w-full py-4 bg-[#6A3CFF] text-white rounded-xl font-bold hover:bg-[#5A2FE6] disabled:bg-gray-600 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3"
            >
              {isSharing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Opening Share...
                </>
              ) : (
                <>
                  {/* Official Farcaster Logo (2024 rebrand) */}
                  <svg className="w-5 h-5" viewBox="0 0 520 457" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M519.801 0V61.6809H458.172V123.31H477.054V123.331H519.801V456.795H416.57L416.507 456.49L363.832 207.03C358.81 183.251 345.667 161.736 326.827 146.434C307.988 131.133 284.255 122.71 260.006 122.71H259.8C235.551 122.71 211.818 131.133 192.979 146.434C174.139 161.736 160.996 183.259 155.974 207.03L103.239 456.795H0V123.323H42.7471V123.31H61.6262V61.6809H0V0H519.801Z" fill="currentColor"/>
                  </svg>
                  Share to Farcaster
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

