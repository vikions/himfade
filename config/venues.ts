import type { PublicEnv } from './env';

export const nadoEndpoints = {
  inkMainnet: {
    gateway: 'https://gateway.prod.nado.xyz/v1',
    gatewayV2: 'https://gateway.prod.nado.xyz/v2',
    archive: 'https://archive.prod.nado.xyz/v1',
    archiveV2: 'https://archive.prod.nado.xyz/v2',
    websocket: 'wss://gateway.prod.nado.xyz/v1/ws',
  },
  inkTestnet: {
    gateway: 'https://gateway.test.nado.xyz/v1',
    gatewayV2: 'https://gateway.test.nado.xyz/v2',
    archive: 'https://archive.test.nado.xyz/v1',
    archiveV2: 'https://archive.test.nado.xyz/v2',
    websocket: 'wss://gateway.test.nado.xyz/v1/ws',
  },
} as const;

export const pacificaEndpoints = {
  mainnet: 'https://api.pacifica.fi/api/v1',
  testnet: 'https://test-api.pacifica.fi/api/v1',
} as const;

export function getPacificaApiBase(env: PublicEnv) {
  return pacificaEndpoints[env.NEXT_PUBLIC_PACIFICA_NETWORK];
}
