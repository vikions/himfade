import {
  ArrowDown,
  ArrowSquareOut,
  ArrowUpRight,
  LockSimple,
} from '@phosphor-icons/react/dist/ssr';
import type { CSSProperties } from 'react';
import type { FadeSignal, FadeSignalFeed } from '@/config/fade-signals';
import { reverseSide } from '@/lib/trading/reverse-side';

function short(value: string) {
  return `${value.slice(0, 7)}…${value.slice(-5)}`;
}

function money(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: Math.abs(value) < 100 ? 2 : 0,
  }).format(value);
}

function updated(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  }).format(new Date(value));
}

export function SignalDesk({
  feed,
  selectedId,
  selectionLocked,
  onSelect,
}: {
  feed: FadeSignalFeed;
  selectedId: string;
  selectionLocked: boolean;
  onSelect: (id: string) => void;
}) {
  const selected =
    feed.signals.find((signal) => signal.id === selectedId) ?? feed.signals[0];
  if (!selected) return <UnavailableSignal feed={feed} />;

  const selectedRank = feed.signals.findIndex(
    (signal) => signal.id === selected.id,
  );

  return (
    <article className="dossier signal-desk animate-enter">
      <header className="signal-desk-heading">
        <div>
          <p className="desk-kicker">Live signal desk</p>
          <h2>Choose who to fade.</h2>
          <p>
            {feed.signals.length} verified open{' '}
            {feed.signals.length === 1 ? 'position' : 'positions'}, ranked by
            observed losses.
          </p>
        </div>
        <div className="desk-live-state" title="Public Nado data">
          <span aria-hidden="true" />
          <strong>LIVE</strong>
          <small>5 MIN CACHE</small>
        </div>
      </header>

      <div
        className="signal-stack"
        role="group"
        aria-label="Verified Nado accounts to fade"
      >
        {feed.signals.map((signal, index) => (
          <SignalRow
            key={signal.id}
            signal={signal}
            rank={index + 1}
            index={index}
            selected={signal.id === selected.id}
            disabled={selectionLocked}
            onSelect={onSelect}
          />
        ))}
      </div>

      {selectionLocked && (
        <p className="selection-lock" role="status">
          <LockSimple size={13} weight="fill" /> Target locked while the order
          is being reviewed.
        </p>
      )}

      <SelectedSignal signal={selected} rank={selectedRank + 1} />
    </article>
  );
}

function SignalRow({
  signal,
  rank,
  index,
  selected,
  disabled,
  onSelect,
}: {
  signal: FadeSignal;
  rank: number;
  index: number;
  selected: boolean;
  disabled: boolean;
  onSelect: (id: string) => void;
}) {
  const window = signal.performanceWindowComplete
    ? '30D PNL'
    : `${signal.performanceWindowDays ?? 0}D PNL`;
  const market = signal.symbol.replace(/-PERP$/i, '');
  const tilt = [-1.4, 0.8, -0.5, 1.2, -0.9][index] ?? 0;
  const palette = [
    ['#ed9188', 'rgba(237, 145, 136, 0.11)'],
    ['#e8b975', 'rgba(232, 185, 117, 0.1)'],
    ['#7fc8d6', 'rgba(127, 200, 214, 0.1)'],
    ['#b8a2de', 'rgba(184, 162, 222, 0.1)'],
    ['#8fc49d', 'rgba(143, 196, 157, 0.1)'],
  ][index % 5]!;
  const style = {
    '--card-index': index,
    '--card-tilt': `${tilt}deg`,
    '--card-accent': palette[0],
    '--card-wash': palette[1],
  } as CSSProperties;

  return (
    <button
      type="button"
      className="loser-card"
      aria-pressed={selected}
      aria-label={`Fade ${signal.positionSide} ${signal.symbol} position from ${short(signal.walletAddress)}`}
      disabled={disabled}
      style={style}
      onClick={(event) => {
        event.currentTarget.scrollIntoView?.({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        });
        onSelect(signal.id);
      }}
    >
      <span className="loser-card-topline">
        <span className="signal-rank">#{String(rank).padStart(2, '0')}</span>
        <span className="loser-card-live">
          <i aria-hidden="true" /> LIVE
        </span>
      </span>
      <span className="loser-card-emblem" aria-hidden="true">
        <strong>{market}</strong>
        <small>{signal.positionSide.toUpperCase()}</small>
      </span>
      <span className="loser-card-account">
        <strong>{short(signal.walletAddress)}</strong>
        <small>NADO ACCOUNT</small>
      </span>
      <span className="loser-card-score">
        <small>{window}</small>
        <strong>{money(signal.performancePnlUsd ?? 0)}</strong>
      </span>
      <span className="loser-card-action">
        <span>FADE {reverseSide(signal.positionSide).toUpperCase()}</span>
        <ArrowUpRight size={16} weight="bold" />
      </span>
    </button>
  );
}

function SelectedSignal({
  signal,
  rank,
}: {
  signal: FadeSignal;
  rank: number;
}) {
  const fade = reverseSide(signal.positionSide);
  const windowLabel = signal.performanceWindowComplete
    ? '30D REALIZED PNL'
    : `${signal.performanceWindowDays ?? 0}D OBSERVED PNL`;

  return (
    <section
      id="selected-signal-dossier"
      className="selected-signal"
      aria-live="polite"
    >
      <div className="selected-signal-heading">
        <div className="min-w-0">
          <p>
            Selected target <span>RANK #{rank}</span>
          </p>
          <h3 className="signal-address">{short(signal.walletAddress)}</h3>
          <small>ACTIVE NADO ACCOUNT · INK MAINNET</small>
        </div>
        <div className="loss-seal">
          <ArrowDown size={22} weight="bold" />
          <span>{signal.performanceWindowComplete ? '30D' : 'LIVE'}</span>
        </div>
      </div>

      <div className="metric-grid selected-metrics">
        <div>
          <span>{windowLabel}</span>
          <strong className="text-red-300">
            {money(signal.performancePnlUsd ?? 0)}
          </strong>
        </div>
        <div>
          <span>CLOSED-ORDER WIN RATE</span>
          <strong>{signal.winRatePercent ?? 0}%</strong>
          <small>{signal.closedOrderCount ?? 0} closed orders</small>
        </div>
        <div>
          <span>LIQUIDATIONS</span>
          <strong>{signal.liquidationCount ?? 0}</strong>
          <small>same observation window</small>
        </div>
      </div>

      <div className="direction-split selected-direction">
        <div>
          <span>THEIR OPEN POSITION</span>
          <strong className="text-red-200">
            {signal.positionSide.toUpperCase()} {signal.symbol}
          </strong>
          <small className="position-caption">
            ≈ {money(signal.positionNotionalUsd ?? 0)} notional
          </small>
        </div>
        <ArrowUpRight className="direction-arrow" size={28} />
        <div>
          <span>YOUR FADE</span>
          <strong className="text-emerald-200">
            {fade.toUpperCase()} {signal.symbol}
          </strong>
          <small className="position-caption">
            You choose the position size
          </small>
        </div>
      </div>

      <div className="signal-proof selected-proof">
        <p>
          Ranked from {signal.candidateCount ?? 0} losing candidates in the
          latest public maker sample; this position was verified before display.
        </p>
        <div>
          <a
            href={`https://explorer.inkonchain.com/address/${signal.walletAddress}`}
            target="_blank"
            rel="noreferrer"
          >
            Verify address <ArrowSquareOut size={13} />
          </a>
          {signal.dataSourceUrl && (
            <a href={signal.dataSourceUrl} target="_blank" rel="noreferrer">
              Data method <ArrowSquareOut size={13} />
            </a>
          )}
        </div>
        <small>Refreshed {updated(signal.updatedAt)}</small>
      </div>
    </section>
  );
}

function UnavailableSignal({ feed }: { feed: FadeSignalFeed }) {
  return (
    <article className="dossier dossier-unavailable animate-enter">
      <div>
        <p className="desk-kicker">Live signal desk</p>
        <h2 className="mt-4 max-w-[14ch] text-3xl font-medium text-stone-100 md:text-5xl">
          No verified target right now.
        </h2>
        <p className="signal-state mt-5 max-w-[58ch]">
          {feed.reason ?? 'Nado public data could not be verified.'} Trading
          stays locked until an account with a live open position passes the
          next refresh.
        </p>
      </div>
      <div
        className="metric-grid mt-14"
        aria-label="Signal metrics unavailable"
      >
        <div>
          <span>REALIZED PNL</span>
          <strong>—</strong>
        </div>
        <div>
          <span>WIN RATE</span>
          <strong>—</strong>
        </div>
        <div>
          <span>LIQUIDATIONS</span>
          <strong>—</strong>
        </div>
      </div>
      <div className="signal-proof mt-12 border-t border-white/10 pt-5">
        <p>No placeholder identity or unverified performance is shown.</p>
        <small>Last checked {updated(feed.checkedAt)}</small>
      </div>
    </article>
  );
}
