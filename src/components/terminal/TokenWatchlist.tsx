import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { Token, LeaderboardToken } from '../../types';
import { getLeaderboardTokens } from '../../services/tokenLeaderboardService';

interface TokenWatchlistProps {
  currentToken: Token;
  onTokenSelect: (token: Token) => void;
}

// BEAR Token - Always first, always golden
const BEAR_TOKEN: Token = {
  currency: 'BEAR',
  issuer: 'rBEARGUAsyu7tUw53rufQzFdWmJHpJEqFW',
  name: 'BEAR',
  symbol: 'BEAR',
  decimals: 15,
  icon: 'https://s1.xrpl.to/token/BEAR_rBEARGUAsyu7tUw53rufQzFdWmJHpJEqFW.webp',
};

export const TokenWatchlist: React.FC<TokenWatchlistProps> = ({
  currentToken,
  onTokenSelect,
}) => {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [tokens, setTokens] = useState<LeaderboardToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Load favorites from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('bear_terminal_favorites');
    if (saved) {
      try {
        setFavorites(JSON.parse(saved));
      } catch {
        setFavorites([]);
      }
    }
  }, []);

  // Save favorites to localStorage
  const saveFavorites = (newFavorites: string[]) => {
    localStorage.setItem('bear_terminal_favorites', JSON.stringify(newFavorites));
    setFavorites(newFavorites);
  };

  // Toggle favorite
  const toggleFavorite = (tokenKey: string) => {
    if (tokenKey === 'BEAR:rBEARGUAsyu7tUw53rufQzFdWmJHpJEqFW') {
      // BEAR is always a favorite, can't be removed
      return;
    }

    if (favorites.includes(tokenKey)) {
      saveFavorites(favorites.filter(f => f !== tokenKey));
    } else {
      saveFavorites([...favorites, tokenKey]);
    }
  };

  // Fetch tokens
  const fetchTokens = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getLeaderboardTokens();
      setTokens(data.slice(0, 50)); // Top 50 tokens
    } catch (error) {
      console.error('[TokenWatchlist] Failed to fetch:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTokens();
    const interval = setInterval(fetchTokens, 30000);
    return () => clearInterval(interval);
  }, [fetchTokens]);

  // Get token key
  const getTokenKey = (token: Token | LeaderboardToken) => {
    return `${token.currency}:${token.issuer || 'XRP'}`;
  };

  // Check if token is favorite
  const isFavorite = (token: Token | LeaderboardToken) => {
    const key = getTokenKey(token);
    return key === 'BEAR:rBEARGUAsyu7tUw53rufQzFdWmJHpJEqFW' || favorites.includes(key);
  };

  // Check if token is current
  const isCurrent = (token: Token | LeaderboardToken) => {
    return token.currency === currentToken.currency && token.issuer === currentToken.issuer;
  };

  // Filter tokens by search
  const filteredTokens = searchQuery
    ? tokens.filter(t =>
        t.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : tokens;

  // Separate favorites and others
  const favoriteTokens = filteredTokens.filter(t => isFavorite(t));
  const otherTokens = filteredTokens.filter(t => !isFavorite(t));

  // Find BEAR in tokens for price data
  const bearData = tokens.find(t => t.currency === 'BEAR' && t.issuer === BEAR_TOKEN.issuer);

  const formatPrice = (price?: number): string => {
    if (!price) return '—';
    if (price >= 1) return price.toFixed(4);
    if (price >= 0.0001) return price.toFixed(6);
    return price.toExponential(2);
  };

  const formatChange = (change?: number): string => {
    if (change === undefined) return '—';
    return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
  };

  const TokenRow: React.FC<{ token: LeaderboardToken; isBear?: boolean }> = ({ token, isBear }) => (
    <motion.div
      whileHover={{ scale: 1.01, x: 2 }}
      whileTap={{ scale: 0.99 }}
      onClick={() => onTokenSelect(token)}
      className={`flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer transition-all ${
        isCurrent(token)
          ? 'bg-bear-purple-500/20 border border-bear-purple-500/50'
          : 'hover:bg-bear-dark-700/50'
      } ${isBear ? 'bg-bearpark-gold/5 border border-bearpark-gold/30' : ''}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {/* Favorite Star */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(getTokenKey(token));
          }}
          className="flex-shrink-0"
        >
          <svg
            className={`w-3.5 h-3.5 transition-colors ${
              isFavorite(token)
                ? 'text-bearpark-gold fill-bearpark-gold'
                : 'text-gray-600 hover:text-gray-400'
            }`}
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
            />
          </svg>
        </button>

        {/* Token Icon */}
        <div className={`w-6 h-6 rounded-full overflow-hidden flex-shrink-0 ${
          isBear ? 'ring-1 ring-bearpark-gold' : ''
        }`}>
          {token.icon ? (
            <img src={token.icon} alt={token.symbol} className="w-full h-full object-cover" />
          ) : (
            <div className={`w-full h-full flex items-center justify-center text-[10px] font-bold ${
              isBear ? 'bg-bearpark-gold/20 text-bearpark-gold' : 'bg-bear-dark-600 text-white'
            }`}>
              {token.symbol.slice(0, 2)}
            </div>
          )}
        </div>

        {/* Token Name */}
        <div className="min-w-0">
          <p className={`text-xs font-semibold truncate ${
            isBear ? 'text-bearpark-gold font-luckiest' : 'text-white'
          }`}>
            {token.symbol}
          </p>
        </div>
      </div>

      {/* Price & Change */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-[10px] font-mono text-gray-400">
          {formatPrice(token.price)}
        </span>
        <span className={`text-[10px] font-mono font-semibold ${
          (token.priceChange24h || 0) >= 0 ? 'text-bear-green-400' : 'text-red-400'
        }`}>
          {formatChange(token.priceChange24h)}
        </span>
      </div>
    </motion.div>
  );

  return (
    <div className="relative h-full flex flex-col rounded-xl overflow-hidden">
      {/* TRICOLOR BORDER */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-bear-gold via-bear-purple-500 to-bear-gold p-[2px]">
        <div className="w-full h-full rounded-xl bg-bear-dark-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-bear-dark-700">
        <h3 className="text-sm font-bold text-white">Tokens</h3>
        <span className="text-[10px] text-gray-500">{tokens.length}</span>
      </div>

      {/* Search */}
      <div className="px-2 py-2 border-b border-bear-dark-700">
        <div className="relative">
          <svg
            className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="w-full pl-7 pr-2 py-1.5 text-xs bg-bear-dark-900 border border-bear-dark-600 rounded-lg text-white placeholder-gray-500 focus:border-bear-purple-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Token List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-bear-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {/* BEAR Always First */}
            {bearData && (
              <div className="pb-2 border-b border-bear-dark-600 mb-2">
                <TokenRow token={bearData} isBear />
              </div>
            )}

            {/* Favorites Section */}
            {favoriteTokens.length > 0 && (
              <>
                <p className="text-[10px] text-gray-500 uppercase px-2 pt-1">Favorites</p>
                {favoriteTokens
                  .filter(t => t.currency !== 'BEAR') // BEAR already shown above
                  .map((token) => (
                    <TokenRow key={getTokenKey(token)} token={token} />
                  ))
                }
              </>
            )}

            {/* Top Tokens */}
            <p className="text-[10px] text-gray-500 uppercase px-2 pt-2">Top Tokens</p>
            {otherTokens.slice(0, 20).map((token) => (
              <TokenRow key={getTokenKey(token)} token={token} />
            ))}
          </div>
        )}
      </div>
        </div>
      </div>
    </div>
  );
};
