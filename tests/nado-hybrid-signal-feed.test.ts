import { describe, expect, it, vi } from 'vitest';
import { loadHybridNadoSignals } from '@/lib/nado/hybrid-signal-feed';
import type { FadeSignalFeed } from '@/config/fade-signals';

describe('hybrid Nado signal feed', () => {
  it('fills a partial Explorer feed from the official fallback without duplicates', async () => {
    const explorer = vi.fn().mockResolvedValue(feed(['one', 'two']));
    const official = vi.fn().mockResolvedValue(feed(['two', 'three', 'four']));

    const result = await loadHybridNadoSignals(explorer, official);

    expect(result.signals.map((signal) => signal.id)).toEqual([
      'one',
      'two',
      'three',
      'four',
    ]);
  });

  it('returns the official feed when Explorer fails', async () => {
    const explorer = vi.fn().mockRejectedValue(new Error('timeout'));
    const officialFeed = feed(['official']);

    await expect(
      loadHybridNadoSignals(explorer, vi.fn().mockResolvedValue(officialFeed)),
    ).resolves.toEqual(officialFeed);
  });
});

function feed(ids: string[]): FadeSignalFeed {
  return {
    status: 'live',
    checkedAt: '2026-09-09T12:00:00.000Z',
    signals: ids.map((id) => ({
      id,
      alias: 'NADO ACCOUNT',
      sourceVenue: 'nado',
      walletAddress: `0x${id}`,
      symbol: 'BTC-PERP',
      positionSide: 'long',
      updatedAt: '2026-09-09T12:00:00.000Z',
      dataSourceLabel: 'test',
      isLiveData: true,
    })),
  };
}
