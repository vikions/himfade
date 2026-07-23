'use client';

import type { PositionSide, Venue } from '@/lib/trading/types';

export function FadeTicket({
  targetSide,
  fadeSide,
  symbol,
  venue,
  notional,
  onNotionalChange,
  price,
  estimatedAmount,
  minimumOrder,
  attribution,
  errors,
}: {
  targetSide: PositionSide;
  fadeSide: PositionSide;
  symbol: string;
  venue: Venue;
  notional: string;
  onNotionalChange: (value: string) => void;
  price: string;
  estimatedAmount: string;
  minimumOrder: string;
  attribution: string;
  errors: string[];
}) {
  return (
    <div className="ticket-fields">
      <div className="trade-equation">
        <div><span>Target</span><strong>{targetSide.toUpperCase()} {symbol}</strong></div>
        <div className="equation-line" />
        <div><span>Your fade</span><strong>{fadeSide.toUpperCase()} {symbol}</strong></div>
      </div>
      <label className="input-block">
        <span>USD NOTIONAL</span>
        <div className="notional-input"><b>$</b><input aria-label="USD notional" inputMode="decimal" value={notional} onChange={(event) => onNotionalChange(event.target.value)} /></div>
        <small>Maximum configured MVP size applies.</small>
      </label>
      <dl className="review-metrics">
        <div><dt>Current reference price</dt><dd>${price}</dd></div>
        <div><dt>Estimated base amount</dt><dd>{estimatedAmount} {symbol}</dd></div>
        <div><dt>Venue minimum</dt><dd>{minimumOrder}</dd></div>
        <div><dt>Builder attribution</dt><dd>{attribution}</dd></div>
        <div><dt>Execution</dt><dd>{venue === 'nado' ? 'Aggressive IOC' : 'Market order'}</dd></div>
      </dl>
      {errors.length > 0 && <div className="inline-errors" role="alert">{errors.map((error) => <p key={error}>{error}</p>)}</div>}
    </div>
  );
}
