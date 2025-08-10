import { useEffect, useRef } from 'react';
import { createChart, type ISeriesApi, LineStyle, type Time } from 'lightweight-charts';
import type { Candle } from './market';

type Props = {
  candles: Candle[];
  forecast?: { t: number; price: number }[];
  levels?: { entry?: number; stop?: number; tp1?: number; tp2?: number };
  fibLevels?: Record<string, number>;
  keyLevels?: number[];
  onSavePng?: (dataUrl: string) => void;
};

export default function ChartPanel({ candles, forecast, levels, fibLevels, keyLevels, onSavePng }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const lineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 380,
      layout: { textColor: '#333', background: { color: '#fff' } },
      grid: { horzLines: { color: '#eee' }, vertLines: { color: '#eee' } },
      rightPriceScale: { borderColor: '#cccccc' },
      timeScale: { borderColor: '#cccccc' },
    });
    const candleSeries = (chart as any).addCandlestickSeries();
    const lineSeries = (chart as any).addLineSeries({ color: '#0077ff', lineWidth: 2 });
    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    lineSeriesRef.current = lineSeries;
    const handleResize = () => {
      if (!containerRef.current) return;
      chart.applyOptions({ width: containerRef.current.clientWidth });
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      lineSeriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    if (!candleSeries) return;
    candleSeries.setData(
      candles.map((c) => ({ time: (c.time / 1000) as Time, open: c.open, high: c.high, low: c.low, close: c.close }))
    );
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  useEffect(() => {
    const lineSeries = lineSeriesRef.current;
    if (!lineSeries) return;
    if (!forecast || forecast.length === 0) {
      lineSeries.setData([]);
      return;
    }
    lineSeries.setData(forecast.map((p) => ({ time: (p.t / 1000) as Time, value: p.price })));
  }, [forecast]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    // clean previous lines by replacing the price scale markers via series markers
    const candleSeries = candleSeriesRef.current!;
    const priceLines: { price: number; color: string; title: string }[] = [];
    if (levels?.entry) priceLines.push({ price: levels.entry, color: '#0077ff', title: 'Entry' });
    if (levels?.stop) priceLines.push({ price: levels.stop, color: '#ff3b30', title: 'Stop' });
    if (levels?.tp1) priceLines.push({ price: levels.tp1, color: '#34c759', title: 'TP1' });
    if (levels?.tp2) priceLines.push({ price: levels.tp2, color: '#34c759', title: 'TP2' });
    if (fibLevels) {
      Object.entries(fibLevels).forEach(([k, v]) => priceLines.push({ price: v, color: '#a78bfa', title: `Fib ${k}` }));
    }
    if (keyLevels) {
      keyLevels.forEach((v, i) => priceLines.push({ price: v, color: '#f59e0b', title: `Key ${i + 1}` }));
    }
    // apply to series as horizontal lines
    candleSeries.createPriceLine({ price: candles[candles.length - 1]?.close ?? 0, color: '#999', lineStyle: LineStyle.Dotted, lineWidth: 1, title: 'Last' });
    priceLines.forEach((pl) => {
      candleSeries.createPriceLine({ price: pl.price, color: pl.color, title: pl.title, lineStyle: LineStyle.Solid, lineWidth: 1 });
    });
  }, [levels, fibLevels, keyLevels, candles]);

  const takePng = async () => {
    try {
      const c = containerRef.current?.querySelector('canvas');
      if (c) onSavePng?.(c.toDataURL('image/png'));
    } catch (e) {
      // ignore
    }
  };

  return (
    <div>
      <div ref={containerRef} />
      {onSavePng && (
        <div style={{ marginTop: 8 }}>
          <button onClick={takePng}>Save PNG</button>
        </div>
      )}
    </div>
  );
}


