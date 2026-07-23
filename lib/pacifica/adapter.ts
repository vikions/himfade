import type { PublicEnv } from '@/config/env';
import { getVenueConfigStatus } from '@/config/env';
import { TradingError } from '@/lib/trading/errors';
import { reverseSide } from '@/lib/trading/reverse-side';
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
import { PacificaApi } from './api';
import {
  getPacificaBuilderApproval,
  isPacificaFeeApprovalSufficient,
} from './builder-approval';
import { getPacificaMarket } from './markets';
import {
  preparePacificaMarketOrder,
  submitPacificaOrder,
  waitForPacificaFill,
} from './orders';
import { getPacificaAccountState, getPacificaPosition } from './positions';
import type { PacificaSigner } from './signing';

export class PacificaAdapter implements VenueAdapter {
  readonly venue = 'pacifica' as const;
  private readonly api: PacificaApi;

  constructor(
    private readonly account: string,
    private readonly signMessage: PacificaSigner,
    private readonly env: PublicEnv,
  ) {
    this.api = new PacificaApi(env.NEXT_PUBLIC_PACIFICA_NETWORK);
  }

  getMarket(symbol: string): Promise<NormalizedMarket> {
    return getPacificaMarket(this.api, symbol);
  }

  getAccountState(): Promise<NormalizedAccountState> {
    return getPacificaAccountState(this.api, this.account);
  }

  getPosition(symbol: string): Promise<NormalizedPosition | null> {
    return getPacificaPosition(this.api, this.account, symbol);
  }

  async getAttributionStatus(): Promise<AttributionStatus> {
    const status = getVenueConfigStatus(this.env, 'pacifica');
    if (!status.ready) {
      return {
        configured: false,
        approved: false,
        label: `Missing ${status.missing.join(', ')}`,
        details: {},
      };
    }
    const builderCode = this.env.NEXT_PUBLIC_PACIFICA_BUILDER_CODE!;
    const required = this.env.NEXT_PUBLIC_PACIFICA_MAX_FEE_RATE!;
    const approval = await getPacificaBuilderApproval({
      api: this.api,
      account: this.account,
      builderCode,
    });
    const sufficient = isPacificaFeeApprovalSufficient(
      approval?.max_fee_rate,
      required,
    );
    return {
      configured: true,
      approved: sufficient,
      label: sufficient ? 'Builder approved' : approval ? 'Approved fee too low' : 'Approval required',
      details: {
        builderCode,
        requiredFee: required,
        approvedMaximum: approval?.max_fee_rate,
      },
    };
  }

  async prepareMarketOrder(input: PrepareOrderInput): Promise<PreparedOrder> {
    const code = this.env.NEXT_PUBLIC_PACIFICA_BUILDER_CODE;
    if (!code) {
      throw new TradingError('MISSING_BUILDER_CODE', 'Pacifica builder code is missing.', 'Configure a registered builder code.');
    }
    const attribution = await this.getAttributionStatus();
    if (!attribution.approved) {
      throw new TradingError(
        'BUILDER_NOT_APPROVED',
        'The Pacifica builder code is not approved at the required fee.',
        'Approve the builder code before signing an order.',
        attribution,
      );
    }
    return preparePacificaMarketOrder({
      api: this.api,
      ...input,
      builderCode: code,
      exactBaseAmount: input.baseAmount,
    });
  }

  submitMarketOrder(prepared: PreparedOrder): Promise<SubmittedOrder> {
    return submitPacificaOrder({
      api: this.api,
      account: this.account,
      signMessage: this.signMessage,
      prepared,
    });
  }

  waitForFill(submitted: SubmittedOrder): Promise<TradeFill> {
    const code = this.env.NEXT_PUBLIC_PACIFICA_BUILDER_CODE;
    if (!code) throw new Error('Pacifica builder code missing.');
    return waitForPacificaFill({
      api: this.api,
      account: this.account,
      submitted,
      builderCode: code,
    });
  }

  async closePosition(input: ClosePositionInput): Promise<SubmittedOrder> {
    const position = await this.getPosition(input.symbol);
    if (!position) throw new TradingError('ORDER_REJECTED', 'There is no Pacifica position to close.', 'Refresh positions.');
    const prepared = await this.prepareMarketOrder({
      symbol: position.symbol,
      side: reverseSide(position.side),
      notionalUsd: position.notionalUsd ?? '0',
      baseAmount: position.baseAmount,
      slippageBps: input.slippageBps,
      reduceOnly: true,
    });
    return this.submitMarketOrder(prepared);
  }
}
