import type { NadoClient } from '@nadohq/client';
import { ProductEngineType } from '@nadohq/shared';
import Decimal from 'decimal.js';
import type {
  NormalizedAccountState,
  NormalizedPosition,
} from '@/lib/trading/types';
import { fromNadoX18 } from './markets';

export type NadoAttributionProof = {
  status: 'verified' | 'mismatch' | 'not-found' | 'unavailable';
  digest?: string;
  builderFeeUsd?: string;
  filledAt?: string;
};

export type NadoManagedPosition = NormalizedPosition & {
  productId: number;
  markPrice: string;
  breakEvenPrice: string;
  notionalUsd: string;
  unrealizedPnlUsd: string;
  attribution: NadoAttributionProof;
};

export type NadoPortfolio = {
  positions: NadoManagedPosition[];
  refreshedAt: string;
};

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
      item.type === ProductEngineType.PERP &&
      item.productId === input.productId,
  );
  if (!balance || balance.amount.isZero()) return null;
  return {
    symbol: input.symbol,
    side: balance.amount.isPositive() ? 'long' : 'short',
    baseAmount: fromNadoX18(balance.amount.abs()),
    raw: balance,
  };
}

export async function getNadoPortfolio(input: {
  client: NadoClient;
  wallet: string;
  subaccountName: string;
  expectedBuilderId?: number;
}): Promise<NadoPortfolio> {
  const [summary, symbols] = await Promise.all([
    input.client.subaccount.getSubaccountSummary({
      subaccountOwner: input.wallet,
      subaccountName: input.subaccountName,
    }),
    input.client.market.getSymbols({ productType: ProductEngineType.PERP }),
  ]);

  let orders: Awaited<ReturnType<NadoClient['market']['getHistoricalOrders']>> =
    [];
  let attributionAvailable = true;
  try {
    orders = await input.client.market.getHistoricalOrders({
      subaccounts: [
        {
          subaccountOwner: input.wallet,
          subaccountName: input.subaccountName,
        },
      ],
      isolated: false,
      limit: 50,
    });
  } catch {
    attributionAvailable = false;
  }

  const symbolsByProductId = new Map(
    Object.values(symbols.symbols).map((market) => [
      market.productId,
      market.symbol,
    ]),
  );
  const filledOrders = [...orders]
    .filter((order) => !order.baseFilled.isZero())
    .sort((a, b) => b.lastFillTimestamp.comparedTo(a.lastFillTimestamp) ?? 0);

  const positions = summary.balances.flatMap(
    (balance): NadoManagedPosition[] => {
      if (balance.type !== ProductEngineType.PERP || balance.amount.isZero()) {
        return [];
      }
      const symbol = symbolsByProductId.get(balance.productId);
      if (!symbol) return [];
      const baseAmount = fromNadoX18(balance.amount.abs());
      const markPrice = balance.oraclePrice.toFixed();
      const notionalUsd = new Decimal(baseAmount).mul(markPrice).toFixed(2);
      const breakEvenPrice = new Decimal(balance.vQuoteBalance.toFixed())
        .abs()
        .div(balance.amount.abs().toFixed())
        .toString();
      const unrealizedPnlUsd = fromNadoX18(
        balance.amount
          .multipliedBy(balance.oraclePrice)
          .plus(balance.vQuoteBalance),
      );
      const latestOrder = filledOrders.find(
        (order) => order.productId === balance.productId,
      );
      const attribution: NadoAttributionProof = !attributionAvailable
        ? { status: 'unavailable' }
        : !latestOrder
          ? { status: 'not-found' }
          : {
              status:
                input.expectedBuilderId !== undefined &&
                latestOrder.appendix.builder?.builderId ===
                  input.expectedBuilderId
                  ? 'verified'
                  : 'mismatch',
              digest: latestOrder.digest,
              builderFeeUsd: fromNadoX18(latestOrder.builderFee.abs()),
              filledAt: new Date(
                latestOrder.lastFillTimestamp.toNumber() * 1_000,
              ).toISOString(),
            };

      return [
        {
          symbol,
          productId: balance.productId,
          side: balance.amount.isPositive() ? 'long' : 'short',
          baseAmount,
          markPrice,
          breakEvenPrice,
          notionalUsd,
          unrealizedPnlUsd: new Decimal(unrealizedPnlUsd).toFixed(2),
          attribution,
          raw: null,
        },
      ];
    },
  );

  return { positions, refreshedAt: new Date().toISOString() };
}
