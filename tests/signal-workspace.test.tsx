import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FadeSignal, FadeSignalFeed } from '@/config/fade-signals';
import type { PublicEnv } from '@/config/env';
import { SignalWorkspace } from '@/components/signal-workspace';

vi.mock('@/components/trade-workbench', () => ({
  TradeWorkbench: ({
    signal,
    onSelectionLockChange,
  }: {
    signal: FadeSignal;
    onSelectionLockChange: (locked: boolean) => void;
  }) => (
    <div>
      <output aria-label="selected workbench signal">{signal.id}</output>
      <button onClick={() => onSelectionLockChange(true)}>Lock target</button>
    </div>
  ),
}));

afterEach(cleanup);

describe('signal workspace', () => {
  it('keeps the selected card and workbench target synchronized', () => {
    render(
      <SignalWorkspace
        feed={feed([signal('one'), signal('two'), signal('three')])}
        env={{} as PublicEnv}
      />,
    );

    expect(
      screen.getByLabelText('selected workbench signal'),
    ).toHaveTextContent('one');

    fireEvent.click(screen.getByRole('button', { name: /0xtwo/i }));

    expect(
      screen.getByLabelText('selected workbench signal'),
    ).toHaveTextContent('two');
    expect(screen.getByRole('button', { name: /0xtwo/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('freezes card selection while an order interaction is locked', () => {
    render(
      <SignalWorkspace
        feed={feed([signal('one'), signal('two'), signal('three')])}
        env={{} as PublicEnv}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /0xtwo/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Lock target' }));

    for (const option of screen.getAllByRole('button', { name: /^Fade / })) {
      expect(option).toBeDisabled();
    }
    fireEvent.click(screen.getByRole('button', { name: /0xthree/i }));
    expect(
      screen.getByLabelText('selected workbench signal'),
    ).toHaveTextContent('two');
  });

  it('labels Explorer performance as net and exposes activity-backed volume', () => {
    render(
      <SignalWorkspace
        feed={feed([
          signal('one', {
            performanceBasis: 'net',
            analyticsProvider: 'Nado Explorer',
            volume30dUsd: 75_000,
            activeDays: 22,
          }),
        ])}
        env={{} as PublicEnv}
      />,
    );

    expect(screen.getAllByText('30D NET PNL')).toHaveLength(2);
    expect(screen.getByText('$75,000')).toBeInTheDocument();
    expect(screen.getByText('22 active days')).toBeInTheDocument();
  });
});

function feed(signals: FadeSignal[]): FadeSignalFeed {
  return {
    status: 'live',
    checkedAt: '2026-09-04T12:00:00.000Z',
    signals,
  };
}

function signal(id: string, overrides: Partial<FadeSignal> = {}): FadeSignal {
  return {
    id,
    alias: 'NADO ACCOUNT',
    sourceVenue: 'nado',
    walletAddress: `0x${id.padEnd(40, '0')}`,
    symbol: `${id.toUpperCase()}-PERP`,
    positionSide: id === 'two' ? 'short' : 'long',
    positionNotionalUsd: 1_000,
    performancePnlUsd: -250,
    performanceWindowDays: 30,
    performanceWindowComplete: true,
    closedOrderCount: 10,
    candidateCount: 12,
    winRatePercent: 30,
    liquidationCount: 0,
    updatedAt: '2026-09-04T12:00:00.000Z',
    dataSourceLabel: 'Nado public archive + gateway',
    isLiveData: true,
    ...overrides,
  };
}
