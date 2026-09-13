import { subaccountFromHex } from '@nadohq/shared';
import type { FadeSignal, FadeSignalFeed } from '@/config/fade-signals';
import type { ExplorerLeaderboardRow } from './explorer-client';
import type { NadoSignalDataSource } from './signal-feed';
import { candidateKey, type CandidateScore } from './signal-ranking';

export type { ExplorerLeaderboardRow } from './explorer-client';

const LOSS_BANDS_USD = [-25, -250, -1_000, -5_000] as const;
const VERIFY_LIMIT = 24;
const LIVE_SCAN_PER_BAND = 16;
const SIGNAL_LIMIT = 5;
const POSITION_LOOKUP_CONCURRENCY = 4;
const LIVE_LOOKUP_BATCH_SIZE = 8;

export interface NadoExplorerSignalSource {
  getLosingSubaccounts(input: {
    maxPnlUsd: number;
  }): Promise<ExplorerLeaderboardRow[]>;
  hasOpenPosition(subaccount: string): Promise<boolean>;
}

type RankedExplorerCandidate = ExplorerLeaderboardRow & {
  fadeScore: number;
};

export function rankExplorerCandidates(
  rows: ExplorerLeaderboardRow[],
): RankedExplorerCandidate[] {
  const unique = new Map<string, ExplorerLeaderboardRow>();

  for (const row of rows) {
    if (row.pnlUsd >= 0) continue;
    const key = row.subaccount.toLowerCase();
    const current = unique.get(key);
    if (!current || row.pnlUsd < current.pnlUsd) unique.set(key, row);
  }

  return [...unique.values()]
    .map((row) => ({ ...row, fadeScore: calculateFadeScore(row) }))
    .sort(
      (a, b) =>
        b.fadeScore - a.fadeScore ||
        a.pnlUsd - b.pnlUsd ||
        a.subaccount.localeCompare(b.subaccount),
    );
}

export async function loadExplorerNadoSignals(
  explorer: NadoExplorerSignalSource,
  official: Pick<NadoSignalDataSource, 'getActivePosition'>,
  now = Date.now(),
): Promise<FadeSignalFeed> {
  const checkedAt = new Date(now).toISOString();

  try {
    const sampleResults = await Promise.allSettled(
      LOSS_BANDS_USD.map((maxPnlUsd) =>
        explorer.getLosingSubaccounts({ maxPnlUsd }),
      ),
    );
    const successfulBands = sampleResults.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : [],
    );
    const samples = successfulBands.flatMap((rows) => rows);
    const scanRows = interleaveBands(
      successfulBands.map((rows) => rows.slice(0, LIVE_SCAN_PER_BAND)),
    );
    const ranked = rankExplorerCandidates(samples);
    const rankedBySubaccount = new Map(
      ranked.map((row) => [row.subaccount.toLowerCase(), row]),
    );
    const decodedCandidates = scanRows.flatMap((sampleRow) => {
      const row =
        rankedBySubaccount.get(sampleRow.subaccount.toLowerCase()) ?? sampleRow;
      try {
        const decoded = subaccountFromHex(row.subaccount);
        if (
          decoded.subaccountOwner.toLowerCase() !==
          row.walletAddress.toLowerCase()
        ) {
          return [];
        }
        return [
          {
            row,
            candidate: {
              subaccountOwner: decoded.subaccountOwner,
              subaccountName: decoded.subaccountName,
              observedRealizedPnlUsd: row.pnlUsd,
              observedMatchCount: row.closedTrades,
              lastActivityAt: Date.parse(row.lastActivityAt),
            } satisfies CandidateScore,
          },
        ];
      } catch {
        return [];
      }
    });
    const candidates = (
      await selectLiveCandidates(explorer, decodedCandidates)
    ).sort(
      (a, b) =>
        calculateFadeScore(b.row) - calculateFadeScore(a.row) ||
        a.row.pnlUsd - b.row.pnlUsd,
    );

    const verified = await mapSettledWithConcurrency(
      candidates,
      POSITION_LOOKUP_CONCURRENCY,
      async ({ row, candidate }) => ({
        row,
        candidate,
        position: await official.getActivePosition(candidate),
      }),
    );
    const signals = verified.flatMap((result): FadeSignal[] => {
      if (result.status !== 'fulfilled' || !result.value.position) return [];
      const { row, candidate, position } = result.value;
      return [
        {
          id: candidateKey(candidate),
          alias: 'NADO ACCOUNT',
          sourceVenue: 'nado',
          walletAddress: candidate.subaccountOwner,
          symbol: position.symbol,
          positionSide: position.side,
          positionNotionalUsd: position.notionalUsd,
          pnl30dUsd: row.pnlUsd,
          performancePnlUsd: row.pnlUsd,
          performanceWindowDays: row.periodDays,
          performanceWindowComplete: true,
          performanceWindowStart: `${row.periodStart}T00:00:00.000Z`,
          performanceBasis: 'net',
          volume30dUsd: row.volumeUsd,
          fees30dUsd: row.feesUsd,
          roiPercent: row.roi ?? undefined,
          maxDrawdownUsd: row.maxDrawdownUsd ?? undefined,
          activeDays: row.activeDays,
          analyticsProvider: 'Nado Explorer',
          closedOrderCount: row.closedTrades,
          candidateCount: ranked.length,
          selectionMethod:
            'Multi-factor loss consistency, activity, and drawdown ranking',
          winRatePercent: round(row.winRate * 100, 1),
          updatedAt: checkedAt,
          dataSourceLabel: 'Nado Explorer analytics + Nado gateway',
          dataSourceUrl: 'https://nadoexplorer.com/developers/api',
          isLiveData: true,
        },
      ];
    });

    if (!signals.length) {
      return {
        status: 'unavailable',
        checkedAt,
        signals: [],
        reason: 'No Explorer candidate has a verified open Nado position.',
      };
    }

    return {
      status: 'live',
      checkedAt,
      signals: signals.slice(0, SIGNAL_LIMIT),
    };
  } catch {
    return {
      status: 'unavailable',
      checkedAt,
      signals: [],
      reason: 'Nado Explorer analytics are temporarily unavailable.',
    };
  }
}

function interleaveBands(bands: ExplorerLeaderboardRow[][]) {
  const rows: ExplorerLeaderboardRow[] = [];
  const seen = new Set<string>();
  const longest = Math.max(0, ...bands.map((band) => band.length));

  for (let index = 0; index < longest; index++) {
    for (const band of bands) {
      const row = band[index];
      if (!row) continue;
      const key = row.subaccount.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
    }
  }

  return rows;
}

async function selectLiveCandidates<T extends { row: ExplorerLeaderboardRow }>(
  explorer: Pick<NadoExplorerSignalSource, 'hasOpenPosition'>,
  candidates: T[],
) {
  const selected: T[] = [];

  for (
    let offset = 0;
    offset < candidates.length;
    offset += LIVE_LOOKUP_BATCH_SIZE
  ) {
    const batch = candidates.slice(offset, offset + LIVE_LOOKUP_BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (candidate) => ({
        candidate,
        open: await explorer.hasOpenPosition(candidate.row.subaccount),
      })),
    );
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.open) {
        selected.push(result.value.candidate);
      }
    }
    if (selected.length >= VERIFY_LIMIT) break;
  }

  return selected.slice(0, VERIFY_LIMIT);
}

function calculateFadeScore(row: ExplorerLeaderboardRow) {
  const loss = Math.log10(1 + Math.abs(row.pnlUsd)) * 25;
  const lowWinRate = (1 - row.winRate) * 30;
  const activity = Math.min(row.activeDays / 30, 1) * 15;
  const drawdown = Math.log10(1 + (row.maxDrawdownUsd ?? 0)) * 8;
  const sampleConfidence = Math.min(row.closedTrades / 50, 1) * 10;
  return round(loss + lowWinRate + activity + drawdown + sampleConfidence, 4);
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

function round(value: number, decimals: number) {
  const scale = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}
