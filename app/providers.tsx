'use client';

import { createContext, useMemo, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { ink, inkSepolia } from 'viem/chains';
import type { PublicEnv } from '@/config/env';

export const AppEnvContext = createContext<PublicEnv | null>(null);

const wagmiConfig = createConfig({
  chains: [inkSepolia, ink],
  connectors: [injected()],
  transports: { [inkSepolia.id]: http(), [ink.id]: http() },
  ssr: true,
});

export function AppProviders({ children, env }: { children: ReactNode; env: PublicEnv }) {
  const queryClient = useMemo(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 15_000, retry: 1 } },
  }), []);
  const endpoint = useMemo(
    () => clusterApiUrl(env.NEXT_PUBLIC_PACIFICA_NETWORK === 'mainnet' ? 'mainnet-beta' : 'devnet'),
    [env.NEXT_PUBLIC_PACIFICA_NETWORK],
  );
  return (
    <AppEnvContext.Provider value={env}>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={[]} autoConnect>
              <WalletModalProvider>{children}</WalletModalProvider>
            </WalletProvider>
          </ConnectionProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </AppEnvContext.Provider>
  );
}
