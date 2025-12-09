import { motion } from 'framer-motion';
import type { Token } from '../../types';

interface TokenMetricsBarProps {
  token: Token;
  priceChange24h: number;
  volume24h: number;
}

export const TokenMetricsBar: React.FC<TokenMetricsBarProps> = ({
  priceChange24h,
}) => {
  // Mock data for now - these would come from real API calls
  const metrics = {
    priceUsd: 0.002681,
    priceXrp: 0.001305,
    liquidity: 275000,
    fdv: 1400000,
    marketCap: 1400000,
    change5m: -0.43,
    change1h: -0.66,
    change6h: -0.73,
    change24h: priceChange24h,
    txns: 66,
    buys: 12,
    sells: 54,
    volume: 2200,
    buyVolume: 1600,
    sellVolume: 643,
    makers: 31,
    buyers: 9,
    sellers: 25,
  };

  const formatPrice = (price: number): string => {
    if (price >= 1) return `$${price.toFixed(6)}`;
    if (price >= 0.0001) return `$${price.toFixed(6)}`;
    return `$${price.toExponential(2)}`;
  };

  const formatNumber = (num: number): string => {
    if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}K`;
    return `$${num.toFixed(0)}`;
  };

  const formatChange = (change: number): string => {
    return `${change >= 0 ? '' : ''}${change.toFixed(2)}%`;
  };

  const getChangeColor = (change: number): string => {
    if (change > 0) return 'text-bear-green-400';
    if (change < 0) return 'text-red-400';
    return 'text-gray-400';
  };

  const buyPercentage = (metrics.buys / (metrics.buys + metrics.sells)) * 100;
  const buyVolumePercentage = (metrics.buyVolume / (metrics.buyVolume + metrics.sellVolume)) * 100;
  const buyersPercentage = (metrics.buyers / (metrics.buyers + metrics.sellers)) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card"
    >
      <div className="px-4 py-3">
        {/* Top Stats Grid */}
        <div className="grid grid-cols-5 gap-4 mb-3 pb-3 border-b border-white/[0.08]">
          <div>
            <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Price USD</p>
            <p className="text-sm font-bold text-white">{formatPrice(metrics.priceUsd)}</p>
          </div>
          <div>
            <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Price</p>
            <p className="text-sm font-bold text-white">{metrics.priceXrp.toFixed(6)} XRP</p>
          </div>
          <div>
            <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Liquidity</p>
            <p className="text-sm font-bold text-white">{formatNumber(metrics.liquidity)}</p>
          </div>
          <div>
            <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">FDV</p>
            <p className="text-sm font-bold text-white">{formatNumber(metrics.fdv)}</p>
          </div>
          <div>
            <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Mkt Cap</p>
            <p className="text-sm font-bold text-white">{formatNumber(metrics.marketCap)}</p>
          </div>
        </div>

        {/* Time-based Changes */}
        <div className="grid grid-cols-4 gap-4 mb-3 pb-3 border-b border-white/[0.08]">
          <div>
            <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">5M</p>
            <p className={`text-sm font-bold ${getChangeColor(metrics.change5m)}`}>
              {formatChange(metrics.change5m)}
            </p>
          </div>
          <div>
            <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">1H</p>
            <p className={`text-sm font-bold ${getChangeColor(metrics.change1h)}`}>
              {formatChange(metrics.change1h)}
            </p>
          </div>
          <div>
            <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">6H</p>
            <p className={`text-sm font-bold ${getChangeColor(metrics.change6h)}`}>
              {formatChange(metrics.change6h)}
            </p>
          </div>
          <div className="bg-white/[0.03] -mx-1 px-1 rounded">
            <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">24H</p>
            <p className={`text-sm font-bold ${getChangeColor(metrics.change24h)}`}>
              {formatChange(metrics.change24h)}
            </p>
          </div>
        </div>

        {/* Trading Stats with Bars */}
        <div className="grid grid-cols-3 gap-6">
          {/* Transactions */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-[9px] text-gray-500 uppercase tracking-wider">Txns</p>
              <p className="text-sm font-bold text-white">{metrics.txns}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[9px] text-gray-500 uppercase tracking-wider">Buys</p>
              <p className="text-sm font-bold text-bear-green-400">{metrics.buys}</p>
            </div>
            <div className="h-1 bg-bear-dark-700 rounded-full overflow-hidden flex">
              <div
                className="h-full bg-bear-green-500"
                style={{ width: `${buyPercentage}%` }}
              />
              <div
                className="h-full bg-red-500"
                style={{ width: `${100 - buyPercentage}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[9px] text-gray-500 uppercase tracking-wider">Sells</p>
              <p className="text-sm font-bold text-red-400">{metrics.sells}</p>
            </div>
          </div>

          {/* Volume */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-[9px] text-gray-500 uppercase tracking-wider">Volume</p>
              <p className="text-sm font-bold text-white">{formatNumber(metrics.volume)}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[9px] text-gray-500 uppercase tracking-wider">Buy Vol</p>
              <p className="text-sm font-bold text-bear-green-400">{formatNumber(metrics.buyVolume)}</p>
            </div>
            <div className="h-1 bg-bear-dark-700 rounded-full overflow-hidden flex">
              <div
                className="h-full bg-bear-green-500"
                style={{ width: `${buyVolumePercentage}%` }}
              />
              <div
                className="h-full bg-red-500"
                style={{ width: `${100 - buyVolumePercentage}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[9px] text-gray-500 uppercase tracking-wider">Sell Vol</p>
              <p className="text-sm font-bold text-red-400">{formatNumber(metrics.sellVolume)}</p>
            </div>
          </div>

          {/* Makers */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-[9px] text-gray-500 uppercase tracking-wider">Makers</p>
              <p className="text-sm font-bold text-white">{metrics.makers}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[9px] text-gray-500 uppercase tracking-wider">Buyers</p>
              <p className="text-sm font-bold text-bear-green-400">{metrics.buyers}</p>
            </div>
            <div className="h-1 bg-bear-dark-700 rounded-full overflow-hidden flex">
              <div
                className="h-full bg-bear-green-500"
                style={{ width: `${buyersPercentage}%` }}
              />
              <div
                className="h-full bg-red-500"
                style={{ width: `${100 - buyersPercentage}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[9px] text-gray-500 uppercase tracking-wider">Sellers</p>
              <p className="text-sm font-bold text-red-400">{metrics.sellers}</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
