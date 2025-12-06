'use client';

import { useState, useEffect } from 'react';
import { useFarcaster } from '@/lib/useFarcaster';
import { sdk } from '@farcaster/miniapp-sdk';
import { haptics } from '@/lib/haptics';
import Link from 'next/link';
import { ProfileModal } from '@/components/ProfileModal';
// import { StakingLaunchMint } from '@/components/StakingLaunchMint'; // TEMPORARILY HIDDEN

// Staking terminal deep link URL
const STAKING_TERMINAL_URL = 'https://farcaster.xyz/miniapps/yG210D-5eNqL/betrmint/mm-stake';
// Coin mini app URL
const COIN_MINIAPP_URL = 'https://coin.mintedmerch.shop';

export function StakePageClient() {
  const { isInFarcaster, isReady, getFid, getUsername, getDisplayName, getPfpUrl, getSessionToken } = useFarcaster();
  const [stakingData, setStakingData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

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

  // Handle opening the staking terminal (opens as mini app)
  const handleOpenStakingTerminal = async () => {
    await haptics.medium(isInFarcaster);
    try {
      if (isInFarcaster && sdk?.actions?.openUrl) {
        // Use Farcaster SDK to deeplink to betrmint mini app
        await sdk.actions.openUrl(STAKING_TERMINAL_URL);
      } else {
        // Fallback to navigation
        window.location.href = STAKING_TERMINAL_URL;
      }
    } catch (err) {
      console.error('Error opening staking terminal:', err);
      window.location.href = STAKING_TERMINAL_URL;
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

Stake your tokens now and Spin-to-Claim daily to compound rewards, have a chance to win bonuses of 100K, Daily Yield Jackpots of 1M $mintedmerch, and physical Mini & Mega Merch Packs!`;
    
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

  // Handle profile button click
  const handleProfileClick = async () => {
    await haptics.selectionChanged(isInFarcaster);
    setIsProfileModalOpen(true);
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
        {/* Left: Back to Shop */}
        <Link 
          href="/" 
          onClick={handleBackToShop}
          style={{
            color: '#3eb489',
            textDecoration: 'none',
            fontSize: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flex: '1'
          }}
        >
          ← Back to Shop
        </Link>
        
        {/* Center: Share Button */}
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
          {/* Official Farcaster Arch Logo */}
          <svg style={{ width: '18px', height: '18px' }} viewBox="0 0 520 457" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M519.801 0V61.6809H458.172V123.31H477.054V123.331H519.801V456.795H416.57L416.507 456.49L363.832 207.03C358.81 183.251 345.667 161.736 326.827 146.434C307.988 131.133 284.255 122.71 260.006 122.71H259.8C235.551 122.71 211.818 131.133 192.979 146.434C174.139 161.736 160.996 183.259 155.974 207.03L103.239 456.795H0V123.323H42.7471V123.31H61.6262V61.6809H0V0H519.801Z" fill="currentColor"/>
          </svg>
        </button>
        
        {/* Right: Profile Button */}
        <div style={{ flex: '1', display: 'flex', justifyContent: 'flex-end' }}>
          {getPfpUrl() && (
            <button
              onClick={handleProfileClick}
              style={{
                background: 'none',
                border: '2px solid #3eb489',
                borderRadius: '50%',
                padding: '0',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <img 
                src={getPfpUrl()} 
                alt={getDisplayName() || getUsername() || 'Profile'}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  objectFit: 'cover'
                }}
              />
            </button>
          )}
        </div>
      </div>

      {/* Main Staking Card - Title, Stats, Button */}
      <div style={{
        backgroundColor: 'rgba(62, 180, 137, 0.1)',
        border: '2px solid #3eb489',
        borderRadius: '16px',
        padding: '24px 24px 12px 24px',
        marginBottom: '20px'
      }}>
        {/* Title with combined image */}
        <div style={{
          textAlign: 'center',
          marginBottom: '8px'
        }}>
          <img 
            src="/StakeToEarnMintedMerch.png" 
            alt="STAKE TO EARN $MINTEDMERCH" 
            style={{ 
              height: '140px', 
              objectFit: 'contain',
              display: 'inline-block'
            }}
          />
        </div>

        {/* Full Width Separator Line */}
        <div style={{
          width: '100%',
          height: '2px',
          backgroundColor: '#3eb489',
          marginBottom: '24px'
        }} />

        {/* Enhanced Staking Stats */}
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#888' }}>
            Loading your staking data...
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
            backgroundColor: 'rgba(0,0,0,0.3)',
            borderRadius: '12px',
            padding: '8px 16px',
            marginBottom: '12px'
          }}>
            {/* Stats List - Labels left, Values right */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Total Staked with Percentage */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px' }}>
                <span style={{ color: '#3eb489', fontWeight: '600' }}>Total Staked:</span>
                <span style={{ color: '#fff', textAlign: 'right' }}>
                  {stakingData?.staking?.global_total_staked_full || '0'} $mintedmerch
                  {stakingData?.staking?.staked_percentage && (
                    <span style={{ color: '#3eb489' }}> ({stakingData.staking.staked_percentage}%)</span>
                  )}
                </span>
              </div>
              
              {/* Your Stake */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px' }}>
                <span style={{ color: '#3eb489', fontWeight: '600' }}>Your Stake:</span>
                <span style={{ color: '#fff' }}>
                  {stakingData?.balances?.staked_formatted || '0'} $mintedmerch
                </span>
              </div>
              
              {/* Your Balance (unstaked wallet balance) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px' }}>
                <span style={{ color: '#3eb489', fontWeight: '600' }}>Your Balance:</span>
                <span style={{ color: '#fff' }}>
                  {stakingData?.balances?.wallet_formatted || '0'} $mintedmerch
                </span>
              </div>
              
              {/* Lifetime Claimed */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px' }}>
                <span style={{ color: '#3eb489', fontWeight: '600' }}>Lifetime Claimed:</span>
                <span style={{ color: '#fff' }}>
                  {stakingData?.staking?.lifetime_claimed_formatted || '0'} $mintedmerch
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Stake/Unstake Button */}
        <button
          onClick={handleOpenStakingTerminal}
          style={{
            width: '100%',
            backgroundColor: 'transparent',
            color: '#3eb489',
            border: '2px solid #3eb489',
            borderRadius: '12px',
            padding: '14px 24px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginBottom: '12px'
          }}
        >
          Stake / Unstake
        </button>

        {/* Spin To Claim Button */}
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
          Spin To Claim
        </button>
        
        {/* Powered By betrmint */}
        <p style={{
          fontSize: '12px',
          textAlign: 'center',
          marginTop: '12px',
          marginBottom: '0'
        }}>
          <span style={{ color: '#E742AE' }}>Powered By</span>{' '}
          <span style={{ color: '#69E3F1' }}>@betrmint</span>
        </p>
      </div>

      {/* Staking Launch Celebration NFT Mint - TEMPORARILY HIDDEN */}
      {/* <StakingLaunchMint /> */}

      {/* Benefits Section - Where Staking Meets Merch */}
      <div style={{
        backgroundColor: 'rgba(62, 180, 137, 0.1)',
        border: '2px solid #3eb489',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '20px'
      }}>
        <p style={{
          fontSize: '18px',
          color: '#3eb489',
          textAlign: 'center',
          fontWeight: '600',
          marginBottom: '16px'
        }}>
          Where Staking Meets Merch!
        </p>
        <p style={{
          fontSize: '16px',
          color: '#fff',
          textAlign: 'center',
          lineHeight: '1.6'
        }}>
          Stake any amount to earn daily rewards! Stake 50M+ $mintedmerch to become a Merch Mogul and unlock: exclusive collab partnerships, the ability to place custom orders, group chat access, and 15% off store wide.
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

      {/* Profile Modal */}
      <ProfileModal 
        isOpen={isProfileModalOpen} 
        onClose={() => setIsProfileModalOpen(false)} 
      />
    </div>
  );
}
