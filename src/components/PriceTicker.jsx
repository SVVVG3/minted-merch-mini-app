'use client';

import { useState, useEffect } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import { useFarcaster } from '@/lib/useFarcaster';

export function PriceTicker() {
  const { isInFarcaster } = useFarcaster();
  const [tokenData, setTokenData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const MINTEDMERCH_TOKEN_ADDRESS = '0x774EAeFE73Df7959496Ac92a77279A8D7d690b07';
  const CHAIN_ID = 'base';

  useEffect(() => {
    const fetchTokenData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch token data from DexScreener API using search endpoint
        const response = await fetch(
          `https://api.dexscreener.com/latest/dex/search?q=${MINTEDMERCH_TOKEN_ADDRESS}`,
          {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
            },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data && data.pairs && data.pairs.length > 0) {
          // Get the pair with highest liquidity (most reliable)
          const bestPair = data.pairs.reduce((best, current) => {
            return (current.liquidity?.usd || 0) > (best.liquidity?.usd || 0) ? current : best;
          });
          
          setTokenData(bestPair);
        } else {
          throw new Error('No token data found');
        }
      } catch (err) {
        console.error('Error fetching token data:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    // Fetch immediately
    fetchTokenData();

    // Set up interval to fetch every 30 seconds
    const interval = setInterval(fetchTokenData, 30000);

    return () => clearInterval(interval);
  }, []);

  const formatPrice = (price) => {
    if (!price) return '$0.00';
    const numPrice = parseFloat(price);
    if (numPrice < 0.01) {
      return `$${numPrice.toFixed(6)}`;
    } else if (numPrice < 1) {
      return `$${numPrice.toFixed(4)}`;
    } else {
      return `$${numPrice.toFixed(2)}`;
    }
  };

  const formatPercentage = (change) => {
    if (!change) return '0.00%';
    const numChange = parseFloat(change);
    return `${numChange >= 0 ? '+' : ''}${numChange.toFixed(2)}%`;
  };

  const getChangeColor = (change) => {
    if (!change) return 'text-gray-600';
    const numChange = parseFloat(change);
    return numChange >= 0 ? 'text-[#3eb489]' : 'text-red-600';
  };

  // Handle click to open swap
  const handleSwapClick = async () => {
    // In mini-app: Use native Farcaster wallet swap
    // Outside mini-app: Open Matcha
    if (isInFarcaster) {
      try {
        const result = await sdk.actions.swapToken({
          buyToken: `eip155:8453/erc20:${MINTEDMERCH_TOKEN_ADDRESS}`, // $mintedmerch token on Base
          sellToken: 'eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
        });
        
        if (result.success) {
          console.log('Swap completed:', result.swap);
        } else {
          console.log('Swap failed or cancelled:', result.reason);
        }
      } catch (error) {
        console.error('Error opening swap:', error);
      }
    } else {
      // Open Matcha for non-mini-app users (dGEN1, desktop)
      window.open('https://matcha.xyz/tokens/base/0x774eaefe73df7959496ac92a77279a8d7d690b07', '_blank');
    }
  };

  if (error) {
    return (
      <div className="bg-black text-white py-1 px-4 text-xs overflow-hidden">
        <div className="flex items-center justify-center">
          <span className="text-gray-400">Unable to load $MINTEDMERCH price data</span>
        </div>
      </div>
    );
  }

  if (isLoading || !tokenData) {
    return (
      <div className="bg-black text-white py-1 px-4 text-xs overflow-hidden">
        <div className="flex items-center justify-center">
          <span className="text-gray-400">Loading $MINTEDMERCH price...</span>
        </div>
      </div>
    );
  }

  const priceUsd = tokenData.priceUsd;
  const hourlyChange = tokenData.priceChange?.h1;
  const volume24h = tokenData.volume?.h24;
  const marketCap = tokenData.marketCap;
  const liquidity = tokenData.liquidity?.usd;

  // Create ticker content
  const tickerContent = (
    <div className="flex items-center space-x-4 flex-shrink-0">
      <span className="font-semibold text-[#3eb489]">$MINTEDMERCH</span>
      <span className="text-white">
        <span className="text-gray-400">Price: </span>{formatPrice(priceUsd)}
      </span>
      <span className={getChangeColor(hourlyChange)}>
        <span className="text-gray-400">1H: </span>{formatPercentage(hourlyChange)}
      </span>
      
      {marketCap && (
        <span className="text-white">
          <span className="text-gray-400">MC: </span>${parseFloat(marketCap).toLocaleString()}
        </span>
      )}
      
      {liquidity && (
        <span className="text-white">
          <span className="text-gray-400">Liquidity: </span>${parseFloat(liquidity).toLocaleString()}
        </span>
      )}
      
      <span className="text-green-400 font-semibold">Tap Here To Buy</span>
    </div>
  );

  return (
    <div 
      className="bg-black text-white py-1 px-4 text-xs overflow-hidden relative cursor-pointer"
      onClick={handleSwapClick}
    >
      <div className="ticker-scroll flex items-center whitespace-nowrap">
        {/* Repeat the content multiple times for seamless scrolling */}
        {[...Array(20)].map((_, index) => (
          <div key={index} className="flex items-center mr-4">
            {tickerContent}
          </div>
        ))}
      </div>
    </div>
  );
}
