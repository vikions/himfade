import { describe, expect, it, vi } from 'vitest';
import { NadoExplorerClient } from '@/lib/nado/explorer-client';

const SUBACCOUNT =
  '0xeb68ca5c712c8e812343f0d3b765a0e27e957f0f64656661756c740000000000';

describe('Nado Explorer client', () => {
  it('requests the documented subaccount leaderboard and validates rows', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          hasMore: false,
          limit: 50,
          offset: 0,
          rows: [leaderboardRow()],
        }),
        { status: 200 },
      ),
    );
    const client = new NadoExplorerClient({ fetcher });

    const result = await client.getLosingSubaccounts({ maxPnlUsd: -25 });

    expect(fetcher).toHaveBeenCalledOnce();
    const url = new URL(fetcher.mock.calls[0]![0] as string);
    expect(url.pathname).toBe('/api/traders/leaderboard');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      entity: 'subaccount',
      period: '30',
      sort: 'pnl',
      limit: '50',
      maxPnl: '-25',
      minEquity: '1',
    });
    expect(result[0]).toMatchObject({
      subaccount: SUBACCOUNT,
      pnlUsd: -25.03,
      winRate: 0.42,
      closedTrades: 67,
    });
  });

  it('fails closed when a required numeric field drifts', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          hasMore: false,
          limit: 50,
          offset: 0,
          rows: [leaderboardRow({ pnlUsd: 'not-a-number' })],
        }),
        { status: 200 },
      ),
    );

    await expect(
      new NadoExplorerClient({ fetcher }).getLosingSubaccounts({
        maxPnlUsd: -25,
      }),
    ).rejects.toThrow();
  });

  it('tolerates additive API changes and missing optional analytics', async () => {
    const sparse: Record<string, unknown> = leaderboardRow();
    delete sparse['maxDrawdownUsd'];
    delete sparse['maxDrawdownPct'];
    delete sparse['roi'];
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          hasMore: false,
          limit: 50,
          offset: 0,
          rows: [{ ...sparse, futureMetric: 123 }],
        }),
        { status: 200 },
      ),
    );

    await expect(
      new NadoExplorerClient({ fetcher }).getLosingSubaccounts({
        maxPnlUsd: -25,
      }),
    ).resolves.toEqual([
      expect.objectContaining({ pnlUsd: -25.03, futureMetric: 123 }),
    ]);
  });

  it('checks whether a leaderboard subaccount still has an open perp', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          liveTables: {
            positions: [{ productId: 1, symbol: 'BTC-PERP' }],
          },
          subaccounts: [SUBACCOUNT],
          fetchedAt: '2026-09-09T12:00:00.000Z',
        }),
        { status: 200 },
      ),
    );

    await expect(
      new NadoExplorerClient({ fetcher }).hasOpenPosition(SUBACCOUNT),
    ).resolves.toBe(true);
    const url = new URL(fetcher.mock.calls[0]![0] as string);
    expect(url.pathname).toBe(`/api/traders/${SUBACCOUNT}/live`);
    expect(url.searchParams.get('section')).toBe('positions');
  });
});

function leaderboardRow(overrides: Record<string, unknown> = {}) {
  return {
    entityType: 'subaccount',
    entityId: SUBACCOUNT,
    walletAddress: '0xeb68ca5c712c8e812343f0d3b765a0e27e957f0f',
    subaccount: SUBACCOUNT,
    periodDays: 30,
    periodStart: '2026-08-09',
    periodEnd: '2026-09-07',
    volumeUsd: 86_196.77,
    pnlUsd: -25.03,
    feesUsd: 7.61,
    winRate: 0.42,
    closedTrades: 67,
    activeDays: 30,
    equityUsd: 0,
    roi: -0.51,
    fillCount: 135,
    lastActivityAt: '2026-09-07 12:11:37+00',
    maxDrawdownUsd: 33.6,
    maxDrawdownPct: 0.69,
    ...overrides,
  };
}
