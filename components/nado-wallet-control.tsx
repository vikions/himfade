'use client';

import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { ink, inkSepolia } from 'viem/chains';

function short(value: string) { return `${value.slice(0, 5)}…${value.slice(-4)}`; }

export function NadoWalletControl({ network }: { network: 'inkTestnet' | 'inkMainnet' }) {
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const required = network === 'inkMainnet' ? ink : inkSepolia;
  if (!isConnected) return (
    <button className="wallet-button wallet-button-primary" disabled={isPending || !connectors[0]} onClick={() => connectors[0] && connect({ connector: connectors[0] })}>
      Nado · {isPending ? 'Connecting' : 'Connect EVM'}
    </button>
  );
  if (chainId !== required.id) return (
    <button className="wallet-button wallet-button-warn" onClick={() => switchChain({ chainId: required.id })}>Switch to {required.name}</button>
  );
  return <button className="wallet-button" onClick={() => disconnect()}>Nado · {address ? short(address) : 'Connected'}</button>;
}
