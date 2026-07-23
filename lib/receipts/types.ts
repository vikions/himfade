import type { PositionSide, TradeIntent, Venue } from '@/lib/trading/types';

export type TradeReceipt = {
  id: string;
  venue: Venue;
  network: string;
  symbol: string;
  side: PositionSide;
  intent: TradeIntent;
  requestedNotionalUsd: string;
  filledNotionalUsd?: string;
  filledBaseAmount?: string;
  averagePrice?: string;
  submittedAt: string;
  filledAt?: string;
  orderId?: string;
  clientOrderId?: string;
  digest?: string;
  builderId?: number;
  builderFeeRate?: number;
  builderCode?: string;
  attributionStatus:
    | 'configured'
    | 'submitted'
    | 'fill-confirmed'
    | 'verified'
    | 'manual-verification-required'
    | 'failed';
  isDemo?: boolean;
  officialEvidence?: unknown;
  sanitizedRawResponse?: unknown;
};
