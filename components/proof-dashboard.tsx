'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Minus } from '@phosphor-icons/react';
import type { PublicEnv } from '@/config/env';
import { loadReceipts } from '@/lib/receipts/storage';
import type { TradeReceipt } from '@/lib/receipts/types';

function latestLive(receipts: TradeReceipt[], venue: 'nado' | 'pacifica') {
  return receipts.find((receipt) => receipt.venue === venue && !receipt.isDemo);
}

function EvidenceRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="proof-row">
      <dt>{label}</dt>
      <dd>{value ?? '—'}</dd>
    </div>
  );
}

function publicHistory(receipts: TradeReceipt[]) {
  return receipts
    .filter((receipt) => !receipt.isDemo)
    .map((receipt) => ({
      venue: receipt.venue,
      symbol: receipt.symbol,
      side: receipt.side,
      intent: receipt.intent,
      requestedNotionalUsd: receipt.requestedNotionalUsd,
      filledNotionalUsd: receipt.filledNotionalUsd,
      filledBaseAmount: receipt.filledBaseAmount,
      averagePrice: receipt.averagePrice,
      orderId: receipt.orderId,
      digest: receipt.digest,
      filledAt: receipt.filledAt,
    }));
}

export function ProofDashboard(props: { env: PublicEnv }) {
  void props.env;
  const [receipts, setReceipts] = useState<TradeReceipt[]>([]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setReceipts(loadReceipts()));
    return () => cancelAnimationFrame(frame);
  }, []);
  const nado = useMemo(() => latestLive(receipts, 'nado'), [receipts]);
  const pacifica = useMemo(() => latestLive(receipts, 'pacifica'), [receipts]);

  return (
    <div className="mt-10">
      <div className="proof-grid">
        <article className="proof-card proof-primary">
          <div className="proof-title">
            <div>
              <span>PRIMARY ROUTE</span>
              <h2>Nado</h2>
            </div>
            <strong>{nado ? 'Latest fill recorded' : 'No fills yet'}</strong>
          </div>
          <dl>
            <EvidenceRow
              label="Order reference"
              value={nado?.digest ?? nado?.orderId}
            />
            <EvidenceRow
              label="Market"
              value={
                nado ? `${nado.symbol} · ${nado.side.toUpperCase()}` : undefined
              }
            />
            <EvidenceRow
              label="Filled notional"
              value={
                nado?.filledNotionalUsd
                  ? `$${nado.filledNotionalUsd}`
                  : undefined
              }
            />
            <EvidenceRow
              label="Filled amount"
              value={
                nado?.filledBaseAmount
                  ? `${nado.filledBaseAmount} ${nado.symbol}`
                  : undefined
              }
            />
            <EvidenceRow
              label="Completed"
              value={
                nado?.filledAt
                  ? new Date(nado.filledAt).toLocaleString()
                  : undefined
              }
            />
          </dl>
        </article>
        <article className="proof-card">
          <div className="proof-title">
            <div>
              <span>SECONDARY ROUTE</span>
              <h2>Pacifica</h2>
            </div>
            <strong>
              {pacifica ? 'Latest fill recorded' : 'No fills yet'}
            </strong>
          </div>
          <dl>
            <EvidenceRow
              label="Order reference"
              value={pacifica?.orderId ?? pacifica?.clientOrderId}
            />
            <EvidenceRow
              label="Market"
              value={
                pacifica
                  ? `${pacifica.symbol} · ${pacifica.side.toUpperCase()}`
                  : undefined
              }
            />
            <EvidenceRow
              label="Filled notional"
              value={
                pacifica?.filledNotionalUsd
                  ? `$${pacifica.filledNotionalUsd}`
                  : undefined
              }
            />
            <EvidenceRow
              label="Filled amount"
              value={
                pacifica?.filledBaseAmount
                  ? `${pacifica.filledBaseAmount} ${pacifica.symbol}`
                  : undefined
              }
            />
            <EvidenceRow
              label="Completed"
              value={
                pacifica?.filledAt
                  ? new Date(pacifica.filledAt).toLocaleString()
                  : undefined
              }
            />
          </dl>
        </article>
      </div>
      <section className="dual-checklist">
        <div>
          <span>{nado ? <Check size={16} /> : <Minus size={16} />}</span>Nado
          execution <strong>{nado ? 'recorded' : 'waiting'}</strong>
        </div>
        <div>
          <span>{pacifica ? <Check size={16} /> : <Minus size={16} />}</span>
          Pacifica execution{' '}
          <strong>{pacifica ? 'recorded' : 'waiting'}</strong>
        </div>
        <button
          className="secondary-action"
          onClick={() =>
            navigator.clipboard.writeText(
              JSON.stringify(publicHistory(receipts), null, 2),
            )
          }
        >
          <Copy size={15} /> Copy history
        </button>
      </section>
    </div>
  );
}
