import { createNadoClient, type NadoClient } from '@nadohq/client';
import type { WalletClientWithAccount } from '@nadohq/shared';
import { createPublicClient, fallback, http } from 'viem';
import { ink, inkSepolia } from 'viem/chains';

export type NadoNetwork = 'inkTestnet' | 'inkMainnet';

export function getNadoChain(network: NadoNetwork) {
  return network === 'inkMainnet' ? ink : inkSepolia;
}

export function createNadoPublicClient(network: NadoNetwork) {
  const backupRpc =
    network === 'inkMainnet'
      ? 'https://rpc-qnd.inkonchain.com'
      : 'https://rpc-gel-sepolia.inkonchain.com';
  return createPublicClient({
    chain: getNadoChain(network),
    transport: fallback([http(), http(backupRpc)]),
  });
}

export function createReadOnlyNadoClient(network: NadoNetwork): NadoClient {
  return createNadoClient(network, {
    publicClient: createNadoPublicClient(network) as unknown as Parameters<
      typeof createNadoClient
    >[1]['publicClient'],
  });
}

export function createWalletNadoClient(input: {
  network: NadoNetwork;
  walletClient: WalletClientWithAccount;
}): NadoClient {
  return createNadoClient(input.network, {
    publicClient: createNadoPublicClient(
      input.network,
    ) as unknown as Parameters<typeof createNadoClient>[1]['publicClient'],
    walletClient: input.walletClient,
  });
}
