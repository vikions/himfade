import { IndexerClient } from '@nadohq/indexer-client';
import { unstable_cache } from 'next/cache';
import { nadoEndpoints } from '@/config/venues';
import { createReadOnlyNadoClient } from './client';
import { NadoExplorerClient } from './explorer-client';
import { loadExplorerNadoSignals } from './explorer-signal-feed';
import { loadHybridNadoSignals } from './hybrid-signal-feed';
import { loadFeaturedNadoSignal } from './signal-feed';
import { NadoSignalSource } from './signal-source';

const loadCachedFeaturedNadoSignal = unstable_cache(
  async () => {
    const source = new NadoSignalSource(
      new IndexerClient({ url: nadoEndpoints.inkMainnet.archive }),
      createReadOnlyNadoClient('inkMainnet'),
    );
    const explorer = new NadoExplorerClient();
    return loadHybridNadoSignals(
      () => loadExplorerNadoSignals(explorer, source),
      () => loadFeaturedNadoSignal(source),
    );
  },
  ['nado-featured-signals-v3'],
  { revalidate: 300 },
);

export async function getFeaturedNadoSignal() {
  return loadCachedFeaturedNadoSignal();
}
