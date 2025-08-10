import type { Candle } from './market';

function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = 0;
  values.forEach((v, i) => {
    if (i === 0) prev = v;
    const next = v * k + prev * (1 - k);
    out.push(next);
    prev = next;
  });
  return out;
}

function rsi(values: number[], period = 14): number[] {
  const gains: number[] = [];
  const losses: number[] = [];
  const out: number[] = [];
  for (let i = 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    gains.push(Math.max(0, diff));
    losses.push(Math.max(0, -diff));
    if (i >= period) {
      const rg = gains.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
      const rl = losses.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
      const rs = rl === 0 ? 100 : rg / rl;
      const r = 100 - 100 / (1 + rs);
      out.push(r);
    } else {
      out.push(50);
    }
  }
  return [50, ...out];
}

function atr(candles: Candle[], period = 14): number[] {
  const trs: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const prevClose = i > 0 ? candles[i - 1].close : c.close;
    const tr = Math.max(c.high - c.low, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose));
    trs.push(tr);
  }
  return ema(trs, period);
}

function swingHL(candles: Candle[], lookback = 120) {
  const len = candles.length;
  const from = Math.max(0, len - lookback);
  const slice = candles.slice(from);
  const high = Math.max(...slice.map((c) => c.high));
  const low = Math.min(...slice.map((c) => c.low));
  return { high, low };
}

export function fibLevels(high: number, low: number) {
  const diff = high - low;
  return {
    '0.236': high - diff * 0.236,
    '0.382': high - diff * 0.382,
    '0.5': high - diff * 0.5,
    '0.618': high - diff * 0.618,
    '0.786': high - diff * 0.786,
  };
}

export function summarizeTA(candles: Candle[]) {
  if (!candles || candles.length === 0) {
    return {
      last: { time: 0, open: 0, high: 0, low: 0, close: 0, volume: 0 },
      ema20: 0,
      ema50: 0,
      rsi14: 50,
      atr14: 0,
      swing: { high: 0, low: 0 },
      fib: {},
      atrPct: 0,
      lowVol: true,
    } as const;
  }
  const closes = candles.map((c) => c.close);
  const e20 = ema(closes, 20);
  const e50 = ema(closes, 50);
  const r14 = rsi(closes, 14);
  const a14 = atr(candles, 14);
  const swing = swingHL(candles, 120);
  const fib = fibLevels(swing.high, swing.low);
  const last = candles[candles.length - 1];
  const atrPct = (a14[a14.length - 1] / last.close) * 100;
  const lowVol = atrPct < 0.4; // conservative filter
  return {
    last,
    ema20: e20[e20.length - 1],
    ema50: e50[e50.length - 1],
    rsi14: r14[r14.length - 1],
    atr14: a14[a14.length - 1],
    swing,
    fib,
    atrPct,
    lowVol,
  };
}

export function summarizeMultiTF(data: { '1m': Candle[]; '5m': Candle[]; '15m': Candle[] }) {
  return {
    '1m': summarizeTA(data['1m']),
    '5m': summarizeTA(data['5m']),
    '15m': summarizeTA(data['15m']),
  };
}


