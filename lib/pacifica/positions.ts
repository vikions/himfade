import { z } from 'zod';
import type { NormalizedAccountState, NormalizedPosition } from '@/lib/trading/types';
import type { PacificaApi } from './api';

const accountSchema = z.object({ success: z.boolean(), data: z.object({
  balance: z.string(), account_equity: z.string(), available_to_spend: z.string(), updated_at: z.number(),
}) });
const positionSchema = z.object({ symbol: z.string(), side: z.enum(['bid', 'ask']), amount: z.string(), entry_price: z.string(), updated_at: z.number() }).passthrough();
const positionsSchema = z.object({ success: z.boolean(), data: z.array(positionSchema) }).passthrough();

export async function getPacificaAccountState(api: PacificaApi, account: string): Promise<NormalizedAccountState> {
  const result = await api.request({ path: `/account?account=${encodeURIComponent(account)}`, schema: accountSchema });
  return { wallet: account, exists: true, collateralUsd: result.data.account_equity, availableCollateralUsd: result.data.available_to_spend, raw: result.data };
}

export async function getPacificaPosition(api: PacificaApi, account: string, symbol: string): Promise<NormalizedPosition | null> {
  const result = await api.request({ path: `/positions?account=${encodeURIComponent(account)}`, schema: positionsSchema });
  const position = result.data.find((item) => item.symbol === symbol);
  return position ? { symbol: position.symbol, side: position.side === 'bid' ? 'long' : 'short', baseAmount: position.amount, raw: position } : null;
}
