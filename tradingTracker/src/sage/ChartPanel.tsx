import { useEffect, useRef, useState } from 'react';
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
  const chartRef = useRef<any | null>(null);
  const candleSeriesRef = useRef<any | null>(null);
  const lineSeriesRef = useRef<any | null>(null);
  const lwcRef = useRef<any | null>(null);
  const [ready, setReady] = useState(false);
  const priceLinesRef = useRef<any[]>([]);

  useEffect(() => {
    let disposed = false;
    (async () => {
      if (!containerRef.current) return;
      const LWC = await import('lightweight-charts');
      lwcRef.current = LWC;
      if (disposed) return;
      const chart = LWC.createChart(containerRef.current, {
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
        if (!containerRef.current || !chartRef.current) return;
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      };
      window.addEventListener('resize', handleResize);
      (chart as any)._disposeHandler = () => window.removeEventListener('resize', handleResize);
      setReady(true);
    })();
    return () => {
      disposed = true;
      try {
        (chartRef.current as any)?._disposeHandler?.();
        chartRef.current?.remove?.();
      } catch {}
      chartRef.current = null;
      candleSeriesRef.current = null;
      lineSeriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    if (!candleSeries || !ready) return;
    if (!candles || candles.length === 0) return;
    const LWC = lwcRef.current;
    (candleSeries as any).setData(
      candles.map((c) => ({ time: (c.time / 1000) as any, open: c.open, high: c.high, low: c.low, close: c.close }))
    );
    chartRef.current?.timeScale().fitContent();
  }, [candles, ready]);

  useEffect(() => {
    const lineSeries = lineSeriesRef.current;
    if (!lineSeries || !ready) return;
    if (!forecast || forecast.length === 0) {
      (lineSeries as any).setData([]);
      return;
    }
    (lineSeries as any).setData(forecast.map((p) => ({ time: (p.t / 1000) as any, value: p.price })));
  }, [forecast, ready]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const candleSeries = candleSeriesRef.current!;
    if (!candles || candles.length === 0) return;
    const LWC = lwcRef.current;
    // Clear existing price lines safely
    if (priceLinesRef.current.length) {
      priceLinesRef.current.forEach((pl) => {
        try { (candleSeries as any).removePriceLine?.(pl); } catch {}
      });
      priceLinesRef.current = [];
    }

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
    const lastLine = (candleSeries as any).createPriceLine({ price: candles[candles.length - 1]?.close ?? 0, color: '#999', lineStyle: LWC?.LineStyle?.Dotted ?? 1, lineWidth: 1, title: 'Last' });
    if (lastLine) priceLinesRef.current.push(lastLine);
    priceLines.forEach((pl) => {
      const l = (candleSeries as any).createPriceLine({ price: pl.price, color: pl.color, title: pl.title, lineStyle: LWC?.LineStyle?.Solid ?? 0, lineWidth: 1 });
      if (l) priceLinesRef.current.push(l);
    });
  }, [levels, fibLevels, keyLevels, candles]);

  const takePng = async () => {
    try {
      const c = containerRef.current?.querySelector('canvas');
      if (c) onSavePng?.(c.toDataURL('image/png'));
    } catch {}
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


