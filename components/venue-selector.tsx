'use client';

import { CaretDown, Lightning, Waves } from '@phosphor-icons/react';
import type { Venue } from '@/lib/trading/types';
import { AttributionBadge } from './attribution-badge';

export function VenueSelector({
  venue,
  onChange,
  nadoReady,
  pacificaReady,
}: {
  venue: Venue;
  onChange: (venue: Venue) => void;
  nadoReady: boolean;
  pacificaReady: boolean;
}) {
  return (
    <div className="space-y-2" aria-label="Execution venue">
      <button
        type="button"
        className={`venue-primary ${venue === 'nado' ? 'venue-selected' : ''}`}
        onClick={() => onChange('nado')}
        aria-pressed={venue === 'nado'}
      >
        <span className="venue-icon"><Lightning size={19} weight="fill" /></span>
        <span className="text-left"><strong>NADO</strong><small>Primary route · Ink · EVM wallet</small></span>
        <AttributionBadge ready={nadoReady}>{nadoReady ? 'Attribution ready' : 'Builder config missing'}</AttributionBadge>
      </button>
      <button
        type="button"
        className={`venue-secondary ${venue === 'pacifica' ? 'venue-selected' : ''}`}
        onClick={() => onChange('pacifica')}
        aria-pressed={venue === 'pacifica'}
      >
        <Waves size={17} />
        <span className="text-left"><strong>PACIFICA</strong><small>Secondary route · Solana wallet</small></span>
        <AttributionBadge ready={pacificaReady}>{pacificaReady ? 'Configured' : 'Config missing'}</AttributionBadge>
        <CaretDown size={14} className={venue === 'pacifica' ? 'rotate-180' : ''} />
      </button>
    </div>
  );
}
