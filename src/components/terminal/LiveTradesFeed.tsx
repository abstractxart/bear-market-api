import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Client } from 'xrpl';
import type { Token } from '../../types';

// Export Trade interface for use by other components
export interface Trade {
  id: string;
  type: 'buy' | 'sell';
  price: number;
  priceUsd: number;
  amount: number;
  amountXrp: number;
  amountUsd: number;
  maker: string;
  timestamp: Date;
  hash: string;
  isNew?: boolean;
}

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
  const [xrpUsdPrice, setXrpUsdPrice] = useState<number>(2.0); // XRP/USD price
  const clientRef = useRef<Client | null>(null);

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

  // Helper: Convert currency to HEX for XRPL
  const currencyToHex = (currency: string): string => {
    if (currency.length === 3) return currency;
    if (currency.length === 40 && /^[0-9A-Fa-f]+$/.test(currency)) return currency;
    let hex = '';
    for (let i = 0; i < currency.length; i++) {
      hex += currency.charCodeAt(i).toString(16).padStart(2, '0');
    }
    return hex.padEnd(40, '0').toUpperCase();
  };

  // Parse trades from RippleState balance changes
  const parseTradesFromTx = (tx: any, meta: any, closeTime?: number, currentPrice?: number): Trade[] => {
    const trades: Trade[] = [];
    if (!tx || !meta || meta.TransactionResult !== 'tesSUCCESS') return trades;

    const affectedNodes = meta.AffectedNodes || [];
    const xrplCurrency = currencyToHex(token.currency);
    const RIPPLE_EPOCH = 946684800;

    for (const node of affectedNodes) {
      const modified = node.ModifiedNode;
      if (!modified || modified.LedgerEntryType !== 'RippleState') continue;

      const prev = modified.PreviousFields;
      const final = modified.FinalFields;
      if (!prev?.Balance || !final?.Balance) continue;

      const currency = final.Balance?.currency || final.HighLimit?.currency || final.LowLimit?.currency;
      if (currency !== xrplCurrency) continue;

      const highIssuer = final.HighLimit?.issuer;
      const lowIssuer = final.LowLimit?.issuer;
      if (highIssuer !== token.issuer && lowIssuer !== token.issuer) continue;

      const prevBalance = parseFloat(prev.Balance?.value || '0');
      const finalBalance = parseFloat(final.Balance?.value || '0');
      const balanceChange = Math.abs(finalBalance - prevBalance);

      if (balanceChange < 0.01) continue;

      const isBuy = finalBalance > prevBalance;
      const holderAddress = highIssuer === token.issuer ? lowIssuer : highIssuer;
      if (!holderAddress || holderAddress === token.issuer) continue;

      const price = currentPrice || 0.00126;
      const amountXrp = balanceChange * price;
      const priceUsd = price * xrpUsdPrice;
      const amountUsd = amountXrp * xrpUsdPrice;

      const timestamp = closeTime
        ? new Date((RIPPLE_EPOCH + closeTime) * 1000)
        : new Date();

      trades.push({
        id: `${tx.hash || ''}-${holderAddress}-${Math.random().toString(36).slice(2, 8)}`,
        type: isBuy ? 'buy' : 'sell',
        price,
        priceUsd,
        amount: balanceChange,
        amountXrp,
        amountUsd,
        maker: holderAddress || 'Unknown',
        timestamp,
        hash: tx.hash || '',
      });
    }

    return trades;
  };

  // Fetch XRP/USD price
  const fetchXrpPrice = async () => {
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd');
      const data = await response.json();
      if (data?.ripple?.usd) {
        setXrpUsdPrice(data.ripple.usd);
      }
    } catch (e) {
      console.warn('[LiveTradesFeed] Could not fetch XRP price');
    }
  };

  // Initialize trade stream
  const initializeTradeStream = useCallback(async () => {
    if (token.currency === 'XRP' || !token.issuer) return;

    setIsLoading(true);
    const xrplCurrency = currencyToHex(token.currency);

    // Fetch XRP/USD price first
    await fetchXrpPrice();

    try {
      const endpoints = ['wss://xrplcluster.com', 'wss://s1.ripple.com', 'wss://s2.ripple.com'];
      let client: Client | null = null;

      for (const endpoint of endpoints) {
        try {
          client = new Client(endpoint);
          await client.connect();
          break;
        } catch (e) {
          console.warn(`[LiveTradesFeed] Failed ${endpoint}`);
        }
      }

      if (!client?.isConnected()) {
        setIsLoading(false);
        return;
      }

      clientRef.current = client;
      setIsConnected(true);

      // Get current price from order book
      let currentPrice = 0;
      try {
        const bookResponse = await client.request({
          command: 'book_offers',
          taker_gets: { currency: xrplCurrency, issuer: token.issuer },
          taker_pays: { currency: 'XRP' },
          limit: 1,
        });
        if (bookResponse.result.offers?.[0]) {
          const offer = bookResponse.result.offers[0];
          const tg = offer.TakerGets as any;
          const tp = offer.TakerPays as any;
          const tokenAmt = typeof tg === 'object' ? parseFloat(tg.value || '0') : 0;
          const xrpAmt = typeof tp === 'string' ? parseInt(tp) / 1e6 : 0;
          currentPrice = tokenAmt > 0 ? xrpAmt / tokenAmt : 0;
        }
      } catch (e) {
        currentPrice = 0.00126;
      }

      // Fetch recent transactions
      const parsedTrades: Trade[] = [];
      let marker: any = undefined;
      let pages = 0;

      do {
        const request: any = {
          command: 'account_tx',
          account: token.issuer,
          limit: 100,
          forward: false,
          api_version: 1,
        };
        if (marker) request.marker = marker;

        try {
          const response = await client.request(request);
          const result = response.result as { transactions?: any[]; marker?: any };
          const transactions = result.transactions || [];

          for (const txEntry of transactions) {
            const tx = txEntry.tx;
            const meta = txEntry.meta;
            const closeTime = tx?.date;

            const txTrades = parseTradesFromTx(tx, meta, closeTime, currentPrice);
            for (const trade of txTrades) {
              if (!parsedTrades.find(t => t.hash === trade.hash && t.maker === trade.maker)) {
                parsedTrades.push(trade);
              }
            }
          }

          marker = result.marker;
          pages++;
          if (parsedTrades.length >= 100) break;
        } catch (err) {
          break;
        }
      } while (marker && pages < 5);

      parsedTrades.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setTrades(parsedTrades.slice(0, 100));
      setIsLoading(false);

      // Subscribe to live updates
      const TAKER_ADDRESS = 'rrrrrrrrrrrrrrrrrrrrBZbvji';
      try {
        await client.request({
          command: 'subscribe',
          accounts: [token.issuer],
          books: [
            { taker_gets: { currency: 'XRP' }, taker_pays: { currency: xrplCurrency, issuer: token.issuer }, taker: TAKER_ADDRESS, both: true },
            { taker_gets: { currency: xrplCurrency, issuer: token.issuer }, taker_pays: { currency: 'XRP' }, taker: TAKER_ADDRESS, both: true },
          ],
        });
      } catch (subError) {
        console.error(`[LiveTradesFeed] Subscribe error:`, subError);
      }

      client.on('transaction', (txData: any) => {
        const newTrades = parseTradesFromTx(txData.transaction, txData.meta, undefined, currentPrice);
        for (const trade of newTrades) {
          trade.isNew = true;
          setTrades(prev => {
            if (prev.find(t => t.hash === trade.hash && t.maker === trade.maker)) return prev;
            return [trade, ...prev.slice(0, 99)];
          });
          setTimeout(() => {
            setTrades(prev => prev.map(t => t.id === trade.id ? { ...t, isNew: false } : t));
          }, 2000);
        }
      });

    } catch (error) {
      console.error('[LiveTradesFeed] Error:', error);
      setIsLoading(false);
    }
  }, [token.currency, token.issuer, xrpUsdPrice]);

  useEffect(() => {
    initializeTradeStream();
    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
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

  // Toggle maker filter
  const toggleMakerFilter = (maker: string) => {
    setMakerFilter(prev => prev === maker ? null : maker);
  };

  return (
    <div className="h-full flex flex-col rounded-2xl bg-bear-dark-800 border border-bear-dark-700 overflow-hidden">
      {/* Header with Tabs */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-bear-dark-700">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveTab('transactions')}
            className={`flex items-center gap-2 text-sm font-semibold transition-colors ${
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
            className={`flex items-center gap-2 text-sm font-semibold transition-colors ${
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
      <div className="grid grid-cols-[minmax(100px,1fr)_minmax(70px,0.8fr)_minmax(80px,1fr)_minmax(100px,1.2fr)_minmax(90px,1fr)_minmax(100px,1.2fr)_minmax(90px,1fr)_60px] gap-4 px-5 py-3 text-sm font-semibold text-gray-500 border-b border-bear-dark-700 bg-bear-dark-900/50">
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

      {/* Trade List */}
      <div className="flex-1 overflow-y-auto">
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
                className={`grid grid-cols-[minmax(100px,1fr)_minmax(70px,0.8fr)_minmax(80px,1fr)_minmax(100px,1.2fr)_minmax(90px,1fr)_minmax(100px,1.2fr)_minmax(90px,1fr)_60px] gap-4 px-5 py-4 text-sm hover:bg-bear-dark-700/30 transition-colors border-b border-bear-dark-700/50 ${
                  trade.type === 'buy' ? 'hover:bg-bear-green-500/5' : 'hover:bg-red-500/5'
                }`}
              >
                {/* Date */}
                <span className="text-gray-400 text-sm">
                  {formatTime(trade.timestamp)}
                </span>

                {/* Type */}
                <span className={`font-bold text-sm ${trade.type === 'buy' ? 'text-bear-green-400' : 'text-red-400'}`}>
                  {trade.type === 'buy' ? 'Buy' : 'Sell'}
                </span>

                {/* USD */}
                <span className="text-right text-gray-300 font-mono text-sm">
                  {formatUsd(trade.amountUsd)}
                </span>

                {/* Token Amount */}
                <span className={`text-right font-mono text-sm ${trade.type === 'buy' ? 'text-bear-green-400' : 'text-red-400'}`}>
                  {formatAmount(trade.amount)}
                </span>

                {/* XRP */}
                <span className="text-right text-gray-300 font-mono text-sm">
                  {formatAmount(trade.amountXrp)}
                </span>

                {/* Price */}
                <span className="text-right text-gray-300 font-mono text-sm">
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
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-bear-dark-700 bg-bear-dark-900/50">
        <span className="text-sm text-gray-500">
          {filteredTrades.length} transactions {makerFilter && `(filtered)`}
        </span>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-bear-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-sm text-gray-500">
            {isConnected ? 'Live' : 'Disconnected'}
          </span>
        </div>
      </div>
    </div>
  );
};
