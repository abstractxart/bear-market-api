/**
 * BEAR MARKET - Token Table Component
 *
 * Displays token leaderboard with sortable columns.
 * Mobile-first design matching FirstLedger's layout.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LeaderboardToken } from '../types';
import {
  formatCompactNumber,
  formatPrice,
  getTokenIconUrls,
} from '../services/tokenLeaderboardService';

// ==================== TYPES ====================

interface TokenTableProps {
  tokens: LeaderboardToken[];
  sortBy: string;
  sortDirection: 'asc' | 'desc';
  onSort: (column: string) => void;
  loading?: boolean;
}

// BEAR token issuer for highlighting
const BEAR_ISSUER = 'rBEARGUAsyu7tUw53rufQzFdWmJHpJEqFW';

// ==================== MAIN COMPONENT ====================

const TokenTable: React.FC<TokenTableProps> = ({
  tokens,
  sortBy,
  sortDirection,
  onSort,
  loading,
}) => {
  const [previousPrices, setPreviousPrices] = useState<Map<string, number>>(new Map());
  const [flashingTokens, setFlashingTokens] = useState<Map<string, 'up' | 'down'>>(new Map());
  const [showScrollTop, setShowScrollTop] = useState(false);
  const mobileScrollRef = useRef<HTMLDivElement>(null);
  const desktopScrollRef = useRef<HTMLDivElement>(null);

  // Track scroll position for scroll-to-top button
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    setShowScrollTop(target.scrollTop > 200);
  };

  const scrollToTop = () => {
    mobileScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    desktopScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Track price changes for flash animation
  useEffect(() => {
    const newFlashing = new Map<string, 'up' | 'down'>();

    tokens.forEach(token => {
      const key = `${token.currency}:${token.issuer}`;
      const prevPrice = previousPrices.get(key);
      const currentPrice = token.price;

      if (prevPrice !== undefined && currentPrice !== undefined && prevPrice !== currentPrice) {
        newFlashing.set(key, currentPrice > prevPrice ? 'up' : 'down');
      }
    });

    if (newFlashing.size > 0) {
      setFlashingTokens(newFlashing);
      setTimeout(() => setFlashingTokens(new Map()), 1000);
    }

    const newPrices = new Map<string, number>();
    tokens.forEach(token => {
      const key = `${token.currency}:${token.issuer}`;
      if (token.price !== undefined) {
        newPrices.set(key, token.price);
      }
    });
    setPreviousPrices(newPrices);
  }, [tokens]);

  // Column header click handler
  const handleHeaderClick = (column: string) => {
    onSort(column);
  };

  // Render sort indicator - BEARpark gold
  const SortIndicator = ({ column }: { column: string }) => {
    if (sortBy !== column) return null;
    return (
      <span className="text-bearpark-gold ml-0.5">
        {sortDirection === 'desc' ? '▼' : '▲'}
      </span>
    );
  };

  return (
    <div className="relative md:rounded-2xl overflow-hidden">
      {/* BEARpark tri-gradient border - desktop only */}
      <div className="hidden md:block absolute inset-0 rounded-2xl bg-gradient-to-r from-[#680cd9] via-[#feb501] to-[#07ae08] p-[3px]">
        <div className="w-full h-full rounded-2xl bg-bear-dark-800"></div>
      </div>

      {/* MOBILE LAYOUT - Scrollable table with sticky columns */}
      <div
        ref={mobileScrollRef}
        onScroll={handleScroll}
        className="md:hidden relative z-10 bg-[#0d0d12] px-1"
        style={{ overflow: 'auto', maxHeight: 'calc(100vh - 90px)', WebkitOverflowScrolling: 'touch' }}
      >
        <table className="text-sm border-collapse w-full" style={{ minWidth: '680px' }}>
          {/* Mobile Header - sticky top with subtle glow */}
          <thead>
            <tr className="text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b border-bear-dark-600/50">
              <th className="py-2.5 pl-2 pr-1 text-center bg-[#0d0d12]" style={{ position: 'sticky', left: 0, top: 0, zIndex: 50, width: '28px' }}>#</th>
              <th className="py-2.5 pl-1 pr-2 text-left bg-[#0d0d12] min-w-[90px]" style={{ position: 'sticky', left: '28px', top: 0, zIndex: 50 }}>Token</th>
              <th className="py-2.5 px-2 text-right min-w-[72px] bg-[#0d0d12]" style={{ position: 'sticky', top: 0, zIndex: 40 }}>Price</th>
              <th className="py-2.5 px-1.5 text-right min-w-[48px] bg-[#0d0d12]" style={{ position: 'sticky', top: 0, zIndex: 40 }}>1H</th>
              <th className="py-2.5 px-1.5 text-right min-w-[48px] bg-[#0d0d12]" style={{ position: 'sticky', top: 0, zIndex: 40 }}>24H</th>
              <th className="py-2.5 px-2 text-right min-w-[62px] bg-[#0d0d12]" style={{ position: 'sticky', top: 0, zIndex: 40 }}>Vol</th>
              <th className="py-2.5 px-2 text-right min-w-[68px] bg-[#0d0d12]" style={{ position: 'sticky', top: 0, zIndex: 40 }}>MCap</th>
              <th className="py-2.5 px-2 text-right min-w-[62px] bg-[#0d0d12]" style={{ position: 'sticky', top: 0, zIndex: 40 }}>TVL</th>
              <th className="py-2.5 pl-2 pr-2 text-right min-w-[56px] bg-[#0d0d12]" style={{ position: 'sticky', top: 0, zIndex: 40 }}>Holders</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-bear-dark-700/50">
            {loading ? (
              Array.from({ length: 15 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="py-2.5 pl-2 pr-1 text-center bg-[#0d0d12]" style={{ position: 'sticky', left: 0, zIndex: 30, width: '28px' }}>
                    <div className="w-4 h-4 bg-bear-dark-600 rounded mx-auto"></div>
                  </td>
                  <td className="py-2.5 pl-1 bg-[#0d0d12]" style={{ position: 'sticky', left: '28px', zIndex: 30 }}>
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-6 bg-bear-dark-600 rounded-full flex-shrink-0"></div>
                      <div className="h-4 w-14 bg-bear-dark-600 rounded"></div>
                    </div>
                  </td>
                  <td className="py-2.5"><div className="h-4 w-14 bg-bear-dark-600 rounded ml-auto"></div></td>
                  <td className="py-2.5"><div className="h-4 w-9 bg-bear-dark-600 rounded ml-auto"></div></td>
                  <td className="py-2.5"><div className="h-4 w-9 bg-bear-dark-600 rounded ml-auto"></div></td>
                  <td className="py-2.5"><div className="h-4 w-10 bg-bear-dark-600 rounded ml-auto"></div></td>
                  <td className="py-2.5"><div className="h-4 w-12 bg-bear-dark-600 rounded ml-auto"></div></td>
                  <td className="py-2.5"><div className="h-4 w-10 bg-bear-dark-600 rounded ml-auto"></div></td>
                  <td className="py-2.5 pr-2"><div className="h-4 w-10 bg-bear-dark-600 rounded ml-auto"></div></td>
                </tr>
              ))
            ) : (
              tokens.map((token, index) => (
                <MobileTokenRow
                  key={`${token.currency}:${token.issuer}`}
                  token={token}
                  rank={index + 1}
                  flashDirection={flashingTokens.get(`${token.currency}:${token.issuer}`)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* DESKTOP LAYOUT - Full table with horizontal scroll */}
      <div
        ref={desktopScrollRef}
        onScroll={handleScroll}
        className="hidden md:block relative z-10 overflow-x-auto overflow-y-auto max-h-[calc(100vh-220px)] bg-bear-dark-800/80 md:rounded-2xl"
      >
        <table className="w-full text-sm min-w-[600px]">
          {/* Header */}
          <thead className="sticky top-0 z-30 bg-bear-dark-800 border-b border-bear-dark-700">
            <tr>
              {/* Rank # */}
              <th className="sticky left-0 z-40 bg-bear-dark-800 pl-3 pr-1 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 w-8">
                #
              </th>

              {/* Token - always visible, sticky on scroll */}
              <th
                className="sticky left-8 z-40 bg-bear-dark-800 pl-1 pr-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer hover:text-white"
                onClick={() => handleHeaderClick('token')}
              >
                Token
                <SortIndicator column="token" />
              </th>

              {/* Price - always visible */}
              <th
                className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer hover:text-white whitespace-nowrap"
                onClick={() => handleHeaderClick('price')}
              >
                Price
                <SortIndicator column="price" />
              </th>

              {/* 1h */}
              <th
                className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer hover:text-white whitespace-nowrap"
                onClick={() => handleHeaderClick('priceChange1h')}
              >
                1h
                <SortIndicator column="priceChange1h" />
              </th>

              {/* 24h */}
              <th
                className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer hover:text-white whitespace-nowrap"
                onClick={() => handleHeaderClick('priceChange24h')}
              >
                24h
                <SortIndicator column="priceChange24h" />
              </th>

              {/* 7d */}
              <th
                className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer hover:text-white whitespace-nowrap"
                onClick={() => handleHeaderClick('priceChange7d')}
              >
                7d
                <SortIndicator column="priceChange7d" />
              </th>

              {/* Volume */}
              <th
                className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer hover:text-white whitespace-nowrap"
                onClick={() => handleHeaderClick('volume24h')}
              >
                Vol
                <SortIndicator column="volume24h" />
              </th>

              {/* Market Cap */}
              <th
                className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer hover:text-white whitespace-nowrap"
                onClick={() => handleHeaderClick('marketCap')}
              >
                MCap
                <SortIndicator column="marketCap" />
              </th>

              {/* TVL */}
              <th
                className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer hover:text-white whitespace-nowrap"
                onClick={() => handleHeaderClick('tvl')}
              >
                TVL
                <SortIndicator column="tvl" />
              </th>

              {/* Holders */}
              <th
                className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer hover:text-white whitespace-nowrap pr-3"
                onClick={() => handleHeaderClick('holders')}
              >
                Holders
                <SortIndicator column="holders" />
              </th>
            </tr>
          </thead>

          {/* Body */}
          <tbody className="divide-y divide-bear-dark-700/50">
            {loading ? (
              // Loading skeleton
              Array.from({ length: 15 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="sticky left-0 bg-bear-dark-800 pl-3 pr-1 py-3">
                    <div className="h-4 w-4 bg-bear-dark-600 rounded"></div>
                  </td>
                  <td className="sticky left-8 bg-bear-dark-800 pl-1 pr-2 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-bear-dark-600 rounded-full"></div>
                      <div className="h-4 w-16 bg-bear-dark-600 rounded"></div>
                    </div>
                  </td>
                  <td className="px-2 py-3"><div className="h-4 w-16 bg-bear-dark-600 rounded ml-auto"></div></td>
                  <td className="px-2 py-3"><div className="h-4 w-10 bg-bear-dark-600 rounded ml-auto"></div></td>
                  <td className="px-2 py-3"><div className="h-4 w-10 bg-bear-dark-600 rounded ml-auto"></div></td>
                  <td className="px-2 py-3"><div className="h-4 w-10 bg-bear-dark-600 rounded ml-auto"></div></td>
                  <td className="px-2 py-3"><div className="h-4 w-16 bg-bear-dark-600 rounded ml-auto"></div></td>
                  <td className="px-2 py-3"><div className="h-4 w-14 bg-bear-dark-600 rounded ml-auto"></div></td>
                  <td className="px-2 py-3"><div className="h-4 w-16 bg-bear-dark-600 rounded ml-auto"></div></td>
                  <td className="px-2 py-3 pr-3"><div className="h-4 w-12 bg-bear-dark-600 rounded ml-auto"></div></td>
                </tr>
              ))
            ) : (
              tokens.map((token, index) => (
                <TokenRow
                  key={`${token.currency}:${token.issuer}`}
                  token={token}
                  rank={index + 1}
                  flashDirection={flashingTokens.get(`${token.currency}:${token.issuer}`)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Empty state */}
      {!loading && tokens.length === 0 && (
        <div className="py-12 text-center text-gray-500">
          No tokens found
        </div>
      )}

      {/* Scroll to Top Button */}
      <button
        onClick={scrollToTop}
        aria-label="Scroll to top"
        className={`
          transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]
          ${showScrollTop
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-50 translate-y-4 pointer-events-none'
          }
          hover:scale-110 active:scale-95
        `}
        style={{
          position: 'absolute',
          bottom: '80px',
          right: '24px',
          width: '56px',
          height: '56px',
          zIndex: 100,
          cursor: 'pointer',
          background: 'transparent',
          border: 'none',
          padding: 0,
        }}
      >
        {/* Spinning gradient border */}
        <div
          className="animate-spin-slow"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '9999px',
            background: 'conic-gradient(from 0deg, #680cd9, #feb501, #07ae08, #680cd9)',
          }}
        />
        {/* Inner button */}
        <div
          style={{
            position: 'absolute',
            inset: '3px',
            borderRadius: '9999px',
            background: '#0A0A0F',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#edb723"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 15l7-7 7 7" />
          </svg>
        </div>
      </button>
    </div>
  );
};

// ==================== TOKEN ROW ====================

interface TokenRowProps {
  token: LeaderboardToken;
  rank: number;
  flashDirection?: 'up' | 'down';
}

const TokenRow: React.FC<TokenRowProps> = ({ token, rank, flashDirection }) => {
  const navigate = useNavigate();
  const isBear = token.currency === 'BEAR' && token.issuer === BEAR_ISSUER;

  const handleClick = () => {
    if (token.issuer) {
      navigate(`/tokens/${token.currency}/${token.issuer}`);
    }
  };

  // BEAR gets the GODMODE treatment - golden row with spinning ring around icon
  if (isBear) {
    return (
      <tr
        onClick={handleClick}
        className="bg-gradient-to-r from-[#edb723]/20 via-[#edb723]/10 to-[#edb723]/20 border-y border-[#edb723]/30 cursor-pointer hover:from-[#edb723]/30 hover:via-[#edb723]/20 hover:to-[#edb723]/30 transition-all"
      >
        {/* Rank */}
        <td className="sticky left-0 z-10 bg-[#1a1a1a] pl-3 pr-1 py-2.5 text-xs font-mono border-l-2 border-[#edb723]">
          <span className="text-bearpark-gold font-black text-sm">{rank}</span>
        </td>

        {/* Token */}
        <td className="sticky left-8 z-10 bg-[#1a1a1a] pl-1 pr-2 py-2.5">
          <div className="flex items-center gap-2">
            {/* BEAR icon - simple, no ring */}
            <TokenIcon token={token} />
            <div className="min-w-0">
              <div className="font-black text-sm text-bearpark-gold drop-shadow-[0_0_8px_rgba(237,183,35,0.5)]">
                ${token.symbol || token.currency || 'Unknown'}
              </div>
              <div className="text-[10px] text-bearpark-gold/60 truncate hidden sm:block font-medium">
                {token.issuer?.slice(0, 8)}...
              </div>
            </div>
          </div>
        </td>

        {/* Price - XRP */}
        <td className="px-2 py-2.5 text-right font-mono text-bearpark-gold text-xs whitespace-nowrap font-bold">
          <span className="inline-flex items-center justify-end gap-0.5">
            {formatPrice(token.price)}
            <img src="https://pub-58cecf0785cc4738a3496a79699fdf1e.r2.dev/images/lufprf.png" alt="XRP" className="w-3 h-3 opacity-80" />
          </span>
        </td>

        {/* 1h */}
        <td className="px-2 py-2.5 text-right whitespace-nowrap">
          <PriceChange value={token.priceChange1h} />
        </td>

        {/* 24h */}
        <td className="px-2 py-2.5 text-right whitespace-nowrap">
          <PriceChange value={token.priceChange24h} />
        </td>

        {/* 7d */}
        <td className="px-2 py-2.5 text-right whitespace-nowrap">
          <PriceChange value={token.priceChange7d} />
        </td>

        {/* Volume 24h - XRP from vol24hxrp */}
        <td className="px-2 py-2.5 text-right font-mono text-bearpark-gold/80 text-xs whitespace-nowrap">
          <span className="inline-flex items-center justify-end gap-0.5">
            {formatCompactNumber(token.volume24h)}
            <img src="https://pub-58cecf0785cc4738a3496a79699fdf1e.r2.dev/images/lufprf.png" alt="XRP" className="w-3 h-3 opacity-60" />
          </span>
        </td>

        {/* Market Cap - USD */}
        <td className="px-2 py-2.5 text-right font-mono text-bearpark-gold/80 text-xs whitespace-nowrap">
          {token.marketCap ? `$${formatCompactNumber(token.marketCap)}` : '--'}
        </td>

        {/* TVL */}
        <td className="px-2 py-2.5 text-right font-mono text-bearpark-gold/80 text-xs whitespace-nowrap">
          {token.tvl ? (
            <span className="inline-flex items-center justify-end gap-0.5">
              {formatCompactNumber(token.tvl)}
              <img src="https://pub-58cecf0785cc4738a3496a79699fdf1e.r2.dev/images/lufprf.png" alt="XRP" className="w-3 h-3 opacity-60" />
            </span>
          ) : '--'}
        </td>

        {/* Holders */}
        <td className="px-2 py-2.5 pr-3 text-right font-mono text-bearpark-gold/80 text-xs whitespace-nowrap border-r-2 border-[#edb723]">
          {token.holders?.toLocaleString() || '--'}
        </td>
      </tr>
    );
  }

  // Regular tokens
  return (
    <tr
      onClick={handleClick}
      className={`
        transition-colors hover:bg-bear-dark-700/50 cursor-pointer
        ${flashDirection === 'up' ? 'animate-flash-green' : ''}
        ${flashDirection === 'down' ? 'animate-flash-red' : ''}
      `}
    >
      {/* Rank */}
      <td className="sticky left-0 z-10 bg-bear-dark-800 pl-3 pr-1 py-2 text-xs text-gray-500 font-mono">
        {rank}
      </td>

      {/* Token */}
      <td className="sticky left-8 z-10 bg-bear-dark-800 pl-1 pr-2 py-2">
        <div className="flex items-center gap-2">
          <TokenIcon token={token} />
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate text-white">
              ${token.symbol || token.currency || 'Unknown'}
            </div>
            <div className="text-[10px] text-gray-500 truncate hidden sm:block">
              {token.issuer?.slice(0, 8)}...
            </div>
          </div>
        </div>
      </td>

      {/* Price - XRP */}
      <td className="px-2 py-2 text-right font-mono text-white text-xs whitespace-nowrap">
        <span className="inline-flex items-center justify-end gap-0.5">
          {formatPrice(token.price)}
          <img src="https://pub-58cecf0785cc4738a3496a79699fdf1e.r2.dev/images/lufprf.png" alt="XRP" className="w-3 h-3 opacity-50" />
        </span>
      </td>

      {/* 1h */}
      <td className="px-2 py-2 text-right whitespace-nowrap">
        <PriceChange value={token.priceChange1h} />
      </td>

      {/* 24h */}
      <td className="px-2 py-2 text-right whitespace-nowrap">
        <PriceChange value={token.priceChange24h} />
      </td>

      {/* 7d */}
      <td className="px-2 py-2 text-right whitespace-nowrap">
        <PriceChange value={token.priceChange7d} />
      </td>

      {/* Volume 24h - XRP from vol24hxrp */}
      <td className="px-2 py-2 text-right font-mono text-gray-300 text-xs whitespace-nowrap">
        <span className="inline-flex items-center justify-end gap-0.5">
          {formatCompactNumber(token.volume24h)}
          <img src="https://pub-58cecf0785cc4738a3496a79699fdf1e.r2.dev/images/lufprf.png" alt="XRP" className="w-3 h-3 opacity-40" />
        </span>
      </td>

      {/* Market Cap - USD */}
      <td className="px-2 py-2 text-right font-mono text-gray-300 text-xs whitespace-nowrap">
        {token.marketCap ? `$${formatCompactNumber(token.marketCap)}` : '--'}
      </td>

      {/* TVL */}
      <td className="px-2 py-2 text-right font-mono text-gray-300 text-xs whitespace-nowrap">
        {token.tvl ? (
          <span className="inline-flex items-center justify-end gap-0.5">
            {formatCompactNumber(token.tvl)}
            <img src="https://pub-58cecf0785cc4738a3496a79699fdf1e.r2.dev/images/lufprf.png" alt="XRP" className="w-3 h-3 opacity-40" />
          </span>
        ) : '--'}
      </td>

      {/* Holders */}
      <td className="px-2 py-2 pr-3 text-right font-mono text-gray-300 text-xs whitespace-nowrap">
        {token.holders?.toLocaleString() || '--'}
      </td>
    </tr>
  );
};

// ==================== MOBILE TOKEN ROW ====================

const MobileTokenRow: React.FC<TokenRowProps> = ({ token, rank, flashDirection }) => {
  const navigate = useNavigate();
  const isBear = token.currency === 'BEAR' && token.issuer === BEAR_ISSUER;

  const handleClick = () => {
    if (token.issuer) {
      navigate(`/tokens/${token.currency}/${token.issuer}`);
    }
  };

  // BEAR token gets GODMODE golden treatment - clean and consistent
  if (isBear) {
    return (
      <tr
        onClick={handleClick}
        className={`
          cursor-pointer active:scale-[0.99] transition-transform bg-[#1a1608]
          ${flashDirection === 'up' ? 'animate-flash-green' : ''}
          ${flashDirection === 'down' ? 'animate-flash-red' : ''}
        `}
        style={{
          boxShadow: 'inset 0 1px 0 rgba(237,183,35,0.3), inset 0 -1px 0 rgba(237,183,35,0.3)'
        }}
      >
        <td
          className="py-3 pl-2 pr-1 text-center text-sm font-black text-bearpark-gold border-l-2 border-[#edb723] bg-[#1a1608]"
          style={{ position: 'sticky', left: 0, zIndex: 30, width: '28px' }}
        >
          {rank}
        </td>
        <td
          className="py-3 pl-1 bg-[#1a1608]"
          style={{ position: 'sticky', left: '28px', zIndex: 30 }}
        >
          <div className="flex items-center gap-1.5">
            <TokenIcon token={token} />
            <span className="font-black text-sm text-bearpark-gold truncate max-w-[70px]">
              ${token.symbol || token.currency || 'Unknown'}
            </span>
          </div>
        </td>
        <td className="py-3 px-2 text-right font-mono text-xs text-bearpark-gold font-bold whitespace-nowrap">
          <span className="inline-flex items-center justify-end gap-0.5">
            {formatPrice(token.price)}
            <img src="https://pub-58cecf0785cc4738a3496a79699fdf1e.r2.dev/images/lufprf.png" alt="XRP" className="w-2.5 h-2.5 opacity-80" />
          </span>
        </td>
        <td className="py-3 px-1.5 text-right whitespace-nowrap">
          <PriceChange value={token.priceChange1h} isBear />
        </td>
        <td className="py-3 px-1.5 text-right whitespace-nowrap">
          <PriceChange value={token.priceChange24h} isBear />
        </td>
        <td className="py-3 px-2 text-right font-mono text-xs text-bearpark-gold/90 whitespace-nowrap">
          <span className="inline-flex items-center justify-end gap-0.5">
            {formatCompactNumber(token.volume24h)}
            <img src="https://pub-58cecf0785cc4738a3496a79699fdf1e.r2.dev/images/lufprf.png" alt="XRP" className="w-2.5 h-2.5 opacity-60" />
          </span>
        </td>
        <td className="py-3 px-2 text-right font-mono text-xs text-bearpark-gold/90 whitespace-nowrap">
          {token.marketCap ? `$${formatCompactNumber(token.marketCap)}` : '--'}
        </td>
        <td className="py-3 px-2 text-right font-mono text-xs text-bearpark-gold/90 whitespace-nowrap">
          {token.tvl ? (
            <span className="inline-flex items-center justify-end gap-0.5">
              {formatCompactNumber(token.tvl)}
              <img src="https://pub-58cecf0785cc4738a3496a79699fdf1e.r2.dev/images/lufprf.png" alt="XRP" className="w-2.5 h-2.5 opacity-60" />
            </span>
          ) : '--'}
        </td>
        <td className="py-3 pl-2 pr-2 text-right font-mono text-xs text-bearpark-gold/90 whitespace-nowrap border-r-2 border-[#edb723]">
          {token.holders?.toLocaleString() || '--'}
        </td>
      </tr>
    );
  }

  // Regular tokens - clean and premium
  return (
    <tr
      onClick={handleClick}
      className={`
        cursor-pointer hover:bg-bear-dark-700/40 active:scale-[0.995] transition-all
        ${flashDirection === 'up' ? 'animate-flash-green' : ''}
        ${flashDirection === 'down' ? 'animate-flash-red' : ''}
      `}
    >
      <td
        className="py-2.5 pl-2 pr-1 text-center text-xs font-semibold text-gray-500 bg-[#0d0d12]"
        style={{ position: 'sticky', left: 0, zIndex: 30, width: '28px' }}
      >
        {rank}
      </td>
      <td
        className="py-2.5 pl-1 bg-[#0d0d12]"
        style={{ position: 'sticky', left: '28px', zIndex: 30 }}
      >
        <div className="flex items-center gap-1.5">
          <TokenIcon token={token} />
          <span className="font-semibold text-sm text-white truncate max-w-[70px]">
            ${token.symbol || token.currency || 'Unknown'}
          </span>
        </div>
      </td>
      <td className="py-2.5 px-2 text-right font-mono text-xs text-white whitespace-nowrap">
        <span className="inline-flex items-center justify-end gap-0.5">
          {formatPrice(token.price)}
          <img src="https://pub-58cecf0785cc4738a3496a79699fdf1e.r2.dev/images/lufprf.png" alt="XRP" className="w-2.5 h-2.5 opacity-50" />
        </span>
      </td>
      <td className="py-2.5 px-1.5 text-right whitespace-nowrap">
        <PriceChange value={token.priceChange1h} />
      </td>
      <td className="py-2.5 px-1.5 text-right whitespace-nowrap">
        <PriceChange value={token.priceChange24h} />
      </td>
      <td className="py-2.5 px-2 text-right font-mono text-xs text-gray-400 whitespace-nowrap">
        <span className="inline-flex items-center justify-end gap-0.5">
          {formatCompactNumber(token.volume24h)}
          <img src="https://pub-58cecf0785cc4738a3496a79699fdf1e.r2.dev/images/lufprf.png" alt="XRP" className="w-2.5 h-2.5 opacity-40" />
        </span>
      </td>
      <td className="py-2.5 px-2 text-right font-mono text-xs text-gray-400 whitespace-nowrap">
        {token.marketCap ? `$${formatCompactNumber(token.marketCap)}` : '--'}
      </td>
      <td className="py-2.5 px-2 text-right font-mono text-xs text-gray-400 whitespace-nowrap">
        {token.tvl ? (
          <span className="inline-flex items-center justify-end gap-0.5">
            {formatCompactNumber(token.tvl)}
            <img src="https://pub-58cecf0785cc4738a3496a79699fdf1e.r2.dev/images/lufprf.png" alt="XRP" className="w-2.5 h-2.5 opacity-40" />
          </span>
        ) : '--'}
      </td>
      <td className="py-2.5 pl-2 pr-2 text-right font-mono text-xs text-gray-400 whitespace-nowrap">
        {token.holders?.toLocaleString() || '--'}
      </td>
    </tr>
  );
};

// ==================== HELPER COMPONENTS ====================

const TokenIcon: React.FC<{ token: LeaderboardToken }> = ({ token }) => {
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

  // Defensive: Handle tokens with missing symbol/currency
  const displayText = (token.symbol || token.currency || '??').slice(0, 2);

  return (
    <div className="w-6 h-6 rounded-full bg-bear-dark-600 flex items-center justify-center overflow-hidden flex-shrink-0">
      {imgSrc ? (
        <img
          src={imgSrc}
          alt={token.symbol || token.currency || 'Token'}
          className="w-full h-full object-cover"
          onError={handleError}
        />
      ) : (
        <span className="text-[10px] font-bold text-gray-400">
          {displayText}
        </span>
      )}
    </div>
  );
};

const PriceChange: React.FC<{ value?: number; isBear?: boolean }> = ({ value, isBear }) => {
  if (value === undefined || value === null) {
    return <span className="text-gray-500 font-mono text-xs">--</span>;
  }

  const isPositive = value >= 0;

  // Make colors POP - brighter and bolder
  const baseColor = isPositive ? 'text-green-400' : 'text-red-400';
  const glowColor = isPositive
    ? 'drop-shadow-[0_0_4px_rgba(74,222,128,0.5)]'
    : 'drop-shadow-[0_0_4px_rgba(248,113,113,0.5)]';

  // BEAR row gets golden treatment for neutral, enhanced for changes
  if (isBear) {
    const bearColor = isPositive
      ? 'text-green-400 drop-shadow-[0_0_6px_rgba(74,222,128,0.6)]'
      : 'text-red-400 drop-shadow-[0_0_6px_rgba(248,113,113,0.6)]';
    return (
      <span className={`font-mono text-xs font-bold ${bearColor}`}>
        {isPositive ? '+' : ''}{value.toFixed(1)}%
      </span>
    );
  }

  return (
    <span className={`font-mono text-xs font-medium ${baseColor} ${Math.abs(value) > 5 ? glowColor : ''}`}>
      {isPositive ? '+' : ''}{value.toFixed(1)}%
    </span>
  );
};

export default TokenTable;
