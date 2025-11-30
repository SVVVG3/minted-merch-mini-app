'use client';

import { useState, useEffect } from 'react';
import { useFarcaster } from '@/lib/useFarcaster';
import { sdk } from '@farcaster/miniapp-sdk';
import { haptics } from '@/lib/haptics';
import Link from 'next/link';

// Staking terminal deep link URL
const STAKING_TERMINAL_URL = 'https://betrmint.fun/mm-stake';
// Coin mini app URL
const COIN_MINIAPP_URL = 'https://coin.mintedmerch.shop';

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

  // Handle back to shop
  const handleBackToShop = async () => {
    await haptics.light(isInFarcaster);
  };

  // Handle opening the staking terminal
  const handleOpenStakingTerminal = async () => {
    await haptics.medium(isInFarcaster);
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

  // Handle opening coin mini app (opens as mini app, not external browser)
  const handleOpenCoinMiniApp = async () => {
    await haptics.light(isInFarcaster);
    try {
      if (isInFarcaster && sdk?.actions?.openMiniApp) {
        // Use Farcaster SDK to open as mini app (stays in Farcaster)
        await sdk.actions.openMiniApp({
          url: COIN_MINIAPP_URL
        });
      } else {
        // Fallback to regular navigation
        window.location.href = COIN_MINIAPP_URL;
      }
    } catch (err) {
      console.error('Error opening coin mini app:', err);
      window.location.href = COIN_MINIAPP_URL;
    }
  };

  // Handle sharing stake page
  const handleShare = async () => {
    await haptics.light(isInFarcaster);
    const shareUrl = 'https://app.mintedmerch.shop/stake';
    const shareText = `Minted Merch - Where Staking Meets Merch

Stake your $mintedmerch now and Spin-to-Claim daily to compound rewards, and have a chance to win bonuses of 100K, daily Yield Jackpots of 1M, and physical merch packs shipped to you at no cost!`;
    
    try {
      if (isInFarcaster && sdk?.actions?.composeCast) {
        await sdk.actions.composeCast({
          text: shareText,
          embeds: [shareUrl]
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
        <Link 
          href="/" 
          onClick={handleBackToShop}
          style={{
            color: '#3eb489',
            textDecoration: 'none',
            fontSize: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          ← Back to Shop
        </Link>
        
        <button
          onClick={handleShare}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            backgroundColor: '#8B5CF6',
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
          {/* Official Farcaster Arch Logo */}
          <svg style={{ width: '18px', height: '18px' }} viewBox="0 0 520 457" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M519.801 0V61.6809H458.172V123.31H477.054V123.331H519.801V456.795H416.57L416.507 456.49L363.832 207.03C358.81 183.251 345.667 161.736 326.827 146.434C307.988 131.133 284.255 122.71 260.006 122.71H259.8C235.551 122.71 211.818 131.133 192.979 146.434C174.139 161.736 160.996 183.259 155.974 207.03L103.239 456.795H0V123.323H42.7471V123.31H61.6262V61.6809H0V0H519.801Z" fill="currentColor"/>
          </svg>
        </button>
      </div>

      {/* Main Staking Card */}
      <div style={{
        backgroundColor: 'rgba(62, 180, 137, 0.1)',
        border: '2px solid #3eb489',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '20px'
      }}>
        {/* Title with image */}
        <div style={{
          textAlign: 'center',
          marginBottom: '8px'
        }}>
          <span style={{
            fontSize: '28px',
            fontWeight: 'bold',
            color: '#3eb489',
            textTransform: 'uppercase'
          }}>
            STAKE TO EARN
          </span>
          <div>
            <img 
              src="/mintedmerch-logo-ticker.png" 
              alt="$MINTEDMERCH" 
              style={{ 
                height: '80px', 
                objectFit: 'contain',
                display: 'inline-block'
              }}
            />
          </div>
        </div>

        {/* Full Width Separator Line */}
        <div style={{
          width: '100%',
          height: '2px',
          backgroundColor: '#3eb489',
          marginBottom: '16px'
        }} />

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

        {/* Stake Button - Changes based on staking status */}
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
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          {stakingData?.staking?.is_staker ? 'Spin To Claim' : 'Start Staking'}
        </button>
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

      {/* More Info Button */}
      <div style={{
        textAlign: 'center',
        marginTop: '20px'
      }}>
        <button
          onClick={handleOpenCoinMiniApp}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#3eb489',
            textDecoration: 'underline',
            fontSize: '14px',
            cursor: 'pointer',
            padding: '8px'
          }}
        >
          More Info →
        </button>
      </div>
    </div>
  );
}
