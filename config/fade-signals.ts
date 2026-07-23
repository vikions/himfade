export type FadeSignal = {
  id: string;
  alias: string;
  sourceVenue: 'nado' | 'pacifica';
  walletAddress: string;
  symbol: string;
  positionSide: 'long' | 'short';
  positionNotionalUsd?: number;
  pnl1dUsd?: number;
  pnl7dUsd?: number;
  pnl30dUsd?: number;
  winRatePercent?: number;
  liquidationCount?: number;
  updatedAt: string;
  dataSourceLabel: string;
  dataSourceUrl?: string;
  isLiveData: boolean;
};

export const featuredSignal: FadeSignal = {
  id: 'demo-eternal-bull',
  alias: 'THE ETERNAL BULL',
  sourceVenue: 'nado',
  walletAddress: '0x000000000000000000000000000000000000dEaD',
  symbol: 'ETH',
  positionSide: 'long',
  positionNotionalUsd: 18420,
  pnl1dUsd: -730,
  pnl7dUsd: -4210,
  pnl30dUsd: -12840,
  winRatePercent: 28,
  liquidationCount: 4,
  updatedAt: '2026-07-13T00:00:00.000Z',
  dataSourceLabel: 'Demo dossier — replace with verified public protocol data',
  isLiveData: false,
};
