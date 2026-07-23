'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { useWallet } from '@solana/wallet-adapter-react';
import type { WalletClientWithAccount } from '@nadohq/shared';
import { ink, inkSepolia } from 'viem/chains';
import { ArrowRight, CheckCircle, SpinnerGap } from '@phosphor-icons/react';
import type { FadeSignal } from '@/config/fade-signals';
import type { PublicEnv } from '@/config/env';
import { getVenueConfigStatus } from '@/config/env';
import { reverseSide } from '@/lib/trading/reverse-side';
import { notionalToBaseAmount, validateNotional } from '@/lib/trading/notional';
import type { PreparedOrder, Venue } from '@/lib/trading/types';
import type { VenueAdapter } from '@/lib/trading/venue-adapter';
import type { TradeReceipt as TradeReceiptType } from '@/lib/receipts/types';
import { saveReceipt } from '@/lib/receipts/storage';
import { createReadOnlyNadoClient, createWalletNadoClient } from '@/lib/nado/client';
import { getNadoMarket } from '@/lib/nado/markets';
import { NadoAdapter } from '@/lib/nado/adapter';
import { PacificaAdapter } from '@/lib/pacifica/adapter';
import { PacificaApi } from '@/lib/pacifica/api';
import { getPacificaMarket } from '@/lib/pacifica/markets';
import { approvePacificaBuilder } from '@/lib/pacifica/builder-approval';
import { toTradingError } from '@/lib/trading/errors';
import { FadeTicket } from './fade-ticket';
import { OrderReviewDialog } from './order-review-dialog';
import { TradeReceipt } from './trade-receipt';
import { VenueSelector } from './venue-selector';

type MarketPreview = {
  venue: Venue;
  price: string;
  sizeIncrement: string;
  minimumUsd: string;
};

export function TradeWorkbench({ signal, env }: { signal: FadeSignal; env: PublicEnv }) {
  const [venue, setVenue] = useState<Venue>('nado');
  const [notional, setNotional] = useState(String(env.NEXT_PUBLIC_DEFAULT_NOTIONAL_USD));
  const [prepared, setPrepared] = useState<PreparedOrder | null>(null);
  const [receipt, setReceipt] = useState<TradeReceiptType | null>(null);
  const [status, setStatus] = useState<string>('Ready');
  const [error, setError] = useState<string | null>(null);
  const [technicalError, setTechnicalError] = useState<unknown>();
  const [pending, setPending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [approving, setApproving] = useState(false);
  const [marketPreview, setMarketPreview] = useState<MarketPreview | null>(null);
  const [marketFailure, setMarketFailure] = useState<{ venue: Venue; message: string } | null>(null);
  const adapterRef = useRef<VenueAdapter | null>(null);
  const { address, chainId } = useAccount();
  const requiredChain = env.NEXT_PUBLIC_NADO_NETWORK === 'inkMainnet' ? ink : inkSepolia;
  const { data: walletClient } = useWalletClient({ chainId: requiredChain.id });
  const solana = useWallet();
  const nadoConfig = getVenueConfigStatus(env, 'nado');
  const pacificaConfig = getVenueConfigStatus(env, 'pacifica');
  const fadeSide = reverseSide(signal.positionSide);
  const activeMarket = marketPreview?.venue === venue ? marketPreview : null;
  const activeMarketFailure = marketFailure?.venue === venue ? marketFailure.message : null;

  useEffect(() => {
    let active = true;
    void (async () => {
      const market = venue === 'nado'
        ? await getNadoMarket(createReadOnlyNadoClient(env.NEXT_PUBLIC_NADO_NETWORK), signal.symbol)
        : await getPacificaMarket(new PacificaApi(env.NEXT_PUBLIC_PACIFICA_NETWORK), signal.symbol);
      if (active) {
        setMarketPreview({
          venue,
          price: market.price,
          sizeIncrement: market.sizeIncrement,
          minimumUsd: market.minimumNotionalUsd,
        });
      }
    })().catch(() => {
      if (active) {
        setMarketFailure({
          venue,
          message: `${venue === 'nado' ? 'Nado' : 'Pacifica'} market data is temporarily unavailable.`,
        });
      }
    });
    return () => { active = false; };
  }, [env.NEXT_PUBLIC_NADO_NETWORK, env.NEXT_PUBLIC_PACIFICA_NETWORK, signal.symbol, venue]);

  const estimatedAmount = useMemo(() => {
    if (!activeMarket) return '—';
    try { return notionalToBaseAmount(notional, activeMarket.price, activeMarket.sizeIncrement); }
    catch { return '0'; }
  }, [activeMarket, notional]);
  const validationErrors = activeMarket
    ? validateNotional({
        notionalUsd: notional,
        minimumUsd: activeMarket.minimumUsd,
        maximumUsd: String(env.NEXT_PUBLIC_MAX_NOTIONAL_USD),
      })
    : [];

  async function createAdapter(): Promise<VenueAdapter> {
    if (venue === 'nado') {
      if (!address || !walletClient?.account) throw new Error('Connect an EVM wallet for Nado.');
      if (chainId !== requiredChain.id) throw new Error(`Switch the wallet to ${requiredChain.name}.`);
      const client = createWalletNadoClient({
        network: env.NEXT_PUBLIC_NADO_NETWORK,
        walletClient: walletClient as unknown as WalletClientWithAccount,
      });
      return new NadoAdapter(client, address, env);
    }
    if (!solana.publicKey || !solana.signMessage) throw new Error('Connect a Solana wallet with signMessage support.');
    return new PacificaAdapter(solana.publicKey.toBase58(), solana.signMessage, env);
  }

  async function handleReview() {
    setError(null);
    setTechnicalError(undefined);
    const selectedConfig = venue === 'nado' ? nadoConfig : pacificaConfig;
    const venueName = venue === 'nado' ? 'Nado' : 'Pacifica';
    if (!selectedConfig.ready) {
      setError(`${venueName} builder configuration is pending. Execution remains locked until attributed orders are enabled.`);
      setStatus('Builder onboarding');
      return;
    }
    if (!env.NEXT_PUBLIC_ENABLE_LIVE_TRADING) {
      setError('Mainnet execution activation is pending. Builder settings will be verified before wallet signing is enabled.');
      setStatus('Activation pending');
      return;
    }
    if (validationErrors.length) return;
    if (!activeMarket) {
      setError(activeMarketFailure ?? `${venueName} market data is still loading. Try again in a moment.`);
      setStatus('Market unavailable');
      return;
    }
    setPending(true);
    setStatus('Preparing');
    try {
      const adapter = await createAdapter();
      const order = await adapter.prepareMarketOrder({
        symbol: signal.symbol,
        side: fadeSide,
        notionalUsd: notional,
        slippageBps: env.NEXT_PUBLIC_MAX_SLIPPAGE_BPS,
      });
      adapterRef.current = adapter;
      setPrepared(order);
      setStatus('Review required');
    } catch (cause) {
      const tradingError = toTradingError(cause);
      setError(`${tradingError.message} ${tradingError.nextAction}`);
      setTechnicalError(tradingError.technicalDetails);
      setStatus('Blocked');
    } finally { setPending(false); }
  }

  async function handleConfirm() {
    if (!prepared) return;
    setPending(true);
    setError(null);
    try {
      const adapter = adapterRef.current;
      if (!adapter) throw new Error('Live venue adapter was not prepared.');
      setStatus('Awaiting signature');
      const submitted = await adapter.submitMarketOrder(prepared);
      setStatus(submitted.accepted ? 'Accepted' : 'Rejected');
      const fill = await adapter.waitForFill(submitted);
      setStatus(fill.status === 'partial' ? 'Partially filled' : 'Filled');
      const liveReceipt: TradeReceiptType = {
        id: crypto.randomUUID(), venue, network: venue === 'nado' ? env.NEXT_PUBLIC_NADO_NETWORK : env.NEXT_PUBLIC_PACIFICA_NETWORK,
        symbol: signal.symbol, side: fadeSide, intent: 'open', requestedNotionalUsd: notional,
        filledNotionalUsd: fill.notionalUsd, filledBaseAmount: fill.baseAmount, averagePrice: fill.averagePrice,
        submittedAt: submitted.submittedAt, filledAt: fill.filledAt, orderId: fill.orderId,
        clientOrderId: submitted.clientOrderId, digest: submitted.digest,
        builderId: venue === 'nado' ? env.NEXT_PUBLIC_NADO_BUILDER_ID : undefined,
        builderFeeRate: venue === 'nado' ? env.NEXT_PUBLIC_NADO_BUILDER_FEE_RATE_UNITS : undefined,
        builderCode: venue === 'pacifica' ? env.NEXT_PUBLIC_PACIFICA_BUILDER_CODE : undefined,
        attributionStatus: fill.builderEvidence ? 'verified' : 'fill-confirmed',
        officialEvidence: fill.builderEvidence,
        sanitizedRawResponse: { submitted: submitted.raw, fill: fill.raw },
      };
      saveReceipt(liveReceipt);
      setReceipt(liveReceipt);
      setPrepared(null);
    } catch (cause) {
      const tradingError = toTradingError(cause);
      setError(`${tradingError.message} ${tradingError.nextAction}`);
      setTechnicalError(tradingError.technicalDetails);
      setStatus('Rejected');
    } finally { setPending(false); }
  }

  async function handleApproval() {
    if (!solana.publicKey || !solana.signMessage || !env.NEXT_PUBLIC_PACIFICA_BUILDER_CODE || !env.NEXT_PUBLIC_PACIFICA_MAX_FEE_RATE) return;
    setApproving(true); setError(null);
    try {
      const approval = await approvePacificaBuilder({
        api: new PacificaApi(env.NEXT_PUBLIC_PACIFICA_NETWORK),
        account: solana.publicKey.toBase58(),
        builderCode: env.NEXT_PUBLIC_PACIFICA_BUILDER_CODE,
        maxFeeRate: env.NEXT_PUBLIC_PACIFICA_MAX_FEE_RATE,
        signMessage: solana.signMessage,
      });
      setStatus(approval ? 'Builder approved' : 'Approval submitted; re-query pending');
    } catch (cause) { const e = toTradingError(cause); setError(`${e.message} ${e.nextAction}`); }
    finally { setApproving(false); }
  }

  async function handleClosePosition() {
    const adapter = adapterRef.current;
    if (!adapter || !receipt) return;
    setClosing(true); setError(null);
    try {
      setStatus('Preparing close');
      const submitted = await adapter.closePosition({ symbol: receipt.symbol, slippageBps: env.NEXT_PUBLIC_MAX_SLIPPAGE_BPS });
      const fill = await adapter.waitForFill(submitted);
      const closeReceipt: TradeReceiptType = {
        ...receipt, id: crypto.randomUUID(), intent: 'close', side: reverseSide(receipt.side),
        requestedNotionalUsd: fill.notionalUsd, filledNotionalUsd: fill.notionalUsd,
        filledBaseAmount: fill.baseAmount, averagePrice: fill.averagePrice,
        submittedAt: submitted.submittedAt, filledAt: fill.filledAt, orderId: fill.orderId,
        clientOrderId: submitted.clientOrderId, digest: submitted.digest,
        attributionStatus: fill.builderEvidence ? 'verified' : 'fill-confirmed', officialEvidence: fill.builderEvidence,
      };
      saveReceipt(closeReceipt); setReceipt(closeReceipt); setStatus('Position closed');
    } catch (cause) { const e = toTradingError(cause); setError(`${e.message} ${e.nextAction}`); }
    finally { setClosing(false); }
  }

  return (
    <section className="trade-panel animate-enter animate-delay">
      <div className="panel-heading"><div><p className="eyebrow">Execution dossier</p><h2>Place the inverse.</h2></div><div className="status-pill">{pending && <SpinnerGap size={13} className="animate-spin" />}{status === 'Filled' && <CheckCircle size={13} />}{status}</div></div>
      <VenueSelector venue={venue} onChange={setVenue} nadoReady={nadoConfig.ready} pacificaReady={pacificaConfig.ready} />
      {(!nadoConfig.ready || !pacificaConfig.ready) && (
        <details className="config-status">
          <summary>Developer configuration status</summary>
          {!nadoConfig.ready && <p>Nado builder onboarding pending: missing {nadoConfig.missing.join(', ')}</p>}
          {!pacificaConfig.ready && <p>Pacifica builder configuration pending: missing {pacificaConfig.missing.join(', ')}</p>}
          <p>Execution remains locked until attribution is configured. No unattributed order will be sent.</p>
        </details>
      )}
      {venue === 'pacifica' && env.NEXT_PUBLIC_ENABLE_LIVE_TRADING && pacificaConfig.ready && (
        <div className="pacifica-approval"><div><strong>Builder approval</strong><span>One signed authorization, revocable through Pacifica.</span></div><button onClick={handleApproval} disabled={approving || !solana.connected}>{approving ? 'Approving…' : 'APPROVE FADE HIM BUILDER CODE'}</button></div>
      )}
      <FadeTicket targetSide={signal.positionSide} fadeSide={fadeSide} symbol={signal.symbol} venue={venue} notional={notional} onNotionalChange={setNotional} price={activeMarket?.price ?? 'Loading'} estimatedAmount={estimatedAmount} minimumOrder={activeMarket ? `$${activeMarket.minimumUsd}` : activeMarketFailure ?? 'Loading'} attribution={venue === 'nado' ? nadoConfig.ready ? `#${env.NEXT_PUBLIC_NADO_BUILDER_ID} · ${env.NEXT_PUBLIC_NADO_BUILDER_FEE_RATE_UNITS} units` : 'Builder onboarding pending' : pacificaConfig.ready ? env.NEXT_PUBLIC_PACIFICA_BUILDER_CODE! : 'Builder configuration pending'} errors={validationErrors} />
      {error && <div className="execution-error" role="alert"><strong>Execution blocked</strong><p>{error}</p>{technicalError !== undefined && <details><summary>Developer details</summary><pre>{JSON.stringify(technicalError, null, 2)}</pre></details>}</div>}
      <button className="fade-button" disabled={pending || validationErrors.length > 0} onClick={handleReview}><span>{pending ? 'PREPARING' : `FADE ON ${venue.toUpperCase()}`}</span><ArrowRight size={19} weight="bold" /></button>
      <p className="button-footnote">No custody. No background agent. Explicit confirmation required.</p>
      {receipt && <TradeReceipt receipt={receipt} onClosePosition={env.NEXT_PUBLIC_ENABLE_LIVE_TRADING && receipt.intent === 'open' ? handleClosePosition : undefined} closing={closing} />}
      {prepared && <OrderReviewDialog order={prepared} targetSide={signal.positionSide} slippageBps={env.NEXT_PUBLIC_MAX_SLIPPAGE_BPS} onCancel={() => setPrepared(null)} onConfirm={handleConfirm} pending={pending} />}
    </section>
  );
}
