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
  Venue,
} from './types';

export interface VenueAdapter {
  readonly venue: Venue;
  getMarket(symbol: string): Promise<NormalizedMarket>;
  getAccountState(): Promise<NormalizedAccountState>;
  getPosition(symbol: string): Promise<NormalizedPosition | null>;
  getAttributionStatus(): Promise<AttributionStatus>;
  prepareMarketOrder(input: PrepareOrderInput): Promise<PreparedOrder>;
  submitMarketOrder(order: PreparedOrder): Promise<SubmittedOrder>;
  waitForFill(submittedOrder: SubmittedOrder): Promise<TradeFill>;
  closePosition(input: ClosePositionInput): Promise<SubmittedOrder>;
}
