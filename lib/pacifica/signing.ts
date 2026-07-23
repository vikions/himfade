import bs58 from 'bs58';
import type { JsonValue } from './canonical-json';
import { pacificaSigningBytes } from './canonical-json';

export type PacificaOperation<T extends Record<string, JsonValue>> = {
  timestamp: number;
  expiry_window: number;
  type: string;
  data: T;
};

export type PacificaSigner = (message: Uint8Array) => Promise<Uint8Array>;

export function buildPacificaOperation<T extends Record<string, JsonValue>>(input: {
  type: string;
  data: T;
  timestamp?: number;
  expiryWindow?: number;
}): PacificaOperation<T> {
  return {
    timestamp: input.timestamp ?? Date.now(),
    expiry_window: input.expiryWindow ?? 30_000,
    type: input.type,
    data: input.data,
  };
}

export async function signPacificaOperation<
  T extends Record<string, JsonValue>,
>(input: {
  account: string;
  operation: PacificaOperation<T>;
  signMessage: PacificaSigner;
}) {
  const messageBytes = pacificaSigningBytes(input.operation as unknown as JsonValue);
  const signatureBytes = await input.signMessage(messageBytes);
  return {
    account: input.account,
    agent_wallet: null,
    signature: bs58.encode(signatureBytes),
    timestamp: input.operation.timestamp,
    expiry_window: input.operation.expiry_window,
    ...input.operation.data,
  };
}
