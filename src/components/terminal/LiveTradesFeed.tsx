import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Client } from 'xrpl';
import type { Token } from '../../types';

interface LiveTradesFeedProps {
  token: Token;
}

interface Trade {
  id: string;
  type: 'buy' | 'sell';
  price: number;
  amount: number;
  total: number;
  maker: string;
  timestamp: Date;
  hash: string;
  isNew?: boolean;
}

type TabType = 'all' | 'my' | 'top';

export const LiveTradesFeed: React.FC<LiveTradesFeedProps> = ({ token }) => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const clientRef = useRef<Client | null>(null);

  const formatTime = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  const formatPrice = (price: number): string => {
    if (price >= 1) return price.toFixed(6);
    if (price >= 0.0001) return price.toFixed(8);
    return price.toExponential(2);
  };

  const formatAmount = (amount: number): string => {
    if (amount >= 1e6) return `${(amount / 1e6).toFixed(2)}M`;
    if (amount >= 1e3) return `${(amount / 1e3).toFixed(2)}K`;
    return amount.toFixed(2);
  };

  const truncateAddress = (addr: string): string => {
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  // Fetch historical trades and subscribe to new ones
  const initializeTradeStream = useCallback(async () => {
    if (token.currency === 'XRP' || !token.issuer) return;

    setIsLoading(true);

    try {
      // Create client
      const client = new Client('wss://xrplcluster.com');
      await client.connect();
      clientRef.current = client;
      setIsConnected(true);

      // Fetch recent transactions for the token issuer
      // This is a simplified version - in production you'd use a proper trade API
      const txResult = await client.request({
        command: 'account_tx',
        account: token.issuer,
        limit: 50,
        ledger_index_min: -1,
        ledger_index_max: -1,
      });

      // Parse transactions into trades
      const parsedTrades: Trade[] = [];

      for (const txEntry of txResult.result.transactions || []) {
        const tx = txEntry.tx as any;
        if (!tx || tx.TransactionType !== 'Payment') continue;

        // Check if this involves our token
        const amount = tx.Amount;

        if (typeof amount === 'object' && amount.currency) {
          // Token payment
          const tokenAmount = parseFloat(amount.value);
          const price = 0.001; // Placeholder - would calculate from order book

          parsedTrades.push({
            id: tx.hash || `${Date.now()}-${Math.random()}`,
            type: 'buy',
            price,
            amount: tokenAmount,
            total: tokenAmount * price,
            maker: tx.Account || 'Unknown',
            timestamp: new Date((tx.date || 0) * 1000 + 946684800000),
            hash: tx.hash || '',
          });
        }
      }

      setTrades(parsedTrades.slice(0, 30));

      // Subscribe to transactions
      await client.request({
        command: 'subscribe',
        accounts: [token.issuer],
      });

      // Handle new transactions
      client.on('transaction', (tx: any) => {
        if (tx.transaction?.TransactionType === 'OfferCreate' ||
            tx.transaction?.TransactionType === 'Payment') {
          // Parse and add new trade
          const newTrade: Trade = {
            id: tx.transaction.hash || `${Date.now()}-${Math.random()}`,
            type: Math.random() > 0.5 ? 'buy' : 'sell', // Simplified
            price: 0.001,
            amount: 1000,
            total: 1,
            maker: tx.transaction.Account || 'Unknown',
            timestamp: new Date(),
            hash: tx.transaction.hash || '',
            isNew: true,
          };

          setTrades(prev => [newTrade, ...prev.slice(0, 49)]);

          // Remove "new" flag after animation
          setTimeout(() => {
            setTrades(prev =>
              prev.map(t => t.id === newTrade.id ? { ...t, isNew: false } : t)
            );
          }, 2000);
        }
      });

    } catch (error) {
      console.error('[LiveTradesFeed] Error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [token.currency, token.issuer]);

  useEffect(() => {
    initializeTradeStream();

    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }
    };
  }, [initializeTradeStream]);

  return (
    <div className="h-full flex flex-col rounded-xl bg-bear-dark-800 border border-bear-dark-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-bear-dark-700">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-white">Trades</h3>
          {/* Connection Status */}
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-bear-green-500 animate-pulse' : 'bg-gray-500'}`} />
        </div>
        <span className="text-[10px] text-gray-500">
          {trades.length} trades
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-2 py-2 border-b border-bear-dark-700">
        {[
          { value: 'all' as TabType, label: 'All Trades' },
          { value: 'my' as TabType, label: 'My Trades' },
          { value: 'top' as TabType, label: 'Top Traders' },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-2 py-1 text-[10px] font-semibold rounded transition-all ${
              activeTab === tab.value
                ? 'bg-bear-purple-500 text-white'
                : 'text-gray-400 hover:text-white hover:bg-bear-dark-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-[50px_50px_1fr_1fr_1fr_80px] gap-1 px-2 py-1.5 text-[9px] font-semibold text-gray-500 uppercase border-b border-bear-dark-700">
        <span>Age</span>
        <span>Type</span>
        <span className="text-right">Price</span>
        <span className="text-right">Amount</span>
        <span className="text-right">Total</span>
        <span className="text-right">Maker</span>
      </div>

      {/* Trade List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-bear-purple-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-[10px] text-gray-500">Loading trades...</span>
            </div>
          </div>
        ) : trades.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <p className="text-gray-500 text-sm">No trades yet</p>
              <p className="text-gray-600 text-xs mt-1">Trades will appear here in real-time</p>
            </div>
          </div>
        ) : (
          <AnimatePresence>
            {trades.map((trade) => (
              <motion.a
                key={trade.id}
                href={`https://xrpscan.com/tx/${trade.hash}`}
                target="_blank"
                rel="noopener noreferrer"
                initial={trade.isNew ? { opacity: 0, y: -20, backgroundColor: 'rgba(237, 183, 35, 0.2)' } : { opacity: 1 }}
                animate={{ opacity: 1, y: 0, backgroundColor: 'transparent' }}
                transition={{ duration: 0.3 }}
                className={`grid grid-cols-[50px_50px_1fr_1fr_1fr_80px] gap-1 px-2 py-1.5 text-xs font-mono hover:bg-bear-dark-700/50 transition-colors group ${
                  trade.type === 'buy' ? 'hover:bg-bear-green-500/5' : 'hover:bg-red-500/5'
                }`}
              >
                <span className="text-gray-500 text-[10px]">
                  {formatTime(trade.timestamp)}
                </span>
                <span className={`font-semibold ${trade.type === 'buy' ? 'text-bear-green-400' : 'text-red-400'}`}>
                  {trade.type === 'buy' ? 'Buy' : 'Sell'}
                </span>
                <span className="text-right text-gray-300">
                  {formatPrice(trade.price)}
                </span>
                <span className="text-right text-gray-300">
                  {formatAmount(trade.amount)}
                </span>
                <span className="text-right text-gray-300">
                  {formatAmount(trade.total)}
                </span>
                <span className="text-right text-gray-500 group-hover:text-bearpark-gold transition-colors flex items-center justify-end gap-1">
                  {truncateAddress(trade.maker)}
                  <svg className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </span>
              </motion.a>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Live Indicator */}
      <div className="flex items-center justify-center gap-2 px-3 py-2 border-t border-bear-dark-700 bg-bear-dark-900/50">
        <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-bear-green-500 animate-pulse' : 'bg-red-500'}`} />
        <span className="text-[10px] text-gray-500">
          {isConnected ? 'Live updates active' : 'Disconnected'}
        </span>
      </div>
    </div>
  );
};
