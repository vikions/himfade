'use client';

import { X } from '@phosphor-icons/react';

export function WithdrawalReviewDialog({
  amount,
  pending,
  onCancel,
  onConfirm,
}: {
  amount: string;
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
        aria-labelledby="withdrawal-title"
        onKeyDown={(event) => event.key === 'Escape' && !pending && onCancel()}
      >
        <button
          className="dialog-close"
          aria-label="Cancel withdrawal"
          onClick={onCancel}
        >
          <X size={18} />
        </button>
        <p className="eyebrow">Collateral checkpoint</p>
        <h2 id="withdrawal-title">Withdraw ${amount}?</h2>
        <dl>
          <div>
            <dt>From</dt>
            <dd>Nado trading balance</dd>
          </div>
          <div>
            <dt>To</dt>
            <dd>Connected Ink wallet</dd>
          </div>
          <div>
            <dt>Asset</dt>
            <dd>USDT0</dd>
          </div>
          <div>
            <dt>Amount</dt>
            <dd>${amount}</dd>
          </div>
        </dl>
        <div className="review-warning">
          Open positions reduce the amount Nado allows you to withdraw. The live
          maximum is checked again before signature.
        </div>
        <div className="dialog-actions">
          <button
            className="secondary-action"
            onClick={onCancel}
            disabled={pending}
            autoFocus
          >
            Cancel
          </button>
          <button
            className="primary-action"
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? 'Waiting for wallet…' : 'Withdraw and sign'}
          </button>
        </div>
      </section>
    </div>
  );
}
