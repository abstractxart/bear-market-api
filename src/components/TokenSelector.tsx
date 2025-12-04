/**
 * BEAR MARKET - Token Selector
 *
 * Beautiful token selection modal with:
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
      className="rounded-full object-cover bg-gray-800"
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
  const color = num >= 0 ? 'text-green-400' : 'text-red-400';
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

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        if (searchQuery.length >= 2) {
          const results = await searchTokens(searchQuery);
          setTokens(results);
        } else {
          const popular = await getPopularTokens();
          setTokens(popular);
        }
      } catch (error) {
        console.error('Token search error:', error);
        // Fallback to common tokens
        setTokens(COMMON_TOKENS);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load popular tokens on mount
  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      getPopularTokens()
        .then(setTokens)
        .catch(() => setTokens(COMMON_TOKENS))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

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
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md bg-gradient-to-b from-gray-900 to-black border border-purple-500/30 rounded-2xl shadow-2xl shadow-purple-500/10 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Select Token</h3>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
              >
                ✕
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, symbol, or issuer..."
                className="w-full px-4 py-3 pl-10 bg-black/60 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                autoFocus
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                🔍
              </div>
              {loading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-5 h-5 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Tabs */}
            {!searchQuery && (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => setActiveTab('popular')}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                    activeTab === 'popular'
                      ? 'bg-purple-500 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  🔥 Popular
                </button>
                {wallet.isConnected && walletTokens.length > 1 && (
                  <button
                    onClick={() => setActiveTab('wallet')}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                      activeTab === 'wallet'
                        ? 'bg-purple-500 text-white'
                        : 'bg-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    💼 My Tokens
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Token List */}
          <div className="max-h-[400px] overflow-y-auto">
            {displayTokens.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                {loading ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                    <span>Searching tokens...</span>
                  </div>
                ) : (
                  <>
                    <div className="text-4xl mb-2">🔍</div>
                    <div>No tokens found</div>
                    <div className="text-xs mt-2">Try a different search term</div>
                  </>
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

                  return (
                    <motion.button
                      key={`${token.currency}-${token.issuer || 'native'}-${index}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(index * 0.02, 0.3) }}
                      onClick={() => handleSelect(token)}
                      className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors ${
                        isSelected ? 'bg-purple-500/10 border-l-2 border-purple-500' : ''
                      }`}
                    >
                      {/* Token Icon */}
                      <TokenIcon token={token} size={40} />

                      {/* Token Info */}
                      <div className="flex-1 text-left min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{token.symbol}</span>
                          {(token as XRPLToken).verified && (
                            <span className="text-blue-400 text-xs" title="Verified">✓</span>
                          )}
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
                              <div className="text-sm text-green-400 font-mono">
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
                    </motion.button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer - Custom Token Entry */}
          <div className="p-4 border-t border-gray-800">
            {!showCustomEntry ? (
              <button
                onClick={() => setShowCustomEntry(true)}
                className="w-full text-center text-sm text-purple-400 hover:text-purple-300 transition-colors"
              >
                Can't find your token? <span className="underline">Add manually</span>
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white">Add Custom Token</span>
                  <button
                    onClick={() => {
                      setShowCustomEntry(false);
                      setCustomCurrency('');
                      setCustomIssuer('');
                    }}
                    className="text-gray-400 hover:text-white text-xs"
                  >
                    ✕ Close
                  </button>
                </div>

                {/* Currency Code Input */}
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Currency Code</label>
                  <input
                    type="text"
                    value={customCurrency}
                    onChange={(e) => setCustomCurrency(e.target.value.toUpperCase())}
                    placeholder="e.g., BEAR, SOLO, RLUSD"
                    className="w-full px-3 py-2 bg-black/60 border border-gray-700 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 text-sm"
                    maxLength={40}
                  />
                </div>

                {/* Issuer Address Input */}
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Issuer Address</label>
                  <input
                    type="text"
                    value={customIssuer}
                    onChange={(e) => setCustomIssuer(e.target.value)}
                    placeholder="rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                    className="w-full px-3 py-2 bg-black/60 border border-gray-700 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 text-sm font-mono"
                    maxLength={35}
                  />
                </div>

                {/* Add Token Button */}
                <button
                  onClick={handleCustomTokenSelect}
                  disabled={!customCurrency || !customIssuer}
                  className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all"
                >
                  Add Token
                </button>

                <p className="text-xs text-gray-600 text-center">
                  Find issuer addresses on XRPScan or First Ledger
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default TokenSelector;

// Export TokenIcon for reuse
export { TokenIcon };
