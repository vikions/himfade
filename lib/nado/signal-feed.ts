import type { FadeSignalFeed } from '@/config/fade-signals';
import {
  aggregatePerformance,
  buildCandidateScores,
  candidateKey,
  selectWorstActiveCandidates,
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
const HISTORY_LOOKUP_CONCURRENCY = 3;
const SIGNAL_LIMIT = 5;

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

    const selected = selectWorstActiveCandidates(
      candidates,
      positions,
      SIGNAL_LIMIT,
    );
    if (!selected.length) {
      return {
        status: 'unavailable',
        checkedAt,
        signals: [],
        reason:
          'No recently active losing account has a verified open position.',
      };
    }

    const since = now - 30 * DAY_MS;
    const historyResults = await mapSettledWithConcurrency(
      selected,
      HISTORY_LOOKUP_CONCURRENCY,
      async ({ candidate, position }) => {
        const history = await source.getPerformanceHistory(candidate, {
          since,
          until: now,
          maxRecords: HISTORY_RECORD_LIMIT,
        });
        return {
          candidate,
          position,
          performance: aggregatePerformance({
            now,
            historyComplete: history.historyComplete,
            orders: history.orders,
            liquidationTimestamps: history.liquidationTimestamps,
          }),
        };
      },
    );
    const signals = historyResults.flatMap((result) => {
      if (result.status !== 'fulfilled') return [];
      const { candidate, position, performance } = result.value;
      return [
        {
          id: candidateKey(candidate),
          alias: 'NADO ACCOUNT',
          sourceVenue: 'nado' as const,
          walletAddress: candidate.subaccountOwner,
          symbol: position.symbol,
          positionSide: position.side,
          positionNotionalUsd: position.notionalUsd,
          pnl30dUsd: performance.windowComplete
            ? performance.realizedPnlUsd
            : undefined,
          performancePnlUsd: performance.realizedPnlUsd,
          performanceWindowDays: performance.observedDays,
          performanceWindowComplete: performance.windowComplete,
          performanceWindowStart: performance.observedFrom,
          performanceBasis: 'realized' as const,
          analyticsProvider: 'Nado official archive',
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
      ];
    });

    if (!signals.length) {
      return {
        status: 'unavailable',
        checkedAt,
        signals: [],
        reason: 'Verified target history is temporarily unavailable.',
      };
    }

    return {
      status: 'live',
      checkedAt,
      signals,
    };
  } catch {
    return {
      status: 'unavailable',
      checkedAt,
      signals: [],
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
