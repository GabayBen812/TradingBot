import { useEffect, useMemo, useRef, useState } from 'react';
import ChartPanel from './ChartPanel';
import { useStore } from './state';
import { fetchKlines, openKlineWS, type Candle, fetchDepth, estimateSlippage } from './market';
import { summarizeMultiTF } from './ta';
import { runEnsemble, type UserPlan } from './ensemble';
import type { AIResp } from './schemas';
import { saveAnalysis } from './history.service';
import HistoryView from './HistoryView';
import { positionSize, shouldBlock } from './sizing';

function SageApp() {
  const { symbol, interval, setSymbol, setInterval, ui, setTab, circuit } = useStore();
  const [c1, setC1] = useState<Candle[]>([]);
  const [c5, setC5] = useState<Candle[]>([]);
  const [c15, setC15] = useState<Candle[]>([]);
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState<AIResp | null>(null);
  const wsRef = useRef<{ close: () => void } | null>(null);
  const [atrPct, setAtrPct] = useState<number | null>(null);
  const [slipNotional, setSlipNotional] = useState(1000);
  const [slipEst, setSlipEst] = useState<string>('');
  const [plan, setPlan] = useState<UserPlan>({});

  useEffect(() => {
    (async () => {
      try {
        const [d1, d5, d15] = await Promise.all([
          fetchKlines(symbol, '1m', 600),
          fetchKlines(symbol, '5m', 600),
          fetchKlines(symbol, '15m', 600),
        ]);
        setC1(d1);
        setC5(d5);
        setC15(d15);
        setLastPrice(d1[d1.length - 1]?.close ?? null);
        if (wsRef.current) wsRef.current.close();
        wsRef.current = openKlineWS(symbol, (c) => {
          setC1((prev) => {
            if (!prev.length || c.time > prev[prev.length - 1].time) return [...prev, c];
            const updated = prev.slice(0, -1).concat(c);
            return updated;
          });
          setLastPrice(c.close);
        });
      } catch (e) {
        console.error('Failed to load initial klines', e);
        setC1([]);
        setC5([]);
        setC15([]);
      }
    })();
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [symbol]);

  const multiTF = useMemo(() => {
    const sum = summarizeMultiTF({ '1m': c1, '5m': c5, '15m': c15 });
    const atr = sum['1m']?.atrPct ?? null;
    setAtrPct(atr);
    return sum;
  }, [c1, c5, c15]);

  const ask = async () => {
    if (circuit.enabled && shouldBlock({ todayLoss: circuit.dailyLoss, cap: circuit.dailyCap })) {
      alert('Circuit breaker active. Asking is disabled.');
      return;
    }
    setAsking(true);
    try {
      const res = await runEnsemble({ symbol, interval, multiTF, notes: question, plan });
      setResponse(res);
      if (lastPrice != null) await saveAnalysis({ symbol, interval, last_price: lastPrice, ai: res });
    } catch (e: any) {
      alert('Ask failed: ' + (e?.message ?? 'unknown'));
    } finally {
      setAsking(false);
    }
  };

  const handleSavePng = async (dataUrl: string) => {
    if (!response || lastPrice == null) return;
    await saveAnalysis({ symbol, interval, last_price: lastPrice, ai: response, snapshotDataUrl: dataUrl });
    alert('Snapshot saved');
  };

  const sizing = useMemo(() => {
    if (!response) return null;
    const { entry, stop } = response.levels;
    return positionSize({ account: 10000, riskPct: 0.01, entry, stop });
  }, [response]);

  return (
    <div className="space-y-4">
      <div className="bg-gray-800/70 backdrop-blur rounded-xl p-3 border border-gray-700 flex items-center gap-3">
        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          placeholder="Symbol e.g. BTCUSDT"
          className="w-40 bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={interval}
          onChange={(e) => setInterval(e.target.value as any)}
          className="bg-gray-900 border border-gray-700 rounded-md px-2 py-2 text-sm"
        >
          <option value="1m">1m</option>
          <option value="5m">5m</option>
          <option value="15m">15m</option>
        </select>
        <span className="text-sm text-gray-300">
          Last: {lastPrice ?? '…'} {atrPct != null && <em className="text-gray-400">ATR% {atrPct.toFixed(2)}</em>}
        </span>
        <div className="ml-auto flex gap-2">
          <button className={`px-3 py-1.5 rounded-md text-sm ${ui.tab === 'chat' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-100'}`} onClick={() => setTab('chat')} disabled={ui.tab === 'chat'}>
            Chat
          </button>
          <button className={`px-3 py-1.5 rounded-md text-sm ${ui.tab === 'history' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-100'}`} onClick={() => setTab('history')} disabled={ui.tab === 'history'}>
            History
          </button>
        </div>
      </div>

      {ui.tab === 'chat' ? (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-2">
            <ChartPanel
              candles={interval === '1m' ? c1 : interval === '5m' ? c5 : c15}
              forecast={response?.forecast.points}
              levels={response?.levels}
              fibLevels={multiTF['1m']?.fib}
              keyLevels={response?.annotations.keyLevels}
              onSavePng={handleSavePng}
            />
            <div className="text-xs text-gray-500 px-1 mt-2">If the chart looks empty, try another symbol (e.g., BTCUSDT) or refresh. Data starts after the first fetch completes.</div>
          </div>
          <div className="flex flex-col gap-3">
            <textarea
              rows={6}
              placeholder="Ask: e.g., 0.618 pullback on AVAX — scalp 5–30m?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void ask(); } }}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm min-h-[140px]"
            />
            <div className="grid grid-cols-2 gap-2">
              <select value={plan.side ?? ''} onChange={(e) => setPlan((p) => ({ ...p, side: (e.target.value || undefined) as any }))} className="bg-gray-900 border border-gray-700 rounded-md px-2 py-2 text-sm">
                <option value="">Side (opt)</option>
                <option value="Buy">Buy</option>
                <option value="Sell">Sell</option>
              </select>
              <input type="number" placeholder="Amount (opt)" value={plan.amount ?? ''} onChange={(e) => setPlan((p) => ({ ...p, amount: e.target.value ? Number(e.target.value) : undefined }))} className="bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-sm" />
              <input type="number" placeholder="Entry (opt)" value={plan.entry ?? ''} onChange={(e) => setPlan((p) => ({ ...p, entry: e.target.value ? Number(e.target.value) : undefined }))} className="bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-sm" />
              <input type="number" placeholder="Stop (opt)" value={plan.stop ?? ''} onChange={(e) => setPlan((p) => ({ ...p, stop: e.target.value ? Number(e.target.value) : undefined }))} className="bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-sm" />
              <input type="number" placeholder="TP1 (opt)" value={plan.tp1 ?? ''} onChange={(e) => setPlan((p) => ({ ...p, tp1: e.target.value ? Number(e.target.value) : undefined }))} className="bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-sm" />
              <input type="number" placeholder="TP2 (opt)" value={plan.tp2 ?? ''} onChange={(e) => setPlan((p) => ({ ...p, tp2: e.target.value ? Number(e.target.value) : undefined }))} className="bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={ask} disabled={asking} className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white">
                {asking ? 'Analyzing…' : 'Ask'}
              </button>
              <button onClick={() => handleSavePng('')} className="px-3 py-2 rounded-md bg-gray-700 text-gray-100">Save PNG</button>
            </div>
            <div className="border-t border-gray-700 pt-3">
              <div className="flex items-center justify-between text-sm font-medium text-gray-200">
                <span>Depth/Slippage</span>
                <div className="flex items-center gap-2">
                  <input type="number" value={slipNotional} onChange={(e) => setSlipNotional(Number(e.target.value))} className="w-28 bg-gray-900 border border-gray-700 rounded-md px-2 py-1.5 text-sm" />
                  <button className="px-3 py-1.5 rounded-md bg-gray-700 text-gray-100" onClick={async () => {
                    try {
                      const depth = await fetchDepth(symbol);
                      const side: 'buy' | 'sell' = 'buy';
                      const { avgPrice, filledNotional } = estimateSlippage(depth.asks, slipNotional, side);
                      setSlipEst(filledNotional ? `Avg ${avgPrice.toFixed(2)} for ${filledNotional.toFixed(2)} notional` : 'Insufficient depth');
                    } catch (e: any) {
                      setSlipEst('Failed: ' + (e?.message ?? 'unknown'));
                    }
                  }}>Estimate</button>
                </div>
              </div>
              {slipEst && <div className="text-sm text-gray-300 mt-2">{slipEst}</div>}
            </div>

            {response && (
              <div className="border border-gray-700 rounded-xl p-3 bg-gray-800/40">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{response.verdict}</span>
                  <span className="text-gray-400">{(response.confidence * 100).toFixed(1)}%</span>
                </div>
                <p className="whitespace-pre-wrap text-gray-200 mt-2 text-sm">{response.analysis_text}</p>
                <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                  <div>
                    <div className="font-semibold">Levels</div>
                    <div>Entry {response.levels.entry}</div>
                    <div>Stop {response.levels.stop}</div>
                    <div>TP1 {response.levels.tp1}</div>
                    <div>TP2 {response.levels.tp2}</div>
                  </div>
                  <div>
                    <div className="font-semibold">Risk</div>
                    <div>R: {response.risk.r}</div>
                    {sizing && (
                      <div className="text-xs text-gray-400">Size: {sizing.qty.toFixed(4)} (~${sizing.notional.toFixed(2)})</div>
                    )}
                  </div>
                </div>
                {response.uncertainty_reasons?.length ? (
                  <div className="mt-2">
                    <div className="font-semibold">Uncertainty</div>
                    <ul className="list-disc list-inside text-gray-300">
                      {response.uncertainty_reasons.map((x, i) => <li key={i}>{x}</li>)}
                    </ul>
                  </div>
                ) : null}
                {response.what_would_change_my_mind?.length ? (
                  <div className="mt-2">
                    <div className="font-semibold">Change my mind</div>
                    <ul className="list-disc list-inside text-gray-300">
                      {response.what_would_change_my_mind.map((x, i) => <li key={i}>{x}</li>)}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
          <HistoryView />
        </div>
      )}
    </div>
  );
}

export default SageApp;


