import Decimal from 'decimal.js';
import { z } from 'zod';
import type { PositionSide, PreparedOrder, SubmittedOrder, TradeFill } from '@/lib/trading/types';
import { bpsToPercent, notionalToBaseAmount } from '@/lib/trading/notional';
import { TradingError } from '@/lib/trading/errors';
import type { PacificaApi } from './api';
import { getPacificaMarket } from './markets';
import { buildPacificaOperation, signPacificaOperation, type PacificaSigner } from './signing';

export async function preparePacificaMarketOrder(input: {
  api: PacificaApi;
  symbol: string;
  side: PositionSide;
  notionalUsd: string;
  slippageBps: number;
  builderCode: string;
  reduceOnly?: boolean;
  exactBaseAmount?: string;
}): Promise<PreparedOrder> {
  const market = await getPacificaMarket(input.api, input.symbol);
  const amount = input.exactBaseAmount ?? notionalToBaseAmount(input.notionalUsd, market.price, market.sizeIncrement);
  if (new Decimal(amount).lte(0)) throw new TradingError('AMOUNT_ROUNDS_TO_ZERO', 'The Pacifica amount rounds to zero.', 'Increase the notional.');
  if (new Decimal(amount).mul(market.price).lt(market.minimumNotionalUsd)) {
    throw new TradingError('MINIMUM_ORDER_NOT_MET', `Pacifica requires at least $${market.minimumNotionalUsd}.`, 'Increase the notional.');
  }
  const clientOrderId = crypto.randomUUID();
  const operation = buildPacificaOperation({
    type: 'create_market_order',
    data: {
      symbol: market.symbol,
      amount,
      side: input.side === 'long' ? 'bid' : 'ask',
      slippage_percent: bpsToPercent(input.slippageBps),
      reduce_only: input.reduceOnly ?? false,
      client_order_id: clientOrderId,
      builder_code: input.builderCode,
    },
  });
  return {
    venue: 'pacifica', symbol: market.symbol, side: input.side,
    requestedNotionalUsd: input.notionalUsd, estimatedBaseAmount: amount,
    reduceOnly: input.reduceOnly ?? false,
    attribution: { configured: true, approved: true, label: `Builder ${input.builderCode}`, details: { builderCode: input.builderCode } },
    payload: operation,
    debug: { clientOrderId, price: market.price, signingMessage: operation },
  };
}

export async function submitPacificaOrder(input: {
  api: PacificaApi;
  account: string;
  signMessage: PacificaSigner;
  prepared: PreparedOrder;
}): Promise<SubmittedOrder> {
  const operation = input.prepared.payload as ReturnType<typeof buildPacificaOperation>;
  const body = await signPacificaOperation({ account: input.account, operation, signMessage: input.signMessage });
  const response = await input.api.raw({ method: 'POST', path: '/orders/create_market', body });
  const clientOrderId = String((input.prepared.debug as { clientOrderId: string }).clientOrderId);
  const data = response.data as Record<string, unknown> | undefined;
  return {
    venue: 'pacifica', accepted: response.success !== false,
    orderId: data?.order_id === undefined ? undefined : String(data.order_id),
    clientOrderId, submittedAt: new Date().toISOString(), raw: response,
  };
}

const tradeSchema = z.object({
  order_id: z.union([z.string(), z.number()]), client_order_id: z.string().nullable().optional(),
  symbol: z.string(), amount: z.string(), price: z.string(), fee: z.string(),
  side: z.enum(['open_long', 'open_short', 'close_long', 'close_short']), created_at: z.number(),
}).passthrough();
const historySchema = z.object({ success: z.boolean(), data: z.array(tradeSchema) }).passthrough();

export async function waitForPacificaFill(input: {
  api: PacificaApi; account: string; submitted: SubmittedOrder; builderCode: string; timeoutMs?: number;
}): Promise<TradeFill> {
  const deadline = Date.now() + (input.timeoutMs ?? 30_000);
  while (Date.now() < deadline) {
    const result = await input.api.request({
      path: `/trades/history?account=${encodeURIComponent(input.account)}&builder_code=${encodeURIComponent(input.builderCode)}&limit=100`,
      schema: historySchema,
    });
    const trade = result.data.find((item) => item.client_order_id === input.submitted.clientOrderId);
    if (trade) return {
      venue: 'pacifica', orderId: String(trade.order_id), status: 'filled',
      baseAmount: trade.amount, averagePrice: trade.price,
      notionalUsd: new Decimal(trade.amount).mul(trade.price).toFixed(2), fee: trade.fee,
      filledAt: new Date(trade.created_at).toISOString(), raw: trade,
      builderEvidence: { builderCode: input.builderCode, filteredUserTrade: trade },
    };
    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }
  throw new TradingError('FILL_TIMEOUT', 'Pacifica accepted the request, but no matching builder-filtered fill was confirmed.', 'Check trade history using the client order ID.', input.submitted);
}
