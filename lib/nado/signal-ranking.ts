const DAY_MS = 86_400_000;
const THIRTY_DAYS_MS = 30 * DAY_MS;

export type ObservedMatch = {
  subaccountOwner: string;
  subaccountName: string;
  realizedPnlUsd: number;
  timestamp: number;
  isolated: boolean;
};

export type CandidateScore = {
  subaccountOwner: string;
  subaccountName: string;
  observedRealizedPnlUsd: number;
  observedMatchCount: number;
  lastActivityAt: number;
};

export type ActivePosition = {
  symbol: string;
  productId: number;
  side: 'long' | 'short';
  baseAmount: number;
  notionalUsd: number;
};

export type ClosedOrder = {
  timestamp: number;
  realizedPnlUsd: number;
  closedAmount: number;
};

export type PerformanceMetrics = {
  realizedPnlUsd: number;
  winRatePercent: number;
  closedOrderCount: number;
  liquidationCount: number;
  observedDays: number;
  windowComplete: boolean;
  observedFrom: string;
};

export function candidateKey(
  candidate: Pick<CandidateScore, 'subaccountOwner' | 'subaccountName'>,
) {
  return `${candidate.subaccountOwner.toLowerCase()}:${candidate.subaccountName}`;
}

export function buildCandidateScores(
  matches: ObservedMatch[],
  limit: number,
): CandidateScore[] {
  const scores = new Map<string, CandidateScore>();

  for (const match of matches) {
    if (match.isolated || !Number.isFinite(match.realizedPnlUsd)) continue;

    const key = candidateKey(match);
    const current = scores.get(key);
    if (current) {
      current.observedRealizedPnlUsd += match.realizedPnlUsd;
      current.observedMatchCount += 1;
      current.lastActivityAt = Math.max(
        current.lastActivityAt,
        match.timestamp,
      );
    } else {
      scores.set(key, {
        subaccountOwner: match.subaccountOwner,
        subaccountName: match.subaccountName,
        observedRealizedPnlUsd: match.realizedPnlUsd,
        observedMatchCount: 1,
        lastActivityAt: match.timestamp,
      });
    }
  }

  return [...scores.values()]
    .sort(
      (a, b) =>
        a.observedRealizedPnlUsd - b.observedRealizedPnlUsd ||
        b.observedMatchCount - a.observedMatchCount ||
        b.lastActivityAt - a.lastActivityAt ||
        candidateKey(a).localeCompare(candidateKey(b)),
    )
    .slice(0, Math.max(0, limit));
}

export function selectWorstActiveCandidate(
  candidates: CandidateScore[],
  positions: ReadonlyMap<string, ActivePosition>,
) {
  for (const candidate of candidates) {
    const position = positions.get(candidateKey(candidate));
    if (position) return { candidate, position };
  }
  return null;
}

export function aggregatePerformance(input: {
  now: number;
  historyComplete: boolean;
  orders: ClosedOrder[];
  liquidationTimestamps: number[];
}): PerformanceMetrics {
  const cutoff = input.now - THIRTY_DAYS_MS;
  const closedOrders = input.orders.filter(
    (order) =>
      order.timestamp >= cutoff &&
      order.timestamp <= input.now &&
      order.closedAmount !== 0 &&
      Number.isFinite(order.realizedPnlUsd),
  );
  const liquidationTimestamps = input.liquidationTimestamps.filter(
    (timestamp) => timestamp >= cutoff && timestamp <= input.now,
  );
  const realizedPnlUsd = round(
    closedOrders.reduce((sum, order) => sum + order.realizedPnlUsd, 0),
    2,
  );
  const wins = closedOrders.filter((order) => order.realizedPnlUsd > 0).length;
  const winRatePercent = closedOrders.length
    ? round((wins / closedOrders.length) * 100, 1)
    : 0;
  const oldestObserved = Math.min(
    ...closedOrders.map((order) => order.timestamp),
    ...liquidationTimestamps,
    input.now,
  );
  const observedFrom = input.historyComplete ? cutoff : oldestObserved;
  const observedDays = input.historyComplete
    ? 30
    : Math.min(30, Math.ceil((input.now - oldestObserved) / DAY_MS));

  return {
    realizedPnlUsd,
    winRatePercent,
    closedOrderCount: closedOrders.length,
    liquidationCount: liquidationTimestamps.length,
    observedDays,
    windowComplete: input.historyComplete,
    observedFrom: new Date(observedFrom).toISOString(),
  };
}

function round(value: number, decimals: number) {
  const scale = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}
