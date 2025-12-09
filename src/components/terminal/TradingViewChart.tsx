import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createChart, CandlestickSeries, LineSeries, AreaSeries, HistogramSeries } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, CandlestickData, Time, SeriesType } from 'lightweight-charts';
import { motion, AnimatePresence } from 'framer-motion';
import type { Token } from '../../types';

// Trade marker interface
export interface ChartTrade {
  type: 'buy' | 'sell';
  timestamp: Date;
  price: number;
  amount: number;
}

interface TradingViewChartProps {
  token: Token;
  trades?: ChartTrade[];
}

type TimeFrame = '1m' | '5m' | '15m' | '1h' | '4h' | '1D' | '1W';
type ChartType = 'candle' | 'line' | 'area';

const TIMEFRAMES: { label: string; value: TimeFrame }[] = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '1H', value: '1h' },
  { label: '4H', value: '4h' },
  { label: '1D', value: '1D' },
  { label: '1W', value: '1W' },
];

// Convert timeframe to milliseconds
const getTimeframeMs = (tf: TimeFrame): number => {
  switch (tf) {
    case '1m': return 60 * 1000;
    case '5m': return 5 * 60 * 1000;
    case '15m': return 15 * 60 * 1000;
    case '1h': return 60 * 60 * 1000;
    case '4h': return 4 * 60 * 60 * 1000;
    case '1D': return 24 * 60 * 60 * 1000;
    case '1W': return 7 * 24 * 60 * 60 * 1000;
    default: return 60 * 60 * 1000;
  }
};

// Generate OHLCV candles from trade data
const generateCandlesFromTrades = (
  trades: ChartTrade[],
  timeframeMs: number,
  candleCount: number = 50
): { candles: CandlestickData[]; volume: { time: Time; value: number; color: string }[] } => {
  if (!trades.length) return { candles: [], volume: [] };

  // Sort trades by time (oldest first)
  const sortedTrades = [...trades].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  const now = Date.now();
  const startTime = now - (candleCount * timeframeMs);

  const candleMap = new Map<number, {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    trades: number;
  }>();

  // Initialize empty candles for the time range
  for (let i = 0; i < candleCount; i++) {
    const candleTime = Math.floor((startTime + i * timeframeMs) / timeframeMs) * timeframeMs;
    candleMap.set(candleTime, {
      open: 0,
      high: 0,
      low: Infinity,
      close: 0,
      volume: 0,
      trades: 0,
    });
  }

  // Fill candles with trade data
  for (const trade of sortedTrades) {
    if (trade.price <= 0) continue;

    const tradeTime = trade.timestamp.getTime();
    const candleTime = Math.floor(tradeTime / timeframeMs) * timeframeMs;

    let candle = candleMap.get(candleTime);
    if (!candle) {
      candle = {
        open: trade.price,
        high: trade.price,
        low: trade.price,
        close: trade.price,
        volume: 0,
        trades: 0,
      };
      candleMap.set(candleTime, candle);
    }

    if (candle.trades === 0) {
      candle.open = trade.price;
    }
    candle.high = Math.max(candle.high, trade.price);
    candle.low = Math.min(candle.low, trade.price);
    candle.close = trade.price;
    candle.volume += trade.amount;
    candle.trades++;
  }

  // Convert to arrays and fill gaps
  const times = Array.from(candleMap.keys()).sort((a, b) => a - b);
  const candles: CandlestickData[] = [];
  const volume: { time: Time; value: number; color: string }[] = [];

  let lastPrice = sortedTrades[0]?.price || 0;

  for (const time of times) {
    const candle = candleMap.get(time)!;
    const timeSeconds = Math.floor(time / 1000) as Time;

    if (candle.trades === 0) {
      // No trades in this candle - use last known price
      if (lastPrice > 0) {
        candles.push({
          time: timeSeconds,
          open: lastPrice,
          high: lastPrice,
          low: lastPrice,
          close: lastPrice,
        });
        volume.push({
          time: timeSeconds,
          value: 0,
          color: 'rgba(107, 114, 128, 0.3)',
        });
      }
    } else {
      candles.push({
        time: timeSeconds,
        open: candle.open,
        high: candle.high,
        low: candle.low === Infinity ? candle.open : candle.low,
        close: candle.close,
      });
      volume.push({
        time: timeSeconds,
        value: candle.volume,
        color: candle.close >= candle.open
          ? 'rgba(7, 174, 8, 0.5)'
          : 'rgba(239, 68, 68, 0.5)',
      });
      lastPrice = candle.close;
    }
  }

  return { candles, volume };
};

export const TradingViewChart: React.FC<TradingViewChartProps> = ({ token, trades = [] }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<SeriesType> | null>(null);
  const lineSeriesRef = useRef<ISeriesApi<SeriesType> | null>(null);
  const areaSeriesRef = useRef<ISeriesApi<SeriesType> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<SeriesType> | null>(null);
  const initRef = useRef(false);

  const [timeframe, setTimeframe] = useState<TimeFrame>('1h');
  const [chartType, setChartType] = useState<ChartType>('candle');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [dataSource, setDataSource] = useState<'api' | 'trades' | 'none'>('none');
  const [hasData, setHasData] = useState(false);

  // Memoize candle data generated from trades
  const generatedCandles = useMemo(() => {
    if (trades.length < 2) return null;
    const timeframeMs = getTimeframeMs(timeframe);
    return generateCandlesFromTrades(trades, timeframeMs, 100);
  }, [trades, timeframe]);

  // Fetch OHLCV data from xMagnetic API
  const fetchFromXMagnetic = useCallback(async (): Promise<{
    candles: CandlestickData[];
    volume: { time: Time; value: number; color: string }[];
  } | null> => {
    if (!token.issuer) return null;

    try {
      // xMagnetic API endpoint format
      const baseToken = `${token.currency}+${token.issuer}`;
      const quoteToken = 'XRP+XRP';
      const interval = timeframe === '1D' ? '1d' : timeframe === '1W' ? '1w' : timeframe;

      // Use proxy in development to avoid CORS
      const baseUrl = import.meta.env.DEV
        ? '/api/xmagnetic'
        : 'https://api.xmagnetic.org/api/v1';

      const url = `${baseUrl}/ohlc?base=${encodeURIComponent(baseToken)}&quote=${encodeURIComponent(quoteToken)}&interval=${interval}&limit=100&network=mainnet`;

      console.log('[TradingViewChart] Fetching from xMagnetic:', url);

      const response = await fetch(url, {
        signal: AbortSignal.timeout(8000),
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`xMagnetic API returned ${response.status}`);
      }

      const data = await response.json();

      if (!data || !Array.isArray(data) || data.length === 0) {
        throw new Error('No data from xMagnetic');
      }

      // Check if we need to invert prices (for RLUSD and other USD-pegged tokens)
      const isUSDPegged = token.currency === 'RLUSD' || token.currency === 'USD';

      const candles: CandlestickData[] = data.map((c: any) => {
        const open = parseFloat(c.open) || 0;
        const high = parseFloat(c.high) || 0;
        const low = parseFloat(c.low) || 0;
        const close = parseFloat(c.close) || 0;

        // Invert prices for USD-pegged tokens (show TOKEN/XRP instead of XRP/TOKEN)
        if (isUSDPegged && open > 0) {
          return {
            time: (typeof c.time === 'number' ? c.time : Math.floor(new Date(c.time).getTime() / 1000)) as Time,
            open: 1 / open,
            high: 1 / low,  // Inverted: lowest becomes highest
            low: 1 / high,  // Inverted: highest becomes lowest
            close: 1 / close,
          };
        }

        return {
          time: (typeof c.time === 'number' ? c.time : Math.floor(new Date(c.time).getTime() / 1000)) as Time,
          open,
          high,
          low,
          close,
        };
      }).filter((c: CandlestickData) => c.open > 0);

      const volume = data.map((c: any) => ({
        time: (typeof c.time === 'number' ? c.time : Math.floor(new Date(c.time).getTime() / 1000)) as Time,
        value: parseFloat(c.volume) || 0,
        color: parseFloat(c.close) >= parseFloat(c.open)
          ? 'rgba(7, 174, 8, 0.5)'
          : 'rgba(239, 68, 68, 0.5)',
      }));

      console.log(`[TradingViewChart] ✅ xMagnetic: ${candles.length} candles`);
      return { candles, volume };
    } catch (err) {
      console.warn('[TradingViewChart] xMagnetic failed:', err);
      return null;
    }
  }, [token.currency, token.issuer, timeframe]);

  // Fetch from xrpl.to as backup
  const fetchFromXrplTo = useCallback(async (): Promise<{
    candles: CandlestickData[];
    volume: { time: Time; value: number; color: string }[];
  } | null> => {
    if (!token.issuer) return null;

    try {
      const interval = timeframe === '1D' ? '1d' : timeframe === '1W' ? '1w' : timeframe;
      const baseUrl = import.meta.env.DEV ? '/api/xrplto' : 'https://api.xrpl.to/api';
      const url = `${baseUrl}/charts/${token.currency}:${token.issuer}?interval=${interval}&limit=100`;

      console.log('[TradingViewChart] Fetching from xrpl.to:', url);

      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });

      if (!response.ok) {
        throw new Error(`xrpl.to API returned ${response.status}`);
      }

      const data = await response.json();

      if (!data?.data || !Array.isArray(data.data) || data.data.length === 0) {
        throw new Error('No data from xrpl.to');
      }

      // Check if we need to invert prices (for RLUSD and other USD-pegged tokens)
      const isUSDPegged = token.currency === 'RLUSD' || token.currency === 'USD';

      const candles: CandlestickData[] = data.data.map((c: any) => {
        const open = parseFloat(c.open) || 0;
        const high = parseFloat(c.high) || 0;
        const low = parseFloat(c.low) || 0;
        const close = parseFloat(c.close) || 0;

        // Invert prices for USD-pegged tokens (show TOKEN/XRP instead of XRP/TOKEN)
        if (isUSDPegged && open > 0) {
          return {
            time: Math.floor(c.time / 1000) as Time,
            open: 1 / open,
            high: 1 / low,  // Inverted: lowest becomes highest
            low: 1 / high,  // Inverted: highest becomes lowest
            close: 1 / close,
          };
        }

        return {
          time: Math.floor(c.time / 1000) as Time,
          open,
          high,
          low,
          close,
        };
      }).filter((c: CandlestickData) => c.open > 0);

      const volume = data.data.map((c: any) => ({
        time: Math.floor(c.time / 1000) as Time,
        value: parseFloat(c.volume) || 0,
        color: parseFloat(c.close) >= parseFloat(c.open)
          ? 'rgba(7, 174, 8, 0.5)'
          : 'rgba(239, 68, 68, 0.5)',
      }));

      console.log(`[TradingViewChart] ✅ xrpl.to: ${candles.length} candles`);
      return { candles, volume };
    } catch (err) {
      console.warn('[TradingViewChart] xrpl.to failed:', err);
      return null;
    }
  }, [token.currency, token.issuer, timeframe]);

  // Helper to update chart with candle data
  const updateChartData = useCallback((
    candles: CandlestickData[],
    volume: { time: Time; value: number; color: string }[]
  ) => {
    if (candleSeriesRef.current) {
      candleSeriesRef.current.setData(candles);
    }
    if (lineSeriesRef.current) {
      lineSeriesRef.current.setData(candles.map(c => ({ time: c.time, value: c.close })));
    }
    if (areaSeriesRef.current) {
      areaSeriesRef.current.setData(candles.map(c => ({ time: c.time, value: c.close })));
    }
    if (volumeSeriesRef.current) {
      volumeSeriesRef.current.setData(volume);
    }

    // Update price info
    const lastCandle = candles[candles.length - 1];
    const firstCandle = candles[0];
    if (lastCandle && firstCandle) {
      setLastPrice(lastCandle.close);
      const change = firstCandle.open > 0
        ? ((lastCandle.close - firstCandle.open) / firstCandle.open) * 100
        : 0;
      setPriceChange(change);
    }

    // Mark that we have data now
    setHasData(true);

    // Fit content
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, []);

  // Main data fetch function
  const fetchChartData = useCallback(async () => {
    if (token.currency === 'XRP' || !token.issuer) return;

    setIsLoading(true);
    setError(null);

    try {
      // Try xMagnetic API first
      let result = await fetchFromXMagnetic();

      if (result && result.candles.length > 0) {
        setDataSource('api');
        updateChartData(result.candles, result.volume);
        setIsLoading(false);
        return;
      }

      // Fallback 1: Try xrpl.to
      result = await fetchFromXrplTo();

      if (result && result.candles.length > 0) {
        setDataSource('api');
        updateChartData(result.candles, result.volume);
        setIsLoading(false);
        return;
      }

      // Fallback 2: Generate candles from trade history
      if (generatedCandles && generatedCandles.candles.length > 0) {
        console.log(`[TradingViewChart] Using generated candles from ${trades.length} trades`);
        setDataSource('trades');
        updateChartData(generatedCandles.candles, generatedCandles.volume);
        setIsLoading(false);
        return;
      }

      // No data available - show placeholder
      setDataSource('none');
      setError('Waiting for trade data...');

    } catch (err) {
      console.error('[TradingViewChart] Error:', err);
      setError('Failed to load chart');
    } finally {
      setIsLoading(false);
    }
  }, [token.currency, token.issuer, fetchFromXMagnetic, fetchFromXrplTo, updateChartData, generatedCandles, trades.length]);

  // Initialize chart once
  useEffect(() => {
    if (!chartContainerRef.current || initRef.current) return;
    initRef.current = true;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#0A0A0F' }, // Deep BEAR void
        textColor: '#D1D5DB', // Brighter text for readability
      },
      grid: {
        vertLines: { color: 'rgba(237, 183, 35, 0.05)' }, // Subtle BEAR gold grid
        horzLines: { color: 'rgba(237, 183, 35, 0.05)' },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: '#edb723', // BEAR gold crosshair
          width: 1,
          style: 2,
          labelBackgroundColor: '#edb723',
        },
        horzLine: {
          color: '#edb723',
          width: 1,
          style: 2,
          labelBackgroundColor: '#edb723',
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(237, 183, 35, 0.2)', // BEAR gold border
        scaleMargins: {
          top: 0.1,
          bottom: 0.2,
        },
      },
      timeScale: {
        borderColor: 'rgba(237, 183, 35, 0.2)', // BEAR gold border
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: {
        vertTouchDrag: false,
      },
    });

    chartRef.current = chart;

    // Add candlestick series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#07ae08',
      downColor: '#ef4444',
      borderUpColor: '#07ae08',
      borderDownColor: '#ef4444',
      wickUpColor: '#07ae08',
      wickDownColor: '#ef4444',
    });
    candleSeriesRef.current = candleSeries;

    // Add line series (hidden by default) - BEAR GOLD theme
    const lineSeries = chart.addSeries(LineSeries, {
      color: '#edb723', // BEAR gold
      lineWidth: 2,
      visible: false,
    });
    lineSeriesRef.current = lineSeries;

    // Add area series (hidden by default) - BEAR GOLD theme
    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: '#edb723', // BEAR gold
      topColor: 'rgba(237, 183, 35, 0.3)', // Transparent BEAR gold
      bottomColor: 'rgba(237, 183, 35, 0.0)',
      lineWidth: 2,
      visible: false,
    });
    areaSeriesRef.current = areaSeries;

    // Add volume histogram - BEAR themed
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: 'rgba(237, 183, 35, 0.4)', // Semi-transparent BEAR gold
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });
    volumeSeriesRef.current = volumeSeries;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      initRef.current = false;
    };
  }, []);

  // Update chart type visibility
  useEffect(() => {
    if (candleSeriesRef.current) {
      candleSeriesRef.current.applyOptions({ visible: chartType === 'candle' });
    }
    if (lineSeriesRef.current) {
      lineSeriesRef.current.applyOptions({ visible: chartType === 'line' });
    }
    if (areaSeriesRef.current) {
      areaSeriesRef.current.applyOptions({ visible: chartType === 'area' });
    }
  }, [chartType]);

  // Fetch data when token or timeframe changes
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchChartData();
    }, 100);
    return () => clearTimeout(timer);
  }, [fetchChartData]);

  // Re-fetch when trades update (for fallback mode)
  useEffect(() => {
    if (dataSource === 'trades' || (dataSource === 'none' && trades.length > 5)) {
      fetchChartData();
    }
  }, [trades.length, dataSource, fetchChartData]);

  // Render trade markers
  useEffect(() => {
    if (!trades.length || !candleSeriesRef.current) return;

    const markers = trades
      .filter(trade => trade.timestamp && trade.price > 0)
      .slice(0, 50) // Limit markers
      .map(trade => ({
        time: (Math.floor(trade.timestamp.getTime() / 1000)) as Time,
        position: (trade.type === 'buy' ? 'belowBar' : 'aboveBar') as 'belowBar' | 'aboveBar',
        color: trade.type === 'buy' ? '#07ae08' : '#ef4444',
        shape: (trade.type === 'buy' ? 'arrowUp' : 'arrowDown') as 'arrowUp' | 'arrowDown',
        text: trade.type === 'buy' ? 'B' : 'S',
        size: 1,
      }))
      .sort((a, b) => (a.time as number) - (b.time as number));

    if (markers.length > 0) {
      try {
        (candleSeriesRef.current as any).setMarkers(markers);
      } catch (e) {
        // Markers not supported or error
      }
    }
  }, [trades]);

  return (
    <div className="relative h-full rounded-xl overflow-hidden bg-bear-dark-900 shadow-2xl">
      {/* TRICOLOR BORDER - Matching wallet/main screen */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-bear-gold via-bear-purple-500 to-bear-gold p-[2px]">
        <div className="w-full h-full rounded-xl bg-bear-dark-900" />
      </div>

      {/* Subtle animated grid overlay */}
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: 'linear-gradient(rgba(237, 183, 35, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(237, 183, 35, 0.3) 1px, transparent 1px)',
        backgroundSize: '40px 40px'
      }} />

      {/* Chart Header - GODMODE (Inside Chart) */}
      <div className="absolute top-3 left-3 right-3 z-50">
        {/* Premium glassmorphic header bar */}
        <div className="relative rounded-xl bg-black/20 backdrop-blur-md border border-white/10">
          <div className="flex items-center justify-between gap-4 px-4 py-2.5">

            {/* Timeframe Selector - Ultra Premium */}
            <div className="flex items-center gap-1.5 px-3 py-2 bg-black/30 rounded-xl border border-white/5 backdrop-blur-md shadow-inner">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf.value}
                  onClick={() => setTimeframe(tf.value)}
                  className={`relative px-4 py-2 text-xs font-black rounded-lg transition-all duration-300 ${
                    timeframe === tf.value
                      ? 'text-black'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {timeframe === tf.value && (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-r from-bear-gold via-yellow-400 to-bear-gold rounded-lg shadow-lg shadow-bear-gold/60" />
                      <div className="absolute inset-0 bg-gradient-to-t from-yellow-600/50 to-transparent rounded-lg" />
                    </>
                  )}
                  <span className="relative z-10">{tf.label}</span>
                </button>
              ))}
            </div>

            {/* Chart Type - Luxury Icons */}
            <div className="flex items-center gap-2 px-3 py-2 bg-black/30 rounded-xl border border-white/5 backdrop-blur-md shadow-inner">
              {[
                { type: 'candle', icon: (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="3" y="8" width="4" height="8" rx="1" />
                    <rect x="10" y="4" width="4" height="16" rx="1" />
                    <rect x="17" y="6" width="4" height="12" rx="1" />
                  </svg>
                ), label: 'Candles' },
                { type: 'line', icon: (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M3 17l6-6 4 4 8-8" />
                  </svg>
                ), label: 'Line' },
                { type: 'area', icon: (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" opacity="0.8">
                    <path d="M3 17l6-6 4 4 8-8v11H3z" />
                  </svg>
                ), label: 'Area' }
              ].map(({ type, icon, label }) => (
                <button
                  key={type}
                  onClick={() => setChartType(type as ChartType)}
                  className={`relative p-2.5 rounded-lg transition-all duration-300 group ${
                    chartType === type ? 'scale-110' : 'hover:scale-105'
                  }`}
                  title={label}
                >
                  {chartType === type && (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-r from-bear-gold via-yellow-400 to-bear-gold rounded-lg shadow-lg shadow-bear-gold/60" />
                      <div className="absolute inset-0 bg-gradient-to-t from-yellow-600/50 to-transparent rounded-lg" />
                    </>
                  )}
                  <div className={chartType === type ? 'relative z-10 text-black' : 'text-gray-400 group-hover:text-bear-gold transition-colors'}>
                    {icon}
                  </div>
                </button>
              ))}
            </div>

            {/* Price Display - Premium Stats */}
            <div className="flex items-center gap-4 px-5 py-3 bg-gradient-to-br from-black/50 via-black/30 to-transparent rounded-xl border border-bear-gold/30 backdrop-blur-md shadow-xl shadow-bear-gold/10">
              {lastPrice ? (
                <>
                  <div className="flex flex-col items-start">
                    <span className="text-[10px] text-gray-500 font-bold tracking-widest uppercase mb-0.5">Price</span>
                    <span className="text-base font-mono font-black text-bear-gold drop-shadow-[0_0_10px_rgba(237,183,35,0.4)]">
                      ${lastPrice.toFixed(lastPrice >= 1 ? 4 : 8)}
                    </span>
                  </div>
                  <div className="w-px h-10 bg-gradient-to-b from-transparent via-bear-gold/30 to-transparent" />
                  <div className="flex flex-col items-start">
                    <span className="text-[10px] text-gray-500 font-bold tracking-widest uppercase mb-0.5">24h Change</span>
                    <div className={`flex items-center gap-1.5 ${
                      priceChange >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      <span className="text-lg font-bold">{priceChange >= 0 ? '↗' : '↘'}</span>
                      <span className="text-sm font-black font-mono">
                        {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                  {dataSource === 'trades' && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-yellow-500/20 to-yellow-600/10 rounded-lg border border-yellow-500/40 shadow-lg shadow-yellow-500/20">
                      <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse shadow-lg shadow-yellow-400/50" />
                      <span className="text-xs text-yellow-300 font-bold tracking-wide">LIVE</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-bear-gold rounded-full animate-pulse" />
                  <span className="text-xs text-gray-500 font-medium">Loading...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Chart Container - Hidden until data loads to prevent weird default scaling */}
      <div
        ref={chartContainerRef}
        className={`w-full h-full transition-opacity duration-500 ${hasData ? 'opacity-100' : 'opacity-0'}`}
        style={{ visibility: hasData ? 'visible' : 'hidden' }}
      />

      {/* Loading Overlay - GODMODE */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 flex items-center justify-center bg-[#0A0A0F]/95 backdrop-blur-2xl z-[100]"
          >
            {/* Radial glow effect */}
            <div className="absolute inset-0 bg-gradient-radial from-bear-gold/10 via-transparent to-transparent opacity-50" />

            <div className="relative flex flex-col items-center gap-6">
              {/* Premium spinner with multiple layers */}
              <div className="relative">
                {/* Outer rotating ring */}
                <div className="w-24 h-24 border-2 border-bear-gold/10 rounded-full animate-spin" style={{ animationDuration: '3s' }} />

                {/* Middle rotating ring */}
                <div className="absolute inset-2 border-2 border-t-bear-gold border-r-bear-gold/50 border-b-transparent border-l-transparent rounded-full animate-spin" style={{ animationDuration: '1.5s' }} />

                {/* Inner glow */}
                <div className="absolute inset-4 bg-gradient-to-br from-bear-gold/20 to-yellow-600/20 rounded-full blur-xl animate-pulse" />

                {/* Center icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-4xl animate-pulse drop-shadow-[0_0_20px_rgba(237,183,35,0.6)]">🐻</span>
                </div>
              </div>

              {/* Loading text with gradient */}
              <div className="flex flex-col items-center gap-2">
                <h3 className="text-xl font-black tracking-wider bg-gradient-to-r from-bear-gold via-yellow-400 to-bear-gold bg-clip-text text-transparent animate-pulse">
                  LOADING CHART
                </h3>
                <p className="text-xs text-gray-500 font-mono tracking-wide">Fetching XRPL market data...</p>
              </div>

              {/* Animated progress bar */}
              <div className="w-48 h-1.5 bg-black/50 rounded-full overflow-hidden border border-bear-gold/20">
                <motion.div
                  className="h-full bg-gradient-to-r from-bear-gold via-yellow-400 to-bear-gold shadow-lg shadow-bear-gold/50"
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                />
              </div>

              {/* Animated particles */}
              <div className="absolute inset-0 pointer-events-none">
                {[...Array(6)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-1 h-1 bg-bear-gold/40 rounded-full"
                    style={{
                      left: `${20 + i * 15}%`,
                      top: `${30 + (i % 2) * 40}%`
                    }}
                    animate={{
                      y: [0, -20, 0],
                      opacity: [0.2, 0.6, 0.2],
                      scale: [1, 1.5, 1]
                    }}
                    transition={{
                      repeat: Infinity,
                      duration: 2,
                      delay: i * 0.2
                    }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error/Waiting Overlay - GODMODE */}
      <AnimatePresence>
        {error && !isLoading && !hasData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-[#0A0A0F] z-[100]"
          >
            {/* Premium background effects */}
            <div className="absolute inset-0 bg-gradient-radial from-bear-gold/5 via-transparent to-transparent" />
            <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-bear-gold/5 rounded-full blur-[120px] animate-pulse" />

            <div className="relative flex flex-col items-center gap-6 text-center px-6 max-w-lg">
              {/* Premium icon with glow */}
              <div className="relative">
                {/* Rotating border */}
                <div className="w-20 h-20 border-2 border-t-bear-gold border-r-bear-gold/50 border-b-bear-gold/20 border-l-transparent rounded-full animate-spin" style={{ animationDuration: '3s' }} />

                {/* Glow effect */}
                <div className="absolute inset-2 bg-gradient-to-br from-bear-gold/20 to-transparent rounded-full blur-xl" />

                {/* Center icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-5xl drop-shadow-[0_0_30px_rgba(237,183,35,0.4)]">🐻</span>
                </div>
              </div>

              {/* Message card */}
              <div className="relative p-6 rounded-2xl bg-gradient-to-br from-black/40 to-black/20 backdrop-blur-xl border border-bear-gold/20 shadow-2xl shadow-bear-gold/10">
                <div className="absolute -top-px left-0 right-0 h-px bg-gradient-to-r from-transparent via-bear-gold/50 to-transparent" />

                <div className="flex flex-col gap-4">
                  <h3 className="text-lg font-black text-bear-gold tracking-wide">{error}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    The chart will automatically update when new trades occur
                  </p>

                  {/* CTA Card */}
                  <div className="mt-2 p-4 rounded-xl bg-gradient-to-br from-bear-gold/15 to-bear-gold/5 border border-bear-gold/30">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-bear-gold to-yellow-600 flex items-center justify-center shadow-lg shadow-bear-gold/30">
                        <span className="text-xl">🎯</span>
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-xs font-bold text-white">Ready to trade?</p>
                        <p className="text-[10px] text-gray-400">Execute a trade to populate the chart</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Animated waiting indicator */}
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-2 h-2 bg-bear-gold rounded-full shadow-lg shadow-bear-gold/50"
                      animate={{
                        scale: [1, 1.3, 1],
                        opacity: [0.4, 1, 0.4]
                      }}
                      transition={{
                        repeat: Infinity,
                        duration: 1.5,
                        delay: i * 0.2
                      }}
                    />
                  ))}
                </div>
                <span className="text-xs text-gray-600 font-mono">Waiting for data</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Premium BEAR Watermark - Elegant */}
      <div className="absolute bottom-6 right-6 opacity-15 pointer-events-none z-10 group-hover:opacity-25 transition-opacity">
        <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-gradient-to-br from-bear-gold/10 to-transparent border border-bear-gold/20">
          <span className="text-3xl drop-shadow-[0_0_10px_rgba(237,183,35,0.3)]">🐻</span>
          <div className="flex flex-col">
            <span className="text-base font-luckiest text-gradient-bear leading-none tracking-wider drop-shadow-[0_0_8px_rgba(237,183,35,0.2)]">BEAR</span>
            <span className="text-[10px] text-gray-500 font-mono leading-none tracking-widest mt-1">TERMINAL v1.0</span>
          </div>
        </div>
      </div>

      {/* Subtle corner accents - Premium glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-bear-gold/5 via-bear-gold/2 to-transparent pointer-events-none blur-2xl" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-bear-gold/5 via-bear-gold/2 to-transparent pointer-events-none blur-2xl" />

      {/* Bottom accent line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-bear-gold/20 to-transparent pointer-events-none" />
    </div>
  );
};
