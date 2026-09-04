import { describe, expect, it, vi } from 'vitest';
import {
  loadFeaturedNadoSignal,
  type NadoSignalDataSource,
} from '@/lib/nado/signal-feed';

const NOW = Date.UTC(2026, 8, 4, 12);

describe('featured Nado signal feed', () => {
  it('returns up to five verified active signals in observed-loss order', async () => {
    const source = dataSource({
      matches: [
        match('0xflat', -100, NOW - 1_000),
        match('0xone', -90, NOW - 2_000),
        match('0xtwo', -80, NOW - 3_000),
        match('0xthree', -70, NOW - 4_000),
        match('0xfour', -60, NOW - 5_000),
        match('0xfive', -50, NOW - 6_000),
        match('0xsix', -40, NOW - 7_000),
      ],
      positions: {
        '0xflat:default': null,
        ...Object.fromEntries(
          ['one', 'two', 'three', 'four', 'five', 'six'].map((owner, index) => [
            `0x${owner}:default`,
            {
              symbol: index % 2 ? 'ETH-PERP' : 'BTC-PERP',
              productId: index % 2 ? 3 : 1,
              side: index % 2 ? ('short' as const) : ('long' as const),
              baseAmount: 0.5,
              notionalUsd: 1_600 - index * 100,
            },
          ]),
        ),
      },
    });

    const result = await loadFeaturedNadoSignal(source, NOW);

    expect(result.status).toBe('live');
    expect(result.signals).toHaveLength(5);
    expect(result.signals?.map((signal) => signal.walletAddress)).toEqual([
      '0xone',
      '0xtwo',
      '0xthree',
      '0xfour',
      '0xfive',
    ]);
    expect(result.signals?.[0]).toMatchObject({
      walletAddress: '0xone',
      symbol: 'BTC-PERP',
      positionSide: 'long',
      positionNotionalUsd: 1_600,
      performancePnlUsd: -18,
      winRatePercent: 50,
      liquidationCount: 1,
      closedOrderCount: 2,
      performanceWindowDays: 30,
      performanceWindowComplete: true,
      candidateCount: 7,
      isLiveData: true,
    });
    expect(source.getPerformanceHistory).toHaveBeenCalledTimes(5);
  });

  it('keeps verified signals available when one history request fails', async () => {
    const source = dataSource({
      matches: [
        match('0xbad', -20, NOW - 1_000),
        match('0xgood', -10, NOW - 2_000),
      ],
      positions: {
        '0xbad:default': {
          symbol: 'BTC-PERP',
          productId: 1,
          side: 'long',
          baseAmount: 0.5,
          notionalUsd: 1_600,
        },
        '0xgood:default': {
          symbol: 'ETH-PERP',
          productId: 3,
          side: 'short',
          baseAmount: 1,
          notionalUsd: 3_200,
        },
      },
    });
    source.getPerformanceHistory.mockImplementation(async (candidate) => {
      if (candidate.subaccountOwner === '0xbad') throw new Error('timeout');
      return performanceHistory();
    });

    const result = await loadFeaturedNadoSignal(source, NOW);

    expect(result.status).toBe('live');
    expect(result.signals?.map((signal) => signal.walletAddress)).toEqual([
      '0xgood',
    ]);
  });

  it('fails closed when no observed account has an open position', async () => {
    const source = dataSource({ positions: {} });
    const result = await loadFeaturedNadoSignal(source, NOW);

    expect(result).toEqual({
      status: 'unavailable',
      checkedAt: new Date(NOW).toISOString(),
      signals: [],
      reason: 'No recently active losing account has a verified open position.',
    });
  });

  it('turns upstream errors into a safe unavailable state', async () => {
    const source = dataSource({ positions: {} });
    source.getRecentMatches.mockRejectedValueOnce(new Error('403 blocked'));

    const result = await loadFeaturedNadoSignal(source, NOW);

    expect(result.status).toBe('unavailable');
    expect(result.signals).toEqual([]);
    expect(result.reason).toBe('Nado public data is temporarily unavailable.');
  });
});

function dataSource(input: {
  matches?: ReturnType<typeof match>[];
  positions: Record<
    string,
    Awaited<ReturnType<NadoSignalDataSource['getActivePosition']>>
  >;
}) {
  const source = {
    getRecentMatches: vi
      .fn()
      .mockResolvedValue(
        input.matches ?? [
          match('0xflat', -40, NOW - 1_000),
          match('0xactive', -8, NOW - 2_000),
        ],
      ),
    getActivePosition: vi.fn(async (candidate) => {
      const key = `${candidate.subaccountOwner}:${candidate.subaccountName}`;
      return input.positions[key] ?? null;
    }),
    getPerformanceHistory: vi.fn().mockResolvedValue(performanceHistory()),
  } satisfies NadoSignalDataSource;
  return source;
}

function performanceHistory() {
  return {
    historyComplete: true,
    orders: [
      { timestamp: NOW - 10_000, realizedPnlUsd: -20, closedAmount: 1 },
      { timestamp: NOW - 20_000, realizedPnlUsd: 2, closedAmount: -1 },
    ],
    liquidationTimestamps: [NOW - 30_000],
  };
}

function match(owner: string, pnl: number, timestamp: number) {
  return {
    subaccountOwner: owner,
    subaccountName: 'default',
    realizedPnlUsd: pnl,
    timestamp,
    isolated: false,
  };
}
