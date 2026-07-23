import { ArrowDown, ArrowUpRight } from '@phosphor-icons/react/dist/ssr';
import type { FadeSignal } from '@/config/fade-signals';
import { reverseSide } from '@/lib/trading/reverse-side';

function short(value: string) { return `${value.slice(0, 7)}…${value.slice(-5)}`; }

export function LoserCard({ signal }: { signal: FadeSignal }) {
  const fade = reverseSide(signal.positionSide);
  return (
    <article className="dossier animate-enter">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow text-red-300/80">Today&apos;s worst trader</p>
          <h2 className="mt-4 text-3xl font-medium tracking-[-0.05em] text-stone-100 md:text-5xl">{signal.alias}</h2>
          <p className="mt-2 font-mono text-xs text-stone-500">{short(signal.walletAddress)} · {signal.sourceVenue.toUpperCase()}</p>
        </div>
        <div className="loss-seal"><ArrowDown size={22} weight="bold" /><span>30D</span></div>
      </div>
      <div className="metric-grid mt-14">
        <div><span>30D PNL</span><strong className="text-red-300">−${Math.abs(signal.pnl30dUsd ?? 0).toLocaleString()}</strong></div>
        <div><span>WIN RATE</span><strong>{signal.winRatePercent ?? '—'}%</strong></div>
        <div><span>LIQUIDATIONS</span><strong>{signal.liquidationCount ?? '—'}</strong></div>
      </div>
      <div className="direction-split mt-12">
        <div><span>THEIR CURRENT MOVE</span><strong className="text-red-200">{signal.positionSide.toUpperCase()} {signal.symbol}</strong></div>
        <ArrowUpRight className="direction-arrow" size={28} />
        <div><span>YOUR FADE</span><strong className="text-emerald-200">{fade.toUpperCase()} {signal.symbol}</strong></div>
      </div>
      <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5 text-xs text-stone-500">
        <span>{signal.isLiveData ? 'Verified public data' : 'Curated signal · Demo data'}</span>
        <span>Last updated: {new Date(signal.updatedAt).toLocaleDateString('en-GB')}</span>
        <span>Source: {signal.dataSourceLabel}</span>
      </div>
    </article>
  );
}
