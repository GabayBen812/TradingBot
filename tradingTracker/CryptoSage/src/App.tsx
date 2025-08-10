import { useEffect, useMemo, useRef, useState } from 'react';
import './styles.css';
import AuthGate from './AuthGate';
import { useStore } from './state';
import { fetchKlines, openKlineWS, type Candle, fetchDepth, estimateSlippage } from './market';
import { summarizeMultiTF } from './ta';
import ChartPanel from './ChartPanel';
import { runEnsemble } from './ensemble';
import type { AIResp } from './schemas';
import { saveAnalysis } from './history.service';
import HistoryView from './HistoryView';
import { positionSize, shouldBlock } from './sizing';

function App() {
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
      const res = await runEnsemble({ symbol, interval, multiTF, notes: question });
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
    <AuthGate>
      <div>
        <div className="toolbar">
          <input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="Symbol e.g. BTCUSDT" style={{ width: 140 }} />
          <select value={interval} onChange={(e) => setInterval(e.target.value as any)}>
            <option value="1m">1m</option>
            <option value="5m">5m</option>
            <option value="15m">15m</option>
          </select>
          <span style={{ marginLeft: 8, color: '#374151' }}>
            Last: {lastPrice ?? '…'} {atrPct != null && <em style={{ color: '#6b7280' }}>ATR% {atrPct.toFixed(2)}</em>}
          </span>
          <div style={{ marginLeft: 'auto' }} className="row">
            <button onClick={() => setTab('chat')} disabled={ui.tab === 'chat'}>Chat</button>
            <button onClick={() => setTab('history')} disabled={ui.tab === 'history'}>History</button>
          </div>
        </div>

        {ui.tab === 'chat' ? (
          <div style={{ padding: 12, display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16 }}>
            <div>
              <ChartPanel
                candles={interval === '1m' ? c1 : interval === '5m' ? c5 : c15}
                forecast={response?.forecast.points}
                levels={response?.levels}
                fibLevels={multiTF['1m']?.fib}
                keyLevels={response?.annotations.keyLevels}
                onSavePng={handleSavePng}
              />
            </div>
            <div className="col">
              <textarea rows={6} placeholder="Ask: e.g., 0.618 pullback on AVAX — scalp 5–30m?" value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void ask(); }
              }} />
              <button onClick={ask} disabled={asking}>{asking ? 'Analyzing…' : 'Ask'}</button>
              <div style={{ borderTop: '1px solid #eee', paddingTop: 8 }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong>Depth/Slippage (scaffold)</strong>
                  <div>
                    <input type="number" value={slipNotional} onChange={(e) => setSlipNotional(Number(e.target.value))} style={{ width: 120 }} />
                    <button style={{ marginLeft: 8 }} onClick={async () => {
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
                {slipEst && <div style={{ color: '#374151' }}>{slipEst}</div>}
              </div>
              {response && (
                <div style={{ border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <strong>{response.verdict}</strong>
                    <span style={{ color: '#6b7280' }}>{(response.confidence * 100).toFixed(1)}%</span>
                  </div>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{response.analysis_text}</p>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <div>
                      <strong>Levels</strong>
                      <div>Entry {response.levels.entry}</div>
                      <div>Stop {response.levels.stop}</div>
                      <div>TP1 {response.levels.tp1}</div>
                      <div>TP2 {response.levels.tp2}</div>
                    </div>
                    <div>
                      <strong>Risk</strong>
                      <div>R: {response.risk.r}</div>
                      {sizing && (
                        <div style={{ fontSize: 12, color: '#374151' }}>
                          Size: {sizing.qty.toFixed(4)} (~${sizing.notional.toFixed(2)})
                        </div>
                      )}
                    </div>
                  </div>
                  {response.uncertainty_reasons?.length ? (
                    <div style={{ marginTop: 8 }}>
                      <strong>Uncertainty</strong>
                      <ul>
                        {response.uncertainty_reasons.map((x, i) => <li key={i}>{x}</li>)}
                      </ul>
                    </div>
                  ) : null}
                  {response.what_would_change_my_mind?.length ? (
                    <div style={{ marginTop: 8 }}>
                      <strong>Change my mind</strong>
                      <ul>
                        {response.what_would_change_my_mind.map((x, i) => <li key={i}>{x}</li>)}
                      </ul>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ padding: 12 }}>
            <HistoryView />
          </div>
        )}
      </div>
    </AuthGate>
  );
}

export default App
