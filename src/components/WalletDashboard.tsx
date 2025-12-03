/**
 * BEAR MARKET - Wallet Dashboard
 *
 * Full wallet view similar to Magnetic X showing:
 * - Token balances with prices
 * - LP positions
 * - NFT collection
 * - Transaction history
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWallet } from '../context/WalletContext';

interface WalletDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'tokens' | 'lps' | 'nfts' | 'history';

interface NFTData {
  id: string;
  name: string;
  image: string;
  collection?: string;
}

interface TxHistory {
  type: 'sent' | 'received' | 'swap';
  to?: string;
  from?: string;
  amount: string;
  currency: string;
  timestamp: string;
  hash: string;
}

export const WalletDashboard = ({ isOpen, onClose }: WalletDashboardProps) => {
  const { wallet, xrplClient, disconnect } = useWallet();
  const [activeTab, setActiveTab] = useState<TabType>('tokens');
  const [nfts, setNfts] = useState<NFTData[]>([]);
  const [history, setHistory] = useState<TxHistory[]>([]);
  const [loadingNfts, setLoadingNfts] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [copied, setCopied] = useState(false);

  // Format address for display
  const formatAddress = (address: string): string => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Copy address to clipboard
  const handleCopyAddress = async () => {
    if (wallet.address) {
      await navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Fetch NFTs
  useEffect(() => {
    const fetchNFTs = async () => {
      if (!xrplClient || !wallet.address || activeTab !== 'nfts') return;

      setLoadingNfts(true);
      try {
        const response = await xrplClient.request({
          command: 'account_nfts',
          account: wallet.address,
          limit: 50,
        });

        const nftData: NFTData[] = response.result.account_nfts.map((nft: any) => {
          // Try to decode URI for image
          let image = '/bear-placeholder.png';
          let name = `NFT #${nft.NFTokenID.slice(-8)}`;

          if (nft.URI) {
            try {
              const uri = Buffer.from(nft.URI, 'hex').toString('utf8');
              if (uri.startsWith('http') || uri.startsWith('ipfs')) {
                image = uri.replace('ipfs://', 'https://ipfs.io/ipfs/');
              }
            } catch {
              // Keep default
            }
          }

          return {
            id: nft.NFTokenID,
            name,
            image,
            collection: nft.Issuer ? `${nft.Issuer.slice(0, 6)}...` : undefined,
          };
        });

        setNfts(nftData);
      } catch (err) {
        console.error('Failed to fetch NFTs:', err);
      } finally {
        setLoadingNfts(false);
      }
    };

    fetchNFTs();
  }, [xrplClient, wallet.address, activeTab]);

  // Fetch transaction history
  useEffect(() => {
    const fetchHistory = async () => {
      if (!xrplClient || !wallet.address || activeTab !== 'history') return;

      setLoadingHistory(true);
      try {
        const response = await xrplClient.request({
          command: 'account_tx',
          account: wallet.address,
          limit: 20,
          ledger_index_min: -1,
          ledger_index_max: -1,
        });

        const txData: TxHistory[] = response.result.transactions
          .filter((tx: any) => tx.tx.TransactionType === 'Payment')
          .map((tx: any) => {
            const isSent = tx.tx.Account === wallet.address;
            const amount = typeof tx.tx.Amount === 'string'
              ? (Number(tx.tx.Amount) / 1_000_000).toFixed(2) + ' XRP'
              : `${tx.tx.Amount.value} ${tx.tx.Amount.currency}`;

            return {
              type: isSent ? 'sent' : 'received',
              to: isSent ? tx.tx.Destination : undefined,
              from: !isSent ? tx.tx.Account : undefined,
              amount,
              currency: typeof tx.tx.Amount === 'string' ? 'XRP' : tx.tx.Amount.currency,
              timestamp: tx.tx.date ? new Date((tx.tx.date + 946684800) * 1000).toLocaleString() : 'Unknown',
              hash: tx.tx.hash,
            };
          });

        setHistory(txData);
      } catch (err) {
        console.error('Failed to fetch history:', err);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchHistory();
  }, [xrplClient, wallet.address, activeTab]);

  // Get LP tokens from balances
  const lpTokens = wallet.balance.tokens.filter(t =>
    t.token.currency.startsWith('LP') || t.token.currency.includes('_')
  );

  // Get regular tokens (not LP)
  const regularTokens = wallet.balance.tokens.filter(t =>
    !t.token.currency.startsWith('LP') && !t.token.currency.includes('_')
  );

  // Format currency code for display
  const formatCurrency = (currency: string): string => {
    if (currency.length === 40) {
      // Hex currency - decode it
      try {
        const decoded = Buffer.from(currency, 'hex').toString('utf8').replace(/\0/g, '');
        return decoded || currency.slice(0, 8);
      } catch {
        return currency.slice(0, 8);
      }
    }
    return currency;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start justify-end p-4 pt-20"
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Dashboard Panel */}
        <motion.div
          initial={{ opacity: 0, x: 20, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 20, scale: 0.95 }}
          transition={{ type: 'spring', duration: 0.4 }}
          className="relative w-full max-w-sm bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col"
        >
          {/* Header */}
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-white">Wallet</h2>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Address bar */}
            <div className="flex items-center gap-2 p-2 bg-gray-800 rounded-xl">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-sm">
                🐻
              </div>
              <span className="flex-1 font-mono text-sm text-white">
                {wallet.address ? formatAddress(wallet.address) : '---'}
              </span>
              <button
                onClick={handleCopyAddress}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                title="Copy address"
              >
                {copied ? (
                  <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
              <a
                href={`https://bithomp.com/explorer/${wallet.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                title="View on explorer"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
              <button
                onClick={() => {
                  disconnect();
                  onClose();
                }}
                className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors"
                title="Disconnect"
              >
                <svg className="w-4 h-4 text-gray-400 hover:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>

            {/* View Wallet Button */}
            <a
              href={`https://bithomp.com/explorer/${wallet.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full mt-3 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-xl text-center font-semibold text-white transition-all"
            >
              View Wallet
            </a>

            {/* Receive / Send Buttons */}
            <div className="grid grid-cols-2 gap-3 mt-3">
              <button className="flex items-center justify-center gap-2 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-xl text-white font-medium transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
                Receive
              </button>
              <button className="flex items-center justify-center gap-2 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-xl text-white font-medium transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
                Send
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-800">
            {(['tokens', 'lps', 'nfts', 'history'] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'text-white border-b-2 border-purple-500'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === 'lps' && ' LPs'}
                {tab === 'nfts' && ' NFTs'}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Tokens Tab */}
            {activeTab === 'tokens' && (
              <div className="p-2">
                {/* XRP Balance */}
                <div className="flex items-center gap-3 p-3 hover:bg-gray-800/50 rounded-xl transition-colors">
                  <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-xl">
                    ✕
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-white">XRP</div>
                    <div className="text-xs text-green-400">
                      ${(parseFloat(wallet.balance.xrp) * 2.18).toFixed(2)} USD
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-white">{parseFloat(wallet.balance.xrp).toFixed(2)}</div>
                    <div className="text-xs text-gray-500">XRP</div>
                  </div>
                </div>

                {/* Token Balances */}
                {regularTokens.map((token, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 hover:bg-gray-800/50 rounded-xl transition-colors">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center text-sm font-bold text-purple-400">
                      {formatCurrency(token.token.currency).slice(0, 2)}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-white">{formatCurrency(token.token.currency)}</div>
                      <div className="text-xs text-gray-500 truncate">
                        {token.token.issuer?.slice(0, 8)}...
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-white">
                        {parseFloat(token.balance).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                ))}

                {regularTokens.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No tokens found
                  </div>
                )}
              </div>
            )}

            {/* LPs Tab */}
            {activeTab === 'lps' && (
              <div className="p-2">
                {lpTokens.map((token, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 hover:bg-gray-800/50 rounded-xl transition-colors">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
                      <span className="text-lg">🌊</span>
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-white">{formatCurrency(token.token.currency)}</div>
                      <div className="text-xs text-gray-500">LP Token</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-white">
                        {parseFloat(token.balance).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                ))}

                {lpTokens.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No LP positions found
                  </div>
                )}
              </div>
            )}

            {/* NFTs Tab */}
            {activeTab === 'nfts' && (
              <div className="p-2">
                {loadingNfts ? (
                  <div className="text-center py-8">
                    <div className="w-8 h-8 mx-auto border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                    <p className="text-gray-500 mt-2">Loading NFTs...</p>
                  </div>
                ) : nfts.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {nfts.map((nft) => (
                      <div key={nft.id} className="bg-gray-800 rounded-xl overflow-hidden">
                        <div className="aspect-square bg-gray-700">
                          <img
                            src={nft.image}
                            alt={nft.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23374151" width="100" height="100"/><text x="50" y="50" text-anchor="middle" dy=".3em" font-size="40">🖼️</text></svg>';
                            }}
                          />
                        </div>
                        <div className="p-2">
                          <div className="text-xs font-medium text-white truncate">{nft.name}</div>
                          {nft.collection && (
                            <div className="text-xs text-gray-500 truncate">{nft.collection}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No NFTs found
                  </div>
                )}
              </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <div className="p-2">
                {loadingHistory ? (
                  <div className="text-center py-8">
                    <div className="w-8 h-8 mx-auto border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                    <p className="text-gray-500 mt-2">Loading history...</p>
                  </div>
                ) : history.length > 0 ? (
                  <div className="space-y-1">
                    {history.map((tx, i) => (
                      <a
                        key={i}
                        href={`https://bithomp.com/explorer/${tx.hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 hover:bg-gray-800/50 rounded-xl transition-colors"
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          tx.type === 'sent' ? 'bg-red-500/20' : 'bg-green-500/20'
                        }`}>
                          {tx.type === 'sent' ? (
                            <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-gray-400">
                            {tx.type === 'sent' ? 'Sent' : 'Received'}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {tx.type === 'sent' ? `To ${tx.to?.slice(0, 8)}...` : `From ${tx.from?.slice(0, 8)}...`}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-sm font-mono ${tx.type === 'sent' ? 'text-red-400' : 'text-green-400'}`}>
                            {tx.type === 'sent' ? '-' : '+'}{tx.amount}
                          </div>
                          <div className="text-xs text-gray-500">{tx.timestamp.split(',')[1]?.trim() || tx.timestamp}</div>
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No transaction history
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default WalletDashboard;
