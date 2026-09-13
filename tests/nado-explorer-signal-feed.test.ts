import { subaccountToHex } from '@nadohq/shared';
import { describe, expect, it, vi } from 'vitest';
import {
  loadExplorerNadoSignals,
  rankExplorerCandidates,
  type ExplorerLeaderboardRow,
} from '@/lib/nado/explorer-signal-feed';
import type { NadoSignalDataSource } from '@/lib/nado/signal-feed';

const NOW = Date.UTC(2026, 8, 9, 12);

describe('Explorer-backed Nado signals', () => {
  it('ranks repeat losers using loss, consistency, activity, and drawdown', () => {
    const ranked = rankExplorerCandidates([
      row('0x1111111111111111111111111111111111111111', {
        pnlUsd: -1_000,
        winRate: 0.8,
        activeDays: 3,
        maxDrawdownUsd: 100,
      }),
      row('0x2222222222222222222222222222222222222222', {
        pnlUsd: -700,
        winRate: 0.2,
        activeDays: 25,
        maxDrawdownUsd: 900,
      }),
    ]);

    expect(ranked[0]?.walletAddress).toBe(
      '0x2222222222222222222222222222222222222222',
    );
  });

  it('uses Explorer net analytics but official Nado state for the position', async () => {
    const owner = '0x2222222222222222222222222222222222222222';
    const explorer = {
      getLosingSubaccounts: vi
        .fn()
        .mockResolvedValueOnce([row(owner, { pnlUsd: -100 })])
        .mockResolvedValueOnce([row(owner, { pnlUsd: -500 })])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]),
      hasOpenPosition: vi.fn().mockResolvedValue(true),
    };
    const official = {
      getActivePosition: vi.fn().mockResolvedValue({
        symbol: 'BTC-PERP',
        productId: 1,
        side: 'long',
        baseAmount: 0.01,
        notionalUsd: 800,
      }),
    } as unknown as NadoSignalDataSource;

    const result = await loadExplorerNadoSignals(explorer, official, NOW);

    expect(result.status).toBe('live');
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0]).toMatchObject({
      walletAddress: owner,
      symbol: 'BTC-PERP',
      positionSide: 'long',
      performancePnlUsd: -500,
      performanceBasis: 'net',
      volume30dUsd: 50_000,
      analyticsProvider: 'Nado Explorer',
      candidateCount: 1,
    });
    expect(official.getActivePosition).toHaveBeenCalledWith(
      expect.objectContaining({
        subaccountOwner: owner,
        subaccountName: 'default',
      }),
    );
  });

  it('keeps healthy loss bands when one Explorer request fails', async () => {
    const owner = '0x3333333333333333333333333333333333333333';
    const explorer = {
      getLosingSubaccounts: vi
        .fn()
        .mockRejectedValueOnce(new Error('rate limited'))
        .mockResolvedValueOnce([row(owner)])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]),
      hasOpenPosition: vi.fn().mockResolvedValue(true),
    };
    const official = {
      getActivePosition: vi.fn().mockResolvedValue({
        symbol: 'ETH-PERP',
        productId: 3,
        side: 'short',
        baseAmount: 0.1,
        notionalUsd: 300,
      }),
    } as unknown as NadoSignalDataSource;

    const result = await loadExplorerNadoSignals(explorer, official, NOW);

    expect(result.status).toBe('live');
    expect(result.signals[0]?.walletAddress).toBe(owner);
  });
});

function row(
  walletAddress: string,
  overrides: Partial<ExplorerLeaderboardRow> = {},
): ExplorerLeaderboardRow {
  return {
    entityType: 'subaccount',
    entityId: subaccountToHex({
      subaccountOwner: walletAddress,
      subaccountName: 'default',
    }),
    walletAddress,
    subaccount: subaccountToHex({
      subaccountOwner: walletAddress,
      subaccountName: 'default',
    }),
    periodDays: 30,
    periodStart: '2026-08-09',
    periodEnd: '2026-09-07',
    volumeUsd: 50_000,
    pnlUsd: -500,
    feesUsd: 20,
    winRate: 0.3,
    closedTrades: 40,
    activeDays: 20,
    equityUsd: 100,
    roi: -0.5,
    fillCount: 80,
    lastActivityAt: '2026-09-08 12:00:00+00',
    maxDrawdownUsd: 600,
    maxDrawdownPct: 0.6,
    ...overrides,
  };
}
