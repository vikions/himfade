import type { PositionSide } from './types';

export function reverseSide(side: PositionSide): PositionSide {
  return side === 'long' ? 'short' : 'long';
}
