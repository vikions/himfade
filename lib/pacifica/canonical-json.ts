export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export function recursivelySortJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(recursivelySortJson);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, recursivelySortJson(value[key] as JsonValue)]),
    );
  }
  return value;
}

export function compactCanonicalJson(value: JsonValue): string {
  return JSON.stringify(recursivelySortJson(value));
}

export function pacificaSigningBytes(value: JsonValue): Uint8Array {
  return new TextEncoder().encode(compactCanonicalJson(value));
}
