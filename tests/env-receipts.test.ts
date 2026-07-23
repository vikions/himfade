import { beforeEach, describe, expect, it } from 'vitest';
import { getVenueConfigStatus, readPublicEnv } from '@/config/env';
import { loadReceipts, sanitizeProtocolData, saveReceipt } from '@/lib/receipts/storage';

describe('fail-closed configuration', () => {
  it('disables each live venue when its attribution config is missing', () => {
    const env = readPublicEnv({ NEXT_PUBLIC_ENABLE_LIVE_TRADING: 'true' });
    expect(getVenueConfigStatus(env, 'nado')).toEqual({
      ready: false,
      missing: ['NEXT_PUBLIC_NADO_BUILDER_ID', 'NEXT_PUBLIC_NADO_BUILDER_FEE_RATE_UNITS'],
    });
    expect(getVenueConfigStatus(env, 'pacifica')).toEqual({
      ready: false,
      missing: ['NEXT_PUBLIC_PACIFICA_BUILDER_CODE', 'NEXT_PUBLIC_PACIFICA_MAX_FEE_RATE'],
    });
  });

  it('allows an intentionally configured zero Nado fee without treating it as missing', () => {
    const env = readPublicEnv({ NEXT_PUBLIC_NADO_BUILDER_ID: '17', NEXT_PUBLIC_NADO_BUILDER_FEE_RATE_UNITS: '0' });
    expect(getVenueConfigStatus(env, 'nado').ready).toBe(true);
  });

  it('rejects invalid builder ranges and formats', () => {
    expect(() => readPublicEnv({ NEXT_PUBLIC_NADO_BUILDER_ID: '0' })).toThrow();
    expect(() => readPublicEnv({ NEXT_PUBLIC_PACIFICA_BUILDER_CODE: 'not-valid-code!' })).toThrow();
  });
});

describe('receipt safety', () => {
  beforeEach(() => localStorage.clear());

  it('redacts nested signatures and sensitive values', () => {
    expect(sanitizeProtocolData({ signature: 'abc', nested: { sessionToken: 'secret', ok: 1 } })).toEqual({
      signature: '[REDACTED]', nested: { sessionToken: '[REDACTED]', ok: 1 },
    });
  });

  it('stores a demo receipt without converting it into verified proof', () => {
    saveReceipt({
      id: 'demo', venue: 'nado', network: 'inkTestnet', symbol: 'ETH', side: 'short', intent: 'open',
      requestedNotionalUsd: '10', submittedAt: new Date(0).toISOString(), attributionStatus: 'configured', isDemo: true,
      sanitizedRawResponse: { signature: 'do-not-store' },
    });
    const [receipt] = loadReceipts();
    expect(receipt?.isDemo).toBe(true);
    expect(receipt?.attributionStatus).not.toBe('verified');
    expect(receipt?.sanitizedRawResponse).toEqual({ signature: '[REDACTED]' });
  });
});
