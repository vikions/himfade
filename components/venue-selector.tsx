'use client';

import Image from 'next/image';
import { CaretDown } from '@phosphor-icons/react';
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
        <span className="venue-logo venue-logo-nado" aria-hidden="true">
          <Image src="/brands/nado.svg" alt="" width={24} height={25} />
        </span>
        <span className="text-left">
          <strong>NADO</strong>
          <small>Primary route · Ink · EVM wallet</small>
        </span>
        <AttributionBadge ready={nadoReady}>
          {nadoReady ? 'Attribution ready' : 'Builder config missing'}
        </AttributionBadge>
      </button>
      <button
        type="button"
        className={`venue-secondary ${venue === 'pacifica' ? 'venue-selected' : ''}`}
        onClick={() => onChange('pacifica')}
        aria-pressed={venue === 'pacifica'}
      >
        <span className="venue-logo venue-logo-pacifica" aria-hidden="true">
          <Image src="/brands/pacifica.svg" alt="" width={25} height={25} />
        </span>
        <span className="text-left">
          <strong>PACIFICA</strong>
          <small>Secondary route · Solana wallet</small>
        </span>
        <AttributionBadge ready={pacificaReady}>
          {pacificaReady ? 'Configured' : 'Config missing'}
        </AttributionBadge>
        <CaretDown
          size={14}
          className={venue === 'pacifica' ? 'rotate-180' : ''}
        />
      </button>
    </div>
  );
}
