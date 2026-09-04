import type { FadeSignalFeed } from '@/config/fade-signals';
import {
  aggregatePerformance,
  buildCandidateScores,
  candidateKey,
  selectWorstActiveCandidate,
  type ActivePosition,
  type CandidateScore,
  type ClosedOrder,
  type ObservedMatch,
} from './signal-ranking';

const DAY_MS = 86_400_000;
const DISCOVERY_MATCH_LIMIT = 200;
const CANDIDATE_LIMIT = 12;
const HISTORY_RECORD_LIMIT = 1_000;
const POSITION_LOOKUP_CONCURRENCY = 4;

export type NadoPerformanceHistory = {
  orders: ClosedOrder[];
  liquidationTimestamps: number[];
  historyComplete: boolean;
};

export interface NadoSignalDataSource {
  getRecentMatches(input: { limit: number }): Promise<ObservedMatch[]>;
  getActivePosition(candidate: CandidateScore): Promise<ActivePosition | null>;
  getPerformanceHistory(
    candidate: CandidateScore,
    input: { since: number; until: number; maxRecords: number },
  ): Promise<NadoPerformanceHistory>;
}

export async function loadFeaturedNadoSignal(
  source: NadoSignalDataSource,
  now = Date.now(),
): Promise<FadeSignalFeed> {
  const checkedAt = new Date(now).toISOString();

  try {
    const recentMatches = await source.getRecentMatches({
      limit: DISCOVERY_MATCH_LIMIT,
    });
    const candidates = buildCandidateScores(
      recentMatches,
      CANDIDATE_LIMIT,
    ).filter((candidate) => candidate.observedRealizedPnlUsd < 0);
    const positionResults = await mapSettledWithConcurrency(
      candidates,
      POSITION_LOOKUP_CONCURRENCY,
      async (candidate) => ({
        candidate,
        position: await source.getActivePosition(candidate),
      }),
    );
    const positions = new Map<string, ActivePosition>();

    for (const result of positionResults) {
      if (result.status === 'fulfilled' && result.value.position) {
        positions.set(
          candidateKey(result.value.candidate),
          result.value.position,
        );
      }
    }

    const selected = selectWorstActiveCandidate(candidates, positions);
    if (!selected) {
      return {
        status: 'unavailable',
        checkedAt,
        reason:
          'No recently active losing account has a verified open position.',
      };
    }

    const since = now - 30 * DAY_MS;
    const history = await source.getPerformanceHistory(selected.candidate, {
      since,
      until: now,
      maxRecords: HISTORY_RECORD_LIMIT,
    });
    const performance = aggregatePerformance({
      now,
      historyComplete: history.historyComplete,
      orders: history.orders,
      liquidationTimestamps: history.liquidationTimestamps,
    });

    return {
      status: 'live',
      checkedAt,
      signal: {
        id: candidateKey(selected.candidate),
        alias: 'NADO ACCOUNT',
        sourceVenue: 'nado',
        walletAddress: selected.candidate.subaccountOwner,
        symbol: selected.position.symbol,
        positionSide: selected.position.side,
        positionNotionalUsd: selected.position.notionalUsd,
        pnl30dUsd: performance.windowComplete
          ? performance.realizedPnlUsd
          : undefined,
        performancePnlUsd: performance.realizedPnlUsd,
        performanceWindowDays: performance.observedDays,
        performanceWindowComplete: performance.windowComplete,
        performanceWindowStart: performance.observedFrom,
        winRatePercent: performance.winRatePercent,
        liquidationCount: performance.liquidationCount,
        closedOrderCount: performance.closedOrderCount,
        candidateCount: candidates.length,
        selectionMethod: 'Worst realized PnL in recent public maker activity',
        updatedAt: checkedAt,
        dataSourceLabel: 'Nado public archive + gateway',
        dataSourceUrl: 'https://docs.nado.xyz/developer-resources/api',
        isLiveData: true,
      },
    };
  } catch {
    return {
      status: 'unavailable',
      checkedAt,
      reason: 'Nado public data is temporarily unavailable.',
    };
  }
}

async function mapSettledWithConcurrency<T, U>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<U>,
): Promise<PromiseSettledResult<U>[]> {
  const results: PromiseSettledResult<U>[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      try {
        results[index] = {
          status: 'fulfilled',
          value: await mapper(items[index]!),
        };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}
