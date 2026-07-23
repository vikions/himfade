import { AppHeader } from '@/components/app-header';
import { ProofDashboard } from '@/components/proof-dashboard';
import { getPublicEnv } from '@/config/env';

export default function ProofPage() {
  const env = getPublicEnv();
  return (
    <main className="min-h-[100dvh]">
      <AppHeader env={env} />
      <div className="mx-auto max-w-[1200px] px-4 py-10 md:px-8 md:py-16">
        <p className="eyebrow">Protocol evidence room</p>
        <h1 className="mt-3 max-w-[13ch] text-4xl font-medium leading-none tracking-[-0.055em] md:text-6xl">Two venues. Two proofs.</h1>
        <p className="mt-5 max-w-[62ch] text-sm leading-6 text-stone-400">Local receipts help diagnostics, but they never prove builder volume by themselves. This page only promotes a venue when stored evidence came from its official protocol response.</p>
        <ProofDashboard env={env} />
      </div>
    </main>
  );
}
