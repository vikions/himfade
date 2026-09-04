'use client';

import Decimal from 'decimal.js';
import type { PositionSide, Venue } from '@/lib/trading/types';

export function FadeTicket({
  signalReady,
  targetSide,
  fadeSide,
  symbol,
  venue,
  notional,
  onNotionalChange,
  price,
  estimatedAmount,
  minimumOrder,
  availablePosition,
  accountEquity,
  minimumFeeNotional,
  errors,
}: {
  signalReady: boolean;
  targetSide: PositionSide;
  fadeSide: PositionSide;
  symbol: string;
  venue: Venue;
  notional: string;
  onNotionalChange: (value: string) => void;
  price: string;
  estimatedAmount: string;
  minimumOrder: string;
  availablePosition?: string;
  accountEquity?: string;
  minimumFeeNotional?: string;
  errors: string[];
}) {
  const leverage = (() => {
    try {
      if (!accountEquity || !new Decimal(accountEquity).isPositive())
        return '—';
      return `${new Decimal(notional || 0).div(accountEquity).toFixed(2)}×`;
    } catch {
      return '—';
    }
  })();
  const applyPreset = (ratio: string) => {
    if (!availablePosition) return;
    onNotionalChange(
      new Decimal(availablePosition)
        .mul(ratio)
        .toDecimalPlaces(2, Decimal.ROUND_DOWN)
        .toString(),
    );
  };

  return (
    <div className="ticket-fields">
      <div className="trade-equation">
        {signalReady ? (
          <>
            <div>
              <span>Target</span>
              <strong>
                {targetSide.toUpperCase()} {symbol}
              </strong>
            </div>
            <div className="equation-line" />
            <div>
              <span>Your fade</span>
              <strong>
                {fadeSide.toUpperCase()} {symbol}
              </strong>
            </div>
          </>
        ) : (
          <div className="signal-waiting">
            <span>Target</span>
            <strong>Waiting for a verified open position</strong>
          </div>
        )}
      </div>
      <label className="input-block">
        <span>USD NOTIONAL</span>
        <div className="notional-input">
          <b>$</b>
          <input
            aria-label="USD notional"
            inputMode="decimal"
            value={notional}
            disabled={!signalReady}
            onChange={(event) => onNotionalChange(event.target.value)}
          />
        </div>
        <div className="size-presets" aria-label="Position size presets">
          <button
            type="button"
            disabled={!signalReady || !availablePosition}
            onClick={() => applyPreset('0.25')}
          >
            25%
          </button>
          <button
            type="button"
            disabled={!signalReady || !availablePosition}
            onClick={() => applyPreset('0.5')}
          >
            50%
          </button>
          <button
            type="button"
            disabled={!signalReady || !availablePosition}
            onClick={() => applyPreset('1')}
          >
            MAX
          </button>
        </div>
        <small>
          {availablePosition
            ? `Choose any amount up to $${availablePosition}.`
            : 'Connect and fund your account to calculate your limit.'}
        </small>
      </label>
      <dl className="review-metrics">
        <div>
          <dt>Current reference price</dt>
          <dd>{price === 'Loading' ? price : `$${price}`}</dd>
        </div>
        <div>
          <dt>Estimated base amount</dt>
          <dd>
            {estimatedAmount} {symbol}
          </dd>
        </div>
        <div>
          <dt>Minimum executable</dt>
          <dd>{minimumOrder}</dd>
        </div>
        <div>
          <dt>Estimated leverage</dt>
          <dd>{leverage}</dd>
        </div>
        {minimumFeeNotional && (
          <div>
            <dt>Trading fee basis</dt>
            <dd>At least ${minimumFeeNotional}</dd>
          </div>
        )}
        <div>
          <dt>Execution</dt>
          <dd>{venue === 'nado' ? 'Aggressive IOC' : 'Market order'}</dd>
        </div>
      </dl>
      {errors.length > 0 && (
        <div className="inline-errors" role="alert">
          {errors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      )}
    </div>
  );
}
