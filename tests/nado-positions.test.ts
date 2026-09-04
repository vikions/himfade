import BigNumber from 'bignumber.js';
import { ProductEngineType } from '@nadohq/shared';
import { describe, expect, it, vi } from 'vitest';
import type { NadoClient } from '@nadohq/client';
import { getNadoPortfolio } from '@/lib/nado/positions';

const X18 = new BigNumber(10).pow(18);

function setup(builderId = 4700) {
  return {
    subaccount: {
      getSubaccountSummary: vi.fn().mockResolvedValue({
        exists: true,
        balances: [
          {
            type: ProductEngineType.PERP,
            productId: 1,
            amount: new BigNumber('-0.0001').times(X18),
            oraclePrice: new BigNumber('100000'),
            vQuoteBalance: new BigNumber('10.05').times(X18),
          },
          {
            type: ProductEngineType.PERP,
            productId: 2,
            amount: new BigNumber(0),
            oraclePrice: new BigNumber('3200'),
            vQuoteBalance: new BigNumber(0),
          },
        ],
      }),
    },
    market: {
      getSymbols: vi.fn().mockResolvedValue({
        symbols: {
          BTC: { productId: 1, symbol: 'BTC' },
          ETH: { productId: 2, symbol: 'ETH' },
        },
      }),
      getHistoricalOrders: vi.fn().mockResolvedValue([
        {
          digest: '0xattributed',
          productId: 1,
          baseFilled: new BigNumber('0.0001').times(X18),
          appendix: { builder: { builderId, builderFeeRate: 1 } },
          builderFee: new BigNumber('0.001').times(X18),
          lastFillTimestamp: new BigNumber(1_757_000_000),
        },
      ]),
    },
  } as unknown as NadoClient;
}

describe('Nado live portfolio', () => {
  it('loads every live perp position independently of the featured market', async () => {
    const portfolio = await getNadoPortfolio({
      client: setup(),
      wallet: '0x0000000000000000000000000000000000000001',
      subaccountName: 'default',
      expectedBuilderId: 4700,
    });

    expect(portfolio.positions).toEqual([
      expect.objectContaining({
        symbol: 'BTC',
        productId: 1,
        side: 'short',
        baseAmount: '0.0001',
        markPrice: '100000',
        breakEvenPrice: '100500',
        notionalUsd: '10.00',
        unrealizedPnlUsd: '0.05',
        attribution: expect.objectContaining({
          status: 'verified',
          digest: '0xattributed',
        }),
      }),
    ]);
  });

  it('reports a mismatched builder instead of claiming attribution', async () => {
    const portfolio = await getNadoPortfolio({
      client: setup(999),
      wallet: '0x0000000000000000000000000000000000000001',
      subaccountName: 'default',
      expectedBuilderId: 4700,
    });

    expect(portfolio.positions[0]!.attribution.status).toBe('mismatch');
  });

  it('keeps positions usable when historical attribution lookup is unavailable', async () => {
    const client = setup();
    vi.mocked(client.market.getHistoricalOrders).mockRejectedValue(
      new Error('forbidden'),
    );

    const portfolio = await getNadoPortfolio({
      client,
      wallet: '0x0000000000000000000000000000000000000001',
      subaccountName: 'default',
      expectedBuilderId: 4700,
    });

    expect(portfolio.positions).toHaveLength(1);
    expect(portfolio.positions[0]!.attribution.status).toBe('unavailable');
  });
});
