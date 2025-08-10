export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 7)}_${Date.now().toString(36)}`;
}

export function stripCodeFences(str: string): string {
  return str.replace(/^```json\s*|```$/gim, '').trim();
}

export function tryParseJSON<T = unknown>(raw: string): { ok: true; value: T } | { ok: false; error: unknown } {
  try {
    const clean = stripCodeFences(raw);
    return { ok: true, value: JSON.parse(clean) } as any;
  } catch (e) {
    return { ok: false, error: e } as const;
  }
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function brierScore(p: number, outcome: 0 | 1): number {
  return (p - outcome) ** 2;
}

export function bucketCalibration(items: { confidence: number; outcome: 0 | 1 }[]) {
  const buckets = [
    { min: 0.5, max: 0.6 },
    { min: 0.6, max: 0.7 },
    { min: 0.7, max: 0.8 },
    { min: 0.8, max: 0.9 },
    { min: 0.9, max: 1.01 },
  ];
  return buckets.map((b) => {
    const inBucket = items.filter((x) => x.confidence >= b.min && x.confidence < b.max);
    const hitRate = inBucket.length ? inBucket.filter((x) => x.outcome === 1).length / inBucket.length : 0;
    return { range: `${b.min.toFixed(1)}-${Math.min(b.max, 1).toFixed(1)}`, count: inBucket.length, hitRate };
  });
}

export function formatNumber(n: number, digits = 2) {
  return Number(n).toFixed(digits);
}


