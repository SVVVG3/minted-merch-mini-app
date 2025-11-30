'use client';

import { useState, useEffect } from 'react';
import { useFarcaster } from '@/lib/useFarcaster';
import { sdk } from '@farcaster/miniapp-sdk';
import Link from 'next/link';

// Staking terminal deep link URL
const STAKING_TERMINAL_URL = 'https://tunnel.betrmint.fun';

export function StakePageClient() {
  const { isInFarcaster, isReady, getFid, getUsername, getDisplayName, getPfpUrl } = useFarcaster();
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

      try {
        const response = await fetch(`/api/staking/user?fid=${fid}`);
        const data = await response.json();
        
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
  }, [isReady, getFid]);

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
            background: 'transparent',
            border: '1px solid #3eb489',
            borderRadius: '8px',
            padding: '8px 16px',
            color: '#3eb489',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Share 📤
        </button>
      </div>

      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <img 
          src="/logo.png" 
          alt="Minted Merch" 
          style={{ height: '60px', objectFit: 'contain' }}
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
          marginBottom: '16px',
          textTransform: 'uppercase'
        }}>
          STAKE TO EARN $mintedmerch
        </h1>

        {/* Description */}
        <p style={{
          fontSize: '16px',
          color: '#fff',
          textAlign: 'center',
          lineHeight: '1.6',
          marginBottom: '24px'
        }}>
          <span style={{ color: '#3eb489' }}>Where Staking Meets Merch!</span>{' '}
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
        <h2 style={{
          fontSize: '16px',
          fontWeight: 'bold',
          color: '#3eb489',
          textAlign: 'center',
          marginBottom: '16px',
          lineHeight: '1.5'
        }}>
          SPIN-TO-CLAIM ONCE PER DAY FOR A CHANCE TO WIN THE{' '}
          <span style={{ color: '#fff' }}>MONTHLY MEGA MERCH PACK JACKPOT</span>,{' '}
          ONE OF FOUR{' '}
          <span style={{ color: '#fff' }}>MINI MERCH PACKS</span>,{' '}
          THE{' '}
          <span style={{ color: '#fff' }}>1M $mintedmerch DAILY JACKPOT</span>{' '}
          OR THE{' '}
          <span style={{ color: '#fff' }}>100K $mintedmerch BONUSES</span>!
        </h2>

        {/* Prize List */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          marginTop: '20px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px',
            backgroundColor: 'rgba(0,0,0,0.3)',
            borderRadius: '8px'
          }}>
            <span style={{ fontSize: '24px' }}>🏆</span>
            <div>
              <div style={{ color: '#3eb489', fontWeight: 'bold' }}>Monthly Mega Merch Pack</div>
              <div style={{ color: '#888', fontSize: '14px' }}>Hat, Shirt, Hoodie - NFT to claim</div>
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px',
            backgroundColor: 'rgba(0,0,0,0.3)',
            borderRadius: '8px'
          }}>
            <span style={{ fontSize: '24px' }}>🎁</span>
            <div>
              <div style={{ color: '#3eb489', fontWeight: 'bold' }}>4x Mini Merch Packs</div>
              <div style={{ color: '#888', fontSize: '14px' }}>Hat or Shirt (winner's choice) - NFT to claim</div>
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px',
            backgroundColor: 'rgba(0,0,0,0.3)',
            borderRadius: '8px'
          }}>
            <span style={{ fontSize: '24px' }}>💰</span>
            <div>
              <div style={{ color: '#3eb489', fontWeight: 'bold' }}>1M $mintedmerch Daily Jackpot</div>
              <div style={{ color: '#888', fontSize: '14px' }}>One winner per day</div>
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px',
            backgroundColor: 'rgba(0,0,0,0.3)',
            borderRadius: '8px'
          }}>
            <span style={{ fontSize: '24px' }}>⚡</span>
            <div>
              <div style={{ color: '#3eb489', fontWeight: 'bold' }}>100K $mintedmerch Bonuses</div>
              <div style={{ color: '#888', fontSize: '14px' }}>3 winners per day</div>
            </div>
          </div>
        </div>
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

