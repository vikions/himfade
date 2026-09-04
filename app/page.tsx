import { AppHeader } from '@/components/app-header';
import { SignalWorkspace } from '@/components/signal-workspace';
import { RiskDisclosure } from '@/components/risk-disclosure';
import { getPublicEnv } from '@/config/env';
import { getFeaturedNadoSignal } from '@/lib/nado/featured-signal';

export const dynamic = 'force-dynamic';
export const preferredRegion = 'iad1';

export default async function HomePage() {
  const env = getPublicEnv();
  const signalFeed = await getFeaturedNadoSignal();
  return (
    <main className="min-h-[100dvh]">
      <AppHeader env={env} />
      <div className="mx-auto max-w-[1400px] px-4 pt-8 pb-16 md:px-8 md:pt-14">
        <div className="mb-8 grid gap-4 border-b border-white/10 pb-7 md:grid-cols-[1.5fr_1fr] md:items-end">
          <div>
            <p className="eyebrow">A live inverse-trading terminal</p>
            <h1 className="mt-3 max-w-[16ch] text-4xl leading-[0.95] font-medium tracking-[-0.055em] text-stone-100 md:text-6xl">
              Trade the other side of questionable decisions.
            </h1>
          </div>
          <p className="max-w-[48ch] text-sm leading-6 text-stone-400 md:justify-self-end">
            A ranked desk of verified live positions. Select the account you
            want to fade; Nado executes the inverse without leaving Fade Him.
          </p>
        </div>
        <SignalWorkspace feed={signalFeed} env={env} />
        <RiskDisclosure />
      </div>
    </main>
  );
}
