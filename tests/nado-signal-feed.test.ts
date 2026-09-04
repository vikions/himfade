import { describe, expect, it, vi } from 'vitest';
import {
  loadFeaturedNadoSignal,
  type NadoSignalDataSource,
} from '@/lib/nado/signal-feed';

const NOW = Date.UTC(2026, 8, 4, 12);

describe('featured Nado signal feed', () => {
  it('enriches only the worst observed candidate with a live position', async () => {
    const source = dataSource({
      positions: {
        '0xflat:default': null,
        '0xactive:default': {
          symbol: 'ETH',
          productId: 2,
          side: 'long',
          baseAmount: 0.5,
          notionalUsd: 1_600,
        },
      },
    });

    const result = await loadFeaturedNadoSignal(source, NOW);

    expect(result.status).toBe('live');
    expect(result.signal).toMatchObject({
      walletAddress: '0xactive',
      symbol: 'ETH',
      positionSide: 'long',
      positionNotionalUsd: 1_600,
      performancePnlUsd: -18,
      winRatePercent: 50,
      liquidationCount: 1,
      closedOrderCount: 2,
      performanceWindowDays: 30,
      performanceWindowComplete: true,
      candidateCount: 2,
      isLiveData: true,
    });
    expect(source.getPerformanceHistory).toHaveBeenCalledTimes(1);
    expect(source.getPerformanceHistory).toHaveBeenCalledWith(
      expect.objectContaining({ subaccountOwner: '0xactive' }),
      expect.objectContaining({ since: NOW - 30 * 86_400_000 }),
    );
  });

  it('fails closed when no observed account has an open position', async () => {
    const source = dataSource({ positions: {} });
    const result = await loadFeaturedNadoSignal(source, NOW);

    expect(result).toEqual({
      status: 'unavailable',
      checkedAt: new Date(NOW).toISOString(),
      reason: 'No recently active losing account has a verified open position.',
    });
  });

  it('turns upstream errors into a safe unavailable state', async () => {
    const source = dataSource({ positions: {} });
    source.getRecentMatches.mockRejectedValueOnce(new Error('403 blocked'));

    const result = await loadFeaturedNadoSignal(source, NOW);

    expect(result.status).toBe('unavailable');
    expect(result.signal).toBeUndefined();
    expect(result.reason).toBe('Nado public data is temporarily unavailable.');
  });
});

function dataSource(input: {
  positions: Record<
    string,
    Awaited<ReturnType<NadoSignalDataSource['getActivePosition']>>
  >;
}) {
  const source = {
    getRecentMatches: vi
      .fn()
      .mockResolvedValue([
        match('0xflat', -40, NOW - 1_000),
        match('0xactive', -8, NOW - 2_000),
      ]),
    getActivePosition: vi.fn(async (candidate) => {
      const key = `${candidate.subaccountOwner}:${candidate.subaccountName}`;
      return input.positions[key] ?? null;
    }),
    getPerformanceHistory: vi.fn().mockResolvedValue({
      historyComplete: true,
      orders: [
        { timestamp: NOW - 10_000, realizedPnlUsd: -20, closedAmount: 1 },
        { timestamp: NOW - 20_000, realizedPnlUsd: 2, closedAmount: -1 },
      ],
      liquidationTimestamps: [NOW - 30_000],
    }),
  } satisfies NadoSignalDataSource;
  return source;
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
