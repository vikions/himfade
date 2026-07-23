'use client';

import Link from 'next/link';
import { ArrowUpRight } from '@phosphor-icons/react';
import type { PublicEnv } from '@/config/env';
import { NadoWalletControl } from './nado-wallet-control';
import { PacificaWalletControl } from './pacifica-wallet-control';

export function AppHeader({ env }: { env: PublicEnv }) {
  return (
    <header className="border-b border-white/10">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-4 py-4 md:px-8">
        <Link href="/" className="mr-auto text-lg font-semibold tracking-[-0.04em] text-stone-100">FADE HIM</Link>
        <span className="network-badge">{env.NEXT_PUBLIC_APP_MODE}</span>
        <NadoWalletControl network={env.NEXT_PUBLIC_NADO_NETWORK} />
        <PacificaWalletControl />
        <Link href="/proof" className="header-link">Proof <ArrowUpRight size={14} weight="bold" /></Link>
      </div>
    </header>
  );
}
