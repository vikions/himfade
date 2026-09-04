'use client';

import { useMemo, useState } from 'react';
import type { FadeSignalFeed } from '@/config/fade-signals';
import { featuredSignal } from '@/config/fade-signals';
import type { PublicEnv } from '@/config/env';
import { SignalDesk } from './loser-card';
import { TradeWorkbench } from './trade-workbench';

export function SignalWorkspace({
  feed,
  env,
}: {
  feed: FadeSignalFeed;
  env: PublicEnv;
}) {
  const [selectedId, setSelectedId] = useState(feed.signals[0]?.id ?? '');
  const [selectionLocked, setSelectionLocked] = useState(false);
  const selectedSignal = useMemo(
    () =>
      feed.signals.find((signal) => signal.id === selectedId) ??
      feed.signals[0] ??
      featuredSignal,
    [feed.signals, selectedId],
  );

  function selectSignal(id: string) {
    if (selectionLocked || id === selectedSignal.id) return;
    setSelectedId(id);
  }

  return (
    <div className="signal-workspace mt-8">
      <SignalDesk
        feed={feed}
        selectedId={selectedSignal.id}
        selectionLocked={selectionLocked}
        onSelect={selectSignal}
      />
      <TradeWorkbench
        signal={selectedSignal}
        signalReady={feed.status === 'live' && selectedSignal.isLiveData}
        env={env}
        onSelectionLockChange={setSelectionLocked}
      />
    </div>
  );
}
