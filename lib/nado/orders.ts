import type { NadoClient, PlaceOrderParams } from '@nadohq/client';
import BigNumber from 'bignumber.js';
import Decimal from 'decimal.js';
import { nowInSeconds } from '@nadohq/shared';
import type {
  PositionSide,
  PreparedOrder,
  SubmittedOrder,
  TradeFill,
} from '@/lib/trading/types';
import { TradingError } from '@/lib/trading/errors';
import { calculateNotional, notionalToBaseAmount } from '@/lib/trading/notional';
import { buildNadoAppendix, decodeNadoAppendix } from './appendix';
import { fromNadoX18, getNadoMarket } from './markets';

const X18 = new Decimal(10).pow(18);

function toNadoX18(value: string): BigNumber {
  return new BigNumber(new Decimal(value).mul(X18).toFixed(0, Decimal.ROUND_DOWN));
}

export type NadoPreparedPayload = PlaceOrderParams & { digestHint?: string };

export async function prepareNadoMarketOrder(input: {
  client: NadoClient;
  symbol: string;
  side: PositionSide;
  notionalUsd: string;
  slippageBps: number;
  subaccountName: string;
  builderId: number;
  builderFeeRate: number;
  reduceOnly?: boolean;
  exactBaseAmount?: string;
}): Promise<PreparedOrder> {
  const market = await getNadoMarket(input.client, input.symbol);
  if (market.productId === undefined) throw new Error('Nado product ID missing.');
  const quote = (market.raw as { quote: { bid: BigNumber; ask: BigNumber } }).quote;
  const priceRaw = input.side === 'long' ? quote.ask : quote.bid;
  const slippage = new BigNumber(input.slippageBps).div(10_000);
  const aggressivePrice = input.side === 'long'
    ? priceRaw.multipliedBy(new BigNumber(1).plus(slippage))
    : priceRaw.multipliedBy(new BigNumber(1).minus(slippage));
  const priceIncrement = toNadoX18(market.priceIncrement);
  const price = aggressivePrice
    .div(priceIncrement)
    .integerValue(input.side === 'long' ? BigNumber.ROUND_CEIL : BigNumber.ROUND_FLOOR)
    .multipliedBy(priceIncrement);
  const baseAmount = input.exactBaseAmount ?? notionalToBaseAmount(
    input.notionalUsd,
    fromNadoX18(priceRaw),
    market.sizeIncrement,
  );
  if (new Decimal(baseAmount).lte(0)) {
    throw new TradingError(
      'AMOUNT_ROUNDS_TO_ZERO',
      'The Nado order rounds to zero at the current size increment.',
      'Increase the notional amount.',
    );
  }
  if (new Decimal(baseAmount).lt(market.minimumBaseAmount)) {
    throw new TradingError(
      'MINIMUM_ORDER_NOT_MET',
      `Nado requires at least ${market.minimumBaseAmount} ${market.symbol}.`,
      `Increase the notional above approximately $${market.minimumNotionalUsd}.`,
    );
  }
  const appendix = buildNadoAppendix({
    builderId: input.builderId,
    builderFeeRate: input.builderFeeRate,
    reduceOnly: input.reduceOnly,
    orderExecutionType: 'ioc',
  });
  const signedAmount = toNadoX18(baseAmount).multipliedBy(
    input.side === 'long' ? 1 : -1,
  );
  const payload: NadoPreparedPayload = {
    productId: market.productId,
    order: {
      subaccountName: input.subaccountName,
      expiration: nowInSeconds() + 60,
      appendix,
      price,
      amount: signedAmount,
    },
  };
  return {
    venue: 'nado',
    symbol: market.symbol,
    side: input.side,
    requestedNotionalUsd: input.notionalUsd,
    estimatedBaseAmount: baseAmount,
    reduceOnly: input.reduceOnly ?? false,
    attribution: {
      configured: true,
      label: `Builder #${input.builderId} · ${input.builderFeeRate} units`,
      details: {
        builderId: input.builderId,
        builderFeeRate: input.builderFeeRate,
      },
    },
    payload,
    debug: {
      productId: market.productId,
      aggressiveLimitPrice: fromNadoX18(price),
      notionalAfterRounding: calculateNotional(baseAmount, fromNadoX18(priceRaw)),
      decodedAppendix: decodeNadoAppendix(appendix),
    },
  };
}

export async function submitNadoOrder(
  client: NadoClient,
  prepared: PreparedOrder,
): Promise<SubmittedOrder> {
  if (prepared.venue !== 'nado') throw new Error('Wrong venue payload.');
  const result = await client.market.placeOrder(prepared.payload as NadoPreparedPayload);
  if (result.data.error) {
    throw new TradingError(
      'ORDER_REJECTED',
      result.data.error,
      'Review Nado order parameters and collateral.',
      result,
    );
  }
  return {
    venue: 'nado',
    digest: result.data.digest,
    accepted: true,
    submittedAt: new Date().toISOString(),
    raw: result,
  };
}

export async function waitForNadoFill(input: {
  client: NadoClient;
  submitted: SubmittedOrder;
  timeoutMs?: number;
}): Promise<TradeFill> {
  if (!input.submitted.digest) throw new Error('Nado digest missing.');
  const deadline = Date.now() + (input.timeoutMs ?? 30_000);
  while (Date.now() < deadline) {
    const orders = await input.client.market.getHistoricalOrders({
      digests: [input.submitted.digest],
      limit: 1,
    });
    const order = orders[0];
    if (order && !order.baseFilled.isZero()) {
      const base = fromNadoX18(order.baseFilled.abs());
      const quote = fromNadoX18(order.quoteFilled.abs());
      const averagePrice = new Decimal(quote).div(base).toString();
      const requested = fromNadoX18(order.amount.abs());
      return {
        venue: 'nado',
        digest: order.digest,
        status: new Decimal(base).gte(requested) ? 'filled' : 'partial',
        baseAmount: base,
        averagePrice,
        notionalUsd: new Decimal(base).mul(averagePrice).toFixed(2),
        fee: fromNadoX18(order.totalFee.abs()),
        builderEvidence: {
          builderFee: fromNadoX18(order.builderFee.abs()),
          appendix: order.appendix,
        },
        filledAt: new Date(order.lastFillTimestamp.toNumber() * 1000).toISOString(),
        raw: order,
      };
    }
    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }
  throw new TradingError(
    'FILL_TIMEOUT',
    'Nado accepted the order, but no fill was confirmed before timeout.',
    'Check the digest in Nado history before placing another order.',
    { digest: input.submitted.digest },
  );
}
