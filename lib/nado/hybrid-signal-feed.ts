import type { FadeSignal, FadeSignalFeed } from '@/config/fade-signals';

const SIGNAL_LIMIT = 5;

export async function loadHybridNadoSignals(
  loadExplorer: () => Promise<FadeSignalFeed>,
  loadOfficial: () => Promise<FadeSignalFeed>,
): Promise<FadeSignalFeed> {
  let explorerFeed: FadeSignalFeed | undefined;
  try {
    explorerFeed = await loadExplorer();
  } catch {
    return loadOfficial();
  }

  if (
    explorerFeed.status === 'live' &&
    explorerFeed.signals.length >= SIGNAL_LIMIT
  ) {
    return {
      ...explorerFeed,
      signals: explorerFeed.signals.slice(0, SIGNAL_LIMIT),
    };
  }

  const officialFeed = await loadOfficial();
  if (explorerFeed.status !== 'live' || explorerFeed.signals.length === 0) {
    return officialFeed;
  }
  if (officialFeed.status !== 'live') return explorerFeed;

  const merged = new Map<string, FadeSignal>();
  for (const signal of [...explorerFeed.signals, ...officialFeed.signals]) {
    if (!merged.has(signal.id)) merged.set(signal.id, signal);
  }

  return {
    status: 'live',
    checkedAt: explorerFeed.checkedAt,
    signals: [...merged.values()].slice(0, SIGNAL_LIMIT),
  };
}
