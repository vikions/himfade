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
  id: 'nado-mainnet-signal-feed',
  alias: 'THE ETERNAL BULL',
  sourceVenue: 'nado',
  walletAddress: '0x000000000000000000000000000000000000dEaD',
  symbol: 'ETH',
  positionSide: 'long',
  positionNotionalUsd: 18420,
  updatedAt: '2026-07-23T00:00:00.000Z',
  dataSourceLabel: 'Nado mainnet signal adapter',
  isLiveData: false,
};
