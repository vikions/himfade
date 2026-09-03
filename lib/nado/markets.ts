import type { NadoClient } from '@nadohq/client';
import { ProductEngineType } from '@nadohq/shared';
import Decimal from 'decimal.js';
import type { NormalizedMarket } from '@/lib/trading/types';
import { TradingError } from '@/lib/trading/errors';

const X18 = new Decimal(10).pow(18);

export function fromNadoX18(value: { toFixed(): string }): string {
  return new Decimal(value.toFixed()).div(X18).toString();
}

export async function getNadoMarket(
  client: NadoClient,
  symbol: string,
): Promise<NormalizedMarket> {
  const symbols = await client.market.getSymbols({
    productType: ProductEngineType.PERP,
  });
  const market = symbols.symbols[symbol.toUpperCase()];
  if (!market) {
    throw new TradingError(
      'MARKET_UNAVAILABLE',
      `${symbol.toUpperCase()} is not available on Nado.`,
      'Choose a symbol returned by the current Nado market metadata.',
    );
  }
  const quote = await client.market.getLatestMarketPrice({
    productId: market.productId,
  });
  const mid = new Decimal(fromNadoX18(quote.bid))
    .plus(fromNadoX18(quote.ask))
    .div(2)
    .toString();
  const sizeIncrement = new Decimal(fromNadoX18(market.sizeIncrement));
  const minimumFeeNotionalUsd = new Decimal(fromNadoX18(market.minSize));
  const minimumBaseAmount = sizeIncrement.toFixed(
    sizeIncrement.decimalPlaces(),
  );
  const minimumNotionalUsd = sizeIncrement
    .mul(mid)
    .toDecimalPlaces(2, Decimal.ROUND_CEIL);
  return {
    venue: 'nado',
    symbol: market.symbol,
    productId: market.productId,
    price: mid,
    priceTimestamp: new Date().toISOString(),
    priceIncrement: fromNadoX18(market.priceIncrement),
    sizeIncrement: sizeIncrement.toString(),
    minimumBaseAmount,
    minimumNotionalUsd: minimumNotionalUsd.toFixed(2),
    minimumFeeNotionalUsd: minimumFeeNotionalUsd.toFixed(2),
    raw: { market, quote },
  };
}
