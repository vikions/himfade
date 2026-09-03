export type TradingErrorCode =
  | 'WALLET_NOT_CONNECTED'
  | 'INCORRECT_NETWORK'
  | 'SIGN_MESSAGE_UNSUPPORTED'
  | 'USER_REJECTED_SIGNATURE'
  | 'SUBACCOUNT_MISSING'
  | 'INSUFFICIENT_COLLATERAL'
  | 'MISSING_BUILDER_ID'
  | 'MISSING_BUILDER_CODE'
  | 'INVALID_BUILDER'
  | 'BUILDER_NOT_APPROVED'
  | 'APPROVED_FEE_TOO_LOW'
  | 'MINIMUM_ORDER_NOT_MET'
  | 'AMOUNT_ROUNDS_TO_ZERO'
  | 'MARKET_UNAVAILABLE'
  | 'STALE_PRICE'
  | 'API_RATE_LIMIT'
  | 'ORDER_REJECTED'
  | 'FILL_TIMEOUT'
  | 'PARTIAL_FILL'
  | 'NETWORK_FAILURE'
  | 'MALFORMED_PROTOCOL_RESPONSE'
  | 'LIVE_TRADING_DISABLED';

export class TradingError extends Error {
  constructor(
    readonly code: TradingErrorCode,
    message: string,
    readonly nextAction: string,
    readonly technicalDetails?: unknown,
  ) {
    super(message);
    this.name = 'TradingError';
  }
}

export function toTradingError(error: unknown): TradingError {
  if (error instanceof TradingError) return error;
  const message =
    error instanceof Error ? error.message : 'Unknown protocol error';
  if (/rejected|denied/i.test(message))
    return new TradingError(
      'USER_REJECTED_SIGNATURE',
      'The wallet signature was rejected.',
      'Review the order and try again when ready.',
      message,
    );
  if (/2118|InvalidBuilder/i.test(message))
    return new TradingError(
      'INVALID_BUILDER',
      'Nado could not accept this order.',
      'Please wait a moment and try again.',
      message,
    );
  return new TradingError(
    'NETWORK_FAILURE',
    'The venue request could not be completed.',
    'Check your connection and try again.',
    message,
  );
}
