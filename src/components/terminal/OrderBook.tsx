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
}

export const OrderBook: React.FC<OrderBookProps> = ({ token, onPriceClick }) => {
  const [buyOrders, setBuyOrders] = useState<OrderLevel[]>([]);
  const [sellOrders, setSellOrders] = useState<OrderLevel[]>([]);
  const [spread, setSpread] = useState<{ value: number; percent: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const clientRef = useRef<Client | null>(null);

  const formatPrice = (price: number): string => {
    if (price >= 1) return price.toFixed(6);
    if (price >= 0.0001) return price.toFixed(8);
    return price.toExponential(4);
  };

  const formatAmount = (amount: number): string => {
    if (amount >= 1e6) return `${(amount / 1e6).toFixed(2)}M`;
    if (amount >= 1e3) return `${(amount / 1e3).toFixed(2)}K`;
    return amount.toFixed(2);
  };

  const fetchOrderBook = useCallback(async () => {
    if (token.currency === 'XRP' || !token.issuer) return;

    try {
      // Create client if needed
      if (!clientRef.current) {
        clientRef.current = new Client('wss://xrplcluster.com');
        await clientRef.current.connect();
      }

      const client = clientRef.current;

      // Fetch buy orders (XRP → Token)
      // taker_gets = what taker receives (token)
      // taker_pays = what taker pays (XRP)
      const buyResult = await client.request({
        command: 'book_offers',
        taker_gets: {
          currency: toXRPLCurrency(token.currency),
          issuer: token.issuer,
        },
        taker_pays: { currency: 'XRP' },
        limit: 20,
      });

      // Fetch sell orders (Token → XRP)
      // taker_gets = what taker receives (XRP)
      // taker_pays = what taker pays (token)
      const sellResult = await client.request({
        command: 'book_offers',
        taker_gets: { currency: 'XRP' },
        taker_pays: {
          currency: toXRPLCurrency(token.currency),
          issuer: token.issuer,
        },
        limit: 20,
      });

      // Process buy orders
      const processedBuys: OrderLevel[] = [];
      let buyCumulative = 0;

      for (const offer of buyResult.result.offers || []) {
        const takerGets = typeof offer.TakerGets === 'object' ? parseFloat(offer.TakerGets.value) : 0;
        const takerPays = typeof offer.TakerPays === 'string' ? parseInt(offer.TakerPays) / 1e6 : 0;

        if (takerGets > 0 && takerPays > 0) {
          const price = takerPays / takerGets; // XRP per token
          const amount = takerGets;
          buyCumulative += amount;

          processedBuys.push({
            price,
            amount,
            total: price * amount,
            cumulative: buyCumulative,
          });
        }
      }

      // Process sell orders
      const processedSells: OrderLevel[] = [];
      let sellCumulative = 0;

      for (const offer of sellResult.result.offers || []) {
        const takerGets = typeof offer.TakerGets === 'string' ? parseInt(offer.TakerGets) / 1e6 : 0;
        const takerPays = typeof offer.TakerPays === 'object' ? parseFloat(offer.TakerPays.value) : 0;

        if (takerGets > 0 && takerPays > 0) {
          const price = takerGets / takerPays; // XRP per token
          const amount = takerPays;
          sellCumulative += amount;

          processedSells.push({
            price,
            amount,
            total: price * amount,
            cumulative: sellCumulative,
          });
        }
      }

      // Sort orders
      processedBuys.sort((a, b) => b.price - a.price); // Highest buy first
      processedSells.sort((a, b) => a.price - b.price); // Lowest sell first

      setBuyOrders(processedBuys.slice(0, 15));
      setSellOrders(processedSells.slice(0, 15));

      // Calculate spread
      if (processedBuys.length > 0 && processedSells.length > 0) {
        const highestBuy = processedBuys[0].price;
        const lowestSell = processedSells[0].price;
        const spreadValue = lowestSell - highestBuy;
        const spreadPercent = (spreadValue / lowestSell) * 100;
        setSpread({ value: spreadValue, percent: spreadPercent });
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
    const interval = setInterval(fetchOrderBook, 5000);

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

  return (
    <div className="h-full flex flex-col rounded-xl bg-bear-dark-800 border border-bear-dark-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-bear-dark-700">
        <h3 className="text-sm font-bold text-white">Order Book</h3>
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
              <AnimatePresence>
                {sellOrders.map((order, idx) => (
                  <motion.div
                    key={`sell-${idx}-${order.price}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    onClick={() => onPriceClick?.(order.price.toFixed(8))}
                    className="relative grid grid-cols-3 px-3 py-1 text-xs font-mono cursor-pointer hover:bg-bear-dark-700/50 transition-colors group"
                  >
                    {/* Depth Bar */}
                    <div
                      className="absolute right-0 top-0 bottom-0 bg-red-500/10 transition-all"
                      style={{ width: `${(order.cumulative / maxSellCumulative) * 100}%` }}
                    />
                    <span className="relative text-red-400 group-hover:text-red-300">
                      {formatPrice(order.price)}
                    </span>
                    <span className="relative text-right text-gray-300">
                      {formatAmount(order.amount)}
                    </span>
                    <span className="relative text-right text-gray-500">
                      {formatAmount(order.total)}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
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
              <AnimatePresence>
                {buyOrders.map((order, idx) => (
                  <motion.div
                    key={`buy-${idx}-${order.price}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    onClick={() => onPriceClick?.(order.price.toFixed(8))}
                    className="relative grid grid-cols-3 px-3 py-1 text-xs font-mono cursor-pointer hover:bg-bear-dark-700/50 transition-colors group"
                  >
                    {/* Depth Bar */}
                    <div
                      className="absolute right-0 top-0 bottom-0 bg-bear-green-500/10 transition-all"
                      style={{ width: `${(order.cumulative / maxBuyCumulative) * 100}%` }}
                    />
                    <span className="relative text-bear-green-400 group-hover:text-bear-green-300">
                      {formatPrice(order.price)}
                    </span>
                    <span className="relative text-right text-gray-300">
                      {formatAmount(order.amount)}
                    </span>
                    <span className="relative text-right text-gray-500">
                      {formatAmount(order.total)}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
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
    </div>
  );
};
