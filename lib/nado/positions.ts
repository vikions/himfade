import type { NadoClient } from '@nadohq/client';
import { ProductEngineType } from '@nadohq/shared';
import type {
  NormalizedAccountState,
  NormalizedPosition,
} from '@/lib/trading/types';
import { fromNadoX18 } from './markets';

export async function getNadoAccountState(input: {
  client: NadoClient;
  wallet: string;
  subaccountName: string;
}): Promise<NormalizedAccountState> {
  const summary = await input.client.subaccount.getSubaccountSummary({
    subaccountOwner: input.wallet,
    subaccountName: input.subaccountName,
  });
  return {
    wallet: input.wallet,
    exists: summary.exists,
    raw: summary,
  };
}

export async function getNadoPosition(input: {
  client: NadoClient;
  wallet: string;
  subaccountName: string;
  productId: number;
  symbol: string;
}): Promise<NormalizedPosition | null> {
  const summary = await input.client.subaccount.getSubaccountSummary({
    subaccountOwner: input.wallet,
    subaccountName: input.subaccountName,
  });
  const balance = summary.balances.find(
    (item) =>
      item.type === ProductEngineType.PERP && item.productId === input.productId,
  );
  if (!balance || balance.amount.isZero()) return null;
  return {
    symbol: input.symbol,
    side: balance.amount.isPositive() ? 'long' : 'short',
    baseAmount: fromNadoX18(balance.amount.abs()),
    raw: balance,
  };
}
