'use client';

import { useState, useEffect } from 'react';

export function PriceTicker() {
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
    return numChange >= 0 ? 'text-green-600' : 'text-red-600';
  };

  if (error) {
    return (
      <div className="bg-white text-gray-900 py-1 px-4 text-xs overflow-hidden border-b border-gray-200">
        <div className="flex items-center justify-center">
          <span className="text-gray-600">Unable to load $MINTEDMERCH price data</span>
        </div>
      </div>
    );
  }

  if (isLoading || !tokenData) {
    return (
      <div className="bg-white text-gray-900 py-1 px-4 text-xs overflow-hidden border-b border-gray-200">
        <div className="flex items-center justify-center">
          <span className="text-gray-600">Loading $MINTEDMERCH price...</span>
        </div>
      </div>
    );
  }

  const priceUsd = tokenData.priceUsd;
  const hourlyChange = tokenData.priceChange?.h1;
  const volume24h = tokenData.volume?.h24;
  const marketCap = tokenData.marketCap;

  return (
    <div className="bg-white text-gray-900 py-1 px-4 text-xs overflow-hidden relative border-b border-gray-200">
      <div className="animate-scroll flex items-center space-x-4 whitespace-nowrap">
        {/* Repeat the content multiple times for continuous scroll */}
        {[...Array(3)].map((_, index) => (
          <div key={index} className="flex items-center space-x-4 flex-shrink-0">
            <div className="flex items-center space-x-2">
              <span className="font-semibold">$MINTEDMERCH</span>
              <span className="text-gray-900">{formatPrice(priceUsd)}</span>
              <span className={getChangeColor(hourlyChange)}>
                {formatPercentage(hourlyChange)}
              </span>
            </div>
            
            {volume24h && (
              <div className="flex items-center space-x-1">
                <span className="text-gray-600">24h Vol:</span>
                <span className="text-gray-900">${parseFloat(volume24h).toLocaleString()}</span>
              </div>
            )}
            
            {marketCap && (
              <div className="flex items-center space-x-1">
                <span className="text-gray-600">MCap:</span>
                <span className="text-gray-900">${parseFloat(marketCap).toLocaleString()}</span>
              </div>
            )}
            
            <div className="flex items-center space-x-1">
              <span className="text-gray-600">DEX:</span>
              <span className="text-gray-900">{tokenData.dexId?.toUpperCase() || 'UNISWAP'}</span>
            </div>
          </div>
        ))}
      </div>
      

    </div>
  );
}
