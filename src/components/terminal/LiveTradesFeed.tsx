import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Token } from '../../types';
import { fetchSwapsForToken, type Trade } from '../../services/xrplDirectService';

// Re-export Trade interface for use by other components
export type { Trade };

interface LiveTradesFeedProps {
  token: Token;
  onTradesUpdate?: (trades: Trade[]) => void;
}

type TabType = 'transactions' | 'topTraders';

export const LiveTradesFeed: React.FC<LiveTradesFeedProps> = ({ token, onTradesUpdate }) => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('transactions');
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [makerFilter, setMakerFilter] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Format time like DexScreener: "11m ago", "1h 43m ago", "1d 22h ago"
  const formatTime = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    const months = Math.floor(diff / (86400000 * 30));

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) {
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m ago` : `${hours}h ago`;
    }
    if (days < 30) {
      const remainingHours = hours % 24;
      return remainingHours > 0 ? `${days}d ${remainingHours}h ago` : `${days}d ago`;
    }
    return `${months}mo ago`;
  };

  const formatPrice = (price: number): string => {
    if (price >= 0.01) return `$${price.toFixed(6)}`;
    if (price >= 0.0001) return `$${price.toFixed(8)}`;
    return `$${price.toExponential(2)}`;
  };

  const formatUsd = (amount: number): string => {
    if (amount >= 1000) return `${(amount / 1000).toFixed(2)}K`;
    if (amount >= 1) return amount.toFixed(2);
    return amount.toFixed(4);
  };

  const formatAmount = (amount: number): string => {
    if (amount >= 1e6) return `${(amount / 1e6).toFixed(2)}M`;
    if (amount >= 1e3) return `${(amount / 1e3).toFixed(2)}K`;
    if (amount >= 1) return amount.toLocaleString('en-US', { maximumFractionDigits: 2 });
    return amount.toFixed(4);
  };

  const truncateAddress = (addr: string): string => {
    return `${addr.slice(0, 6)}`;
  };

  // Initialize XRPL trade polling - fetches 2+ days of transaction history (OfferCreate support added!)
  const initializeTradeStream = useCallback(async () => {
    if (token.currency === 'XRP' || !token.issuer) return;
    const issuer = token.issuer; // TypeScript guard

    setIsLoading(true);
    setIsConnected(true);

    // Fetch real trades from XRPL issuer account (last 3 days, fast query with ledger range)
    const fetchRealTrades = async (): Promise<Trade[]> => {
      try {
        console.log('[LiveTradesFeed] Fetching real trades from XRPL (3+ days history)...');
        const trades = await fetchSwapsForToken(token.currency, issuer, 300);
        console.log(`[LiveTradesFeed] Loaded ${trades.length} real trades from XRPL!`);
        return trades;
      } catch (error) {
        console.error('[LiveTradesFeed] XRPL fetch error:', error);
        return [];
      }
    };

    // Fetch initial trades
    const initialTrades = await fetchRealTrades();
    setTrades(initialTrades);
    setIsLoading(false);

    // Poll for updates every 10 seconds
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      const updatedTrades = await fetchRealTrades();

      // Mark new trades for animation
      setTrades(prevTrades => {
        const previousHashes = new Set(prevTrades.map(t => t.hash));
        return updatedTrades.map(t => ({
          ...t,
          isNew: !previousHashes.has(t.hash)
        }));
      });
    }, 10000); // 10 seconds for responsive updates

    console.log('[LiveTradesFeed] XRPL polling started (10s interval)');
  }, [token.currency, token.issuer]);

  useEffect(() => {
    initializeTradeStream();
    return () => {
      // Cleanup polling interval
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [initializeTradeStream]);

  // Notify parent component when trades update (for chart markers)
  useEffect(() => {
    if (onTradesUpdate && trades.length > 0) {
      onTradesUpdate(trades);
    }
  }, [trades, onTradesUpdate]);

  // Filter trades by maker if filter is active
  const filteredTrades = makerFilter
    ? trades.filter(t => t.maker === makerFilter)
    : trades;

  // Calculate max USD value for bar scaling
  const maxUsdValue = Math.max(...filteredTrades.map(t => t.amountUsd), 1);

  // Toggle maker filter
  const toggleMakerFilter = (maker: string) => {
    setMakerFilter(prev => prev === maker ? null : maker);
  };

  return (
    <div className="h-full w-full max-h-full overflow-hidden">
      <div className="glass-card h-full max-h-full flex flex-col overflow-hidden">
        {/* Header with Tabs */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.08] bg-white/[0.03] backdrop-blur-md shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveTab('transactions')}
            className={`flex items-center gap-2 text-sm font-semibold transition-all duration-200 ${
              activeTab === 'transactions' ? 'text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            Transactions
          </button>
          <button
            onClick={() => setActiveTab('topTraders')}
            className={`flex items-center gap-2 text-sm font-semibold transition-all duration-200 ${
              activeTab === 'topTraders' ? 'text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Top Traders
          </button>
        </div>
        <div className="flex items-center gap-2">
          {makerFilter && (
            <button
              onClick={() => setMakerFilter(null)}
              className="px-2 py-1 text-xs bg-bear-purple-500/20 text-bear-purple-400 rounded-lg hover:bg-bear-purple-500/30"
            >
              Clear Filter ✕
            </button>
          )}
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-bear-green-500 animate-pulse' : 'bg-gray-500'}`} />
        </div>
      </div>

      {/* Column Headers - DexScreener Style */}
      <div className="border-b border-white/[0.06] bg-white/[0.02] backdrop-blur-sm">
        {/* Desktop Headers */}
        <div className="hidden md:grid grid-cols-[4px_minmax(100px,1fr)_minmax(70px,0.8fr)_minmax(80px,1fr)_minmax(100px,1.2fr)_minmax(90px,1fr)_minmax(100px,1.2fr)_minmax(90px,1fr)_60px] gap-4 py-3 px-5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
          <span></span> {/* Bar column */}
          <span>DATE</span>
          <span>TYPE</span>
          <span className="text-right">USD</span>
          <span className="text-right">{token.symbol || token.currency}</span>
          <span className="text-right">XRP</span>
          <span className="text-right">PRICE</span>
          <span className="text-right flex items-center justify-end gap-1">
            MAKER
            <svg className="w-3 h-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          </span>
          <span className="text-right">TXN</span>
        </div>

        {/* Mobile Headers - Match DEXScreener */}
        <div className="md:hidden grid grid-cols-[90px_1fr_95px_75px] gap-3 py-2.5 px-3.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
          <span className="pl-0.5">TXN</span>
          <span className="pl-1">USD</span>
          <span className="text-right">PRICE</span>
          <span className="text-right pr-0.5">MAKER</span>
        </div>
      </div>

      {/* Trade List */}
      <div className="flex-1 overflow-x-auto overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-2 border-bear-purple-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-base text-gray-500">Loading transactions...</span>
            </div>
          </div>
        ) : filteredTrades.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <p className="text-gray-400 text-base">No transactions found</p>
              <p className="text-gray-600 text-sm mt-1">New trades will appear in real-time</p>
            </div>
          </div>
        ) : (
          <AnimatePresence>
            {filteredTrades.map((trade) => (
              <motion.div
                key={trade.id}
                initial={trade.isNew ? { opacity: 0, y: -10, backgroundColor: 'rgba(139, 92, 246, 0.2)' } : { opacity: 1 }}
                animate={{ opacity: 1, y: 0, backgroundColor: 'transparent' }}
                transition={{ duration: 0.3 }}
                className={`hover:bg-white/[0.02] transition-all duration-200 border-b border-white/[0.05] ${
                  trade.type === 'buy' ? 'hover:bg-bear-green-500/5' : 'hover:bg-red-500/5'
                }`}
              >
                {/* DESKTOP LAYOUT */}
                <div className="hidden md:grid grid-cols-[4px_minmax(100px,1fr)_minmax(70px,0.8fr)_minmax(80px,1fr)_minmax(100px,1.2fr)_minmax(90px,1fr)_minmax(100px,1.2fr)_minmax(90px,1fr)_60px] gap-4 py-3 px-5 text-sm">
                {/* DEXScreener-Style Volume Bar on LEFT */}
                <div className="relative">
                  <div
                    className={`absolute left-0 top-0 bottom-0 rounded-r-sm transition-all ${
                      trade.type === 'buy' ? 'bg-bear-green-400' : 'bg-red-400'
                    }`}
                    style={{
                      width: '4px',
                      opacity: Math.max(0.3, (trade.amountUsd / maxUsdValue))
                    }}
                  />
                </div>

                {/* Date */}
                <span className="text-gray-400 text-sm pl-5">
                  {formatTime(trade.timestamp)}
                </span>

                {/* Type */}
                <span className={`font-bold text-sm ${trade.type === 'buy' ? 'text-bear-green-400' : 'text-red-400'}`}>
                  {trade.type === 'buy' ? 'Buy' : 'Sell'}
                </span>

                {/* USD with Volume Bar */}
                <div className="relative flex items-center justify-end">
                  <div className="absolute right-0 h-full flex items-center justify-end" style={{ width: '100%' }}>
                    <div
                      className={`h-full rounded-sm transition-all ${
                        trade.type === 'buy' ? 'bg-bear-green-500/30' : 'bg-red-500/30'
                      }`}
                      style={{
                        width: `${(trade.amountUsd / maxUsdValue) * 100}%`,
                        minWidth: '2px'
                      }}
                    />
                  </div>
                  <span className="relative z-10 text-gray-300 font-mono text-sm px-2">
                    {formatUsd(trade.amountUsd)}
                  </span>
                </div>

                {/* Token Amount */}
                <span className={`text-right font-mono text-sm ${trade.type === 'buy' ? 'text-bear-green-400' : 'text-red-400'}`}>
                  {formatAmount(trade.amount)}
                </span>

                {/* XRP - hidden on mobile/tablet */}
                <span className="text-right text-gray-300 font-mono text-sm hidden md:block">
                  {formatAmount(trade.amountXrp)}
                </span>

                {/* Price - hidden on small screens */}
                <span className="text-right text-gray-300 font-mono text-sm hidden lg:block">
                  {formatPrice(trade.priceUsd)}
                </span>

                {/* Maker with filter */}
                <button
                  onClick={() => toggleMakerFilter(trade.maker)}
                  className={`text-right font-mono text-sm flex items-center justify-end gap-1 transition-colors ${
                    makerFilter === trade.maker
                      ? 'text-bear-purple-400'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {truncateAddress(trade.maker)}
                  <svg className={`w-3 h-3 ${makerFilter === trade.maker ? 'text-bear-purple-400' : 'text-gray-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  <svg className="w-3 h-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                {/* TXN Link */}
                <a
                  href={`https://xrpscan.com/tx/${trade.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-right text-gray-500 hover:text-bearpark-gold transition-colors flex items-center justify-end"
                  onClick={(e) => e.stopPropagation()}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
                </div>

                {/* MOBILE LAYOUT - Match DEXScreener */}
                <div className="md:hidden grid grid-cols-[90px_1fr_95px_75px] gap-3 py-3 px-3.5">
                  {/* TXN: Buy/Sell Circle + Time */}
                  <div className="flex items-center gap-1.5 pl-0.5">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 shadow-lg ${
                      trade.type === 'buy' ? 'bg-bear-green-500' : 'bg-red-500'
                    }`}>
                      {trade.type === 'buy' ? 'B' : 'S'}
                    </div>
                    <span className="text-gray-400 text-[11px] whitespace-nowrap font-medium">
                      {formatTime(trade.timestamp).replace(' ago', '')}
                    </span>
                  </div>

                  {/* USD with Volume Bar */}
                  <div className="relative flex items-center pl-1">
                    <div className="absolute left-0 h-full flex items-center" style={{ width: '100%' }}>
                      <div
                        className={`h-full rounded transition-all ${
                          trade.type === 'buy' ? 'bg-bear-green-500/25' : 'bg-red-500/25'
                        }`}
                        style={{
                          width: `${(trade.amountUsd / maxUsdValue) * 100}%`,
                          minWidth: '2px'
                        }}
                      />
                    </div>
                    <span className={`relative z-10 font-mono text-[13px] font-bold ${
                      trade.type === 'buy' ? 'text-bear-green-400' : 'text-red-400'
                    }`}>
                      ${formatUsd(trade.amountUsd)}
                    </span>
                  </div>

                  {/* Price */}
                  <span className="text-right text-gray-300 font-mono text-[12px] font-semibold">
                    {formatPrice(trade.priceUsd)}
                  </span>

                  {/* Maker */}
                  <button
                    onClick={() => toggleMakerFilter(trade.maker)}
                    className={`text-right font-mono text-[11px] pr-0.5 font-medium transition-colors ${
                      makerFilter === trade.maker ? 'text-bear-purple-400' : 'text-gray-500'
                    }`}
                  >
                    {truncateAddress(trade.maker)}
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-5 py-3.5 border-t border-white/[0.08] bg-white/[0.03] backdrop-blur-md shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
        <span className="text-xs text-gray-500 font-medium">
          {filteredTrades.length} transactions {makerFilter && `(filtered)`}
        </span>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-bear-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-xs text-gray-500 font-medium">
            {isConnected ? 'Live' : 'Disconnected'}
          </span>
        </div>
      </div>
      </div>
    </div>
  );
};
