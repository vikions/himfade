export type Venue = 'nado' | 'pacifica';
export type PositionSide = 'long' | 'short';
export type TradeIntent = 'open' | 'close';

export type NormalizedMarket = {
  venue: Venue;
  symbol: string;
  productId?: number;
  price: string;
  priceTimestamp: string;
  priceIncrement: string;
  sizeIncrement: string;
  minimumBaseAmount: string;
  minimumNotionalUsd: string;
  minimumFeeNotionalUsd?: string;
  raw: unknown;
};

export type NormalizedAccountState = {
  wallet: string;
  exists: boolean;
  collateralUsd?: string;
  availableCollateralUsd?: string;
  raw: unknown;
};

export type NormalizedPosition = {
  symbol: string;
  side: PositionSide;
  baseAmount: string;
  notionalUsd?: string;
  raw: unknown;
};

export type AttributionStatus = {
  configured: boolean;
  approved?: boolean;
  label: string;
  details: Record<string, string | number | boolean | undefined>;
};

export type PrepareOrderInput = {
  symbol: string;
  side: PositionSide;
  notionalUsd: string;
  slippageBps: number;
  reduceOnly?: boolean;
  baseAmount?: string;
};

export type PreparedOrder = {
  venue: Venue;
  symbol: string;
  side: PositionSide;
  requestedNotionalUsd: string;
  estimatedBaseAmount: string;
  reduceOnly: boolean;
  attribution: AttributionStatus;
  payload: unknown;
  debug: unknown;
};

export type SubmittedOrder = {
  venue: Venue;
  orderId?: string;
  clientOrderId?: string;
  digest?: string;
  accepted: boolean;
  submittedAt: string;
  raw: unknown;
};

export type TradeFill = {
  venue: Venue;
  orderId?: string;
  digest?: string;
  status: 'partial' | 'filled';
  baseAmount: string;
  averagePrice: string;
  notionalUsd: string;
  fee?: string;
  builderEvidence?: unknown;
  filledAt: string;
  raw: unknown;
};

export type ClosePositionInput = {
  symbol: string;
  slippageBps: number;
};
