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
  performancePnlUsd?: number;
  performanceWindowDays?: number;
  performanceWindowComplete?: boolean;
  performanceWindowStart?: string;
  closedOrderCount?: number;
  candidateCount?: number;
  selectionMethod?: string;
  winRatePercent?: number;
  liquidationCount?: number;
  updatedAt: string;
  dataSourceLabel: string;
  dataSourceUrl?: string;
  isLiveData: boolean;
};

export type FadeSignalFeed = {
  status: 'live' | 'unavailable';
  checkedAt: string;
  signals: FadeSignal[];
  reason?: string;
};

export const featuredSignal: FadeSignal = {
  id: 'nado-mainnet-signal-feed',
  alias: 'NO VERIFIED TARGET',
  sourceVenue: 'nado',
  walletAddress: '',
  symbol: 'ETH',
  positionSide: 'long',
  updatedAt: '1970-01-01T00:00:00.000Z',
  dataSourceLabel: 'Nado mainnet signal adapter',
  isLiveData: false,
};
