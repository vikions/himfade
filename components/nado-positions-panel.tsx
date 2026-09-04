'use client';

import {
  ArrowClockwise,
  CheckCircle,
  SpinnerGap,
  WarningCircle,
} from '@phosphor-icons/react';
import Decimal from 'decimal.js';
import type { NadoManagedPosition, NadoPortfolio } from '@/lib/nado/positions';

function formatUsd(value: string, signed = false) {
  const amount = new Decimal(value);
  const prefix = signed && amount.gt(0) ? '+' : '';
  return `${prefix}$${amount.toFixed(2)}`;
}

function attributionCopy(position: NadoManagedPosition) {
  switch (position.attribution.status) {
    case 'verified':
      return { label: 'Volume attribution verified', tone: 'verified' };
    case 'mismatch':
      return { label: 'Latest fill was not attributed', tone: 'warning' };
    case 'not-found':
      return { label: 'Fill proof is still indexing', tone: 'pending' };
    default:
      return { label: 'Attribution check unavailable', tone: 'pending' };
  }
}

export function NadoPositionsPanel({
  portfolio,
  loading,
  error,
  closingSymbol,
  onRefresh,
  onRequestClose,
}: {
  portfolio: NadoPortfolio | null;
  loading: boolean;
  error?: string;
  closingSymbol?: string;
  onRefresh: () => void;
  onRequestClose: (position: NadoManagedPosition) => void;
}) {
  return (
    <section className="positions-panel" aria-label="Your open Nado positions">
      <div className="positions-heading">
        <div>
          <strong>Your open positions</strong>
          <span>Live Nado account state</span>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          aria-label="Refresh open positions"
        >
          {loading ? (
            <SpinnerGap size={14} className="animate-spin" />
          ) : (
            <ArrowClockwise size={14} />
          )}
          Refresh
        </button>
      </div>

      {error ? (
        <div className="positions-state positions-state-error" role="alert">
          <WarningCircle size={16} />
          <span>{error}</span>
        </div>
      ) : !portfolio && loading ? (
        <div className="positions-state">
          <SpinnerGap size={16} className="animate-spin" />
          <span>Loading positions from Nado…</span>
        </div>
      ) : portfolio?.positions.length ? (
        <div className="position-list">
          {portfolio.positions.map((position) => {
            const pnl = new Decimal(position.unrealizedPnlUsd);
            const proof = attributionCopy(position);
            return (
              <article className="position-row" key={position.productId}>
                <div className="position-summary">
                  <div>
                    <span className={`position-side ${position.side}`}>
                      {position.side.toUpperCase()}
                    </span>
                    <h3>{position.symbol}-PERP</h3>
                  </div>
                  <div className="position-pnl">
                    <span>Unrealized PnL</span>
                    <strong data-tone={pnl.gte(0) ? 'positive' : 'negative'}>
                      {formatUsd(position.unrealizedPnlUsd, true)}
                    </strong>
                  </div>
                </div>
                <dl className="position-metrics">
                  <div>
                    <dt>Position value</dt>
                    <dd>{formatUsd(position.notionalUsd)}</dd>
                  </div>
                  <div>
                    <dt>Size</dt>
                    <dd>{position.baseAmount}</dd>
                  </div>
                  <div>
                    <dt>Mark</dt>
                    <dd>{formatUsd(position.markPrice)}</dd>
                  </div>
                  <div>
                    <dt>Break-even est.</dt>
                    <dd>{formatUsd(position.breakEvenPrice)}</dd>
                  </div>
                </dl>
                <div className="position-footer">
                  <span className={`attribution-proof ${proof.tone}`}>
                    {proof.tone === 'verified' && <CheckCircle size={13} />}
                    {proof.label}
                  </span>
                  <button
                    type="button"
                    className="close-position-action"
                    disabled={Boolean(closingSymbol)}
                    onClick={() => onRequestClose(position)}
                  >
                    {closingSymbol === position.symbol ? (
                      <>
                        <SpinnerGap size={13} className="animate-spin" />{' '}
                        Closing
                      </>
                    ) : (
                      `Close ${position.symbol}`
                    )}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="positions-state">
          <CheckCircle size={16} />
          <span>No open positions. A confirmed fade will appear here.</span>
        </div>
      )}
    </section>
  );
}
