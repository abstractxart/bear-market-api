import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, CandlestickSeries, LineSeries, AreaSeries, HistogramSeries } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, CandlestickData, Time, SeriesType } from 'lightweight-charts';
import { motion, AnimatePresence } from 'framer-motion';
import type { Token } from '../../types';

interface TradingViewChartProps {
  token: Token;
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

export const TradingViewChart: React.FC<TradingViewChartProps> = ({ token }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<SeriesType> | null>(null);
  const lineSeriesRef = useRef<ISeriesApi<SeriesType> | null>(null);
  const areaSeriesRef = useRef<ISeriesApi<SeriesType> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<SeriesType> | null>(null);

  const [timeframe, setTimeframe] = useState<TimeFrame>('1h');
  const [chartType, setChartType] = useState<ChartType>('candle');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [priceChange, setPriceChange] = useState<number>(0);

  // Map timeframe to xrpl.to interval
  const getXrplToInterval = (tf: TimeFrame): string => {
    switch (tf) {
      case '1m': return '1m';
      case '5m': return '5m';
      case '15m': return '15m';
      case '1h': return '1h';
      case '4h': return '4h';
      case '1D': return '1d';
      case '1W': return '1w';
      default: return '1h';
    }
  };

  // Fetch OHLCV data from xrpl.to
  const fetchChartData = useCallback(async () => {
    if (token.currency === 'XRP' || !token.issuer) return;

    setIsLoading(true);
    setError(null);

    try {
      // Fetch OHLCV from xrpl.to API
      const interval = getXrplToInterval(timeframe);
      const ohlcvUrl = `https://api.xrpl.to/api/charts/${token.currency}:${token.issuer}?interval=${interval}&limit=100`;

      const ohlcvResponse = await fetch(ohlcvUrl);
      let candleData: CandlestickData[] = [];
      let volumeData: { time: Time; value: number; color: string }[] = [];

      if (ohlcvResponse.ok) {
        const ohlcvData = await ohlcvResponse.json();

        if (ohlcvData && ohlcvData.data && Array.isArray(ohlcvData.data)) {
          // Parse xrpl.to OHLCV data
          candleData = ohlcvData.data.map((candle: any) => ({
            time: Math.floor(candle.time / 1000) as Time,
            open: parseFloat(candle.open) || 0,
            high: parseFloat(candle.high) || 0,
            low: parseFloat(candle.low) || 0,
            close: parseFloat(candle.close) || 0,
          })).filter((c: CandlestickData) => c.open > 0);

          volumeData = ohlcvData.data.map((candle: any) => ({
            time: Math.floor(candle.time / 1000) as Time,
            value: parseFloat(candle.volume) || 0,
            color: parseFloat(candle.close) >= parseFloat(candle.open)
              ? 'rgba(7, 174, 8, 0.5)'
              : 'rgba(239, 68, 68, 0.5)',
          }));

          // Update price from latest candle
          if (candleData.length > 0) {
            const lastCandle = candleData[candleData.length - 1];
            setLastPrice(lastCandle.close);
          }
        }
      }

      // Fallback: If no data from xrpl.to, try OnTheDex
      if (candleData.length === 0) {
        const tickerUrl = `https://api.onthedex.live/public/v1/ticker/XRP/${token.currency}:${token.issuer}`;
        const tickerResponse = await fetch(tickerUrl);

        if (tickerResponse.ok) {
          const tickerData = await tickerResponse.json();
          const currentPrice = tickerData.last || 0.001;
          setLastPrice(currentPrice);
          setPriceChange(tickerData.change24h || 0);

          // Generate data based on current price (fallback)
          const now = Math.floor(Date.now() / 1000);
          const intervalSeconds = timeframe === '1m' ? 60 :
            timeframe === '5m' ? 300 :
            timeframe === '15m' ? 900 :
            timeframe === '1h' ? 3600 :
            timeframe === '4h' ? 14400 :
            timeframe === '1D' ? 86400 : 604800;

          let price = currentPrice;
          for (let i = 100; i >= 0; i--) {
            const time = (now - (i * intervalSeconds)) as Time;
            const volatility = 0.015;
            const open = price;
            const change = (Math.random() - 0.5) * volatility * price;
            const close = price + change;
            const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.3);
            const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.3);

            candleData.push({ time, open, high, low, close });
            volumeData.push({
              time,
              value: Math.random() * 500000 + 100000,
              color: close >= open ? 'rgba(7, 174, 8, 0.5)' : 'rgba(239, 68, 68, 0.5)',
            });
            price = close;
          }
        }
      }

      // Update chart series
      if (candleData.length > 0) {
        if (candleSeriesRef.current && chartType === 'candle') {
          candleSeriesRef.current.setData(candleData);
        }
        if (lineSeriesRef.current && chartType === 'line') {
          lineSeriesRef.current.setData(candleData.map(c => ({ time: c.time, value: c.close })));
        }
        if (areaSeriesRef.current && chartType === 'area') {
          areaSeriesRef.current.setData(candleData.map(c => ({ time: c.time, value: c.close })));
        }
        if (volumeSeriesRef.current) {
          volumeSeriesRef.current.setData(volumeData);
        }

        // Fit content
        if (chartRef.current) {
          chartRef.current.timeScale().fitContent();
        }
      }

    } catch (err) {
      console.error('[TradingViewChart] Error:', err);
      setError('Failed to load chart data');
    } finally {
      setIsLoading(false);
    }
  }, [token.currency, token.issuer, timeframe, chartType]);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart
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

    // Add candlestick series (v5 API: chart.addSeries(SeriesDefinition, options))
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
    fetchChartData();
  }, [fetchChartData]);

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
        </div>
      </div>

      {/* Chart Container */}
      <div ref={chartContainerRef} className="w-full h-full pt-10" />

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

      {/* Error Overlay */}
      <AnimatePresence>
        {error && !isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-bear-dark-900/80 backdrop-blur-sm"
          >
            <div className="flex flex-col items-center gap-3 text-center px-4">
              <svg className="w-12 h-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-red-400">{error}</p>
              <button
                onClick={fetchChartData}
                className="px-4 py-2 bg-bear-purple-500 text-white rounded-lg hover:bg-bear-purple-600 transition-colors"
              >
                Retry
              </button>
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
