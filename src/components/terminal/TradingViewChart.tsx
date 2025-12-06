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

      const candles: CandlestickData[] = data.map((c: any) => ({
        time: (typeof c.time === 'number' ? c.time : Math.floor(new Date(c.time).getTime() / 1000)) as Time,
        open: parseFloat(c.open) || 0,
        high: parseFloat(c.high) || 0,
        low: parseFloat(c.low) || 0,
        close: parseFloat(c.close) || 0,
      })).filter((c: CandlestickData) => c.open > 0);

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

      const candles: CandlestickData[] = data.data.map((c: any) => ({
        time: Math.floor(c.time / 1000) as Time,
        open: parseFloat(c.open) || 0,
        high: parseFloat(c.high) || 0,
        low: parseFloat(c.low) || 0,
        close: parseFloat(c.close) || 0,
      })).filter((c: CandlestickData) => c.open > 0);

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
        background: { color: '#0A0A0F' },
        textColor: '#9CA3AF',
      },
      grid: {
        vertLines: { color: '#1A1A2E' },
        horzLines: { color: '#1A1A2E' },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: '#edb723',
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
        borderColor: '#1A1A2E',
        scaleMargins: {
          top: 0.1,
          bottom: 0.2,
        },
      },
      timeScale: {
        borderColor: '#1A1A2E',
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

    // Add line series (hidden by default)
    const lineSeries = chart.addSeries(LineSeries, {
      color: '#8B5CF6',
      lineWidth: 2,
      visible: false,
    });
    lineSeriesRef.current = lineSeries;

    // Add area series (hidden by default)
    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: '#8B5CF6',
      topColor: 'rgba(139, 92, 246, 0.4)',
      bottomColor: 'rgba(139, 92, 246, 0.0)',
      lineWidth: 2,
      visible: false,
    });
    areaSeriesRef.current = areaSeries;

    // Add volume histogram
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: 'rgba(139, 92, 246, 0.5)',
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
    <div className="relative h-full rounded-xl overflow-hidden bg-bear-dark-800 border border-bear-dark-700">
      {/* Chart Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-3 py-2 bg-bear-dark-800/90 backdrop-blur-sm border-b border-bear-dark-700">
        {/* Timeframe Selector */}
        <div className="flex items-center gap-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setTimeframe(tf.value)}
              className={`px-2 py-1 text-xs font-semibold rounded transition-all ${
                timeframe === tf.value
                  ? 'bg-bear-purple-500 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-bear-dark-700'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>

        {/* Chart Type */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setChartType('candle')}
            className={`p-1.5 rounded ${chartType === 'candle' ? 'bg-bear-purple-500' : 'hover:bg-bear-dark-700'}`}
            title="Candlestick"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <rect x="3" y="8" width="4" height="8" rx="1" />
              <rect x="10" y="4" width="4" height="16" rx="1" />
              <rect x="17" y="6" width="4" height="12" rx="1" />
            </svg>
          </button>
          <button
            onClick={() => setChartType('line')}
            className={`p-1.5 rounded ${chartType === 'line' ? 'bg-bear-purple-500' : 'hover:bg-bear-dark-700'}`}
            title="Line"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 17l6-6 4 4 8-8" />
            </svg>
          </button>
          <button
            onClick={() => setChartType('area')}
            className={`p-1.5 rounded ${chartType === 'area' ? 'bg-bear-purple-500' : 'hover:bg-bear-dark-700'}`}
            title="Area"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" opacity="0.5">
              <path d="M3 17l6-6 4 4 8-8v11H3z" />
            </svg>
          </button>
        </div>

        {/* Price Info */}
        <div className="flex items-center gap-3">
          {lastPrice && (
            <>
              <span className="text-white font-mono font-bold">
                {lastPrice.toFixed(lastPrice >= 1 ? 4 : 8)}
              </span>
              <span className={`text-sm font-mono ${priceChange >= 0 ? 'text-bear-green-400' : 'text-red-400'}`}>
                {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
              </span>
            </>
          )}
          {dataSource === 'trades' && (
            <span className="text-xs text-yellow-500" title="Generated from trade history">
              📊
            </span>
          )}
        </div>
      </div>

      {/* Chart Container - Hidden until data loads to prevent weird default scaling */}
      <div
        ref={chartContainerRef}
        className={`w-full h-full pt-10 transition-opacity duration-300 ${hasData ? 'opacity-100' : 'opacity-0'}`}
        style={{ visibility: hasData ? 'visible' : 'hidden' }}
      />

      {/* Loading Overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-bear-dark-900/80 backdrop-blur-sm"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-bear-purple-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-400 text-sm">Loading chart...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error/Info Overlay - Fully covers chart when no data */}
      <AnimatePresence>
        {error && !isLoading && !hasData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-bear-dark-800"
          >
            <div className="flex flex-col items-center gap-3 text-center px-4">
              <div className="w-12 h-12 border-4 border-bear-purple-500/30 border-t-bear-purple-500 rounded-full animate-spin" />
              <p className="text-gray-400 text-sm">{error}</p>
              <p className="text-gray-500 text-xs">Chart will update as trades come in</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Watermark */}
      <div className="absolute bottom-12 left-3 opacity-30 pointer-events-none">
        <span className="text-xs font-luckiest text-gradient-bear">BEAR TERMINAL</span>
      </div>
    </div>
  );
};
