import { useEffect, useMemo, useState } from 'react';
import { deleteAnalysis, listAnalyses, type AnalysisRow } from './history.service';
import { fetchKlines } from './market';
import { bucketCalibration, formatNumber } from './utils';

export default function HistoryView() {
  const [items, setItems] = useState<AnalysisRow[]>([]);
  const [selected, setSelected] = useState<AnalysisRow | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [mae, setMae] = useState<number | null>(null);

  const load = async () => {
    setRefreshing(true);
    const list = await listAnalyses();
    setItems(list);
    setRefreshing(false);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    (async () => {
      if (!selected) return setMae(null);
      const horizonMin = selected.ai.forecast.horizonMinutes;
      const lastT = selected.ai.forecast.points[selected.ai.forecast.points.length - 1]?.t ?? 0;
      const endT = Math.max(lastT, new Date(selected.created_at).getTime() + horizonMin * 60 * 1000);
      const closes = await fetchKlines(selected.symbol, '1m', 600);
      const realized = closes.filter((c) => c.time >= selected.ai.forecast.points[0].t && c.time <= endT);
      if (realized.length === 0) return setMae(null);
      const tToClose: Record<number, number> = {};
      realized.forEach((c) => (tToClose[c.time] = c.close));
      const diffs: number[] = [];
      selected.ai.forecast.points.forEach((p) => {
        const close = tToClose[p.t];
        if (close != null) diffs.push(Math.abs(close - p.price));
      });
      setMae(diffs.length ? diffs.reduce((a, b) => a + b, 0) / diffs.length : null);
    })();
  }, [selected]);

  const calibration = useMemo(() => {
    const arr = items.map((it) => {
      const direction = it.ai.verdict === 'Sell' ? -1 : it.ai.verdict === 'Buy' ? 1 : 0;
      const outcome: 0 | 1 = direction === 0 ? 0 : 0;
      return { confidence: it.ai.confidence, outcome };
    });
    return bucketCalibration(arr);
  }, [items]);

  const onDelete = async (id: string) => {
    await deleteAnalysis(id);
    await load();
    if (selected?.id === id) setSelected(null);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }}>
      <div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <button onClick={load} disabled={refreshing}>{refreshing ? 'Refreshing...' : 'Refresh'}</button>
        </div>
        <div style={{ border: '1px solid #eee', borderRadius: 8, maxHeight: 520, overflow: 'auto' }}>
          {items.map((it) => (
            <div key={it.id} style={{ padding: 8, borderBottom: '1px solid #f2f2f2', cursor: 'pointer', background: selected?.id === it.id ? '#f9fafb' : undefined }} onClick={() => setSelected(it)}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>{it.symbol}</strong>
                <span>{new Date(it.created_at).toLocaleString()}</span>
              </div>
              <div style={{ fontSize: 12, color: '#666' }}>{it.ai.verdict} ({formatNumber(it.ai.confidence * 100, 1)}%) • {it.interval}</div>
            </div>
          ))}
        </div>
      </div>
      <div>
        {!selected ? (
          <div style={{ padding: 16, color: '#666' }}>Select an analysis</div>
        ) : (
          <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <h3 style={{ marginTop: 0 }}>{selected.symbol}</h3>
              <button onClick={() => selected.snapshot_url && window.open(selected.snapshot_url, '_blank')?.focus()} disabled={!selected.snapshot_url}>Open Snapshot</button>
              <button onClick={() => onDelete(selected.id)} style={{ marginLeft: 'auto', color: '#b91c1c' }}>Delete</button>
            </div>
            <p>{selected.ai.analysis_text}</p>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <strong>Levels</strong>
                <div>Entry {selected.ai.levels.entry}</div>
                <div>Stop {selected.ai.levels.stop}</div>
                <div>TP1 {selected.ai.levels.tp1}</div>
                <div>TP2 {selected.ai.levels.tp2}</div>
              </div>
              <div>
                <strong>Risk</strong>
                <div>R: {selected.ai.risk.r}</div>
              </div>
              <div>
                <strong>Checklist</strong>
                <ul>
                  {selected.ai.checklist.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <strong>MAE</strong>: {mae == null ? 'n/a' : mae.toFixed(4)}
            </div>
            <div style={{ marginTop: 12 }}>
              <strong>Calibration</strong>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', borderBottom: '1px solid #eee' }}>Bucket</th>
                    <th style={{ textAlign: 'right', borderBottom: '1px solid #eee' }}>Count</th>
                    <th style={{ textAlign: 'right', borderBottom: '1px solid #eee' }}>Hit rate</th>
                  </tr>
                </thead>
                <tbody>
                  {calibration.map((b) => (
                    <tr key={b.range}>
                      <td>{b.range}</td>
                      <td style={{ textAlign: 'right' }}>{b.count}</td>
                      <td style={{ textAlign: 'right' }}>{(b.hitRate * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


