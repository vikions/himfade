import Decimal from 'decimal.js';
import { z } from 'zod';
import type { NormalizedMarket } from '@/lib/trading/types';
import { TradingError } from '@/lib/trading/errors';
import type { PacificaApi } from './api';

const marketSchema = z.object({
  symbol: z.string(),
  tick_size: z.string(),
  lot_size: z.string(),
  min_order_size: z.string(),
  max_order_size: z.string(),
  max_leverage: z.number(),
  isolated_only: z.boolean(),
});
const infoSchema = z.object({ success: z.boolean(), data: z.array(marketSchema) });
const levelSchema = z.object({ p: z.string(), a: z.string(), n: z.number() });
const bookSchema = z.object({
  success: z.boolean(),
  data: z.object({ s: z.string(), l: z.tuple([z.array(levelSchema), z.array(levelSchema)]), t: z.number() }),
});

export async function getPacificaMarket(
  api: PacificaApi,
  symbol: string,
): Promise<NormalizedMarket> {
  const info = await api.request({ path: '/info', schema: infoSchema });
  const market = info.data.find((item) => item.symbol === symbol);
  if (!market) {
    throw new TradingError(
      'MARKET_UNAVAILABLE',
      `${symbol} is not available on Pacifica.`,
      'Use the exact case-sensitive symbol returned by Pacifica.',
    );
  }
  const book = await api.request({
    path: `/book?symbol=${encodeURIComponent(market.symbol)}`,
    schema: bookSchema,
  });
  const bid = book.data.l[0][0]?.p;
  const ask = book.data.l[1][0]?.p;
  if (!bid || !ask) throw new TradingError('MARKET_UNAVAILABLE', 'Pacifica book has no two-sided price.', 'Wait for market liquidity.');
  const price = new Decimal(bid).plus(ask).div(2).toString();
  return {
    venue: 'pacifica',
    symbol: market.symbol,
    price,
    priceTimestamp: new Date(book.data.t).toISOString(),
    priceIncrement: market.tick_size,
    sizeIncrement: market.lot_size,
    minimumBaseAmount: new Decimal(market.min_order_size).div(price).toString(),
    minimumNotionalUsd: market.min_order_size,
    raw: { market, book: book.data },
  };
}
