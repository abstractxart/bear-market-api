import { useState } from 'react';
import { motion } from 'framer-motion';
import type { Token } from '../types';
import { XRP_TOKEN } from '../types';
import { useWallet } from '../context/WalletContext';

interface TokenSelectorProps {
  onSelect: (token: Token) => void;
  onClose: () => void;
  excludeToken?: Token | null;
}

// Popular tokens on XRPL (will be fetched from API in production)
const POPULAR_TOKENS: Token[] = [
  XRP_TOKEN,
  {
    currency: 'BEAR',
    issuer: 'rBEARTokenIssuerAddressHere', // UPDATE
    name: 'BEAR Token',
    symbol: 'BEAR',
    icon: '/tokens/bear.svg',
    decimals: 15,
  },
  {
    currency: 'USD',
    issuer: 'rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B', // Bitstamp
    name: 'USD (Bitstamp)',
    symbol: 'USD',
    icon: '/tokens/usd.svg',
    decimals: 15,
  },
  {
    currency: 'SOLO',
    issuer: 'rsoLo2S1kiGeCcn6hCUXVrCpGMWLrRrLZz',
    name: 'Sologenic',
    symbol: 'SOLO',
    icon: '/tokens/solo.svg',
    decimals: 15,
  },
  {
    currency: 'CSC',
    issuer: 'rCSCManTZ8ME9EoLrSHHYKW8PPwWMgkwr',
    name: 'CasinoCoin',
    symbol: 'CSC',
    icon: '/tokens/csc.svg',
    decimals: 15,
  },
];

const TokenSelector: React.FC<TokenSelectorProps> = ({ onSelect, onClose, excludeToken }) => {
  const { wallet } = useWallet();
  const [search, setSearch] = useState('');
  const tokens = POPULAR_TOKENS;

  // Filter tokens based on search and exclude current selection
  const filteredTokens = tokens.filter((token) => {
    // Exclude the token from the other side
    if (
      excludeToken &&
      token.currency === excludeToken.currency &&
      token.issuer === excludeToken.issuer
    ) {
      return false;
    }

    // Search filter
    if (search) {
      const query = search.toLowerCase();
      return (
        token.currency.toLowerCase().includes(query) ||
        token.name.toLowerCase().includes(query) ||
        token.symbol.toLowerCase().includes(query)
      );
    }

    return true;
  });

  // Get balance for a token
  const getBalance = (token: Token): string => {
    if (token.currency === 'XRP') {
      return wallet.balance.xrp;
    }
    const tokenBalance = wallet.balance.tokens.find(
      (t) => t.token.currency === token.currency && t.token.issuer === token.issuer
    );
    return tokenBalance?.balance || '0';
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="glass-card w-full max-w-md max-h-[70vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-bear-dark-500">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">Select a token</h3>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-bear-dark-600 transition-colors"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {/* Search input */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or paste address"
              className="w-full bg-bear-dark-800 border border-bear-dark-500 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:border-bear-purple-500 outline-none"
              autoFocus
            />
          </div>
        </div>

        {/* Token list */}
        <div className="overflow-y-auto max-h-[400px] p-2">
          {filteredTokens.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              No tokens found
            </div>
          ) : (
            filteredTokens.map((token) => (
              <motion.button
                key={`${token.currency}-${token.issuer || 'native'}`}
                onClick={() => onSelect(token)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-bear-dark-700 transition-colors"
                whileHover={{ x: 4 }}
              >
                {/* Token icon */}
                <div className="w-10 h-10 rounded-full bg-bear-dark-600 flex items-center justify-center overflow-hidden">
                  {token.icon ? (
                    <img src={token.icon} alt={token.symbol} className="w-6 h-6" />
                  ) : (
                    <span className="text-lg font-bold text-bear-purple-400">
                      {token.symbol.charAt(0)}
                    </span>
                  )}
                </div>

                {/* Token info */}
                <div className="flex-1 text-left">
                  <div className="font-semibold text-white">{token.symbol}</div>
                  <div className="text-sm text-gray-400">{token.name}</div>
                </div>

                {/* Balance */}
                <div className="text-right">
                  <div className="text-white font-mono">{getBalance(token)}</div>
                </div>
              </motion.button>
            ))
          )}
        </div>

        {/* Add custom token hint */}
        <div className="p-4 border-t border-bear-dark-500 text-center">
          <p className="text-sm text-gray-500">
            Can't find your token? Paste the issuer address above.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default TokenSelector;
