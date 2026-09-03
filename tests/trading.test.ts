import { describe, expect, it } from 'vitest';
import { reverseSide } from '@/lib/trading/reverse-side';
import {
  calculateNotional,
  isPriceStale,
  notionalToBaseAmount,
  roundDownToIncrement,
  validateNotional,
} from '@/lib/trading/notional';

describe('trading math', () => {
  it('maps each target side to its inverse', () => {
    expect(reverseSide('long')).toBe('short');
    expect(reverseSide('short')).toBe('long');
  });

  it('converts USD notional to base amount without floating point drift', () => {
    expect(notionalToBaseAmount('10', '3241.82', '0.0001')).toBe('0.0030');
    expect(calculateNotional('0.0030', '3241.82')).toBe('9.72');
  });

  it('rounds down to the exact lot increment', () => {
    expect(roundDownToIncrement('1.239999999999', '0.01')).toBe('1.23');
    expect(roundDownToIncrement('0.000099999', '0.0001')).toBe('0.0000');
  });

  it('validates the executable lot and connected account capacity', () => {
    expect(
      validateNotional({
        notionalUsd: '2.39',
        minimumUsd: '2.40',
        availableUsd: '120',
      }),
    ).toContain('Minimum executable size is $2.40.');
    expect(
      validateNotional({
        notionalUsd: '120.01',
        minimumUsd: '2.40',
        availableUsd: '120',
      }),
    ).toContain('Available position size is up to $120.');
    expect(
      validateNotional({
        notionalUsd: '10',
        minimumUsd: '2.40',
        availableUsd: '120',
      }),
    ).toEqual([]);
  });

  it('detects stale prices at the boundary', () => {
    expect(isPriceStale(60_000, 30_000, 90_001)).toBe(true);
    expect(isPriceStale(60_000, 30_000, 90_000)).toBe(false);
  });
});
