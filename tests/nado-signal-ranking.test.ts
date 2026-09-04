import { describe, expect, it } from 'vitest';
import {
  aggregatePerformance,
  buildCandidateScores,
  candidateKey,
  selectWorstActiveCandidate,
  selectWorstActiveCandidates,
  type ActivePosition,
} from '@/lib/nado/signal-ranking';

const DAY = 86_400_000;

describe('Nado signal ranking', () => {
  it('groups recent cross-margin matches and ranks the worst observed PnL first', () => {
    const scores = buildCandidateScores(
      [
        match('0xaaa', -8, 1_000),
        match('0xbbb', -3, 2_000),
        match('0xaaa', -4, 3_000),
        match('0xccc', -50, 4_000, true),
        match('0xddd', 7, 5_000),
      ],
      3,
    );

    expect(scores).toEqual([
      expect.objectContaining({
        subaccountOwner: '0xaaa',
        observedRealizedPnlUsd: -12,
        observedMatchCount: 2,
        lastActivityAt: 3_000,
      }),
      expect.objectContaining({
        subaccountOwner: '0xbbb',
        observedRealizedPnlUsd: -3,
      }),
      expect.objectContaining({
        subaccountOwner: '0xddd',
        observedRealizedPnlUsd: 7,
      }),
    ]);
  });

  it('selects the worst candidate that still has an open position', () => {
    const scores = buildCandidateScores(
      [match('0xflat', -50, 1_000), match('0xactive', -12, 2_000)],
      10,
    );
    const position: ActivePosition = {
      symbol: 'ETH',
      productId: 2,
      side: 'long',
      baseAmount: 0.25,
      notionalUsd: 800,
    };
    const active = new Map([[candidateKey(scores[1]!), position]]);

    expect(selectWorstActiveCandidate(scores, active)).toEqual({
      candidate: scores[1],
      position,
    });
  });

  it('selects multiple active candidates in ranking order up to the limit', () => {
    const scores = buildCandidateScores(
      [
        match('0xflat', -50, 1_000),
        match('0xworst', -30, 2_000),
        match('0xsecond', -20, 3_000),
        match('0xthird', -10, 4_000),
      ],
      10,
    );
    const position: ActivePosition = {
      symbol: 'BTC-PERP',
      productId: 1,
      side: 'long',
      baseAmount: 0.1,
      notionalUsd: 8_000,
    };
    const active = new Map(
      scores
        .filter((candidate) => candidate.subaccountOwner !== '0xflat')
        .map((candidate) => [candidateKey(candidate), position]),
    );

    expect(
      selectWorstActiveCandidates(scores, active, 2).map(
        ({ candidate }) => candidate.subaccountOwner,
      ),
    ).toEqual(['0xworst', '0xsecond']);
  });

  it('computes closed-order PnL and win rate over a complete 30-day window', () => {
    const now = Date.UTC(2026, 8, 4);
    const result = aggregatePerformance({
      now,
      historyComplete: true,
      orders: [
        order(now - DAY, -20, 1),
        order(now - 2 * DAY, 5, -1),
        order(now - 3 * DAY, 0, 1),
        order(now - 4 * DAY, 100, 0),
        order(now - 31 * DAY, -999, 1),
      ],
      liquidationTimestamps: [now - DAY, now - 31 * DAY],
    });

    expect(result).toEqual({
      realizedPnlUsd: -15,
      winRatePercent: 33.3,
      closedOrderCount: 3,
      liquidationCount: 1,
      observedDays: 30,
      windowComplete: true,
      observedFrom: new Date(now - 30 * DAY).toISOString(),
    });
  });

  it('labels bounded history as an incomplete observed window', () => {
    const now = Date.UTC(2026, 8, 4);
    const result = aggregatePerformance({
      now,
      historyComplete: false,
      orders: [order(now - 2 * DAY, -4, 1), order(now - 6 * DAY, 1, -1)],
      liquidationTimestamps: [],
    });

    expect(result.observedDays).toBe(6);
    expect(result.windowComplete).toBe(false);
    expect(result.observedFrom).toBe(new Date(now - 6 * DAY).toISOString());
  });
});

function match(
  subaccountOwner: string,
  realizedPnlUsd: number,
  timestamp: number,
  isolated = false,
) {
  return {
    subaccountOwner,
    subaccountName: 'default',
    realizedPnlUsd,
    timestamp,
    isolated,
  };
}

function order(
  timestamp: number,
  realizedPnlUsd: number,
  closedAmount: number,
) {
  return { timestamp, realizedPnlUsd, closedAmount };
}
