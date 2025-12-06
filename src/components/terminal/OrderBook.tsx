import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Client } from 'xrpl';
import type { Token } from '../../types';
import { toXRPLCurrency } from '../../utils/currency';

interface OrderBookProps {
  token: Token;
  onPriceClick?: (price: string) => void;
}

interface OrderLevel {
  price: number;
  amount: number;
  total: number;
  cumulative: number;
  cumulativeXrp: number;
  avgPrice: number;
  account?: string;
}

// Minimum XRP value to filter dust orders (orders below this are hidden)
const MIN_ORDER_XRP = 0.01; // Filter orders worth less than 0.01 XRP

// Maximum token amount for buy orders (filter spam/unrealistic orders)
const MAX_BUY_AMOUNT = 10_000_000; // Filter buy orders over 10 million tokens

export const OrderBook: React.FC<OrderBookProps> = ({ token, onPriceClick: _onPriceClick }) => {
  const [buyOrders, setBuyOrders] = useState<OrderLevel[]>([]);
  const [sellOrders, setSellOrders] = useState<OrderLevel[]>([]);
  const [spread, setSpread] = useState<{ value: number; percent: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const clientRef = useRef<Client | null>(null);

  // Interactive state
  const [hoveredOrder, setHoveredOrder] = useState<{ id: string; order: OrderLevel; type: 'buy' | 'sell'; rect: DOMRect } | null>(null);
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(new Set()); // Multiple expanded orders
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [longPressOrder, setLongPressOrder] = useState<{ id: string; order: OrderLevel; type: 'buy' | 'sell'; x: number; y: number } | null>(null);

  const formatPrice = (price: number): string => {
    if (price >= 1) return price.toFixed(6);
    if (price >= 0.0001) return price.toFixed(8);
    return price.toExponential(4);
  };

  const formatAmount = (amount: number): string => {
    // Show full precision like Magnetic does
    if (amount >= 1e9) return amount.toLocaleString('en-US', { maximumFractionDigits: 0 });
    if (amount >= 1e6) return amount.toLocaleString('en-US', { maximumFractionDigits: 2 });
    if (amount >= 1e3) return amount.toLocaleString('en-US', { maximumFractionDigits: 2 });
    if (amount >= 1) return amount.toLocaleString('en-US', { maximumFractionDigits: 4 });
    return amount.toFixed(6);
  };

  const fetchOrderBook = useCallback(async () => {
    if (token.currency === 'XRP' || !token.issuer) return;

    try {
      // XRPL servers with fallback
      const XRPL_SERVERS = [
        'wss://s1.ripple.com',
        'wss://s2.ripple.com',
        'wss://xrplcluster.com',
      ];

      // Create client if needed or reconnect if disconnected
      if (!clientRef.current || !clientRef.current.isConnected()) {
        // Disconnect old client if exists
        if (clientRef.current) {
          try { await clientRef.current.disconnect(); } catch {}
        }

        // Try each server until one works
        for (const server of XRPL_SERVERS) {
          try {
            clientRef.current = new Client(server);
            await clientRef.current.connect();
            console.log(`[OrderBook] Connected to ${server}`);
            break;
          } catch (err) {
            console.warn(`[OrderBook] Failed to connect to ${server}, trying next...`);
          }
        }
      }

      if (!clientRef.current || !clientRef.current.isConnected()) {
        console.error('[OrderBook] Could not connect to any XRPL server');
        return;
      }

      const client = clientRef.current;
      const xrplCurrency = toXRPLCurrency(token.currency);

      // Helper to fetch offers with pagination (max 3 pages to avoid rate limits)
      const fetchAllOffers = async (takerGets: any, takerPays: any) => {
        const allOffers: any[] = [];
        let marker: any = undefined;
        let pages = 0;
        const MAX_PAGES = 3; // Limit to avoid rate limiting

        do {
          const request: any = {
            command: 'book_offers',
            taker_gets: takerGets,
            taker_pays: takerPays,
            limit: 200,
          };
          if (marker) request.marker = marker;

          const result = await client.request(request);
          const bookResult = result.result as { offers?: any[]; marker?: any };
          const offers = bookResult.offers || [];
          allOffers.push(...offers);
          marker = bookResult.marker;
          pages++;
        } while (marker && pages < MAX_PAGES);

        return allOffers;
      };

      // ASKS (Sell orders) - Makers are SELLING token for XRP
      // Fetch ALL asks with pagination
      const askOffers = await fetchAllOffers(
        { currency: xrplCurrency, issuer: token.issuer },
        { currency: 'XRP' }
      );

      // BIDS (Buy orders) - Makers are BUYING token with XRP
      // Fetch ALL bids with pagination
      const bidOffers = await fetchAllOffers(
        { currency: 'XRP' },
        { currency: xrplCurrency, issuer: token.issuer }
      );

      // Process ASKS (sell orders) - RED
      // Price = XRP they want / TOKEN they're selling
      const asks: OrderLevel[] = [];
      let askCumulative = 0;
      let askCumulativeXrp = 0;

      for (const offer of askOffers) {
        // TakerGets = TOKEN amount (what taker receives from maker)
        // TakerPays = XRP amount in drops (what taker pays to maker)
        const tokenAmount = typeof offer.TakerGets === 'object' ? parseFloat(offer.TakerGets.value) : 0;
        const xrpAmount = typeof offer.TakerPays === 'string' ? parseInt(offer.TakerPays) / 1e6 : 0;
        const account = offer.Account || '';

        // Filter dust orders - skip if below minimum XRP threshold
        if (tokenAmount > 0 && xrpAmount >= MIN_ORDER_XRP) {
          const price = xrpAmount / tokenAmount; // XRP per token
          askCumulative += tokenAmount;
          askCumulativeXrp += xrpAmount;
          const avgPrice = askCumulativeXrp / askCumulative;

          asks.push({
            price,
            amount: tokenAmount,
            total: xrpAmount,
            cumulative: askCumulative,
            cumulativeXrp: askCumulativeXrp,
            avgPrice,
            account,
          });
        }
      }

      // Process BIDS (buy orders) - GREEN
      // Price = XRP they're offering / TOKEN they want
      const bids: OrderLevel[] = [];
      let bidCumulative = 0;
      let bidCumulativeXrp = 0;

      for (const offer of bidOffers) {
        // TakerGets = XRP amount in drops (what taker receives from maker)
        // TakerPays = TOKEN amount (what taker pays to maker)
        const xrpAmount = typeof offer.TakerGets === 'string' ? parseInt(offer.TakerGets) / 1e6 : 0;
        const tokenAmount = typeof offer.TakerPays === 'object' ? parseFloat(offer.TakerPays.value) : 0;
        const account = offer.Account || '';

        // Filter dust orders AND spam orders (over 10M tokens)
        if (tokenAmount > 0 && xrpAmount >= MIN_ORDER_XRP && tokenAmount <= MAX_BUY_AMOUNT) {
          const price = xrpAmount / tokenAmount; // XRP per token
          bidCumulative += tokenAmount;
          bidCumulativeXrp += xrpAmount;
          const avgPrice = bidCumulativeXrp / bidCumulative;

          bids.push({
            price,
            amount: tokenAmount,
            total: xrpAmount,
            cumulative: bidCumulative,
            cumulativeXrp: bidCumulativeXrp,
            avgPrice,
            account,
          });
        }
      }

      // Sort orders correctly:
      // ASKS: lowest price first (best ask = lowest = closest to spread)
      // BIDS: highest price first (best bid = highest = closest to spread)
      asks.sort((a, b) => a.price - b.price);
      bids.sort((a, b) => b.price - a.price);

      // RECALCULATE cumulative AFTER sorting (for correct depth bars)
      let askCum = 0;
      let askCumXrp = 0;
      for (const ask of asks) {
        askCum += ask.amount;
        askCumXrp += ask.total;
        ask.cumulative = askCum;
        ask.cumulativeXrp = askCumXrp;
        ask.avgPrice = askCumXrp / askCum;
      }
      let bidCum = 0;
      let bidCumXrp = 0;
      for (const bid of bids) {
        bidCum += bid.amount;
        bidCumXrp += bid.total;
        bid.cumulative = bidCum;
        bid.cumulativeXrp = bidCumXrp;
        bid.avgPrice = bidCumXrp / bidCum;
      }

      // Set state: sellOrders = ASKS (red), buyOrders = BIDS (green)
      // Show ALL orders - no limits!
      setSellOrders(asks);
      setBuyOrders(bids);
      console.log(`[OrderBook] 🐻 FULL ORDER BOOK: ${asks.length} asks, ${bids.length} bids - EVERY SINGLE ORDER!`);

      // Calculate spread (best ask - best bid)
      if (asks.length > 0 && bids.length > 0) {
        const bestAsk = asks[0].price; // Lowest ask
        const bestBid = bids[0].price; // Highest bid
        const spreadValue = bestAsk - bestBid;
        const midPrice = (bestAsk + bestBid) / 2;
        const spreadPercent = midPrice > 0 ? (spreadValue / midPrice) * 100 : 0;
        setSpread({ value: spreadValue, percent: spreadPercent });
        console.log(`[OrderBook] Best Bid: ${bestBid.toFixed(8)} | Best Ask: ${bestAsk.toFixed(8)} | Spread: ${spreadValue.toFixed(8)} (${spreadPercent.toFixed(2)}%)`);
      }

      setLastUpdate(new Date());
    } catch (error) {
      console.error('[OrderBook] Failed to fetch:', error);
    } finally {
      setIsLoading(false);
    }
  }, [token.currency, token.issuer]);

  useEffect(() => {
    fetchOrderBook();

    // Refresh every 5 seconds
    const interval = setInterval(fetchOrderBook, 15000); // 15 seconds to avoid rate limits

    return () => {
      clearInterval(interval);
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }
    };
  }, [fetchOrderBook]);

  const maxBuyCumulative = buyOrders.length > 0 ? buyOrders[buyOrders.length - 1].cumulative : 1;
  const maxSellCumulative = sellOrders.length > 0 ? sellOrders[sellOrders.length - 1].cumulative : 1;

  // Check if mobile
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Handle hover for desktop tooltip
  const handleMouseEnter = (e: React.MouseEvent, order: OrderLevel, orderId: string, type: 'buy' | 'sell') => {
    if (isMobile || expandedOrderIds.has(orderId)) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setHoveredOrder({ id: orderId, order, type, rect });
  };

  const handleMouseLeave = () => {
    setHoveredOrder(null);
  };

  // Handle long press for mobile
  const handleTouchStart = (e: React.TouchEvent, order: OrderLevel, orderId: string, type: 'buy' | 'sell') => {
    if (expandedOrderIds.has(orderId)) return;
    const touch = e.touches[0];
    longPressTimerRef.current = setTimeout(() => {
      setLongPressOrder({ id: orderId, order, type, x: touch.clientX, y: touch.clientY });
    }, 400);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleTouchMove = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setLongPressOrder(null);
  };

  // Handle click - toggle expand to show wallet address inline (supports multiple)
  const handleOrderClick = (orderId: string) => {
    // Don't expand if we just showed long press popup
    if (longPressOrder) {
      setLongPressOrder(null);
      return;
    }
    setExpandedOrderIds(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
    setHoveredOrder(null);
  };

  // Close expanded order
  const closeExpandedOrder = (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation();
    setExpandedOrderIds(prev => {
      const next = new Set(prev);
      next.delete(orderId);
      return next;
    });
  };

  // Check if order should be highlighted (part of cumulative range)
  const isOrderInCumulativeRange = (orderId: string): boolean => {
    if (!hoveredOrder) return false;

    // Parse the hovered order ID: "sell-5-0.00123" or "buy-3-0.00456"
    const hoveredParts = hoveredOrder.id.split('-');
    const hoveredType = hoveredParts[0];
    const hoveredIdx = parseInt(hoveredParts[1]);

    // Parse the current order ID
    const parts = orderId.split('-');
    const type = parts[0];
    const idx = parseInt(parts[1]);

    // Must be same type (both sells or both buys)
    if (type !== hoveredType) return false;

    // Highlight orders from 0 to hoveredIdx (inclusive) - these are included in cumulative
    return idx <= hoveredIdx;
  };

  return (
    <div className="h-full flex flex-col rounded-xl bg-bear-dark-800 border border-bear-dark-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-bear-dark-700">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-white">Order Book</h3>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-bear-dark-700 text-gray-400">
            {sellOrders.length + buyOrders.length} orders
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500">
            {lastUpdate.toLocaleTimeString()}
          </span>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9, rotate: 180 }}
            onClick={fetchOrderBook}
            className="p-1 rounded hover:bg-bear-dark-700"
          >
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </motion.button>
        </div>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-3 px-3 py-1.5 text-[10px] font-semibold text-gray-500 border-b border-bear-dark-700">
        <span>Price (XRP)</span>
        <span className="text-right">Amount</span>
        <span className="text-right">Total</span>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-bear-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Sell Orders (Red - top, reversed so lowest is at bottom near spread) */}
            <div className="flex-1 overflow-y-auto flex flex-col-reverse">
              {sellOrders.map((order, idx) => {
                const orderId = `sell-${idx}-${order.price}`;
                const isExpanded = expandedOrderIds.has(orderId);

                return (
                  <div
                    key={orderId}
                    onMouseEnter={(e) => handleMouseEnter(e, order, orderId, 'sell')}
                    onMouseLeave={handleMouseLeave}
                    onTouchStart={(e) => handleTouchStart(e, order, orderId, 'sell')}
                    onTouchEnd={handleTouchEnd}
                    onTouchMove={handleTouchMove}
                    onClick={() => handleOrderClick(orderId)}
                    className="relative cursor-pointer"
                  >
                    {/* Depth Bar */}
                    <div
                      className="absolute right-0 top-0 bottom-0 bg-red-500/20 transition-all duration-300"
                      style={{ width: `${(order.cumulative / maxSellCumulative) * 100}%` }}
                    />

                    {/* Order Row - Normal or Expanded (wallet address) */}
                    {isExpanded ? (
                      <div className="relative flex items-center justify-between px-3 py-1 text-xs font-mono bg-red-500/20">
                        <a
                          href={`https://bithomp.com/explorer/${order.account}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-red-300 hover:text-white transition-colors truncate flex-1"
                        >
                          {order.account || 'Unknown'}
                        </a>
                        <button
                          onClick={(e) => closeExpandedOrder(e, orderId)}
                          className="ml-2 p-0.5 rounded hover:bg-red-500/30 text-gray-400 hover:text-white"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <div className={`relative grid grid-cols-3 px-3 py-1 text-xs font-mono transition-colors ${
                        isOrderInCumulativeRange(orderId) ? 'bg-red-500/20' : 'hover:bg-red-950/40'
                      }`}>
                        <span className="text-red-400">{formatPrice(order.price)}</span>
                        <span className="text-right text-gray-300">{formatAmount(order.amount)}</span>
                        <span className="text-right text-gray-500">{formatAmount(order.total)}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Spread Indicator */}
            {spread && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center justify-center gap-2 py-2 px-3 bg-bear-dark-900 border-y border-bear-dark-600"
              >
                <span className="text-xs text-gray-400">Spread:</span>
                <span className="text-xs font-mono text-bearpark-gold font-bold">
                  {formatPrice(spread.value)}
                </span>
                <span className="text-[10px] text-gray-500">
                  ({spread.percent.toFixed(2)}%)
                </span>
              </motion.div>
            )}

            {/* Buy Orders (Green - bottom) */}
            <div className="flex-1 overflow-y-auto">
              {buyOrders.map((order, idx) => {
                const orderId = `buy-${idx}-${order.price}`;
                const isExpanded = expandedOrderIds.has(orderId);

                return (
                  <div
                    key={orderId}
                    onMouseEnter={(e) => handleMouseEnter(e, order, orderId, 'buy')}
                    onMouseLeave={handleMouseLeave}
                    onTouchStart={(e) => handleTouchStart(e, order, orderId, 'buy')}
                    onTouchEnd={handleTouchEnd}
                    onTouchMove={handleTouchMove}
                    onClick={() => handleOrderClick(orderId)}
                    className="relative cursor-pointer"
                  >
                    {/* Depth Bar */}
                    <div
                      className="absolute right-0 top-0 bottom-0 bg-green-500/20 transition-all duration-300"
                      style={{ width: `${(order.cumulative / maxBuyCumulative) * 100}%` }}
                    />

                    {/* Order Row - Normal or Expanded (wallet address) */}
                    {isExpanded ? (
                      <div className="relative flex items-center justify-between px-3 py-1 text-xs font-mono bg-green-500/20">
                        <a
                          href={`https://bithomp.com/explorer/${order.account}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-green-300 hover:text-white transition-colors truncate flex-1"
                        >
                          {order.account || 'Unknown'}
                        </a>
                        <button
                          onClick={(e) => closeExpandedOrder(e, orderId)}
                          className="ml-2 p-0.5 rounded hover:bg-green-500/30 text-gray-400 hover:text-white"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <div className={`relative grid grid-cols-3 px-3 py-1 text-xs font-mono transition-colors ${
                        isOrderInCumulativeRange(orderId) ? 'bg-green-500/20' : 'hover:bg-green-950/40'
                      }`}>
                        <span className="text-green-400">{formatPrice(order.price)}</span>
                        <span className="text-right text-gray-300">{formatAmount(order.amount)}</span>
                        <span className="text-right text-gray-500">{formatAmount(order.total)}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* No Orders State */}
      {!isLoading && buyOrders.length === 0 && sellOrders.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500 text-sm">No orders available</p>
        </div>
      )}

      {/* Hover Tooltip - Desktop (positioned near row) */}
      <AnimatePresence>
        {hoveredOrder && !expandedOrderIds.has(hoveredOrder.id) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 400 }}
            style={{
              position: 'fixed',
              left: hoveredOrder.rect.right + 8,
              top: hoveredOrder.rect.top + hoveredOrder.rect.height / 2,
              transform: 'translateY(-50%)',
              zIndex: 100,
            }}
            className={`bg-bear-dark-900 rounded-xl border shadow-xl p-3 min-w-[160px] pointer-events-none ${
              hoveredOrder.type === 'sell' ? 'border-red-500/40' : 'border-green-500/40'
            }`}
          >
            <div className="space-y-2">
              <div className="flex justify-between items-center gap-4">
                <span className="text-[10px] text-gray-500">Avg. price</span>
                <span className="text-xs font-mono font-bold text-white">{formatPrice(hoveredOrder.order.avgPrice)}</span>
              </div>
              <div className="flex justify-between items-center gap-4">
                <span className="text-[10px] text-gray-500">Amount {token.symbol || token.currency}</span>
                <span className={`text-xs font-mono font-bold ${hoveredOrder.type === 'sell' ? 'text-red-400' : 'text-green-400'}`}>
                  {formatAmount(hoveredOrder.order.cumulative)}
                </span>
              </div>
              <div className="flex justify-between items-center gap-4">
                <span className="text-[10px] text-gray-500">Amount XRP</span>
                <span className="text-xs font-mono font-bold text-bearpark-gold">{formatAmount(hoveredOrder.order.cumulativeXrp)}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Long Press Popup - Mobile (positioned near thumb) */}
      <AnimatePresence>
        {longPressOrder && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setLongPressOrder(null)}
              className="fixed inset-0 z-40"
            />
            {/* Popup */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: 'spring', damping: 20, stiffness: 400 }}
              style={{
                position: 'fixed',
                left: Math.min(longPressOrder.x - 80, window.innerWidth - 180),
                top: longPressOrder.y - 120,
                zIndex: 100,
              }}
              className={`bg-bear-dark-900 rounded-2xl border shadow-2xl p-4 min-w-[160px] ${
                longPressOrder.type === 'sell' ? 'border-red-500/50' : 'border-green-500/50'
              }`}
            >
              <div className="space-y-3">
                <div className="flex justify-between items-center gap-4">
                  <span className="text-xs text-gray-400">Avg. price</span>
                  <span className="text-sm font-mono font-bold text-white">{formatPrice(longPressOrder.order.avgPrice)}</span>
                </div>
                <div className="flex justify-between items-center gap-4">
                  <span className="text-xs text-gray-400">Amount {token.symbol || token.currency}</span>
                  <span className={`text-sm font-mono font-bold ${longPressOrder.type === 'sell' ? 'text-red-400' : 'text-green-400'}`}>
                    {formatAmount(longPressOrder.order.cumulative)}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-4">
                  <span className="text-xs text-gray-400">Amount XRP</span>
                  <span className="text-sm font-mono font-bold text-bearpark-gold">{formatAmount(longPressOrder.order.cumulativeXrp)}</span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
