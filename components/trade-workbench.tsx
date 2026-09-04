'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { useWallet } from '@solana/wallet-adapter-react';
import type { WalletClientWithAccount } from '@nadohq/shared';
import Decimal from 'decimal.js';
import { ink, inkSepolia } from 'viem/chains';
import { ArrowRight, CheckCircle, SpinnerGap } from '@phosphor-icons/react';
import type { FadeSignal } from '@/config/fade-signals';
import type { PublicEnv } from '@/config/env';
import { getVenueConfigStatus } from '@/config/env';
import { reverseSide } from '@/lib/trading/reverse-side';
import { notionalToBaseAmount, validateNotional } from '@/lib/trading/notional';
import type { PreparedOrder, SubmittedOrder, Venue } from '@/lib/trading/types';
import type { VenueAdapter } from '@/lib/trading/venue-adapter';
import type { TradeReceipt as TradeReceiptType } from '@/lib/receipts/types';
import { saveReceipt } from '@/lib/receipts/storage';
import {
  createReadOnlyNadoClient,
  createWalletNadoClient,
} from '@/lib/nado/client';
import { getNadoMarket } from '@/lib/nado/markets';
import {
  depositNadoCollateral,
  getNadoAccountOverview,
  type NadoAccountOverview,
  withdrawNadoCollateral,
} from '@/lib/nado/funding';
import {
  type NadoManagedPosition,
  type NadoPortfolio,
} from '@/lib/nado/positions';
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
import { NadoAccountPanel } from './nado-account-panel';
import { NadoPositionsPanel } from './nado-positions-panel';
import { ClosePositionDialog } from './close-position-dialog';
import { WithdrawalReviewDialog } from './withdrawal-review-dialog';

type MarketPreview = {
  venue: Venue;
  symbol: string;
  price: string;
  sizeIncrement: string;
  minimumUsd: string;
  minimumFeeUsd?: string;
  productId?: number;
};

export function TradeWorkbench({
  signal,
  signalReady,
  env,
  onSelectionLockChange,
}: {
  signal: FadeSignal;
  signalReady: boolean;
  env: PublicEnv;
  onSelectionLockChange?: (locked: boolean) => void;
}) {
  const [venue, setVenue] = useState<Venue>('nado');
  const [notional, setNotional] = useState(
    String(env.NEXT_PUBLIC_DEFAULT_NOTIONAL_USD),
  );
  const [prepared, setPrepared] = useState<PreparedOrder | null>(null);
  const [receipt, setReceipt] = useState<TradeReceiptType | null>(null);
  const [status, setStatus] = useState<string>('Ready');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [approving, setApproving] = useState(false);
  const [funding, setFunding] = useState(false);
  const [fundingStatus, setFundingStatus] = useState<string>();
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawalStatus, setWithdrawalStatus] = useState<string>();
  const [withdrawalAmount, setWithdrawalAmount] = useState<string | null>(null);
  const [account, setAccount] = useState<NadoAccountOverview | null>(null);
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountRefresh, setAccountRefresh] = useState(0);
  const [portfolio, setPortfolio] = useState<NadoPortfolio | null>(null);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [portfolioError, setPortfolioError] = useState<string>();
  const [positionToClose, setPositionToClose] =
    useState<NadoManagedPosition | null>(null);
  const [closingSymbol, setClosingSymbol] = useState<string>();
  const [marketPreview, setMarketPreview] = useState<MarketPreview | null>(
    null,
  );
  const [marketFailure, setMarketFailure] = useState<{
    venue: Venue;
    symbol: string;
    message: string;
  } | null>(null);
  const adapterRef = useRef<VenueAdapter | null>(null);
  const submissionInFlightRef = useRef(false);
  const closeInFlightRef = useRef(false);
  const { address, chainId, isConnected } = useAccount();
  const requiredChain =
    env.NEXT_PUBLIC_NADO_NETWORK === 'inkMainnet' ? ink : inkSepolia;
  const { data: walletClient } = useWalletClient({ chainId: requiredChain.id });
  const solana = useWallet();
  const nadoConfig = getVenueConfigStatus(env, 'nado');
  const pacificaConfig = getVenueConfigStatus(env, 'pacifica');
  const fadeSide = reverseSide(signal.positionSide);
  const activeMarket =
    marketPreview?.venue === venue && marketPreview.symbol === signal.symbol
      ? marketPreview
      : null;
  const activeMarketFailure =
    marketFailure?.venue === venue && marketFailure.symbol === signal.symbol
      ? marketFailure.message
      : null;

  useEffect(() => {
    let active = true;
    void (async () => {
      const market =
        venue === 'nado'
          ? await getNadoMarket(
              createReadOnlyNadoClient(env.NEXT_PUBLIC_NADO_NETWORK),
              signal.symbol,
            )
          : await getPacificaMarket(
              new PacificaApi(env.NEXT_PUBLIC_PACIFICA_NETWORK),
              signal.symbol,
            );
      if (active) {
        setMarketFailure(null);
        setMarketPreview({
          venue,
          symbol: signal.symbol,
          price: market.price,
          sizeIncrement: market.sizeIncrement,
          minimumUsd: market.minimumNotionalUsd,
          minimumFeeUsd: market.minimumFeeNotionalUsd,
          productId: market.productId,
        });
      }
    })().catch(() => {
      if (active) {
        setMarketFailure({
          venue,
          symbol: signal.symbol,
          message: `${venue === 'nado' ? 'Nado' : 'Pacifica'} market data is temporarily unavailable.`,
        });
      }
    });
    return () => {
      active = false;
    };
  }, [
    env.NEXT_PUBLIC_NADO_NETWORK,
    env.NEXT_PUBLIC_PACIFICA_NETWORK,
    signal.symbol,
    venue,
  ]);

  useEffect(() => {
    onSelectionLockChange?.(pending || prepared !== null);
    return () => onSelectionLockChange?.(false);
  }, [onSelectionLockChange, pending, prepared]);

  useEffect(() => {
    let active = true;

    const refreshPortfolio = async () => {
      if (venue !== 'nado' || !address || chainId !== requiredChain.id) {
        if (active) {
          setPortfolio(null);
          setPortfolioError(undefined);
        }
        return;
      }
      if (active) setPortfolioLoading(true);
      try {
        const response = await fetch(
          `/api/nado/portfolio?wallet=${encodeURIComponent(address)}`,
          { cache: 'no-store' },
        );
        if (!response.ok) {
          throw new Error('Portfolio request failed.');
        }
        const next = (await response.json()) as NadoPortfolio;
        if (active) {
          setPortfolio(next);
          setPortfolioError(undefined);
        }
      } catch {
        if (active) {
          setPortfolioError(
            'Positions could not be refreshed. Your Nado account is unchanged; try again.',
          );
        }
      } finally {
        if (active) setPortfolioLoading(false);
      }
    };

    void refreshPortfolio();
    const timer = setInterval(() => void refreshPortfolio(), 15_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [
    accountRefresh,
    address,
    chainId,
    env.NEXT_PUBLIC_NADO_BUILDER_ID,
    env.NEXT_PUBLIC_NADO_NETWORK,
    env.NEXT_PUBLIC_NADO_SUBACCOUNT_NAME,
    requiredChain.id,
    venue,
  ]);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (
        venue !== 'nado' ||
        !address ||
        activeMarket?.productId === undefined
      ) {
        if (active) setAccount(null);
        return;
      }
      if (active) setAccountLoading(true);
      try {
        const next = await getNadoAccountOverview({
          client: createReadOnlyNadoClient(env.NEXT_PUBLIC_NADO_NETWORK),
          wallet: address,
          subaccountName: env.NEXT_PUBLIC_NADO_SUBACCOUNT_NAME,
          productId: activeMarket.productId,
          side: fadeSide,
          price: activeMarket.price,
        });
        if (active) setAccount(next);
      } catch {
        if (active) setAccount(null);
      } finally {
        if (active) setAccountLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [
    accountRefresh,
    activeMarket,
    address,
    env.NEXT_PUBLIC_NADO_NETWORK,
    env.NEXT_PUBLIC_NADO_SUBACCOUNT_NAME,
    fadeSide,
    venue,
  ]);

  const estimatedAmount = useMemo(() => {
    if (!activeMarket) return '—';
    try {
      return notionalToBaseAmount(
        notional,
        activeMarket.price,
        activeMarket.sizeIncrement,
      );
    } catch {
      return '0';
    }
  }, [activeMarket, notional]);
  const validationErrors = activeMarket
    ? validateNotional({
        notionalUsd: notional,
        minimumUsd: activeMarket.minimumUsd,
        availableUsd:
          venue === 'nado' ? account?.maximumNotionalUsd : undefined,
      })
    : [];

  async function createAdapter(): Promise<VenueAdapter> {
    if (venue === 'nado') {
      if (!address || !walletClient?.account)
        throw new Error('Connect an EVM wallet for Nado.');
      if (chainId !== requiredChain.id)
        throw new Error(`Switch the wallet to ${requiredChain.name}.`);
      const client = createWalletNadoClient({
        network: env.NEXT_PUBLIC_NADO_NETWORK,
        walletClient: walletClient as unknown as WalletClientWithAccount,
      });
      return new NadoAdapter(client, address, env);
    }
    if (!solana.publicKey || !solana.signMessage)
      throw new Error('Connect a Solana wallet with signMessage support.');
    return new PacificaAdapter(
      solana.publicKey.toBase58(),
      solana.signMessage,
      env,
    );
  }

  async function handleReview() {
    setError(null);
    setNotice(null);
    if (!signalReady) {
      setError(
        'A verified live target is not available yet. Try again after the signal refreshes.',
      );
      setStatus('Signal unavailable');
      return;
    }
    const selectedConfig = venue === 'nado' ? nadoConfig : pacificaConfig;
    const venueName = venue === 'nado' ? 'Nado' : 'Pacifica';
    if (!selectedConfig.ready) {
      setError(
        `${venueName} trading is temporarily unavailable. Please try again later.`,
      );
      setStatus('Unavailable');
      return;
    }
    if (!env.NEXT_PUBLIC_ENABLE_LIVE_TRADING) {
      setError('Trading is not available yet. Please try again later.');
      setStatus('Unavailable');
      return;
    }
    if (venue === 'nado' && !account?.exists) {
      setError('Fund your trading balance before placing an order.');
      setStatus('Deposit required');
      return;
    }
    if (validationErrors.length) return;
    if (!activeMarket) {
      setError(
        activeMarketFailure ??
          `${venueName} market data is still loading. Try again in a moment.`,
      );
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
      setStatus('Blocked');
    } finally {
      setPending(false);
    }
  }

  async function handleNadoDeposit(amountUsd: string) {
    setError(null);
    setNotice(null);
    if (!address || !walletClient?.account) {
      setError('Connect your Ink wallet before depositing.');
      return;
    }
    if (chainId !== requiredChain.id) {
      setError(`Switch your wallet to ${requiredChain.name}.`);
      return;
    }
    try {
      const amount = new Decimal(amountUsd);
      if (!amount.isFinite() || !amount.isPositive()) {
        setError('Enter a deposit amount greater than zero.');
        return;
      }
      if (!account?.exists && amount.lt(5)) {
        setError('The first deposit must be at least $5.');
        return;
      }
      if (account && amount.gt(account.walletBalanceUsd)) {
        setError(
          `Your wallet has $${account.walletBalanceUsd} USDT0 available.`,
        );
        return;
      }
      setFunding(true);
      const client = createWalletNadoClient({
        network: env.NEXT_PUBLIC_NADO_NETWORK,
        walletClient: walletClient as unknown as WalletClientWithAccount,
      });
      await depositNadoCollateral({
        client,
        wallet: address,
        subaccountName: env.NEXT_PUBLIC_NADO_SUBACCOUNT_NAME,
        amountUsd,
        onStatus: (next) =>
          setFundingStatus(
            {
              checking: 'Checking',
              approving: 'Approve USDT0',
              depositing: 'Confirm deposit',
              confirming: 'Confirming',
            }[next],
          ),
      });
      setStatus('Deposit complete');
      setNotice('Collateral confirmed. Your Nado balance has been refreshed.');
      setAccountRefresh((value) => value + 1);
    } catch (cause) {
      const tradingError = toTradingError(cause);
      setError(`${tradingError.message} ${tradingError.nextAction}`);
      setStatus('Deposit failed');
    } finally {
      setFunding(false);
      setFundingStatus(undefined);
    }
  }

  function handleNadoWithdrawRequest(amountUsd: string) {
    setError(null);
    setNotice(null);
    try {
      const amount = new Decimal(amountUsd);
      if (!amount.isFinite() || !amount.isPositive()) {
        throw new Error('Enter a withdrawal amount greater than zero.');
      }
      if (!account?.maximumWithdrawableUsd) {
        throw new Error('The withdrawable balance is still loading.');
      }
      if (amount.gt(account.maximumWithdrawableUsd)) {
        throw new Error(
          `You can currently withdraw up to $${account.maximumWithdrawableUsd}.`,
        );
      }
      setWithdrawalAmount(amount.toString());
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Invalid withdrawal amount.',
      );
    }
  }

  async function handleNadoWithdraw() {
    if (!withdrawalAmount || !address || !walletClient?.account || withdrawing)
      return;
    setWithdrawing(true);
    setError(null);
    setNotice(null);
    try {
      const client = createWalletNadoClient({
        network: env.NEXT_PUBLIC_NADO_NETWORK,
        walletClient: walletClient as unknown as WalletClientWithAccount,
      });
      await withdrawNadoCollateral({
        client,
        wallet: address,
        subaccountName: env.NEXT_PUBLIC_NADO_SUBACCOUNT_NAME,
        amountUsd: withdrawalAmount,
        onStatus: (next) => {
          const label = {
            checking: 'Checking limit',
            signing: 'Awaiting signature',
            submitted: 'Submitted',
          }[next];
          setWithdrawalStatus(label);
          setStatus(label);
        },
      });
      setWithdrawalAmount(null);
      setStatus('Withdrawal accepted');
      setNotice(
        'Nado accepted the withdrawal. Wallet USDT0 updates after settlement.',
      );
      setAccountRefresh((value) => value + 1);
    } catch (cause) {
      const tradingError = toTradingError(cause);
      setError(`${tradingError.message} ${tradingError.nextAction}`);
      setStatus('Withdrawal failed');
    } finally {
      setWithdrawing(false);
      setWithdrawalStatus(undefined);
    }
  }

  async function handleConfirm() {
    if (!prepared || submissionInFlightRef.current) return;
    submissionInFlightRef.current = true;
    setPending(true);
    setError(null);
    setNotice(null);
    let submitted: SubmittedOrder | undefined;
    try {
      const adapter = adapterRef.current;
      if (!adapter) throw new Error('Live venue adapter was not prepared.');
      setStatus('Awaiting signature');
      submitted = await adapter.submitMarketOrder(prepared);
      setStatus(submitted.accepted ? 'Accepted' : 'Rejected');
      setPrepared(null);
      setNotice('Order accepted by Nado. Confirming the fill…');
      setAccountRefresh((value) => value + 1);

      let fill;
      try {
        fill = await adapter.waitForFill(submitted);
      } catch {
        setStatus('Order submitted');
        setNotice(
          'Nado accepted the order, but fill history is delayed. Live positions refresh automatically below.',
        );
        return;
      }
      setStatus(fill.status === 'partial' ? 'Partially filled' : 'Filled');
      const liveReceipt: TradeReceiptType = {
        id: crypto.randomUUID(),
        venue,
        network:
          venue === 'nado'
            ? env.NEXT_PUBLIC_NADO_NETWORK
            : env.NEXT_PUBLIC_PACIFICA_NETWORK,
        symbol: prepared.symbol,
        side: prepared.side,
        intent: 'open',
        requestedNotionalUsd: notional,
        filledNotionalUsd: fill.notionalUsd,
        filledBaseAmount: fill.baseAmount,
        averagePrice: fill.averagePrice,
        submittedAt: submitted.submittedAt,
        filledAt: fill.filledAt,
        orderId: fill.orderId,
        clientOrderId: submitted.clientOrderId,
        digest: submitted.digest,
        builderId:
          venue === 'nado' ? env.NEXT_PUBLIC_NADO_BUILDER_ID : undefined,
        builderFeeRate:
          venue === 'nado'
            ? env.NEXT_PUBLIC_NADO_BUILDER_FEE_RATE_UNITS
            : undefined,
        builderCode:
          venue === 'pacifica'
            ? env.NEXT_PUBLIC_PACIFICA_BUILDER_CODE
            : undefined,
        attributionStatus: fill.builderEvidence ? 'verified' : 'fill-confirmed',
        officialEvidence: fill.builderEvidence,
        sanitizedRawResponse: { submitted: submitted.raw, fill: fill.raw },
      };
      saveReceipt(liveReceipt);
      setReceipt(liveReceipt);
      setNotice('Fill confirmed. Your live position and PnL are shown below.');
      setAccountRefresh((value) => value + 1);
    } catch (cause) {
      const tradingError = toTradingError(cause);
      setError(`${tradingError.message} ${tradingError.nextAction}`);
      setStatus(submitted ? 'Confirmation delayed' : 'Rejected');
    } finally {
      submissionInFlightRef.current = false;
      setPending(false);
    }
  }

  async function handleApproval() {
    if (
      !solana.publicKey ||
      !solana.signMessage ||
      !env.NEXT_PUBLIC_PACIFICA_BUILDER_CODE ||
      !env.NEXT_PUBLIC_PACIFICA_MAX_FEE_RATE
    )
      return;
    setApproving(true);
    setError(null);
    try {
      const approval = await approvePacificaBuilder({
        api: new PacificaApi(env.NEXT_PUBLIC_PACIFICA_NETWORK),
        account: solana.publicKey.toBase58(),
        builderCode: env.NEXT_PUBLIC_PACIFICA_BUILDER_CODE,
        maxFeeRate: env.NEXT_PUBLIC_PACIFICA_MAX_FEE_RATE,
        signMessage: solana.signMessage,
      });
      setStatus(approval ? 'Trading authorized' : 'Authorization submitted');
    } catch (cause) {
      const e = toTradingError(cause);
      setError(`${e.message} ${e.nextAction}`);
    } finally {
      setApproving(false);
    }
  }

  async function handleClosePosition() {
    if (!positionToClose || closeInFlightRef.current) return;
    const position = positionToClose;
    closeInFlightRef.current = true;
    setClosing(true);
    setClosingSymbol(position.symbol);
    setPositionToClose(null);
    setError(null);
    setNotice(null);
    let submitted: SubmittedOrder | undefined;
    try {
      setStatus('Preparing close');
      const adapter = await createAdapter();
      submitted = await adapter.closePosition({
        symbol: position.symbol,
        slippageBps: env.NEXT_PUBLIC_MAX_SLIPPAGE_BPS,
      });
      setStatus('Close accepted');
      setNotice('Reduce-only close accepted. Confirming the fill…');
      setAccountRefresh((value) => value + 1);
      let fill;
      try {
        fill = await adapter.waitForFill(submitted);
      } catch {
        setStatus('Close submitted');
        setNotice(
          'Nado accepted the close. Position state will update automatically when the fill is indexed.',
        );
        return;
      }
      const closeReceipt: TradeReceiptType = {
        id: crypto.randomUUID(),
        venue: 'nado',
        network: env.NEXT_PUBLIC_NADO_NETWORK,
        symbol: position.symbol,
        intent: 'close',
        side: reverseSide(position.side),
        requestedNotionalUsd: fill.notionalUsd,
        filledNotionalUsd: fill.notionalUsd,
        filledBaseAmount: fill.baseAmount,
        averagePrice: fill.averagePrice,
        submittedAt: submitted.submittedAt,
        filledAt: fill.filledAt,
        orderId: fill.orderId,
        clientOrderId: submitted.clientOrderId,
        digest: submitted.digest,
        builderId: env.NEXT_PUBLIC_NADO_BUILDER_ID,
        builderFeeRate: env.NEXT_PUBLIC_NADO_BUILDER_FEE_RATE_UNITS,
        attributionStatus: fill.builderEvidence ? 'verified' : 'fill-confirmed',
        officialEvidence: fill.builderEvidence,
        sanitizedRawResponse: { submitted: submitted.raw, fill: fill.raw },
      };
      saveReceipt(closeReceipt);
      setReceipt(closeReceipt);
      setStatus('Position closed');
      setNotice('Close fill confirmed. Your account has been refreshed.');
      setAccountRefresh((value) => value + 1);
    } catch (cause) {
      const e = toTradingError(cause);
      setError(`${e.message} ${e.nextAction}`);
    } finally {
      closeInFlightRef.current = false;
      setClosing(false);
      setClosingSymbol(undefined);
    }
  }

  return (
    <section className="trade-panel animate-enter animate-delay">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Execution dossier</p>
          <h2>Place the inverse.</h2>
        </div>
        <div className="status-pill">
          {pending && <SpinnerGap size={13} className="animate-spin" />}
          {status === 'Filled' && <CheckCircle size={13} />}
          {status}
        </div>
      </div>
      <VenueSelector
        venue={venue}
        onChange={setVenue}
        nadoReady={nadoConfig.ready}
        pacificaReady={pacificaConfig.ready}
      />
      {venue === 'nado' && (
        <NadoAccountPanel
          connected={isConnected}
          correctChain={chainId === requiredChain.id}
          requiredChainId={requiredChain.id}
          requiredChainName={requiredChain.name}
          account={account}
          loading={accountLoading}
          funding={funding}
          fundingStatus={fundingStatus}
          withdrawing={withdrawing}
          withdrawalStatus={withdrawalStatus}
          onDeposit={handleNadoDeposit}
          onWithdraw={handleNadoWithdrawRequest}
        />
      )}
      {venue === 'pacifica' &&
        env.NEXT_PUBLIC_ENABLE_LIVE_TRADING &&
        pacificaConfig.ready && (
          <div className="pacifica-approval">
            <div>
              <strong>Trading permission</strong>
              <span>One signed authorization, revocable through Pacifica.</span>
            </div>
            <button
              onClick={handleApproval}
              disabled={approving || !solana.connected}
            >
              {approving ? 'Approving…' : 'AUTHORIZE TRADING'}
            </button>
          </div>
        )}
      {venue === 'nado' && isConnected && chainId === requiredChain.id && (
        <NadoPositionsPanel
          portfolio={portfolio}
          loading={portfolioLoading}
          error={portfolioError}
          closingSymbol={closingSymbol}
          onRefresh={() => setAccountRefresh((value) => value + 1)}
          onRequestClose={setPositionToClose}
        />
      )}
      <FadeTicket
        signalReady={signalReady}
        targetSide={signal.positionSide}
        fadeSide={fadeSide}
        symbol={signal.symbol}
        venue={venue}
        notional={notional}
        onNotionalChange={setNotional}
        price={activeMarket?.price ?? 'Loading'}
        estimatedAmount={estimatedAmount}
        minimumOrder={
          activeMarket
            ? `$${activeMarket.minimumUsd}`
            : (activeMarketFailure ?? 'Loading')
        }
        availablePosition={
          venue === 'nado' ? account?.maximumNotionalUsd : undefined
        }
        accountEquity={venue === 'nado' ? account?.accountEquityUsd : undefined}
        minimumFeeNotional={activeMarket?.minimumFeeUsd}
        errors={validationErrors}
      />
      {error && (
        <div className="execution-error" role="alert">
          <strong>Action needed</strong>
          <p>{error}</p>
        </div>
      )}
      {notice && (
        <div className="execution-notice" role="status">
          <CheckCircle size={16} />
          <p>{notice}</p>
        </div>
      )}
      <button
        className="fade-button"
        disabled={!signalReady || pending || validationErrors.length > 0}
        onClick={handleReview}
      >
        <span>
          {!signalReady
            ? 'WAITING FOR LIVE SIGNAL'
            : pending
              ? 'PREPARING'
              : `FADE ON ${venue.toUpperCase()}`}
        </span>
        <ArrowRight size={19} weight="bold" />
      </button>
      <p className="button-footnote">
        No custody. No background agent. Explicit confirmation required.
      </p>
      {receipt && (
        <TradeReceipt
          receipt={receipt}
          onClosePosition={
            env.NEXT_PUBLIC_ENABLE_LIVE_TRADING && receipt.intent === 'open'
              ? () => {
                  const matchingPosition = portfolio?.positions.find(
                    (position) => position.symbol === receipt.symbol,
                  );
                  if (matchingPosition) setPositionToClose(matchingPosition);
                }
              : undefined
          }
          closing={closing}
        />
      )}
      {prepared && (
        <OrderReviewDialog
          order={prepared}
          targetSide={reverseSide(prepared.side)}
          slippageBps={env.NEXT_PUBLIC_MAX_SLIPPAGE_BPS}
          onCancel={() => setPrepared(null)}
          onConfirm={handleConfirm}
          pending={pending}
        />
      )}
      {positionToClose && (
        <ClosePositionDialog
          position={positionToClose}
          pending={closing}
          onCancel={() => setPositionToClose(null)}
          onConfirm={() => void handleClosePosition()}
        />
      )}
      {withdrawalAmount && (
        <WithdrawalReviewDialog
          amount={withdrawalAmount}
          pending={withdrawing}
          onCancel={() => setWithdrawalAmount(null)}
          onConfirm={() => void handleNadoWithdraw()}
        />
      )}
    </section>
  );
}
