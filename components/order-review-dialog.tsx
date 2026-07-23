'use client';

import { X } from '@phosphor-icons/react';
import type { PreparedOrder } from '@/lib/trading/types';

export function OrderReviewDialog({
  order,
  targetSide,
  slippageBps,
  onCancel,
  onConfirm,
  pending,
}: {
  order: PreparedOrder;
  targetSide: 'long' | 'short';
  slippageBps: number;
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <section className="review-dialog" role="dialog" aria-modal="true" aria-labelledby="review-title">
        <button className="dialog-close" aria-label="Close review" onClick={onCancel}><X size={18} /></button>
        <p className="eyebrow">Signature checkpoint</p>
        <h2 id="review-title">Review the fade.</h2>
        <dl>
          <div><dt>Venue</dt><dd>{order.venue.toUpperCase()}</dd></div>
          <div><dt>Target direction</dt><dd>{targetSide.toUpperCase()}</dd></div>
          <div><dt>Your inverse</dt><dd>{order.side.toUpperCase()} {order.symbol}</dd></div>
          <div><dt>USD notional</dt><dd>${order.requestedNotionalUsd}</dd></div>
          <div><dt>Estimated amount</dt><dd>{order.estimatedBaseAmount} {order.symbol}</dd></div>
          <div><dt>Order type</dt><dd>{order.venue === 'nado' ? 'IOC aggressive limit' : 'Market'}</dd></div>
          <div><dt>Reduce only</dt><dd>{order.reduceOnly ? 'Yes' : 'No'}</dd></div>
          <div><dt>Slippage</dt><dd>{slippageBps} bps</dd></div>
          <div><dt>Attribution</dt><dd>{order.attribution.label}</dd></div>
        </dl>
        <div className="review-warning">The final execution price may differ. Your wallet will show the signature request next.</div>
        <div className="dialog-actions">
          <button className="secondary-action" onClick={onCancel} disabled={pending}>Cancel</button>
          <button className="primary-action" onClick={onConfirm} disabled={pending}>{pending ? 'Working…' : 'Confirm and sign'}</button>
        </div>
      </section>
    </div>
  );
}
