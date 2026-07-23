import type { TradeReceipt } from './types';

const STORAGE_KEY = 'fade-him:receipts:v1';
const REDACT_KEYS = /signature|authorization|token|secret|private.?key|session/i;

export function sanitizeProtocolData(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeProtocolData);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        REDACT_KEYS.test(key) ? '[REDACTED]' : sanitizeProtocolData(item),
      ]),
    );
  }
  return value;
}

export function loadReceipts(): TradeReceipt[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? (parsed as TradeReceipt[]) : [];
  } catch {
    return [];
  }
}

export function saveReceipt(receipt: TradeReceipt): void {
  if (typeof window === 'undefined') return;
  const safeReceipt = {
    ...receipt,
    sanitizedRawResponse: sanitizeProtocolData(receipt.sanitizedRawResponse),
    officialEvidence: sanitizeProtocolData(receipt.officialEvidence),
  };
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([safeReceipt, ...loadReceipts()].slice(0, 25)),
  );
}

export function clearReceipts(): void {
  if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_KEY);
}
