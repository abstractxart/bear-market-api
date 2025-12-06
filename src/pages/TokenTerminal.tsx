import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { TerminalHeader } from '../components/terminal/TerminalHeader';
import { TradingViewChart, type ChartTrade } from '../components/terminal/TradingViewChart';
import { OrderBook } from '../components/terminal/OrderBook';
import { LimitOrderPanel } from '../components/terminal/LimitOrderPanel';
import { TokenWatchlist } from '../components/terminal/TokenWatchlist';
import { LiveTradesFeed, type Trade } from '../components/terminal/LiveTradesFeed';
import SwapCard from '../components/SwapCard';
import type { Token } from '../types';
import { hexToString } from '../utils/currency';
import { getTokenFromXRPL } from '../services/xrplDirectService';

interface TokenInfo {
  token: Token;
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  holders: number;
}

const TokenTerminal: React.FC = () => {
  const { currency, issuer } = useParams<{ currency: string; issuer?: string }>();
  const navigate = useNavigate();

  // State
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'chart' | 'orderbook' | 'trades'>('chart');
  const [limitOrderPrice, setLimitOrderPrice] = useState<string>('');
  const [mobilePanel, setMobilePanel] = useState<'swap' | 'limit'>('swap');
  const [tradingMode, setTradingMode] = useState<'swap' | 'limit'>('swap');
  const [chartTrades, setChartTrades] = useState<ChartTrade[]>([]);

  // Handle trades update from LiveTradesFeed - convert to chart format
  const handleTradesUpdate = useCallback((trades: Trade[]) => {
    const converted: ChartTrade[] = trades.map(t => ({
      type: t.type,
      timestamp: t.timestamp,
      price: t.price,
      amount: t.amount,
    }));
    setChartTrades(converted);
  }, []);

  // Decode currency if hex
  const decodedCurrency = currency && currency.length === 40 ? hexToString(currency) : currency;

  // Build token object
  const currentToken: Token | null = currency ? {
    currency: currency,
    issuer: issuer,
    name: decodedCurrency || currency,
    symbol: decodedCurrency || currency,
    decimals: 15,
  } : null;

  // Fetch token info - PARALLEL FETCH FROM ALL SOURCES!
  const fetchTokenInfo = useCallback(async () => {
    if (!currentToken || !currentToken.issuer) return;

    setIsLoading(true);
    console.log(`[TokenTerminal] 🐻 Fetching ALL data for ${currentToken.currency}...`);

    try {
      // FETCH ALL SOURCES IN PARALLEL - Combine the best data from each!
      const [xrplResult, dexResult, metaResult] = await Promise.allSettled([
        // 1. Pure XRPL - Best price (direct from order book)
        getTokenFromXRPL(currentToken.currency, currentToken.issuer),

        // 2. DexScreener - 24h change, volume, market cap
        fetch(`https://api.dexscreener.com/latest/dex/search?q=${currentToken.currency} xrpl`, {
          signal: AbortSignal.timeout(5000)
        }).then(r => r.ok ? r.json() : null),

        // 3. XRPL Meta - Holders, trustlines
        fetch(`https://s1.xrplmeta.org/token/${currentToken.currency}:${currentToken.issuer}`, {
          signal: AbortSignal.timeout(5000)
        }).then(r => r.ok ? r.json() : null),
      ]);

      // Initialize with zeros
      let price = 0;
      let priceChange24h = 0;
      let volume24h = 0;
      let marketCap = 0;
      let holders = 0;

      // 1. Get PRICE from Pure XRPL (most accurate!)
      if (xrplResult.status === 'fulfilled' && xrplResult.value) {
        price = xrplResult.value.price || 0;
        marketCap = xrplResult.value.marketCap || 0;
        console.log(`[TokenTerminal] ✅ XRPL Direct: price=${price} XRP`);
      }

      // 2. Get 24h CHANGE, VOLUME, MARKET CAP from DexScreener
      if (dexResult.status === 'fulfilled' && dexResult.value?.pairs) {
        const pair = dexResult.value.pairs.find((p: any) =>
          p.chainId === 'xrpl' &&
          p.baseToken?.address?.includes(currentToken.issuer || '')
        );
        if (pair) {
          // DexScreener has the BEST 24h data!
          priceChange24h = pair.priceChange?.h24 || 0;
          volume24h = pair.volume?.h24 || 0;
          // Use DexScreener market cap if we don't have one yet
          if (!marketCap) marketCap = pair.marketCap || pair.fdv || 0;
          // Use DexScreener price if XRPL failed
          if (!price) price = parseFloat(pair.priceNative) || 0;
          console.log(`[TokenTerminal] ✅ DexScreener: change=${priceChange24h}%, vol=${volume24h}, mcap=${marketCap}`);
        }
      }

      // 3. Get HOLDERS from XRPL Meta
      if (metaResult.status === 'fulfilled' && metaResult.value) {
        const meta = metaResult.value;
        holders = meta.metrics?.holders || meta.holders || 0;
        // Fill in market cap from meta if still missing
        if (!marketCap && meta.metrics?.marketcap) {
          marketCap = parseFloat(meta.metrics.marketcap) || 0;
        }
        console.log(`[TokenTerminal] ✅ XRPL Meta: holders=${holders}`);
      }

      // If we still don't have holders, try xrpl.to as backup
      if (holders === 0) {
        try {
          const XRPL_TO_API = import.meta.env.DEV ? '/api/xrplto' : 'https://api.xrpl.to/api';
          const xrplToResponse = await fetch(
            `${XRPL_TO_API}/token/${currentToken.currency}:${currentToken.issuer}`,
            { signal: AbortSignal.timeout(3000) }
          );
          if (xrplToResponse.ok) {
            const xrplToData = await xrplToResponse.json();
            if (xrplToData?.token) {
              holders = parseInt(xrplToData.token.holders) || 0;
              // Fill in any missing data from xrpl.to
              if (!priceChange24h) priceChange24h = parseFloat(xrplToData.token.pro_24h) || 0;
              if (!volume24h) volume24h = parseFloat(xrplToData.token.vol_24h) || 0;
              console.log(`[TokenTerminal] ✅ xrpl.to backup: holders=${holders}`);
            }
          }
        } catch {
          // xrpl.to backup failed, that's okay
        }
      }

      // Set the combined token info!
      console.log(`[TokenTerminal] 🐻🐻🐻 FINAL: price=${price}, change=${priceChange24h}%, vol=${volume24h}, mcap=${marketCap}, holders=${holders}`);
      setTokenInfo({
        token: currentToken,
        price,
        priceChange24h,
        volume24h,
        marketCap,
        holders,
      });

    } catch (error) {
      console.error('[TokenTerminal] Failed to fetch token info:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentToken?.currency, currentToken?.issuer]);

  useEffect(() => {
    fetchTokenInfo();
    // Refresh every 10 seconds
    const interval = setInterval(fetchTokenInfo, 10000);
    return () => clearInterval(interval);
  }, [fetchTokenInfo]);

  // Handle token switch from watchlist
  const handleTokenSelect = (token: Token) => {
    if (token.currency === 'XRP') {
      navigate('/tokens');
    } else {
      navigate(`/tokens/${token.currency}/${token.issuer}`);
    }
  };

  // Handle price click from order book
  const handlePriceClick = (price: string) => {
    setLimitOrderPrice(price);
    setTradingMode('limit');
    setMobilePanel('limit');
  };

  if (!currentToken) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Invalid token</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bear-dark-900">
      {/* Terminal Header */}
      <TerminalHeader
        token={currentToken}
        tokenInfo={tokenInfo}
        isLoading={isLoading}
      />

      {/* Main Terminal Grid - Desktop GODMODE Layout */}
      <div className="hidden lg:grid grid-cols-[300px_1fr_320px] gap-2 p-2 h-[calc(100vh-120px)]">
        {/* Left Column - Order Book (Full Height) */}
        <div className="h-full overflow-hidden">
          <OrderBook
            token={currentToken}
            onPriceClick={handlePriceClick}
          />
        </div>

        {/* Center Column - Chart + Trades */}
        <div className="flex flex-col gap-2 h-full">
          {/* Chart - Takes ~48% of available height */}
          <div className="flex-[0.95] min-h-[420px] max-h-[650px]">
            <TradingViewChart token={currentToken} trades={chartTrades} />
          </div>
          {/* Trades - Takes ~52% of available height with scroll */}
          <div className="flex-[1.05] min-h-[450px]">
            <LiveTradesFeed token={currentToken} onTradesUpdate={handleTradesUpdate} />
          </div>
        </div>

        {/* Right Column - Watchlist + Swap/Limit */}
        <div className="flex flex-col gap-2 h-full">
          {/* Watchlist */}
          <div className="h-[240px]">
            <TokenWatchlist
              currentToken={currentToken}
              onTokenSelect={handleTokenSelect}
            />
          </div>

          {/* Trading Panel - Compact */}
          <div className="flex-1 min-h-0 flex flex-col">
            {/* Trading Mode Toggle */}
            <div className="flex items-center justify-center gap-1 mb-2">
              <div className="inline-flex p-1 bg-bear-dark-800 rounded-xl border border-bear-dark-600">
                <button
                  onClick={() => setTradingMode('swap')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    tradingMode === 'swap'
                      ? 'bg-gradient-to-r from-bear-green-500 to-bear-green-600 text-white shadow-lg shadow-bear-green-500/25'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  ⚡ MARKET SWAP
                </button>
                <button
                  onClick={() => setTradingMode('limit')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    tradingMode === 'limit'
                      ? 'bg-gradient-to-r from-bearpark-gold to-yellow-500 text-black shadow-lg shadow-bearpark-gold/25'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  🎯 LIMIT ORDER
                </button>
              </div>
            </div>

            {/* Trading Card */}
            <div className="flex-1 overflow-hidden">
              <AnimatePresence mode="wait">
                {tradingMode === 'swap' ? (
                  <motion.div
                    key="swap"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="h-full"
                  >
                    <SwapCard presetOutputToken={currentToken} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="limit"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="h-full"
                  >
                    <LimitOrderPanel
                      token={currentToken}
                      initialPrice={limitOrderPrice}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Tablet Layout (md-lg) */}
      <div className="hidden md:grid lg:hidden grid-cols-2 gap-2 p-2 h-[calc(100vh-120px)]">
        {/* Top Row - Trades (full width) - 35% of height */}
        <div className="col-span-2 h-[35vh] min-h-[300px]">
          <LiveTradesFeed token={currentToken} onTradesUpdate={handleTradesUpdate} />
        </div>

        {/* Middle Row - Order Book & Swap - 40% of height */}
        <div className="h-[40vh] min-h-[350px]">
          <OrderBook token={currentToken} onPriceClick={handlePriceClick} />
        </div>
        <div className="flex flex-col gap-2 h-[40vh] min-h-[350px]">
          <SwapCard presetOutputToken={currentToken} />
        </div>

        {/* Bottom Row - Watchlist - remaining height */}
        <div className="col-span-2 flex-1 min-h-[180px]">
          <TokenWatchlist currentToken={currentToken} onTokenSelect={handleTokenSelect} />
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden flex flex-col gap-2 p-2">
        {/* Mobile Tabs */}
        <div className="flex gap-1 p-1 bg-bear-dark-800 rounded-xl">
          {(['chart', 'orderbook', 'trades'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                activeTab === tab
                  ? 'bg-bear-purple-500 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab === 'chart' ? '📈 Chart' : tab === 'orderbook' ? '📊 Orders' : '💹 Trades'}
            </button>
          ))}
        </div>

        {/* Mobile Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'chart' && (
            <motion.div
              key="chart"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex flex-col gap-2"
            >
              <div className="h-[40vh] min-h-[280px]">
                <TradingViewChart token={currentToken} trades={chartTrades} />
              </div>

              {/* Swap/Limit Toggle */}
              <div className="flex gap-1 p-1 bg-bear-dark-800 rounded-xl">
                <button
                  onClick={() => setMobilePanel('swap')}
                  className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-bold transition-all ${
                    mobilePanel === 'swap'
                      ? 'bg-gradient-to-r from-bear-green-500 to-bear-green-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  ⚡ Market
                </button>
                <button
                  onClick={() => setMobilePanel('limit')}
                  className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-bold transition-all ${
                    mobilePanel === 'limit'
                      ? 'bg-gradient-to-r from-bearpark-gold to-yellow-500 text-black'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  🎯 Limit
                </button>
              </div>

              {mobilePanel === 'swap' ? (
                <SwapCard presetOutputToken={currentToken} />
              ) : (
                <LimitOrderPanel
                  token={currentToken}
                  initialPrice={limitOrderPrice}
                />
              )}
            </motion.div>
          )}

          {activeTab === 'orderbook' && (
            <motion.div
              key="orderbook"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="h-[70vh] min-h-[450px]"
            >
              <OrderBook
                token={currentToken}
                onPriceClick={handlePriceClick}
              />
            </motion.div>
          )}

          {activeTab === 'trades' && (
            <motion.div
              key="trades"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex flex-col gap-2"
            >
              <div className="h-[25vh] min-h-[180px]">
                <TokenWatchlist
                  currentToken={currentToken}
                  onTokenSelect={handleTokenSelect}
                />
              </div>
              <div className="h-[50vh] min-h-[380px]">
                <LiveTradesFeed token={currentToken} onTradesUpdate={handleTradesUpdate} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default TokenTerminal;
