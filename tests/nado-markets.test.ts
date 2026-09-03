import BigNumber from 'bignumber.js';
import { describe, expect, it, vi } from 'vitest';
import type { NadoClient } from '@nadohq/client';
import { getNadoMarket } from '@/lib/nado/markets';
import { decodeNadoAppendix } from '@/lib/nado/appendix';
import {
  prepareNadoMarketOrder,
  type NadoPreparedPayload,
} from '@/lib/nado/orders';

function nadoClient(): NadoClient {
  const x18 = new BigNumber(10).pow(18);
  return {
    market: {
      getSymbols: vi.fn().mockResolvedValue({
        symbols: {
          ETH: {
            symbol: 'ETH',
            productId: 2,
            priceIncrement: new BigNumber('0.1').multipliedBy(x18),
            sizeIncrement: new BigNumber('0.0001').multipliedBy(x18),
            minSize: new BigNumber('10').multipliedBy(x18),
          },
        },
      }),
      getLatestMarketPrice: vi.fn().mockResolvedValue({
        bid: new BigNumber('3199').multipliedBy(x18),
        ask: new BigNumber('3201').multipliedBy(x18),
      }),
    },
  } as unknown as NadoClient;
}

describe('Nado market metadata', () => {
  it('uses one base increment as the IOC floor and keeps minSize as fee basis', async () => {
    const market = await getNadoMarket(nadoClient(), 'ETH');

    expect(market.minimumNotionalUsd).toBe('0.32');
    expect(market.minimumBaseAmount).toBe('0.0001');
    expect(market.minimumFeeNotionalUsd).toBe('10.00');
  });

  it('prepares a sub-minSize IOC order when it clears one market increment', async () => {
    const prepared = await prepareNadoMarketOrder({
      client: nadoClient(),
      symbol: 'ETH',
      side: 'short',
      notionalUsd: '5',
      slippageBps: 100,
      subaccountName: 'default',
      builderId: 4242,
      builderFeeRate: 7,
    });

    expect(prepared.estimatedBaseAmount).toBe('0.0015');
  });

  it('puts the configured Builder ID on both opening and reduce-only closing orders', async () => {
    const client = nadoClient();
    const open = await prepareNadoMarketOrder({
      client,
      symbol: 'ETH',
      side: 'short',
      notionalUsd: '20',
      slippageBps: 100,
      subaccountName: 'default',
      builderId: 4242,
      builderFeeRate: 7,
    });
    const close = await prepareNadoMarketOrder({
      client,
      symbol: 'ETH',
      side: 'long',
      notionalUsd: '20',
      slippageBps: 100,
      subaccountName: 'default',
      builderId: 4242,
      builderFeeRate: 7,
      reduceOnly: true,
      exactBaseAmount: '0.0063',
    });

    const openAppendix = (open.payload as NadoPreparedPayload).order.appendix;
    const closeAppendix = (close.payload as NadoPreparedPayload).order.appendix;
    expect(decodeNadoAppendix(BigInt(openAppendix.toString()))).toMatchObject({
      builderId: 4242,
      builderFeeRate: 7,
      reduceOnly: false,
      orderExecutionType: 'ioc',
    });
    expect(decodeNadoAppendix(BigInt(closeAppendix.toString()))).toMatchObject({
      builderId: 4242,
      builderFeeRate: 7,
      reduceOnly: true,
      orderExecutionType: 'ioc',
    });
  });
});
