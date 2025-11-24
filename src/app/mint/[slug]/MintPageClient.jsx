'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFarcaster } from '@/lib/useFarcaster';
import { shareToFarcaster } from '@/lib/farcasterShare';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
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

  // Wagmi hooks for NFT minting
  const { 
    writeContract: writeMintContract, 
    data: mintTxHash, 
    isPending: isMintTxPending,
    error: mintWriteError 
  } = useWriteContract();
  const { 
    isLoading: isMintConfirming, 
    isSuccess: isMintConfirmed 
  } = useWaitForTransactionReceipt({
    hash: mintTxHash,
  });

  // Wagmi hooks for token claiming (like Ambassador program)
  const { 
    writeContract: writeClaimContract, 
    data: claimTxHash, 
    isPending: isClaimTxPending,
    error: claimWriteError 
  } = useWriteContract();
  const { 
    isLoading: isClaimConfirming, 
    isSuccess: isClaimConfirmed 
  } = useWaitForTransactionReceipt({
    hash: claimTxHash,
  });

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

  // Watch for mint transaction confirmation
  useEffect(() => {
    if (isMintConfirmed && mintTxHash) {
      console.log('✅ NFT mint confirmed! TX:', mintTxHash);
      
      // Record mint in backend
      const recordMint = async () => {
        try {
          const { sdk } = await import('@/lib/frame');
          const accounts = await sdk.wallet.ethProvider.request({
            method: 'eth_requestAccounts'
          });
          const walletAddress = accounts[0];

          console.log('💾 Recording mint in database...');
          const response = await fetch(`/api/nft-mints/${slug}/mint`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${sessionToken}`
            },
            body: JSON.stringify({
              transactionHash: mintTxHash,
              walletAddress,
              tokenId: campaign.tokenId || '0'
            })
          });

          if (response.ok) {
            const data = await response.json();
            console.log('✅ Mint recorded:', data);
            
            // Update state
            setClaimId(data.claim.id); // Fix: API returns data.claim.id, not data.claimId
            setUserStatus(prev => ({ ...prev, hasMinted: true, canMint: false }));
            setShowShareModal(true);
          } else {
            console.error('⚠️  Failed to record mint');
          }
        } catch (err) {
          console.error('❌ Error recording mint:', err);
        } finally {
          setIsMinting(false);
        }
      };

      recordMint();
    }
  }, [isMintConfirmed, mintTxHash]);

  // Watch for Wagmi errors
  useEffect(() => {
    if (claimWriteError) {
      console.error('❌ Wagmi claim error:', claimWriteError);
      setClaimError(claimWriteError.message || 'Transaction failed');
    }
  }, [claimWriteError]);

  useEffect(() => {
    if (mintWriteError) {
      console.error('❌ Wagmi mint error:', mintWriteError);
      setMintError(mintWriteError.message || 'Transaction failed');
      setIsMinting(false);
    }
  }, [mintWriteError]);

  // Watch for claim transaction confirmation
  useEffect(() => {
    if (isClaimConfirmed && claimTxHash) {
      console.log('✅ Token claim confirmed! TX:', claimTxHash);
      
      // Mark as claimed in backend
      const markClaimed = async () => {
        try {
          console.log('💾 Marking claim as complete in database...');
          const response = await fetch(`/api/nft-mints/claims/${claimId}/mark-claimed`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${sessionToken}`
            },
            body: JSON.stringify({
              transactionHash: claimTxHash
            })
          });

          if (response.ok) {
            console.log('✅ Claim marked as complete!');
            setHasClaimed(true);
            setShowStakingTeaser(true);
          } else {
            console.error('⚠️  Failed to mark claim as complete');
          }
        } catch (err) {
          console.error('❌ Error marking claim:', err);
        }
      };

      markClaimed();
    }
  }, [isClaimConfirmed, claimTxHash]);

  // Handle NFT mint using Wagmi (like Ambassador program)
  const handleMint = async () => {
    console.log('🎨 Mint button clicked');
    
    if (!farcasterUser || !sessionToken) {
      setMintError('Please sign in to mint');
      return;
    }

    if (!campaign) {
      setMintError('Campaign data not loaded');
      return;
    }

    try {
      setIsMinting(true);
      setMintError(null);

      console.log('🎨 Starting mint process...');
      console.log('📋 Contract:', campaign.contractAddress);
      console.log('🎫 Token ID:', campaign.tokenId || 0);

      // Get wallet address
      const { sdk } = await import('@/lib/frame');
      const accounts = await sdk.wallet.ethProvider.request({
        method: 'eth_requestAccounts'
      });
      
      if (!accounts || !accounts[0]) {
        throw new Error('No wallet connected');
      }

      const walletAddress = accounts[0];
      console.log('💳 Wallet address:', walletAddress);

      // ERC1155 claim ABI (Thirdweb Edition Drop contract)
      const erc1155ClaimABI = [
        {
          name: 'claim',
          type: 'function',
          inputs: [
            { name: 'receiver', type: 'address' },
            { name: 'tokenId', type: 'uint256' },
            { name: 'quantity', type: 'uint256' },
            { name: 'currency', type: 'address' },
            { name: 'pricePerToken', type: 'uint256' },
            { name: 'allowlistProof', type: 'tuple', components: [
              { name: 'proof', type: 'bytes32[]' },
              { name: 'quantityLimitPerWallet', type: 'uint256' },
              { name: 'pricePerToken', type: 'uint256' },
              { name: 'currency', type: 'address' }
            ]},
            { name: 'data', type: 'bytes' }
          ],
          outputs: []
        }
      ];

      // Call Wagmi writeContract (triggers wallet approval)
      console.log('📤 Calling writeContract...');
      writeMintContract({
        address: campaign.contractAddress,
        abi: erc1155ClaimABI,
        functionName: 'claim',
        args: [
          walletAddress, // receiver
          BigInt(campaign.tokenId || 0), // tokenId
          BigInt(1), // quantity
          '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // currency (native token placeholder)
          BigInt(0), // pricePerToken (free)
          { // allowlistProof (empty for public claim)
            proof: [],
            quantityLimitPerWallet: BigInt(0),
            pricePerToken: BigInt(0),
            currency: '0x0000000000000000000000000000000000000000'
          },
          '0x' // data (empty)
        ]
      });

      console.log('✅ Mint transaction sent - waiting for user approval...');
      // Transaction will be handled by useEffect watching isMintConfirmed

    } catch (err) {
      console.error('❌ Mint error:', err);
      setMintError(err.message || 'Failed to mint NFT');
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

  // Handle token claim using Wagmi (same as Ambassador program)
  const handleClaim = async () => {
    console.log('💰 Claim button clicked!');
    
    if (!claimId || !sessionToken) {
      setClaimError('Missing claim data. Please refresh and try again.');
      return;
    }

    try {
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

      // Convert to BigInt (same as Ambassador program)
      const reqWithBigInt = {
        uid: claimData.req.uid,
        tokenAddress: claimData.req.tokenAddress,
        expirationTimestamp: BigInt(claimData.req.expirationTimestamp),
        contents: claimData.req.contents.map(content => ({
          recipient: content.recipient,
          amount: BigInt(content.amount)
        }))
      };

      console.log('📝 Prepared claim request');

      // Airdrop contract ABI (same as Ambassador program)
      const airdropABI = [
        {
          name: 'airdropERC20WithSignature',
          type: 'function',
          inputs: [
            {
              name: 'req',
              type: 'tuple',
              components: [
                { name: 'uid', type: 'bytes32' },
                { name: 'tokenAddress', type: 'address' },
                { name: 'expirationTimestamp', type: 'uint256' },
                {
                  name: 'contents',
                  type: 'tuple[]',
                  components: [
                    { name: 'recipient', type: 'address' },
                    { name: 'amount', type: 'uint256' }
                  ]
                }
              ]
            },
            { name: 'signature', type: 'bytes' }
          ],
          outputs: []
        }
      ];

      // Call Wagmi writeContract (triggers wallet approval)
      console.log('📤 Calling writeContract...');
      writeClaimContract({
        address: claimData.contractAddress,
        abi: airdropABI,
        functionName: 'airdropERC20WithSignature',
        args: [reqWithBigInt, claimData.signature]
      });

      console.log('✅ Claim transaction sent - waiting for user approval...');
      // Transaction will be handled by useEffect watching isClaimConfirmed

    } catch (err) {
      console.error('❌ Claim error:', err);
      setClaimError(err.message || 'Failed to claim tokens');
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

  // Calculate if user can mint (include Wagmi transaction states)
  const isMintingProcess = isMinting || isMintTxPending || isMintConfirming;
  const canMint = (userStatus?.canMint !== false) && !isMintingProcess;
  
  // Calculate if user is claiming (include Wagmi transaction states)
  const isClaimingProcess = isClaimTxPending || isClaimConfirming;

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
              {isMintConfirming ? 'Confirming...' : isMintTxPending ? 'Approve in wallet...' : isMinting ? 'Preparing...' : canMint ? 'Claim FREE Mint 📟' : '❌ Mint Unavailable'}
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
              disabled={isClaimingProcess}
              className="w-full py-4 bg-[#3eb489] hover:bg-[#359970] text-white rounded-xl text-xl font-bold disabled:bg-gray-600 disabled:cursor-not-allowed transition-all"
            >
              {isClaimConfirming ? 'Confirming...' : isClaimTxPending ? 'Approve in wallet...' : 'Claim $mintedmerch'}
            </button>

            {claimError && (
              <div className="p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200">
                {claimError}
              </div>
            )}
          </>
        )}

        {/* STATE 4: Claimed - Show Success + Engagement CTAs */}
        {hasClaimed && showStakingTeaser && (
          <div className="space-y-3">
            {/* Success Header - Extra Compact */}
            <div className="text-center space-y-0.5 py-1">
              <div className="inline-flex items-center justify-center w-10 h-10 bg-gradient-to-br from-[#3eb489] to-emerald-600 rounded-full mb-1 shadow-lg shadow-[#3eb489]/50">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-black">You're In! 🎉</h2>
              <p className="text-xs text-gray-400">Welcome to Minted Merch!</p>
            </div>

            {/* Claims Card - Extra Compact */}
            <div className="p-3 bg-gradient-to-br from-[#3eb489]/20 via-emerald-900/20 to-[#3eb489]/10 border-2 border-[#3eb489] rounded-xl text-center relative overflow-hidden">
              {/* Animated background effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer"></div>
              
              <div className="relative z-10">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">You Claimed</p>
                <p className="text-xl font-black text-[#3eb489] mb-0.5">100,000 $MINTEDMERCH</p>
                <p className="text-xs font-semibold text-white">& 1x WEN BEEPER MERCH NFT</p>
              </div>
            </div>

            {/* What Can I Do Now? Section */}
            <div className="pt-1">
              <h3 className="text-base font-bold text-center mb-2 text-gray-300">What Can I Do Now?</h3>
              
              {/* Daily Spin Info */}
              <div className="p-2.5 bg-gradient-to-br from-blue-900/30 to-cyan-900/30 border border-blue-500/50 rounded-lg mb-2">
                <div className="text-center mb-1">
                  <p className="font-bold text-blue-400 text-xs">🎰 SPIN THE WHEEL DAILY</p>
                </div>
                <p className="text-[10px] text-gray-300 leading-snug text-center">
                  Earn points & move up the leaderboard to be entered into random raffles for $MINTEDMERCH, gift cards, and FREE merch! Earn extra points for purchases with multipliers for $MINTEDMERCH holdings.
                </p>
              </div>

              {/* Stake to Earn Message */}
              <div className="p-2.5 bg-gradient-to-br from-purple-900/30 to-pink-900/30 border border-purple-500/50 rounded-lg">
                <div className="text-center mb-1">
                  <p className="font-bold text-purple-400 text-xs">💎 STAKE TO EARN</p>
                </div>
                <p className="text-[10px] text-gray-300 leading-snug text-center">
                  Staking launches SOON! Hold 50M+ tokens to become a <span className="text-[#3eb489] font-semibold">Merch Mogul</span> & unlock exclusive perks, discounts, and access to the group chat.
                </p>
              </div>
            </div>

            {/* Daily Spin CTA */}
            <button
              onClick={() => router.push('/')}
              className="w-full py-3 bg-gradient-to-br from-purple-600 to-purple-700 text-white rounded-xl text-base font-bold hover:bg-purple-600 hover:scale-105 transition-all shadow-lg"
            >
              Spin Daily Wheel
            </button>

            {/* Start Shopping CTA */}
            <button
              onClick={() => router.push('/')}
              className="w-full py-3 bg-[#3eb489] text-white rounded-xl text-base font-bold hover:bg-[#35a078] hover:scale-105 transition-all shadow-lg shadow-[#3eb489]/20"
            >
              Start Shopping
            </button>
          </div>
        )}
      </div>


      {/* Share Modal (Displayed as overlay when showShareModal is true) */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50" style={{ pointerEvents: 'auto' }}>
          <div className="bg-black border border-gray-800 rounded-2xl p-8 max-w-md w-full space-y-6">
            <div className="text-center space-y-2">
              <div className="text-5xl">🎉</div>
              <h3 className="text-2xl font-bold">You Minted!</h3>
              <p className="text-gray-300">Share to unlock $mintedmerch</p>
            </div>

            <button
              onClick={(e) => {
                console.log('🖱️ Share button CLICKED!', { isSharing, claimId, sessionToken: !!sessionToken });
                e.preventDefault();
                e.stopPropagation();
                handleShare();
              }}
              disabled={isSharing}
              style={{ pointerEvents: isSharing ? 'none' : 'auto' }}
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

