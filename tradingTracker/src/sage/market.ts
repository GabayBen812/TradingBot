export type Candle = {
  time: number; // ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type DepthLevel = { price: number; qty: number };
export type DepthSnapshot = { bids: DepthLevel[]; asks: DepthLevel[] };

const BINANCE_API = 'https://api.binance.com';

export async function fetchKlines(symbol: string, interval: '1m' | '5m' | '15m', limit = 600): Promise<Candle[]> {
  const url = `${BINANCE_API}/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch klines: ${res.status}`);
  const data = (await res.json()) as any[];
  return data.map((d) => ({
    time: d[0],
    open: parseFloat(d[1]),
    high: parseFloat(d[2]),
    low: parseFloat(d[3]),
    close: parseFloat(d[4]),
    volume: parseFloat(d[5]),
  }));
}

export function openKlineWS(symbol: string, cb: (candle: Candle, isFinal: boolean) => void): { close: () => void } {
  const s = symbol.toLowerCase();
  const streamUrl = `wss://stream.binance.com:9443/ws/${s}@kline_1m`;
  const ws = new WebSocket(streamUrl);
  ws.onmessage = (ev) => {
    try {
      const m = JSON.parse((ev as MessageEvent).data as any);
      const k = (m as any).k; // kline payload
      const candle: Candle = {
        time: k.t,
        open: parseFloat(k.o),
        high: parseFloat(k.h),
        low: parseFloat(k.l),
        close: parseFloat(k.c),
        volume: parseFloat(k.v),
      };
      cb(candle, !!k.x);
    } catch {}
  };
  return { close: () => ws.close() };
}

export async function fetchDepth(symbol: string, limit: 100 | 500 | 1000 = 1000): Promise<DepthSnapshot> {
  const url = `${BINANCE_API}/api/v3/depth?symbol=${symbol.toUpperCase()}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed depth');
  const d = await res.json();
  const bids: DepthLevel[] = (d.bids || []).map((x: [string, string]) => ({ price: parseFloat(x[0]), qty: parseFloat(x[1]) }));
  const asks: DepthLevel[] = (d.asks || []).map((x: [string, string]) => ({ price: parseFloat(x[0]), qty: parseFloat(x[1]) }));
  return { bids, asks };
}

export function estimateSlippage(levels: DepthLevel[], notional: number, _side: 'buy' | 'sell'): { avgPrice: number; filledNotional: number } {
  const book = levels.slice(0);
  let remaining = notional;
  let cost = 0;
  for (const lvl of book) {
    const canFill = lvl.qty * lvl.price;
    const take = Math.min(remaining, canFill);
    cost += take; // notional
    remaining -= take;
    if (remaining <= 0) break;
  }
  const filledNotional = notional - remaining;
  const avgPrice = filledNotional === 0 ? 0 : cost / filledNotional;
  return { avgPrice, filledNotional };
}


