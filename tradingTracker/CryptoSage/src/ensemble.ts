import { buildPromptVariants, askGemini } from './gemini';
import type { AIResp } from './schemas';

type MultiTF = Record<'1m' | '5m' | '15m', any>;

export async function runEnsemble(params: { symbol: string; interval: string; multiTF: MultiTF; notes?: string }): Promise<AIResp> {
  const prompts = buildPromptVariants({ symbol: params.symbol, interval: params.interval, taMultiTF: params.multiTF, userNote: params.notes });
  const [a, b, c] = await Promise.allSettled(prompts.map((p) => askGemini(p)));
  const valids = [a, b, c]
    .filter((r): r is PromiseFulfilledResult<AIResp> => r.status === 'fulfilled')
    .map((r) => r.value);
  if (valids.length === 0) throw new Error('All ensemble calls failed');

  // majority verdict
  const verdictCounts: Record<string, number> = {};
  valids.forEach((v) => {
    verdictCounts[v.verdict] = (verdictCounts[v.verdict] ?? 0) + 1;
  });
  const majority = Object.entries(verdictCounts).sort((a, b2) => b2[1] - a[1])[0][0] as AIResp['verdict'];
  const uniqueVerdicts = Object.keys(verdictCounts).length;
  const avgConfidence = valids.reduce((a2, b2) => a2 + b2.confidence, 0) / valids.length;

  // merge forecast by timestamp
  const timeToPrices: Record<number, number[]> = {};
  valids.forEach((v) => {
    v.forecast.points.forEach((pt) => {
      if (!timeToPrices[pt.t]) timeToPrices[pt.t] = [];
      timeToPrices[pt.t].push(pt.price);
    });
  });
  const mergedPoints = Object.entries(timeToPrices)
    .map(([t, prices]) => ({ t: Number(t), price: prices.reduce((a2, b2) => a2 + b2, 0) / prices.length }))
    .sort((x, y) => x.t - y.t);

  const base = valids[0];
  const merged: AIResp = {
    ...base,
    verdict: majority,
    confidence: avgConfidence,
    forecast: { ...base.forecast, points: mergedPoints },
    annotations: {
      fibLevels: base.annotations.fibLevels || {},
      keyLevels: Array.from(new Set(valids.flatMap((v) => v.annotations.keyLevels || []))).sort((x, y) => x - y),
    },
  };

  if (uniqueVerdicts > 1 || avgConfidence < 0.55) {
    merged.verdict = 'No-Trade';
  }

  return merged;
}


