import BigNumber from 'bignumber.js';
import { ProductEngineType } from '@nadohq/shared';
import { describe, expect, it, vi } from 'vitest';
import { NadoSignalSource } from '@/lib/nado/signal-source';

const X18 = new BigNumber(10).pow(18);

describe('Nado signal source normalization', () => {
  it('normalizes perp matches and ignores spot activity', async () => {
    const { source } = setup();
    const matches = await source.getRecentMatches({ limit: 20 });

    expect(matches).toEqual([
      {
        subaccountOwner: '0xactive',
        subaccountName: 'default',
        realizedPnlUsd: -12.5,
        timestamp: 1_750_000_000_000,
        isolated: false,
      },
    ]);
  });

  it('returns the largest verified open perp position with its symbol', async () => {
    const { source } = setup();
    const position = await source.getActivePosition({
      subaccountOwner: '0xactive',
      subaccountName: 'default',
      observedRealizedPnlUsd: -10,
      observedMatchCount: 2,
      lastActivityAt: 1,
    });

    expect(position).toEqual({
      symbol: 'ETH',
      productId: 2,
      side: 'long',
      baseAmount: 0.5,
      notionalUsd: 1_600,
    });
  });

  it('normalizes bounded order and liquidation history', async () => {
    const { source } = setup();
    const history = await source.getPerformanceHistory(
      {
        subaccountOwner: '0xactive',
        subaccountName: 'default',
        observedRealizedPnlUsd: -10,
        observedMatchCount: 2,
        lastActivityAt: 1,
      },
      { since: 1_700_000_000_000, until: 1_800_000_000_000, maxRecords: 50 },
    );

    expect(history).toEqual({
      orders: [
        {
          timestamp: 1_750_000_000_000,
          realizedPnlUsd: -9.25,
          closedAmount: 0.1,
        },
      ],
      liquidationTimestamps: [1_740_000_000_000],
      historyComplete: true,
    });
  });
});

function setup() {
  const indexer = {
    getMatchEvents: vi.fn().mockResolvedValue([
      {
        subaccountOwner: '0xactive',
        subaccountName: 'default',
        realizedPnl: new BigNumber('-12.5').times(X18),
        timestamp: new BigNumber(1_750_000_000),
        isolated: false,
        postBalances: { base: { type: ProductEngineType.PERP } },
      },
      {
        subaccountOwner: '0xspot',
        subaccountName: 'default',
        realizedPnl: new BigNumber(-99).times(X18),
        timestamp: new BigNumber(1_750_000_000),
        isolated: false,
        postBalances: { base: { type: ProductEngineType.SPOT } },
      },
    ]),
    getPaginatedSubaccountOrders: vi.fn().mockResolvedValue({
      orders: [
        {
          lastFillTimestamp: new BigNumber(1_750_000_000),
          realizedPnl: new BigNumber('-9.25').times(X18),
          closedAmount: new BigNumber('0.1').times(X18),
        },
      ],
      meta: { hasMore: false },
    }),
    getPaginatedSubaccountLiquidationEvents: vi.fn().mockResolvedValue({
      events: [{ timestamp: new BigNumber(1_740_000_000) }],
      meta: { hasMore: false },
    }),
  };
  const client = {
    subaccount: {
      getSubaccountSummary: vi.fn().mockResolvedValue({
        exists: true,
        balances: [
          {
            type: ProductEngineType.PERP,
            productId: 2,
            amount: new BigNumber('0.5').times(X18),
            oraclePrice: new BigNumber(3_200),
          },
          {
            type: ProductEngineType.PERP,
            productId: 4,
            amount: new BigNumber(0),
            oraclePrice: new BigNumber(100),
          },
        ],
      }),
    },
    market: {
      getSymbols: vi.fn().mockResolvedValue({
        symbols: { ETH: { productId: 2 }, SOL: { productId: 4 } },
      }),
    },
  };

  return {
    source: new NadoSignalSource(indexer as never, client as never),
  };
}
