import { z } from 'zod';

const apiEnvelopeSchema = z
  .object({
    success: z.boolean().optional(),
    data: z.unknown().optional(),
    error: z.unknown().optional(),
    code: z.unknown().optional(),
  })
  .passthrough();

export type PacificaNetwork = 'testnet' | 'mainnet';

export class PacificaApi {
  constructor(readonly network: PacificaNetwork) {}

  async request<T>(input: {
    method?: 'GET' | 'POST';
    path: string;
    body?: unknown;
    schema: z.ZodType<T>;
  }): Promise<T> {
    const url = new URL('/api/pacifica', window.location.origin);
    url.searchParams.set('network', this.network);
    url.searchParams.set('path', input.path);
    const response = await fetch(url, {
      method: input.method ?? 'GET',
      headers: input.body ? { 'content-type': 'application/json' } : undefined,
      body: input.body ? JSON.stringify(input.body) : undefined,
    });
    const raw: unknown = await response.json();
    if (!response.ok) throw new Error(`Pacifica ${response.status}: ${JSON.stringify(raw)}`);
    return input.schema.parse(raw);
  }

  async raw(input: { method?: 'GET' | 'POST'; path: string; body?: unknown }) {
    return this.request({ ...input, schema: apiEnvelopeSchema });
  }
}
