'use client';

import { X } from '@phosphor-icons/react';
import type { NadoManagedPosition } from '@/lib/nado/positions';

export function ClosePositionDialog({
  position,
  pending,
  onCancel,
  onConfirm,
}: {
  position: NadoManagedPosition;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) =>
        event.target === event.currentTarget && !pending && onCancel()
      }
    >
      <section
        className="review-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="close-position-title"
        onKeyDown={(event) => event.key === 'Escape' && !pending && onCancel()}
      >
        <button
          className="dialog-close"
          aria-label="Cancel close"
          onClick={onCancel}
        >
          <X size={18} />
        </button>
        <p className="eyebrow">Reduce-only checkpoint</p>
        <h2 id="close-position-title">Close this position?</h2>
        <dl>
          <div>
            <dt>Market</dt>
            <dd>{position.symbol}-PERP</dd>
          </div>
          <div>
            <dt>Current side</dt>
            <dd>{position.side.toUpperCase()}</dd>
          </div>
          <div>
            <dt>Size to close</dt>
            <dd>{position.baseAmount}</dd>
          </div>
          <div>
            <dt>Position value</dt>
            <dd>${position.notionalUsd}</dd>
          </div>
          <div>
            <dt>Order protection</dt>
            <dd>Reduce only</dd>
          </div>
        </dl>
        <div className="review-warning">
          This signs an IOC order for the full live position. It cannot increase
          or reverse your exposure.
        </div>
        <div className="dialog-actions">
          <button
            className="secondary-action"
            onClick={onCancel}
            disabled={pending}
            autoFocus
          >
            Keep position
          </button>
          <button
            className="danger-action"
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? 'Waiting for wallet…' : 'Close and sign'}
          </button>
        </div>
      </section>
    </div>
  );
}
