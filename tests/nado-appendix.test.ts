import { describe, expect, it } from 'vitest';
import { buildNadoAppendix, decodeNadoAppendix } from '@/lib/nado/appendix';

describe('Nado builder appendix', () => {
  it('encodes and decodes builder fields in official SDK format', () => {
    const packed = buildNadoAppendix({ builderId: 123, builderFeeRate: 5 });
    expect(decodeNadoAppendix(packed)).toEqual({
      version: 1,
      orderType: 1,
      orderExecutionType: 'ioc',
      reduceOnly: false,
      isolated: false,
      builderId: 123,
      builderFeeRate: 5,
    });
    expect(Number((packed >> 48n) & 0xffffn)).toBe(123);
    expect(Number((packed >> 38n) & 0x3ffn)).toBe(5);
  });

  it('preserves builder bits when reduce-only is set', () => {
    const packed = buildNadoAppendix({ builderId: 65535, builderFeeRate: 1023, reduceOnly: true });
    const decoded = decodeNadoAppendix(packed);
    expect(decoded.reduceOnly).toBe(true);
    expect(decoded.builderId).toBe(65535);
    expect(decoded.builderFeeRate).toBe(1023);
    expect(Number((packed >> 11n) & 1n)).toBe(1);
  });

  it('rejects missing or out-of-range builders instead of defaulting to zero', () => {
    expect(() => buildNadoAppendix({ builderId: 0, builderFeeRate: 5 })).toThrow();
    expect(() => buildNadoAppendix({ builderId: 1, builderFeeRate: 1024 })).toThrow();
  });
});
