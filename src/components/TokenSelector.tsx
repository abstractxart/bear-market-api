/**
 * BEAR SWAP - Token Selector
 *
 * Token selection modal featuring:
 * - Animated gradient styling
 * - Search across all XRPL tokens
 * - Token icons from Bithomp CDN
 * - Popular tokens quick access
 * - Price and volume data
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  searchTokens,
  getPopularTokens,
  getTokenIconUrl,
  getTokenIconUrls,
  formatCurrencyCode,
  fetchDexScreenerIcon,
  COMMON_TOKENS,
  XRP_TOKEN,
  type XRPLToken,
} from '../services/tokenService';
import { getLeaderboardTokens } from '../services/tokenLeaderboardService';
import type { Token } from '../types';
import { useWallet } from '../context/WalletContext';

interface TokenSelectorProps {
  isOpen?: boolean;
  onSelect: (token: Token) => void;
  onClose: () => void;
  selectedToken?: Token;
  excludeToken?: Token | null;
}

// Token icon component with fallback - tries multiple icon sources + DexScreener API
const TokenIcon = ({ token, size = 40 }: { token: Token | XRPLToken; size?: number }) => {
  const [currentUrlIndex, setCurrentUrlIndex] = useState(0);
  const [dynamicUrl, setDynamicUrl] = useState<string | null>(null);
  const [fetchingDynamic, setFetchingDynamic] = useState(false);
  const [allFailed, setAllFailed] = useState(false);

  // Get list of URLs to try
  const iconUrls = useMemo(() => {
    if (token.icon) return [token.icon];
    return getTokenIconUrls(token.currency, token.issuer);
  }, [token.currency, token.issuer, token.icon]);

  const currentUrl = dynamicUrl || iconUrls[currentUrlIndex];

  // Reset when token changes
  useEffect(() => {
    setCurrentUrlIndex(0);
    setDynamicUrl(null);
    setFetchingDynamic(false);
    setAllFailed(false);
  }, [token.currency, token.issuer]);

  // Handle image load error - try next URL or fetch from DexScreener
  const handleError = async () => {
    if (currentUrlIndex < iconUrls.length - 1) {
      setCurrentUrlIndex(prev => prev + 1);
    } else if (!fetchingDynamic && !dynamicUrl) {
      // Try fetching from DexScreener API
      setFetchingDynamic(true);
      const icon = await fetchDexScreenerIcon(token.symbol || token.currency);
      if (icon) {
        setDynamicUrl(icon);
      } else {
        setAllFailed(true);
      }
      setFetchingDynamic(false);
    } else {
      setAllFailed(true);
    }
  };

  // Generate a color from the token name for fallback
  const generateColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = hash % 360;
    return `hsl(${hue}, 60%, 50%)`;
  };

  if (allFailed || !currentUrl) {
    return (
      <div
        className="rounded-full flex items-center justify-center text-white font-bold"
        style={{
          width: size,
          height: size,
          backgroundColor: generateColor(token.currency),
          fontSize: size * 0.35,
        }}
      >
        {token.symbol?.slice(0, 3) || token.currency.slice(0, 3)}
      </div>
    );
  }

  return (
    <img
      src={currentUrl}
      alt={token.name || token.currency}
      className="rounded-full object-cover bg-bear-dark-700"
      style={{ width: size, height: size }}
      onError={handleError}
    />
  );
};

// Format volume in XRP (like Magnetic shows: "1K", "2.7K", "255")
const formatVolumeXRP = (num: number | undefined): string => {
  if (!num || num === 0) return '';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M XRP`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K XRP`;
  return `${Math.round(num)} XRP`;
};

// Format price change
const formatPriceChange = (change: number | undefined): { text: string; color: string } => {
  if (change === undefined || change === null) return { text: '', color: 'text-gray-500' };
  const num = typeof change === 'string' ? parseFloat(change) : change;
  if (isNaN(num)) return { text: '', color: 'text-gray-500' };
  const sign = num >= 0 ? '+' : '';
  const color = num >= 0 ? 'text-bear-green-400' : 'text-red-400';
  return { text: `${sign}${num.toFixed(2)}%`, color };
};

// Safely format price
const formatPrice = (price: number | string | undefined): string => {
  if (price === undefined || price === null) return '';
  const num = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(num)) return '';
  return num.toFixed(6);
};

const TokenSelector: React.FC<TokenSelectorProps> = ({
  isOpen = true,
  onSelect,
  onClose,
  selectedToken,
  excludeToken,
}) => {
  const { wallet } = useWallet();
  const [searchQuery, setSearchQuery] = useState('');
  const [tokens, setTokens] = useState<XRPLToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'popular' | 'wallet'>('popular');
  const [showCustomEntry, setShowCustomEntry] = useState(false);
  const [customCurrency, setCustomCurrency] = useState('');
  const [customIssuer, setCustomIssuer] = useState('');

  // Debounced search AND initial load
  // Uses getLeaderboardTokens (same as Tokens page - up to 1000 tokens!)
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        if (searchQuery.length >= 2) {
          // Searching - use multi-API search
          const results = await searchTokens(searchQuery);
          setTokens(results);
        } else {
          // No search query - load leaderboard tokens (same as Tokens page!)
          try {
            const leaderboardTokens = await getLeaderboardTokens();
            if (leaderboardTokens.length > 0) {
              setTokens(leaderboardTokens as XRPLToken[]);
            } else {
              throw new Error('No leaderboard tokens');
            }
          } catch {
            // Fallback to popular tokens
            try {
              const popular = await getPopularTokens();
              setTokens(popular);
            } catch {
              // Last resort: common tokens
              setTokens(COMMON_TOKENS);
            }
          }
        }
      } catch (error) {
        console.error('Token search error:', error);
        setTokens(COMMON_TOKENS);
      } finally {
        setLoading(false);
      }
    }, searchQuery.length >= 2 ? 300 : 0); // Instant load for initial, debounce for search

    return () => clearTimeout(timer);
  }, [searchQuery, isOpen]);

  // Get user's wallet tokens
  const walletTokens = useMemo(() => {
    const userTokens: XRPLToken[] = [];

    // Add XRP first
    userTokens.push({
      ...XRP_TOKEN,
      issuer: '',
    } as XRPLToken);

    // Add user's tokens with decoded currency codes
    for (const tb of wallet.balance.tokens) {
      const decodedCurrency = formatCurrencyCode(tb.token.currency);
      // Check if name looks like hex (40 char hex string) and use decoded instead
      const isHexName = tb.token.name && tb.token.name.length === 40 && /^[0-9A-Fa-f]+$/.test(tb.token.name);
      const tokenName = isHexName ? decodedCurrency : (tb.token.name || decodedCurrency);

      userTokens.push({
        currency: tb.token.currency,
        issuer: tb.token.issuer || '',
        name: tokenName,
        symbol: decodedCurrency,
        icon: getTokenIconUrl(tb.token.currency, tb.token.issuer), // Always use Bithomp CDN
        decimals: tb.token.decimals,
      });
    }

    return userTokens;
  }, [wallet.balance.tokens]);

  // Filter out excluded token - BEAR is always first from getPopularTokens()
  const displayTokens = useMemo(() => {
    const sourceTokens = activeTab === 'wallet' && !searchQuery ? walletTokens : tokens;

    const filtered = sourceTokens.filter(t => {
      // Exclude the "other side" token
      if (excludeToken && t.currency === excludeToken.currency && t.issuer === excludeToken.issuer) {
        return false;
      }
      return true;
    });

    return filtered;
  }, [tokens, walletTokens, excludeToken, searchQuery, activeTab]);

  // Get balance for a token
  const getBalance = useCallback((token: Token | XRPLToken): string => {
    if (token.currency === 'XRP') {
      return wallet.balance.xrp;
    }
    const tokenBalance = wallet.balance.tokens.find(
      (t) => t.token.currency === token.currency && t.token.issuer === token.issuer
    );
    return tokenBalance?.balance || '0';
  }, [wallet.balance]);

  // Handle token selection
  const handleSelect = useCallback((token: Token | XRPLToken) => {
    const selectedToken: Token = {
      currency: token.currency,
      issuer: token.issuer || undefined,
      name: token.name,
      symbol: token.symbol,
      icon: token.icon || getTokenIconUrl(token.currency, token.issuer),
      decimals: token.decimals,
    };
    onSelect(selectedToken);
    setSearchQuery('');
  }, [onSelect]);

  // Reset state on close
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setActiveTab('popular');
      setShowCustomEntry(false);
      setCustomCurrency('');
      setCustomIssuer('');
    }
  }, [isOpen]);

  // Handle custom token entry
  const handleCustomTokenSelect = () => {
    if (!customCurrency || !customIssuer) return;
    if (!customIssuer.startsWith('r') || customIssuer.length < 25) {
      alert('Invalid issuer address. Must start with "r" and be 25-35 characters.');
      return;
    }

    const currency = customCurrency.toUpperCase().trim();
    const token: Token = {
      currency,
      issuer: customIssuer.trim(),
      name: currency,
      symbol: currency,
      icon: getTokenIconUrl(currency, customIssuer.trim()),
      decimals: 15,
    };
    onSelect(token);
    setShowCustomEntry(false);
    setCustomCurrency('');
    setCustomIssuer('');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Backdrop - darker for premium energy */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/90 backdrop-blur-md"
        />

        {/* Modal with animated tri-gradient border */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className="relative w-full max-w-md rounded-2xl max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Animated tri-gradient spinning border */}
          <div className="absolute inset-0 rounded-2xl bg-[conic-gradient(from_0deg,#680cd9,#feb501,#07ae08,#680cd9)] animate-spin-slow opacity-80"></div>

          {/* Inner content container */}
          <div className="relative m-[2px] rounded-[14px] bg-gradient-to-b from-bear-dark-900 via-bear-dark-900 to-black overflow-hidden">
            {/* Floating animated orbs background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-10 -left-10 w-40 h-40 bg-bear-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
              <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-bearpark-gold/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-bear-green-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }}></div>
            </div>

            {/* Header */}
            <div className="relative p-5 border-b border-bear-dark-700/50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white font-luckiest tracking-wide">Select Token</h3>
                {/* Close button with hover effect */}
                <button
                  onClick={onClose}
                  className="relative w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white rounded-lg transition-all group"
                >
                  <span className="absolute inset-0 rounded-lg bg-bear-dark-700 group-hover:bg-bear-dark-600 transition-colors"></span>
                  <span className="relative z-10">✕</span>
                </button>
              </div>

              {/* Search Input with tri-gradient border */}
              <div className="relative">
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-bear-purple-500/50 via-bearpark-gold/50 to-bear-green-500/50 blur-sm opacity-50"></div>
                <div className="relative bg-bear-dark-800 rounded-xl">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, symbol, or issuer..."
                    className="w-full px-4 py-3 pl-10 pr-10 bg-transparent rounded-xl text-white placeholder-gray-500 focus:outline-none"
                    autoFocus
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-bearpark-gold">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  {loading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-5 h-5 border-2 border-bearpark-gold/30 border-t-bearpark-gold rounded-full animate-spin" />
                    </div>
                  )}
                </div>
              </div>

              {/* Tabs with BEARpark styling */}
              {!searchQuery && (
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => setActiveTab('popular')}
                    className={`relative px-4 py-2 rounded-xl text-sm font-bold transition-all overflow-hidden ${
                      activeTab === 'popular'
                        ? 'text-white'
                        : 'text-gray-400 hover:text-white bg-bear-dark-700/50 hover:bg-bear-dark-600/50'
                    }`}
                  >
                    {activeTab === 'popular' && (
                      <>
                        <span className="absolute inset-0 bg-gradient-to-r from-bear-purple-500 to-purple-600"></span>
                        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-shimmer"></span>
                      </>
                    )}
                    <span className="relative flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
                      </svg>
                      Popular
                    </span>
                  </button>
                  {wallet.isConnected && walletTokens.length > 1 && (
                    <button
                      onClick={() => setActiveTab('wallet')}
                      className={`relative px-4 py-2 rounded-xl text-sm font-bold transition-all overflow-hidden ${
                        activeTab === 'wallet'
                          ? 'text-bear-dark-900'
                          : 'text-gray-400 hover:text-white bg-bear-dark-700/50 hover:bg-bear-dark-600/50'
                      }`}
                    >
                      {activeTab === 'wallet' && (
                        <>
                          <span className="absolute inset-0 bg-gradient-to-r from-bearpark-gold to-amber-500"></span>
                          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-shimmer"></span>
                        </>
                      )}
                      <span className="relative flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                        My Tokens
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Token List */}
            <div className="relative max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-bear-dark-600 scrollbar-track-bear-dark-800">
              {displayTokens.length === 0 ? (
                <div className="p-8 text-center">
                  {loading ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="relative">
                        <div className="w-12 h-12 border-3 border-bear-purple-500/30 border-t-bear-purple-500 rounded-full animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-6 h-6 border-2 border-bearpark-gold/30 border-t-bearpark-gold rounded-full animate-spin" style={{ animationDirection: 'reverse' }} />
                        </div>
                      </div>
                      <span className="text-gray-400 font-medium">Searching tokens...</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="w-16 h-16 mx-auto rounded-full bg-bear-dark-700 flex items-center justify-center">
                        <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      <div className="text-gray-400 font-medium">No tokens found</div>
                      <div className="text-xs text-gray-600">Try a different search term</div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-2">
                  {displayTokens.map((token, index) => {
                    const isSelected =
                      selectedToken?.currency === token.currency &&
                      selectedToken?.issuer === token.issuer;
                    const balance = getBalance(token);
                    const hasBalance = parseFloat(balance) > 0;
                    const priceChange = formatPriceChange((token as XRPLToken).priceChange24h);
                    const isBear = token.symbol?.toUpperCase() === 'BEAR' || token.currency?.toUpperCase() === 'BEAR';

                    return (
                      <motion.button
                        key={`${token.currency}-${token.issuer || 'native'}-${index}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(index * 0.02, 0.3) }}
                        onClick={() => handleSelect(token)}
                        className={`w-full px-4 py-3 flex items-center gap-3 transition-all group ${
                          isSelected
                            ? 'bg-bear-purple-500/20 border-l-2 border-bear-purple-500'
                            : isBear
                            ? 'bg-bearpark-gold/5 hover:bg-bearpark-gold/10 border-l-2 border-bearpark-gold/50'
                            : 'hover:bg-white/5'
                        }`}
                      >
                        {/* Token Icon with glow for BEAR */}
                        <div className={`relative ${isBear ? 'animate-pulse' : ''}`}>
                          {isBear && (
                            <div className="absolute inset-0 bg-bearpark-gold/30 rounded-full blur-md"></div>
                          )}
                          <TokenIcon token={token} size={40} />
                        </div>

                        {/* Token Info */}
                        <div className="flex-1 text-left min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`font-bold ${isBear ? 'text-bearpark-gold' : 'text-white'}`}>
                              {token.symbol}
                            </span>
                          </div>
                          <div className="text-sm text-gray-500 truncate">
                            {token.name}
                          </div>
                          {/* Show issuer address for non-XRP tokens */}
                          {token.issuer && (
                            <div className="text-xs text-gray-600 font-mono truncate">
                              {token.issuer.slice(0, 4)}...{token.issuer.slice(-4)}
                            </div>
                          )}
                        </div>

                        {/* Balance, Price & Volume */}
                        <div className="text-right flex-shrink-0">
                          {hasBalance ? (
                            <>
                              <div className="text-sm text-white font-mono">
                                {parseFloat(balance).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                              </div>
                              <div className="text-xs text-gray-500">Balance</div>
                            </>
                          ) : (
                            <>
                              {(token as XRPLToken).price !== undefined && (
                                <div className="text-sm text-bear-green-400 font-mono">
                                  {formatPrice((token as XRPLToken).price)}
                                </div>
                              )}
                              {(token as XRPLToken).volume24h !== undefined && (token as XRPLToken).volume24h! > 0 && (
                                <div className="text-xs text-gray-500">
                                  {formatVolumeXRP((token as XRPLToken).volume24h)}
                                </div>
                              )}
                              {priceChange.text && (
                                <div className={`text-xs ${priceChange.color}`}>
                                  {priceChange.text}
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        {/* Hover arrow */}
                        <svg className="w-4 h-4 text-gray-600 group-hover:text-bearpark-gold transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer - Custom Token Entry */}
            <div className="relative p-4 border-t border-bear-dark-700/50">
              {!showCustomEntry ? (
                <button
                  onClick={() => setShowCustomEntry(true)}
                  className="w-full text-center text-sm text-bearpark-gold hover:text-yellow-400 transition-colors font-medium"
                >
                  Can't find your token? <span className="underline">Add manually</span>
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">Add Custom Token</span>
                    <button
                      onClick={() => {
                        setShowCustomEntry(false);
                        setCustomCurrency('');
                        setCustomIssuer('');
                      }}
                      className="text-gray-400 hover:text-white text-xs font-medium"
                    >
                      ✕ Close
                    </button>
                  </div>

                  {/* Currency Code Input */}
                  <div>
                    <label className="text-xs text-gray-500 mb-1.5 block font-medium">Currency Code</label>
                    <input
                      type="text"
                      value={customCurrency}
                      onChange={(e) => setCustomCurrency(e.target.value.toUpperCase())}
                      placeholder="e.g., BEAR, SOLO, RLUSD"
                      className="w-full px-3 py-2.5 bg-bear-dark-800 border border-bear-dark-600 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-bear-purple-500 text-sm transition-colors"
                      maxLength={40}
                    />
                  </div>

                  {/* Issuer Address Input */}
                  <div>
                    <label className="text-xs text-gray-500 mb-1.5 block font-medium">Issuer Address</label>
                    <input
                      type="text"
                      value={customIssuer}
                      onChange={(e) => setCustomIssuer(e.target.value)}
                      placeholder="rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                      className="w-full px-3 py-2.5 bg-bear-dark-800 border border-bear-dark-600 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-bear-purple-500 text-sm font-mono transition-colors"
                      maxLength={35}
                    />
                  </div>

                  {/* Add Token Button with 3D effect */}
                  <motion.button
                    onClick={handleCustomTokenSelect}
                    disabled={!customCurrency || !customIssuer}
                    className="w-full py-3 rounded-xl font-bold text-bear-dark-900 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: customCurrency && customIssuer
                        ? 'linear-gradient(135deg, #edb723 0%, #d4a31e 100%)'
                        : 'linear-gradient(135deg, #374151 0%, #1f2937 100%)',
                      boxShadow: customCurrency && customIssuer
                        ? '0 4px 0 #b8941a, 0 6px 15px rgba(237, 183, 35, 0.3)'
                        : '0 4px 0 #111827',
                    }}
                    whileHover={customCurrency && customIssuer ? {
                      boxShadow: '0 2px 0 #b8941a, 0 4px 10px rgba(237, 183, 35, 0.3)',
                      y: 2,
                    } : {}}
                    whileTap={customCurrency && customIssuer ? {
                      boxShadow: '0 1px 0 #b8941a, 0 2px 5px rgba(237, 183, 35, 0.3)',
                      y: 3,
                    } : {}}
                  >
                    <span className={customCurrency && customIssuer ? 'text-bear-dark-900' : 'text-gray-400'}>
                      Add Token
                    </span>
                  </motion.button>

                  <p className="text-xs text-gray-600 text-center">
                    Find issuer addresses on XRPScan or First Ledger
                  </p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default TokenSelector;

// Export TokenIcon for reuse
export { TokenIcon };
