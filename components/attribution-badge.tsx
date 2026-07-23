import { SealCheck, WarningCircle } from '@phosphor-icons/react/dist/ssr';

export function AttributionBadge({ ready, children }: { ready: boolean; children: React.ReactNode }) {
  return <span className={ready ? 'attribution attribution-ready' : 'attribution attribution-missing'}>{ready ? <SealCheck size={14} /> : <WarningCircle size={14} />}{children}</span>;
}
