import { AppHeader } from '@/components/app-header';
import { LoserCard } from '@/components/loser-card';
import { TradeWorkbench } from '@/components/trade-workbench';
import { RiskDisclosure } from '@/components/risk-disclosure';
import { featuredSignal } from '@/config/fade-signals';
import { getPublicEnv } from '@/config/env';

export default function HomePage() {
  const env = getPublicEnv();
  return (
    <main className="min-h-[100dvh]">
      <AppHeader env={env} />
      <div className="mx-auto max-w-[1400px] px-4 pb-16 pt-8 md:px-8 md:pt-14">
        <div className="mb-8 grid gap-4 border-b border-white/10 pb-7 md:grid-cols-[1.5fr_1fr] md:items-end">
          <div>
            <p className="eyebrow">A one-button market experiment</p>
            <h1 className="mt-3 max-w-[16ch] text-4xl font-medium leading-[0.95] tracking-[-0.055em] text-stone-100 md:text-6xl">
              Trade the other side of questionable decisions.
            </h1>
          </div>
          <p className="max-w-[48ch] text-sm leading-6 text-stone-400 md:justify-self-end">
            One curated position. One inverse order. Nado is the primary route; Pacifica remains available when you need the Solana path.
          </p>
        </div>
        {!env.NEXT_PUBLIC_ENABLE_LIVE_TRADING && (
          <div className="demo-banner" role="status">DEMO MODE — NO ORDER WILL BE SENT</div>
        )}
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
          <LoserCard signal={featuredSignal} />
          <TradeWorkbench signal={featuredSignal} env={env} />
        </div>
        <RiskDisclosure />
      </div>
    </main>
  );
}
