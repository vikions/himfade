import type { NadoClient } from '@nadohq/client';
import type { PublicEnv } from '@/config/env';
import { getVenueConfigStatus } from '@/config/env';
import type {
  AttributionStatus,
  ClosePositionInput,
  NormalizedAccountState,
  NormalizedMarket,
  NormalizedPosition,
  PrepareOrderInput,
  PreparedOrder,
  SubmittedOrder,
  TradeFill,
} from '@/lib/trading/types';
import type { VenueAdapter } from '@/lib/trading/venue-adapter';
import { reverseSide } from '@/lib/trading/reverse-side';
import { TradingError } from '@/lib/trading/errors';
import { getNadoMarket } from './markets';
import { prepareNadoMarketOrder, submitNadoOrder, waitForNadoFill } from './orders';
import { getNadoAccountState, getNadoPosition } from './positions';

export class NadoAdapter implements VenueAdapter {
  readonly venue = 'nado' as const;
  constructor(
    private readonly client: NadoClient,
    private readonly wallet: string,
    private readonly env: PublicEnv,
  ) {}

  getMarket(symbol: string): Promise<NormalizedMarket> {
    return getNadoMarket(this.client, symbol);
  }

  getAccountState(): Promise<NormalizedAccountState> {
    return getNadoAccountState({
      client: this.client,
      wallet: this.wallet,
      subaccountName: this.env.NEXT_PUBLIC_NADO_SUBACCOUNT_NAME,
    });
  }

  async getPosition(symbol: string): Promise<NormalizedPosition | null> {
    const market = await this.getMarket(symbol);
    if (market.productId === undefined) return null;
    return getNadoPosition({
      client: this.client,
      wallet: this.wallet,
      subaccountName: this.env.NEXT_PUBLIC_NADO_SUBACCOUNT_NAME,
      productId: market.productId,
      symbol: market.symbol,
    });
  }

  async getAttributionStatus(): Promise<AttributionStatus> {
    const status = getVenueConfigStatus(this.env, 'nado');
    return {
      configured: status.ready,
      label: status.ready
        ? `Builder #${this.env.NEXT_PUBLIC_NADO_BUILDER_ID}`
        : `Missing ${status.missing.join(', ')}`,
      details: {
        builderId: this.env.NEXT_PUBLIC_NADO_BUILDER_ID,
        builderFeeRate: this.env.NEXT_PUBLIC_NADO_BUILDER_FEE_RATE_UNITS,
      },
    };
  }

  async prepareMarketOrder(input: PrepareOrderInput): Promise<PreparedOrder> {
    const builderId = this.env.NEXT_PUBLIC_NADO_BUILDER_ID;
    const builderFeeRate = this.env.NEXT_PUBLIC_NADO_BUILDER_FEE_RATE_UNITS;
    if (builderId === undefined || builderFeeRate === undefined) {
      throw new TradingError(
        'MISSING_BUILDER_ID',
        'Nado builder attribution is not configured.',
        'Set both Nado builder environment variables; unattributed orders are disabled.',
      );
    }
    const account = await this.getAccountState();
    if (!account.exists) {
      throw new TradingError(
        'SUBACCOUNT_MISSING',
        'The configured Nado subaccount does not exist.',
        'Create and fund the subaccount with at least the current Nado activation minimum.',
      );
    }
    return prepareNadoMarketOrder({
      client: this.client,
      ...input,
      subaccountName: this.env.NEXT_PUBLIC_NADO_SUBACCOUNT_NAME,
      builderId,
      builderFeeRate,
      exactBaseAmount: input.baseAmount,
    });
  }

  submitMarketOrder(order: PreparedOrder): Promise<SubmittedOrder> {
    return submitNadoOrder(this.client, order);
  }

  waitForFill(submittedOrder: SubmittedOrder): Promise<TradeFill> {
    return waitForNadoFill({ client: this.client, submitted: submittedOrder });
  }

  async closePosition(input: ClosePositionInput): Promise<SubmittedOrder> {
    const position = await this.getPosition(input.symbol);
    if (!position) {
      throw new TradingError(
        'ORDER_REJECTED',
        'There is no Nado position to close.',
        'Refresh account state before retrying.',
      );
    }
    const prepared = await this.prepareMarketOrder({
      symbol: input.symbol,
      side: reverseSide(position.side),
      notionalUsd: position.notionalUsd ?? '0',
      baseAmount: position.baseAmount,
      slippageBps: input.slippageBps,
      reduceOnly: true,
    });
    return this.submitMarketOrder(prepared);
  }
}
