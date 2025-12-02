'use client';

import { useState, useEffect } from 'react';
import { useFarcaster } from '@/lib/useFarcaster';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { triggerHaptic } from '@/lib/haptics';
import { shareToFarcaster } from '@/lib/farcasterShare';
import Image from 'next/image';

/**
 * StakingLaunchMint - Embedded NFT mint for staking launch celebration
 * 
 * Flow: Mint NFT → Share to Farcaster → Claim $mintedmerch
 * Uses existing nft-mints API infrastructure with slug: 'staking-launch'
 */

const CAMPAIGN_SLUG = 'staking-launch';

export function StakingLaunchMint() {
  const { user: farcasterUser, sessionToken, isInFarcaster, isReady } = useFarcaster();
  
  // Wagmi hooks for NFT minting
  const {
    writeContract: writeMintContract,
    data: mintTxHash,
    isPending: isMintTxPending,
    error: mintWriteError,
  } = useWriteContract();
  const { isLoading: isMintConfirming, isSuccess: isMintConfirmed } = useWaitForTransactionReceipt({
    hash: mintTxHash,
  });

  // Wagmi hooks for token claiming
  const {
    writeContract: writeClaimContract,
    data: claimTxHash,
    isPending: isClaimTxPending,
    error: claimWriteError,
  } = useWriteContract();
  const { isLoading: isClaimConfirming, isSuccess: isClaimConfirmed } = useWaitForTransactionReceipt({
    hash: claimTxHash,
  });

  // State
  const [campaign, setCampaign] = useState(null);
  const [userStatus, setUserStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [isMinting, setIsMinting] = useState(false);
  const [mintError, setMintError] = useState(null);
  const [claimId, setClaimId] = useState(null);
  
  const [isSharing, setIsSharing] = useState(false);
  const [hasShared, setHasShared] = useState(false);
  
  const [claimError, setClaimError] = useState(null);
  const [hasClaimed, setHasClaimed] = useState(false);

  // Fetch campaign data on load
  useEffect(() => {
    async function fetchCampaign() {
      if (!isReady) return;
      
      try {
        setLoading(true);
        
        const headers = {};
        if (sessionToken) {
          headers['Authorization'] = `Bearer ${sessionToken}`;
        }

        const response = await fetch(`/api/nft-mints/${CAMPAIGN_SLUG}`, { headers });
        
        if (!response.ok) {
          if (response.status === 404) {
            // Campaign not set up yet - show nothing
            setCampaign(null);
            setLoading(false);
            return;
          }
          throw new Error('Failed to load campaign');
        }

        const data = await response.json();
        setCampaign(data.campaign);
        setUserStatus(data.userStatus);
        
        if (data.userStatus.claimId) {
          setClaimId(data.userStatus.claimId);
        }
        if (data.userStatus.hasShared) {
          setHasShared(true);
        }
        if (data.userStatus.hasClaimed) {
          setHasClaimed(true);
        }
      } catch (err) {
        console.error('Error fetching staking launch campaign:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchCampaign();
  }, [isReady, sessionToken]);

  // Watch for mint confirmation
  useEffect(() => {
    if (isMintConfirmed && mintTxHash) {
      const recordMint = async () => {
        try {
          const { sdk } = await import('@/lib/frame');
          const accounts = await sdk.wallet.ethProvider.request({ method: 'eth_requestAccounts' });
          const walletAddress = accounts[0];

          const response = await fetch(`/api/nft-mints/${CAMPAIGN_SLUG}/mint`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${sessionToken}`,
            },
            body: JSON.stringify({
              transactionHash: mintTxHash,
              walletAddress,
              tokenId: campaign?.tokenId || '0',
            }),
          });

          if (response.ok) {
            const data = await response.json();
            setClaimId(data.claim.id);
            // Reset flow states for this new mint cycle
            setHasShared(false);
            setHasClaimed(false);
            // Update user status - increment count, check if can still mint more
            setUserStatus(prev => {
              const newCount = (prev?.mintCount || 0) + 1;
              const limit = prev?.mintLimit;
              const isUnlimited = !limit || limit === 0;
              return { 
                ...prev, 
                hasMinted: true, 
                mintCount: newCount,
                canMint: isUnlimited || newCount < limit
              };
            });
          }
        } catch (err) {
          console.error('Error recording mint:', err);
        } finally {
          setIsMinting(false);
        }
      };

      recordMint();
    }
  }, [isMintConfirmed, mintTxHash, sessionToken, campaign]);

  // Watch for claim confirmation
  useEffect(() => {
    if (isClaimConfirmed && claimTxHash) {
      const markClaimed = async () => {
        try {
          await fetch(`/api/nft-mints/claims/${claimId}/mark-claimed`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${sessionToken}`,
            },
            body: JSON.stringify({ transactionHash: claimTxHash }),
          });
          setHasClaimed(true);
          
          // Re-fetch campaign to get updated canMint status
          const headers = {};
          if (sessionToken) {
            headers['Authorization'] = `Bearer ${sessionToken}`;
          }
          const refreshResponse = await fetch(`/api/nft-mints/${CAMPAIGN_SLUG}`, { headers });
          if (refreshResponse.ok) {
            const refreshData = await refreshResponse.json();
            setUserStatus(refreshData.userStatus);
          }
        } catch (err) {
          console.error('Error marking claimed:', err);
        }
      };

      markClaimed();
    }
  }, [isClaimConfirmed, claimTxHash, claimId, sessionToken]);

  // Watch for Wagmi errors
  useEffect(() => {
    if (mintWriteError) {
      setMintError(mintWriteError.message || 'Transaction failed');
      setIsMinting(false);
    }
  }, [mintWriteError]);

  useEffect(() => {
    if (claimWriteError) {
      setClaimError(claimWriteError.message || 'Transaction failed');
    }
  }, [claimWriteError]);

  // Handle mint
  const handleMint = async () => {
    triggerHaptic('medium', isInFarcaster);
    
    if (!farcasterUser || !sessionToken) {
      setMintError('Please sign in to mint');
      return;
    }

    try {
      setIsMinting(true);
      setMintError(null);

      const { sdk } = await import('@/lib/frame');
      const accounts = await sdk.wallet.ethProvider.request({ method: 'eth_requestAccounts' });
      
      if (!accounts || !accounts[0]) {
        throw new Error('No wallet connected');
      }

      const walletAddress = accounts[0];

      // Get claim params from backend
      const proofResponse = await fetch(`/api/nft-mints/${CAMPAIGN_SLUG}/get-proof`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          walletAddress,
          tokenId: campaign?.tokenId || 0,
        }),
      });

      if (!proofResponse.ok) {
        const errorData = await proofResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'You are not eligible to mint this NFT');
      }

      const { pricePerToken, currency, allowlistProof } = await proofResponse.json();

      // ERC1155 claim ABI
      const erc1155ClaimABI = [{
        name: 'claim',
        type: 'function',
        inputs: [
          { name: 'receiver', type: 'address' },
          { name: 'tokenId', type: 'uint256' },
          { name: 'quantity', type: 'uint256' },
          { name: 'currency', type: 'address' },
          { name: 'pricePerToken', type: 'uint256' },
          {
            name: 'allowlistProof',
            type: 'tuple',
            components: [
              { name: 'proof', type: 'bytes32[]' },
              { name: 'quantityLimitPerWallet', type: 'uint256' },
              { name: 'pricePerToken', type: 'uint256' },
              { name: 'currency', type: 'address' },
            ],
          },
          { name: 'data', type: 'bytes' },
        ],
        outputs: [],
      }];

      const allowlistProofTuple = {
        proof: allowlistProof.proof,
        quantityLimitPerWallet: BigInt(allowlistProof.quantityLimitPerWallet),
        pricePerToken: BigInt(allowlistProof.pricePerToken),
        currency: allowlistProof.currency,
      };

      writeMintContract({
        address: campaign.contractAddress,
        abi: erc1155ClaimABI,
        functionName: 'claim',
        args: [
          walletAddress,
          BigInt(campaign?.tokenId || 0),
          BigInt(1),
          currency,
          BigInt(pricePerToken),
          allowlistProofTuple,
          '0x',
        ],
        value: BigInt(pricePerToken), // For paid mint
      });

    } catch (err) {
      console.error('Mint error:', err);
      let errorMessage = err.message || 'Failed to mint NFT';
      if (err.message?.includes('User rejected')) {
        errorMessage = 'Transaction cancelled';
      }
      setMintError(errorMessage);
      setIsMinting(false);
    }
  };

  // Handle share
  const handleShare = async () => {
    triggerHaptic('medium', isInFarcaster);
    
    if (!claimId || !sessionToken) {
      setMintError('Missing claim data');
      return;
    }

    try {
      setIsSharing(true);
      setMintError(null);

      const shareText = campaign?.metadata?.shareText || 
        `Just minted this commemorative NFT to celebrate the launch of $mintedmerch staking!\n\nEarn rewards & win prizes! Stake 50M+ to unlock exclusive collab partnerships, the ability to place custom orders, group chat access, and 15% off store wide.\n\nMint yours and claim 100K tokens! 👇`;
      const sharePageUrl = `${window.location.origin}/share/${CAMPAIGN_SLUG}`;

      const shareResult = await shareToFarcaster({
        text: shareText,
        embeds: [sharePageUrl],
        isInFarcaster,
      });

      if (shareResult) {
        // Mark as shared in backend
        const markSharedResponse = await fetch(`/api/nft-mints/claims/${claimId}/mark-shared`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({}),
        });

        if (markSharedResponse.ok) {
          setHasShared(true);
        }
      }
    } catch (err) {
      console.error('Share error:', err);
      setMintError(`Share failed: ${err.message}`);
    } finally {
      setIsSharing(false);
    }
  };

  // Handle claim
  const handleClaim = async () => {
    triggerHaptic('medium', isInFarcaster);
    
    if (!claimId || !sessionToken) {
      setClaimError('Missing claim data');
      return;
    }

    try {
      setClaimError(null);

      const claimDataResponse = await fetch(`/api/nft-mints/claims/${claimId}/claim-data`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` },
      });

      if (!claimDataResponse.ok) {
        const errorData = await claimDataResponse.json();
        throw new Error(errorData.error || 'Failed to fetch claim data');
      }

      const { claimData } = await claimDataResponse.json();

      const reqWithBigInt = {
        uid: claimData.req.uid,
        tokenAddress: claimData.req.tokenAddress,
        expirationTimestamp: BigInt(claimData.req.expirationTimestamp),
        contents: claimData.req.contents.map(content => ({
          recipient: content.recipient,
          amount: BigInt(content.amount),
        })),
      };

      const airdropABI = [{
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
                  { name: 'amount', type: 'uint256' },
                ],
              },
            ],
          },
          { name: 'signature', type: 'bytes' },
        ],
        outputs: [],
      }];

      writeClaimContract({
        address: claimData.contractAddress,
        abi: airdropABI,
        functionName: 'airdropERC20WithSignature',
        args: [reqWithBigInt, claimData.signature],
      });

    } catch (err) {
      console.error('Claim error:', err);
      setClaimError(err.message || 'Failed to claim tokens');
    }
  };

  // Don't render if campaign not found or not loaded
  if (loading) {
    return (
      <div style={{
        backgroundColor: 'rgba(62, 180, 137, 0.1)',
        border: '2px solid #3eb489',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '20px',
        textAlign: 'center'
      }}>
        <p style={{ color: '#888' }}>Loading mint...</p>
      </div>
    );
  }

  if (!campaign) {
    // Campaign not set up yet - return null to hide section
    return null;
  }

  const isMintingProcess = isMinting || isMintTxPending || isMintConfirming;
  const canMint = userStatus?.canMint !== false && !isMintingProcess && !userStatus?.hasMinted;
  const isClaimingProcess = isClaimTxPending || isClaimConfirming;

  return (
    <div style={{
      backgroundColor: 'rgba(62, 180, 137, 0.1)',
      border: '2px solid #3eb489',
      borderRadius: '16px',
      padding: '24px',
      marginBottom: '20px'
    }}>
      {/* NFT Image */}
      <div style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '1',
        borderRadius: '12px',
        overflow: 'hidden',
        marginBottom: '16px',
        backgroundColor: '#111'
      }}>
        <Image
          src="/staking-launch-nft.png"
          alt="Staking Launch NFT"
          fill
          style={{ objectFit: 'cover' }}
        />
      </div>

      {/* Description */}
      <p style={{
        fontSize: '14px',
        color: '#fff',
        textAlign: 'center',
        marginBottom: '16px',
        lineHeight: '1.5'
      }}>
        Mint this commemorative NFT to celebrate the launch of $mintedmerch staking and claim <span style={{ color: '#3eb489', fontWeight: 'bold' }}>100,000 $mintedmerch</span>!
      </p>

      {/* Price */}
      <p style={{
        fontSize: '14px',
        color: '#888',
        textAlign: 'center',
        marginBottom: '16px'
      }}>
        Mint Price: <span style={{ color: '#fff', fontWeight: 'bold' }}>0.0005 ETH</span>
      </p>

      {/* STATE 1: Not Minted - Show Mint Button */}
      {!userStatus?.hasMinted && (
        <>
          <button
            onClick={handleMint}
            disabled={!canMint}
            style={{
              width: '100%',
              backgroundColor: canMint ? '#fff' : '#444',
              color: canMint ? '#000' : '#888',
              border: 'none',
              borderRadius: '12px',
              padding: '14px 24px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: canMint ? 'pointer' : 'not-allowed'
            }}
          >
            {isMintConfirming ? 'Confirming...' :
             isMintTxPending ? 'Approve in wallet...' :
             isMinting ? 'Preparing...' :
             canMint ? 'Mint' : '❌ Mint Unavailable'}
          </button>

          {mintError && (
            <p style={{ color: '#ef4444', fontSize: '14px', textAlign: 'center', marginTop: '12px' }}>
              {mintError}
            </p>
          )}
        </>
      )}

      {/* STATE 2: Minted but not shared */}
      {userStatus?.hasMinted && !hasShared && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#3eb489', fontSize: '18px', fontWeight: 'bold', marginBottom: '12px' }}>
            🎉 NFT Minted!
          </p>
          <p style={{ color: '#888', fontSize: '14px', marginBottom: '16px' }}>
            Share to unlock your $mintedmerch claim
          </p>
          <button
            onClick={handleShare}
            disabled={isSharing}
            style={{
              width: '100%',
              backgroundColor: '#6A3CFF',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              padding: '14px 24px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: isSharing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {isSharing ? 'Opening...' : 'Share to Farcaster'}
            <svg style={{ width: '18px', height: '18px' }} viewBox="0 0 520 457" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M519.801 0V61.6809H458.172V123.31H477.054V123.331H519.801V456.795H416.57L416.507 456.49L363.832 207.03C358.81 183.251 345.667 161.736 326.827 146.434C307.988 131.133 284.255 122.71 260.006 122.71H259.8C235.551 122.71 211.818 131.133 192.979 146.434C174.139 161.736 160.996 183.259 155.974 207.03L103.239 456.795H0V123.323H42.7471V123.31H61.6262V61.6809H0V0H519.801Z" fill="currentColor"/>
            </svg>
          </button>
        </div>
      )}

      {/* STATE 3: Shared but not claimed */}
      {userStatus?.hasMinted && hasShared && !hasClaimed && (
        <>
          <button
            onClick={handleClaim}
            disabled={isClaimingProcess}
            style={{
              width: '100%',
              backgroundColor: '#3eb489',
              color: '#000',
              border: 'none',
              borderRadius: '12px',
              padding: '14px 24px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: isClaimingProcess ? 'not-allowed' : 'pointer'
            }}
          >
            {isClaimConfirming ? 'Confirming...' :
             isClaimTxPending ? 'Approve in wallet...' :
             'Claim 100K $mintedmerch'}
          </button>

          {claimError && (
            <p style={{ color: '#ef4444', fontSize: '14px', textAlign: 'center', marginTop: '12px' }}>
              {claimError}
            </p>
          )}
        </>
      )}

      {/* STATE 4a: Claimed and can mint more - show success + mint again button */}
      {hasClaimed && userStatus?.canMint && (
        <>
          <div style={{
            backgroundColor: 'rgba(0,0,0,0.3)',
            borderRadius: '12px',
            padding: '16px',
            textAlign: 'center',
            marginBottom: '16px'
          }}>
            <p style={{ color: '#3eb489', fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
              Mint & Claim Complete!
            </p>
            <p style={{ color: '#888', fontSize: '14px' }}>
              You've minted the commemorative NFT and claimed 100K $mintedmerch - thank you for celebrating with us!
            </p>
          </div>
          <button
            onClick={handleMint}
            disabled={isMintingProcess}
            style={{
              width: '100%',
              backgroundColor: '#fff',
              color: '#000',
              border: 'none',
              borderRadius: '12px',
              padding: '14px 24px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: isMintingProcess ? 'not-allowed' : 'pointer'
            }}
          >
            {isMintConfirming ? 'Confirming...' :
             isMintTxPending ? 'Approve in wallet...' :
             isMinting ? 'Preparing...' :
             `Mint Again (${userStatus?.mintCount || 0}/${userStatus?.mintLimit || '∞'})`}
          </button>
        </>
      )}

      {/* STATE 4b: Claimed and reached limit - show complete */}
      {hasClaimed && !userStatus?.canMint && (
        <div style={{
          backgroundColor: 'rgba(0,0,0,0.3)',
          borderRadius: '12px',
          padding: '16px',
          textAlign: 'center'
        }}>
          <p style={{ color: '#3eb489', fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
            Mint & Claim Complete!
          </p>
          <p style={{ color: '#888', fontSize: '14px' }}>
            You've minted the commemorative NFT and claimed 100K $mintedmerch - thank you for celebrating with us!
          </p>
        </div>
      )}
    </div>
  );
}

