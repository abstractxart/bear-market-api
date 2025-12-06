import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { TerminalHeader } from '../components/terminal/TerminalHeader';
import { TradingViewChart } from '../components/terminal/TradingViewChart';
import { OrderBook } from '../components/terminal/OrderBook';
import { LimitOrderPanel } from '../components/terminal/LimitOrderPanel';
import { TokenWatchlist } from '../components/terminal/TokenWatchlist';
import { LiveTradesFeed } from '../components/terminal/LiveTradesFeed';
import SwapCard from '../components/SwapCard';
import type { Token } from '../types';
import { hexToString } from '../utils/currency';

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

  // Fetch token info from xrpl.to API
  const fetchTokenInfo = useCallback(async () => {
    if (!currentToken || !currentToken.issuer) return;

    setIsLoading(true);
    try {
      // Fetch from xrpl.to API for accurate data
      const xrplToUrl = `https://api.xrpl.to/api/token/${currentToken.currency}:${currentToken.issuer}`;

      const response = await fetch(xrplToUrl);
      if (response.ok) {
        const data = await response.json();

        if (data && data.token) {
          const token = data.token;
          setTokenInfo({
            token: currentToken,
            price: parseFloat(token.price_mid) || 0,
            priceChange24h: parseFloat(token.pro_24h) || 0,
            volume24h: parseFloat(token.vol_24h) || 0,
            marketCap: parseFloat(token.marketcap) || 0,
            holders: parseInt(token.holders) || 0,
          });

          // Update token with icon if available
          if (token.icon) {
            currentToken.icon = token.icon;
          }
        }
      } else {
        // Fallback to OnTheDex API
        const otdUrl = `https://api.onthedex.live/public/v1/ticker/XRP/${currentToken.currency}:${currentToken.issuer}`;
        const otdResponse = await fetch(otdUrl);
        if (otdResponse.ok) {
          const otdData = await otdResponse.json();
          setTokenInfo({
            token: currentToken,
            price: otdData.last || 0,
            priceChange24h: otdData.change24h || 0,
            volume24h: otdData.volume24h || 0,
            marketCap: 0,
            holders: 0,
          });
        }
      }
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
    <div className="min-h-screen bg-bear-dark-900 pt-14 md:pt-16">
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

        {/* Center Column - Chart + Trading Panel */}
        <div className="flex flex-col gap-2 h-full">
          {/* Chart - Takes most of the space */}
          <div className="flex-1 min-h-0">
            <TradingViewChart token={currentToken} />
          </div>

          {/* Trading Panel - Swap & Limit Side by Side */}
          <div className="h-auto">
            {/* Trading Mode Toggle */}
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="inline-flex p-1 bg-bear-dark-800 rounded-xl border border-bear-dark-600">
                <button
                  onClick={() => setTradingMode('swap')}
                  className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                    tradingMode === 'swap'
                      ? 'bg-gradient-to-r from-bear-green-500 to-bear-green-600 text-white shadow-lg shadow-bear-green-500/25'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  ⚡ MARKET SWAP
                </button>
                <button
                  onClick={() => setTradingMode('limit')}
                  className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                    tradingMode === 'limit'
                      ? 'bg-gradient-to-r from-bearpark-gold to-yellow-500 text-black shadow-lg shadow-bearpark-gold/25'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  🎯 LIMIT ORDER
                </button>
              </div>
            </div>

            {/* Trading Cards - Animate between them */}
            <div className="grid grid-cols-2 gap-3 max-w-3xl mx-auto">
              <AnimatePresence mode="wait">
                {tradingMode === 'swap' ? (
                  <motion.div
                    key="swap-full"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="col-span-2"
                  >
                    <SwapCard presetOutputToken={currentToken} />
                  </motion.div>
                ) : (
                  <>
                    <motion.div
                      key="swap-half"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="col-span-1"
                    >
                      <SwapCard presetOutputToken={currentToken} />
                    </motion.div>
                    <motion.div
                      key="limit-half"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="col-span-1"
                    >
                      <LimitOrderPanel
                        token={currentToken}
                        initialPrice={limitOrderPrice}
                      />
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Right Column - Watchlist + Trades */}
        <div className="flex flex-col gap-2 h-full">
          <div className="h-[280px]">
            <TokenWatchlist
              currentToken={currentToken}
              onTokenSelect={handleTokenSelect}
            />
          </div>
          <div className="flex-1 min-h-0">
            <LiveTradesFeed token={currentToken} />
          </div>
        </div>
      </div>

      {/* Tablet Layout (md-lg) */}
      <div className="hidden md:grid lg:hidden grid-cols-2 gap-2 p-2">
        {/* Top Row - Chart */}
        <div className="col-span-2 h-[350px]">
          <TradingViewChart token={currentToken} />
        </div>

        {/* Middle Row - Order Book & Trading */}
        <div className="h-[400px]">
          <OrderBook token={currentToken} onPriceClick={handlePriceClick} />
        </div>
        <div className="flex flex-col gap-2">
          <SwapCard presetOutputToken={currentToken} />
        </div>

        {/* Bottom Row - Watchlist & Trades */}
        <div className="h-[300px]">
          <TokenWatchlist currentToken={currentToken} onTokenSelect={handleTokenSelect} />
        </div>
        <div className="h-[300px]">
          <LiveTradesFeed token={currentToken} />
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
              <div className="h-[300px]">
                <TradingViewChart token={currentToken} />
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
              className="h-[500px]"
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
              <div className="h-[200px]">
                <TokenWatchlist
                  currentToken={currentToken}
                  onTokenSelect={handleTokenSelect}
                />
              </div>
              <div className="h-[400px]">
                <LiveTradesFeed token={currentToken} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default TokenTerminal;
