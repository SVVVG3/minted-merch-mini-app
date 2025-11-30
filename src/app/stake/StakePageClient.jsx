'use client';

import { useState, useEffect } from 'react';
import { useFarcaster } from '@/lib/useFarcaster';
import { sdk } from '@farcaster/miniapp-sdk';
import Link from 'next/link';

// Staking terminal deep link URL
const STAKING_TERMINAL_URL = 'https://tunnel.betrmint.fun';

export function StakePageClient() {
  const { isInFarcaster, isReady, getFid, getUsername, getDisplayName, getPfpUrl, getSessionToken } = useFarcaster();
  const [stakingData, setStakingData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadStakingData() {
      if (!isReady) return;
      
      const fid = getFid();
      if (!fid) {
        setIsLoading(false);
        return;
      }

      // 🔒 SECURITY: Get session token for authenticated request
      const sessionToken = getSessionToken();
      if (!sessionToken) {
        console.log('⚠️ No session token available - showing default state');
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/staking/user?fid=${fid}`, {
          headers: {
            'Authorization': `Bearer ${sessionToken}`
          }
        });
        const data = await response.json();
        
        if (response.status === 401 || response.status === 403) {
          console.warn('🚫 Authentication failed for staking data');
          setError(null); // Don't show error, just default state
          setIsLoading(false);
          return;
        }
        
        if (data.success) {
          setStakingData(data);
        } else {
          setError(data.error || 'Failed to load staking data');
        }
      } catch (err) {
        console.error('Error loading staking data:', err);
        setError('Failed to load staking data');
      } finally {
        setIsLoading(false);
      }
    }

    loadStakingData();
  }, [isReady, getFid, getSessionToken]);

  // Format large numbers
  const formatNumber = (num) => {
    if (!num) return '0';
    if (num >= 1_000_000_000) {
      return (num / 1_000_000_000).toFixed(2) + 'B';
    } else if (num >= 1_000_000) {
      return (num / 1_000_000).toFixed(2) + 'M';
    } else if (num >= 1_000) {
      return (num / 1_000).toFixed(2) + 'K';
    }
    return num.toLocaleString();
  };

  // Handle opening the staking terminal
  const handleOpenStakingTerminal = async () => {
    try {
      if (isInFarcaster && sdk?.actions?.openUrl) {
        // Use Farcaster SDK to open external URL
        await sdk.actions.openUrl(STAKING_TERMINAL_URL);
      } else {
        // Fallback to regular window.open
        window.open(STAKING_TERMINAL_URL, '_blank');
      }
    } catch (err) {
      console.error('Error opening staking terminal:', err);
      window.open(STAKING_TERMINAL_URL, '_blank');
    }
  };

  // Handle sharing stake page
  const handleShare = async () => {
    const shareUrl = 'https://app.mintedmerch.shop/stake';
    const shareText = '💰 Stake $mintedmerch to earn rewards and unlock exclusive merch benefits!';
    
    try {
      if (isInFarcaster && sdk?.actions?.composeCast) {
        await sdk.actions.composeCast({
          text: shareText,
          embeds: [{ url: shareUrl }]
        });
      } else if (navigator.share) {
        await navigator.share({
          title: 'Stake to Earn $mintedmerch',
          text: shareText,
          url: shareUrl
        });
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`);
        alert('Link copied to clipboard!');
      }
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#000',
      color: '#fff',
      padding: '20px',
      paddingBottom: '100px'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px'
      }}>
        <Link href="/" style={{
          color: '#3eb489',
          textDecoration: 'none',
          fontSize: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          ← Back to Shop
        </Link>
        
        <button
          onClick={handleShare}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            backgroundColor: '#6A3CFF',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 16px',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          Share
          {/* Official Farcaster Logo (2024 rebrand) */}
          <svg style={{ width: '16px', height: '16px' }} viewBox="0 0 520 457" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M88.75 0H431.25L520 88.75V368.25L431.25 457H88.75L0 368.25V88.75L88.75 0Z" fill="white"/>
            <path d="M148.75 118.75H371.25V338.25H325V198.75H267.5V338.25H195V198.75H148.75V118.75Z" fill="#6A3CFF"/>
          </svg>
        </button>
      </div>

      {/* Logo - Using Spinner Logo for better horizontal fit */}
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <img 
          src="/MintedMerchSpinnerLogo.png" 
          alt="Minted Merch" 
          style={{ height: '50px', objectFit: 'contain' }}
        />
      </div>

      {/* Main Staking Card */}
      <div style={{
        backgroundColor: 'rgba(62, 180, 137, 0.1)',
        border: '2px solid #3eb489',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '20px'
      }}>
        {/* Title */}
        <h1 style={{
          fontSize: '28px',
          fontWeight: 'bold',
          color: '#3eb489',
          textAlign: 'center',
          marginBottom: '24px',
          textTransform: 'uppercase'
        }}>
          STAKE TO EARN $mintedmerch
        </h1>

        {/* Tagline */}
        <p style={{
          fontSize: '18px',
          color: '#3eb489',
          textAlign: 'center',
          fontWeight: '600',
          marginBottom: '16px'
        }}>
          Where Staking Meets Merch!
        </p>

        {/* Description */}
        <p style={{
          fontSize: '16px',
          color: '#fff',
          textAlign: 'center',
          lineHeight: '1.6',
          marginBottom: '24px'
        }}>
          Stake 50M+ $mintedmerch to unlock exclusive collab partnerships, the ability to place custom orders, group chat access, and 15% off store wide.
        </p>

        {/* User Stats */}
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#888' }}>
            Loading your staking data...
          </div>
        ) : stakingData && stakingData.staking.is_staker ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            marginBottom: '24px'
          }}>
            <div style={{
              backgroundColor: 'rgba(0,0,0,0.3)',
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'center'
            }}>
              <div style={{ color: '#888', fontSize: '14px', marginBottom: '4px' }}>
                Your Stake
              </div>
              <div style={{ color: '#3eb489', fontSize: '24px', fontWeight: 'bold' }}>
                {stakingData.staking.total_staked_formatted}
              </div>
              <div style={{ color: '#666', fontSize: '12px' }}>
                $mintedmerch
              </div>
            </div>
            
            <div style={{
              backgroundColor: 'rgba(0,0,0,0.3)',
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'center'
            }}>
              <div style={{ color: '#888', fontSize: '14px', marginBottom: '4px' }}>
                Rewards Earned
              </div>
              <div style={{ color: '#3eb489', fontSize: '24px', fontWeight: 'bold' }}>
                {stakingData.staking.rewards_claimed_formatted}
              </div>
              <div style={{ color: '#666', fontSize: '12px' }}>
                $mintedmerch
              </div>
            </div>
          </div>
        ) : !getFid() ? (
          <div style={{
            textAlign: 'center',
            padding: '20px',
            color: '#888',
            backgroundColor: 'rgba(0,0,0,0.3)',
            borderRadius: '12px',
            marginBottom: '24px'
          }}>
            Connect with Farcaster to see your staking stats
          </div>
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '20px',
            color: '#888',
            backgroundColor: 'rgba(0,0,0,0.3)',
            borderRadius: '12px',
            marginBottom: '24px'
          }}>
            You haven't staked yet. Stake $mintedmerch to earn rewards!
          </div>
        )}

        {/* Stake Button */}
        <button
          onClick={handleOpenStakingTerminal}
          style={{
            width: '100%',
            backgroundColor: '#3eb489',
            color: '#000',
            border: 'none',
            borderRadius: '12px',
            padding: '16px 24px',
            fontSize: '18px',
            fontWeight: 'bold',
            cursor: 'pointer',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          {stakingData?.staking?.is_staker ? 'Manage Stake' : 'Start Staking'} 💰
        </button>

        <p style={{
          fontSize: '12px',
          color: '#666',
          textAlign: 'center'
        }}>
          Opens the Staking Terminal in a new window
        </p>
      </div>

      {/* Prizes Section */}
      <div style={{
        backgroundColor: 'rgba(62, 180, 137, 0.1)',
        border: '2px solid #3eb489',
        borderRadius: '16px',
        padding: '24px'
      }}>
        <p style={{
          fontSize: '16px',
          fontWeight: 'bold',
          color: '#3eb489',
          textAlign: 'center',
          lineHeight: '1.6'
        }}>
          SPIN-TO-CLAIM ONCE PER DAY FOR A CHANCE TO WIN THE{' '}
          <span style={{ color: '#fff' }}>MONTHLY MEGA MERCH PACK JACKPOT</span>,{' '}
          ONE OF FOUR{' '}
          <span style={{ color: '#fff' }}>MINI MERCH PACKS</span>,{' '}
          THE{' '}
          <span style={{ color: '#fff' }}>1M $mintedmerch DAILY JACKPOT</span>{' '}
          OR THE{' '}
          <span style={{ color: '#fff' }}>100K $mintedmerch BONUSES</span>!
        </p>
      </div>

      {/* More Info Link */}
      <div style={{
        textAlign: 'center',
        marginTop: '20px'
      }}>
        <a
          href="https://docs.mintedmerch.shop/staking"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: '#3eb489',
            textDecoration: 'underline',
            fontSize: '14px'
          }}
        >
          More Info →
        </a>
      </div>
    </div>
  );
}

