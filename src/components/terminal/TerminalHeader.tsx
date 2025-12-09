import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import type { Token } from '../../types';
import { getTokenIconUrls } from '../../services/tokenLeaderboardService';

interface TokenInfo {
  token: Token;
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  holders: number;
}

interface TerminalHeaderProps {
  token: Token;
  tokenInfo: TokenInfo | null;
  isLoading: boolean;
}

// Token Icon Component with fallback handling
const TokenIcon: React.FC<{ token: Token }> = ({ token }) => {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [errorIndex, setErrorIndex] = useState(0);
  const iconUrls = useRef<string[]>([]);

  useEffect(() => {
    iconUrls.current = getTokenIconUrls(token.currency, token.issuer || '');
    setImgSrc(iconUrls.current[0] || token.icon || null);
    setErrorIndex(0);
  }, [token.currency, token.issuer, token.icon]);

  const handleError = () => {
    const nextIndex = errorIndex + 1;
    if (nextIndex < iconUrls.current.length) {
      setImgSrc(iconUrls.current[nextIndex]);
      setErrorIndex(nextIndex);
    } else {
      setImgSrc(null);
    }
  };

  const displayText = (token.symbol || token.currency || '??').slice(0, 2);

  return (
    <>
      {imgSrc ? (
        <img
          src={imgSrc}
          alt={token.symbol || token.currency || 'Token'}
          className="w-full h-full object-cover"
          onError={handleError}
        />
      ) : (
        <span className={`text-lg font-bold ${token.currency === 'BEAR' ? 'text-bearpark-gold' : 'text-white'}`}>
          {displayText}
        </span>
      )}
    </>
  );
};

export const TerminalHeader: React.FC<TerminalHeaderProps> = ({
  token,
  tokenInfo,
  isLoading,
}) => {
  const formatNumber = (num: number, decimals = 2): string => {
    if (num >= 1e9) return `${(num / 1e9).toFixed(decimals)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(decimals)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(decimals)}K`;
    return num.toFixed(decimals);
  };

  const formatPrice = (price: number): string => {
    if (price >= 1) return price.toFixed(4);
    if (price >= 0.0001) return price.toFixed(6);
    return price.toFixed(8);
  };

  const isBear = token.currency === 'BEAR';

  return (
    <div className="sticky top-12 md:top-16 z-30 bg-bear-dark-900/95 backdrop-blur-xl border-b border-bear-dark-700">
      <div className="flex items-center justify-between px-3 py-2 gap-4">
        {/* Left - Token Info */}
        <div className="flex items-center gap-3">
          {/* Back Button */}
          <Link
            to="/tokens"
            className="p-2 rounded-lg bg-bear-dark-800 hover:bg-bear-dark-700 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>

          {/* Token Icon */}
          <div className={`relative w-10 h-10 rounded-full overflow-hidden ${isBear ? 'ring-2 ring-bearpark-gold' : ''}`}>
            {isBear && (
              <div className="absolute inset-0 bg-[conic-gradient(from_0deg,#680cd9,#feb501,#07ae08,#680cd9)] animate-spin-slow"></div>
            )}
            <div className={`absolute ${isBear ? 'inset-[2px]' : 'inset-0'} rounded-full bg-bear-dark-800 flex items-center justify-center overflow-hidden`}>
              <TokenIcon token={token} />
            </div>
          </div>

          {/* Token Name & Symbol */}
          <div>
            <div className="flex items-center gap-2">
              <h1 className={`text-lg font-bold ${isBear ? 'text-bearpark-gold font-luckiest' : 'text-white'}`}>
                {token.symbol}
              </h1>
              <span className="text-xs text-gray-500">/XRP</span>
            </div>
            <div className="flex items-center gap-1">
              <p className="text-xs text-gray-500 font-mono truncate max-w-[150px]">
                {token.issuer ? `${token.issuer.slice(0, 8)}...${token.issuer.slice(-6)}` : 'Native'}
              </p>
              {token.issuer && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(token.issuer!);
                  }}
                  className="p-1 rounded hover:bg-bear-dark-700 transition-colors"
                  title="Copy issuer address"
                >
                  <svg className="w-3 h-3 text-gray-500 hover:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Center - Price Info */}
        <div className="hidden md:flex items-center gap-6">
          {/* Price */}
          <div>
            <p className="text-xs text-gray-500 uppercase">Price</p>
            {isLoading ? (
              <div className="h-6 w-24 bg-bear-dark-700 rounded animate-pulse"></div>
            ) : (
              <p className="text-lg font-bold font-mono text-white">
                {tokenInfo ? formatPrice(tokenInfo.price) : '—'} <span className="text-xs text-gray-500">XRP</span>
              </p>
            )}
          </div>

          {/* 24h Change */}
          <div>
            <p className="text-xs text-gray-500 uppercase">24h Change</p>
            {isLoading ? (
              <div className="h-6 w-16 bg-bear-dark-700 rounded animate-pulse"></div>
            ) : (
              <p className={`text-lg font-bold font-mono ${
                tokenInfo && tokenInfo.priceChange24h >= 0 ? 'text-bear-green-400' : 'text-red-400'
              }`}>
                {tokenInfo ? `${tokenInfo.priceChange24h >= 0 ? '+' : ''}${tokenInfo.priceChange24h.toFixed(2)}%` : '—'}
              </p>
            )}
          </div>

          {/* 24h Volume */}
          <div>
            <p className="text-xs text-gray-500 uppercase">24h Volume</p>
            {isLoading ? (
              <div className="h-6 w-20 bg-bear-dark-700 rounded animate-pulse"></div>
            ) : (
              <p className="text-lg font-bold font-mono text-white">
                {tokenInfo ? formatNumber(tokenInfo.volume24h) : '—'} <span className="text-xs text-gray-500">XRP</span>
              </p>
            )}
          </div>

          {/* Market Cap */}
          <div>
            <p className="text-xs text-gray-500 uppercase">Market Cap</p>
            {isLoading ? (
              <div className="h-6 w-20 bg-bear-dark-700 rounded animate-pulse"></div>
            ) : (
              <p className="text-lg font-bold font-mono text-white">
                {tokenInfo && tokenInfo.marketCap > 0 ? `$${formatNumber(tokenInfo.marketCap)}` : '—'}
              </p>
            )}
          </div>
        </div>

        {/* Right - Actions */}
        <div className="flex items-center gap-2">
          {/* External Links */}
          {token.issuer && (
            <a
              href={`https://xrpscan.com/account/${token.issuer}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg bg-bear-dark-800 hover:bg-bear-dark-700 transition-colors"
              title="View on XRPScan"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}

          {/* Refresh */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95, rotate: 180 }}
            className="p-2 rounded-lg bg-bear-dark-800 hover:bg-bear-dark-700 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </motion.button>
        </div>
      </div>

      {/* Mobile Price Bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-2.5 border-t border-bear-dark-700 bg-bear-dark-800/50">
        <div className="flex items-center justify-between w-full gap-3">
          <div className="flex-1 text-center">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Price</p>
            <p className="text-sm font-bold font-mono text-white">
              {tokenInfo ? formatPrice(tokenInfo.price) : '—'}
            </p>
          </div>
          <div className="flex-1 text-center border-l border-r border-bear-dark-700/50 px-2">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">24h</p>
            <p className={`text-sm font-bold font-mono ${
              tokenInfo && tokenInfo.priceChange24h >= 0 ? 'text-bear-green-400' : 'text-red-400'
            }`}>
              {tokenInfo ? `${tokenInfo.priceChange24h >= 0 ? '+' : ''}${tokenInfo.priceChange24h.toFixed(2)}%` : '—'}
            </p>
          </div>
          <div className="flex-1 text-center border-r border-bear-dark-700/50 pr-2">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Vol</p>
            <p className="text-sm font-bold font-mono text-white">
              {tokenInfo ? formatNumber(tokenInfo.volume24h) : '—'}
            </p>
          </div>
          <div className="flex-1 text-center">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">MCap</p>
            <p className="text-sm font-bold font-mono text-white">
              {tokenInfo && tokenInfo.marketCap > 0 ? `$${formatNumber(tokenInfo.marketCap)}` : '—'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
