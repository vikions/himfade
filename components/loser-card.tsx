import {
  ArrowDown,
  ArrowSquareOut,
  ArrowUpRight,
} from '@phosphor-icons/react/dist/ssr';
import type { FadeSignalFeed } from '@/config/fade-signals';
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

export function LoserCard({ feed }: { feed: FadeSignalFeed }) {
  if (!feed.signal) return <UnavailableSignal feed={feed} />;

  const signal = feed.signal;
  const fade = reverseSide(signal.positionSide);
  const windowLabel = signal.performanceWindowComplete
    ? '30D REALIZED PNL'
    : `${signal.performanceWindowDays ?? 0}D OBSERVED PNL`;

  return (
    <article className="dossier animate-enter">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow text-red-300/80">
            Worst in recent public maker activity
          </p>
          <h2 className="signal-address mt-4 text-3xl font-medium text-stone-100 md:text-5xl">
            {short(signal.walletAddress)}
          </h2>
          <p className="mt-2 font-mono text-xs text-stone-500">
            ACTIVE NADO ACCOUNT · INK MAINNET
          </p>
        </div>
        <div className="loss-seal">
          <ArrowDown size={22} weight="bold" />
          <span>{signal.performanceWindowComplete ? '30D' : 'LIVE'}</span>
        </div>
      </div>

      <div className="metric-grid mt-14">
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

      <div className="direction-split mt-12">
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

      <div className="signal-proof mt-10 border-t border-white/10 pt-5">
        <p>
          Selected from {signal.candidateCount ?? 0} losing candidates in the
          latest public maker sample; current position verified before display.
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
    </article>
  );
}

function UnavailableSignal({ feed }: { feed: FadeSignalFeed }) {
  return (
    <article className="dossier dossier-unavailable animate-enter">
      <div>
        <p className="eyebrow text-red-300/80">Live ranking unavailable</p>
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
