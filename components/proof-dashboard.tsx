'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Minus } from '@phosphor-icons/react';
import type { PublicEnv } from '@/config/env';
import { getVenueConfigStatus } from '@/config/env';
import { loadReceipts, sanitizeProtocolData } from '@/lib/receipts/storage';
import type { TradeReceipt } from '@/lib/receipts/types';

function latestLive(receipts: TradeReceipt[], venue: 'nado' | 'pacifica') {
  return receipts.find((receipt) => receipt.venue === venue && !receipt.isDemo);
}

function EvidenceRow({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="proof-row"><dt>{label}</dt><dd>{value ?? '—'}</dd></div>;
}

export function ProofDashboard({ env }: { env: PublicEnv }) {
  const [receipts, setReceipts] = useState<TradeReceipt[]>([]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setReceipts(loadReceipts()));
    return () => cancelAnimationFrame(frame);
  }, []);
  const nado = useMemo(() => latestLive(receipts, 'nado'), [receipts]);
  const pacifica = useMemo(() => latestLive(receipts, 'pacifica'), [receipts]);
  const nadoConfig = getVenueConfigStatus(env, 'nado');
  const pacificaConfig = getVenueConfigStatus(env, 'pacifica');
  const nadoVerified = Boolean(nado?.attributionStatus === 'verified' && nado.officialEvidence);
  const pacificaVerified = Boolean(pacifica?.attributionStatus === 'verified' && pacifica.officialEvidence);
  const diagnostics = sanitizeProtocolData({ generatedAt: new Date().toISOString(), config: {
    nado: { network: env.NEXT_PUBLIC_NADO_NETWORK, builderId: env.NEXT_PUBLIC_NADO_BUILDER_ID, feeRate: env.NEXT_PUBLIC_NADO_BUILDER_FEE_RATE_UNITS },
    pacifica: { network: env.NEXT_PUBLIC_PACIFICA_NETWORK, builderCode: env.NEXT_PUBLIC_PACIFICA_BUILDER_CODE, maxFeeRate: env.NEXT_PUBLIC_PACIFICA_MAX_FEE_RATE },
  }, receipts });

  return (
    <div className="mt-10">
      <div className="proof-grid">
        <article className="proof-card proof-primary">
          <div className="proof-title"><div><span>PRIMARY ROUTE</span><h2>Nado</h2></div><strong>{nadoVerified ? 'Attribution evidence found' : nado ? 'Fill recorded · evidence incomplete' : nadoConfig.ready ? 'Configured' : 'Not configured'}</strong></div>
          <dl>
            <EvidenceRow label="Network" value={env.NEXT_PUBLIC_NADO_NETWORK} />
            <EvidenceRow label="Builder ID" value={env.NEXT_PUBLIC_NADO_BUILDER_ID === undefined ? undefined : String(env.NEXT_PUBLIC_NADO_BUILDER_ID)} />
            <EvidenceRow label="Builder fee units" value={env.NEXT_PUBLIC_NADO_BUILDER_FEE_RATE_UNITS === undefined ? undefined : String(env.NEXT_PUBLIC_NADO_BUILDER_FEE_RATE_UNITS)} />
            <EvidenceRow label="Configuration" value={nadoConfig.ready ? 'Ready' : 'Missing builder ID and fee units'} />
            <EvidenceRow label="Latest digest" value={nado?.digest} />
            <EvidenceRow label="Filled notional" value={nado?.filledNotionalUsd ? `$${nado.filledNotionalUsd}` : undefined} />
            <EvidenceRow label="Intent" value={nado?.intent} />
            <EvidenceRow label="Official evidence" value={nado?.officialEvidence ? 'Stored from Nado indexer response' : 'None'} />
          </dl>
          {Boolean(nado?.officialEvidence) && <details className="proof-details"><summary>Decoded evidence</summary><pre>{JSON.stringify(nado?.officialEvidence, null, 2)}</pre></details>}
        </article>
        <article className="proof-card">
          <div className="proof-title"><div><span>SECONDARY ROUTE</span><h2>Pacifica</h2></div><strong>{pacificaVerified ? 'Attribution evidence found' : pacifica ? 'Fill recorded · evidence incomplete' : pacificaConfig.ready ? 'Configured' : 'Not configured'}</strong></div>
          <dl>
            <EvidenceRow label="Network" value={env.NEXT_PUBLIC_PACIFICA_NETWORK} />
            <EvidenceRow label="Builder code" value={env.NEXT_PUBLIC_PACIFICA_BUILDER_CODE === undefined ? undefined : String(env.NEXT_PUBLIC_PACIFICA_BUILDER_CODE)} />
            <EvidenceRow label="Required max fee" value={env.NEXT_PUBLIC_PACIFICA_MAX_FEE_RATE === undefined ? undefined : String(env.NEXT_PUBLIC_PACIFICA_MAX_FEE_RATE)} />
            <EvidenceRow label="Configuration" value={pacificaConfig.ready ? 'Ready' : 'Missing builder code and max fee rate'} />
            <EvidenceRow label="Latest order" value={pacifica?.orderId} />
            <EvidenceRow label="Client order ID" value={pacifica?.clientOrderId} />
            <EvidenceRow label="Filled notional" value={pacifica?.filledNotionalUsd ? `$${pacifica.filledNotionalUsd}` : undefined} />
            <EvidenceRow label="Official evidence" value={pacifica?.officialEvidence ? 'Builder-filtered user trade matched' : 'None'} />
          </dl>
          {Boolean(pacifica?.officialEvidence) && <details className="proof-details"><summary>Builder evidence</summary><pre>{JSON.stringify(pacifica?.officialEvidence, null, 2)}</pre></details>}
        </article>
      </div>
      <section className="dual-checklist">
        <div><span>{nadoVerified ? <Check size={16} /> : <Minus size={16} />}</span>Nado attributed fill <strong>{nadoVerified ? 'complete' : 'incomplete'}</strong></div>
        <div><span>{pacificaVerified ? <Check size={16} /> : <Minus size={16} />}</span>Pacifica attributed fill <strong>{pacificaVerified ? 'complete' : 'incomplete'}</strong></div>
        {nadoVerified && pacificaVerified && <p>DUAL BUILDER ATTRIBUTION VERIFIED</p>}
        <button className="secondary-action" onClick={() => navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2))}><Copy size={15} /> Copy diagnostics</button>
      </section>
    </div>
  );
}
