export function positionSize(params: { account: number; riskPct: number; entry: number; stop: number }) {
  const { account, riskPct, entry, stop } = params;
  const riskAmount = account * riskPct;
  const rDist = Math.abs(entry - stop);
  const qty = rDist > 0 ? riskAmount / rDist : 0;
  const notional = qty * entry;
  return { qty, notional, rDist };
}

export function shouldBlock(params: { todayLoss: number; cap: number }) {
  return params.todayLoss >= params.cap;
}


