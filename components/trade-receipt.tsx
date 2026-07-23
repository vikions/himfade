'use client';

import Link from 'next/link';
import { ArrowRight, Check, Copy } from '@phosphor-icons/react';
import type { TradeReceipt as TradeReceiptType } from '@/lib/receipts/types';

export function TradeReceipt({ receipt, onClosePosition, closing }: { receipt: TradeReceiptType; onClosePosition?: () => void; closing?: boolean }) {
  return (
    <section className="trade-receipt" aria-live="polite">
      <div className="receipt-heading"><span><Check size={17} weight="bold" /></span><div><p>{receipt.isDemo ? 'Demo sequence complete' : 'Fill receipt'}</p><small>{receipt.venue.toUpperCase()} · {receipt.intent.toUpperCase()}</small></div></div>
      {receipt.isDemo && <div className="demo-stamp">DEMO — NOT PROTOCOL PROOF</div>}
      <dl>
        <div><dt>Side</dt><dd>{receipt.side.toUpperCase()} {receipt.symbol}</dd></div>
        <div><dt>Requested</dt><dd>${receipt.requestedNotionalUsd}</dd></div>
        <div><dt>Filled</dt><dd>{receipt.filledNotionalUsd ? `$${receipt.filledNotionalUsd}` : 'Not confirmed'}</dd></div>
        <div><dt>Order ID</dt><dd>{receipt.orderId ?? receipt.digest ?? 'Demo only'}</dd></div>
        <div><dt>Attribution state</dt><dd>{receipt.attributionStatus.replaceAll('-', ' ')}</dd></div>
      </dl>
      <div className="receipt-actions">
        {onClosePosition && !receipt.isDemo && <button className="secondary-action" onClick={onClosePosition} disabled={closing}>{closing ? 'Closing…' : `Close ${receipt.venue.toUpperCase()} fade`}</button>}
        <button className="icon-action" title="Copy receipt diagnostics" onClick={() => navigator.clipboard.writeText(JSON.stringify(receipt, null, 2))}><Copy size={16} /></button>
        <Link href="/proof">Open proof <ArrowRight size={14} /></Link>
      </div>
    </section>
  );
}
