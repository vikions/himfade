import { describe, expect, it, vi } from 'vitest';
import { compactCanonicalJson, pacificaSigningBytes, recursivelySortJson } from '@/lib/pacifica/canonical-json';
import { buildPacificaOperation, signPacificaOperation } from '@/lib/pacifica/signing';

describe('Pacifica deterministic signing', () => {
  it('recursively sorts objects while preserving array order', () => {
    expect(recursivelySortJson({ z: 1, a: { d: 4, b: 2 }, list: [{ y: 2, x: 1 }, 3] })).toEqual({
      a: { b: 2, d: 4 },
      list: [{ x: 1, y: 2 }, 3],
      z: 1,
    });
  });

  it('generates identical compact JSON regardless of insertion order', () => {
    const first = compactCanonicalJson({ type: 'x', data: { z: 'last', a: 'first' } });
    const second = compactCanonicalJson({ data: { a: 'first', z: 'last' }, type: 'x' });
    expect(first).toBe(second);
    expect(first).not.toContain(' ');
  });

  it('includes builder code in exact signing bytes before wallet signature', async () => {
    const operation = buildPacificaOperation({
      type: 'create_market_order',
      timestamp: 1716200000000,
      expiryWindow: 30000,
      data: {
        symbol: 'ETH', amount: '0.01', side: 'ask', slippage_percent: '1',
        reduce_only: false, client_order_id: '11111111-1111-4111-8111-111111111111', builder_code: 'FADEHIM',
      },
    });
    let signed = '';
    const signMessage = vi.fn(async (bytes: Uint8Array) => {
      signed = new TextDecoder().decode(bytes);
      return new Uint8Array(64).fill(7);
    });
    const body = await signPacificaOperation({ account: 'wallet', operation, signMessage });
    expect(signed).toContain('"builder_code":"FADEHIM"');
    expect(signed).toBe(new TextDecoder().decode(pacificaSigningBytes(operation)));
    expect(body.builder_code).toBe('FADEHIM');
    expect(body.signature).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/);
  });

  it('constructs the documented approval operation', () => {
    expect(buildPacificaOperation({
      type: 'approve_builder_code', timestamp: 1, expiryWindow: 5000,
      data: { builder_code: 'FADEHIM', max_fee_rate: '0.001' },
    })).toEqual({
      timestamp: 1, expiry_window: 5000, type: 'approve_builder_code',
      data: { builder_code: 'FADEHIM', max_fee_rate: '0.001' },
    });
  });
});
