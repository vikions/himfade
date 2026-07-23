import { describe, expect, it, vi } from 'vitest';
import type { NadoClient } from '@nadohq/client';
import { submitNadoOrder, waitForNadoFill } from '@/lib/nado/orders';
import { preparePacificaMarketOrder } from '@/lib/pacifica/orders';
import { isPacificaFeeApprovalSufficient } from '@/lib/pacifica/builder-approval';
import type { PacificaApi } from '@/lib/pacifica/api';
import type { PreparedOrder } from '@/lib/trading/types';

const preparedNado: PreparedOrder = {
  venue: 'nado', symbol: 'ETH', side: 'short', requestedNotionalUsd: '10',
  estimatedBaseAmount: '0.1', reduceOnly: false,
  attribution: { configured: true, label: 'Builder #7', details: { builderId: 7 } },
  payload: {}, debug: {},
};

describe('venue integration contracts with protocol mocks', () => {
  it('does not treat a rejected Nado order as accepted', async () => {
    const client = { market: { placeOrder: vi.fn().mockResolvedValue({
      status: 'success', data: { digest: '0xdead', error: 'insufficient health' },
    }) } } as unknown as NadoClient;
    await expect(submitNadoOrder(client, preparedNado)).rejects.toMatchObject({ code: 'ORDER_REJECTED' });
  });

  it('does not treat an accepted but unfilled Nado order as filled', async () => {
    const client = { market: { getHistoricalOrders: vi.fn().mockResolvedValue([]) } } as unknown as NadoClient;
    await expect(waitForNadoFill({
      client,
      submitted: { venue: 'nado', digest: '0xaccepted', accepted: true, submittedAt: new Date(0).toISOString(), raw: {} },
      timeoutMs: 0,
    })).rejects.toMatchObject({ code: 'FILL_TIMEOUT' });
  });

  it('requires a sufficient Pacifica approval maximum', () => {
    expect(isPacificaFeeApprovalSufficient(undefined, '0.001')).toBe(false);
    expect(isPacificaFeeApprovalSufficient('0.0009', '0.001')).toBe(false);
    expect(isPacificaFeeApprovalSufficient('0.001', '0.001')).toBe(true);
  });

  it('puts Pacifica builder attribution inside opening and closing signing data', async () => {
    const api = { request: vi.fn(async ({ path }: { path: string }) => {
      if (path === '/info') return { success: true, data: [{
        symbol: 'ETH', tick_size: '0.1', lot_size: '0.0001', min_order_size: '10',
        max_order_size: '5000000', max_leverage: 50, isolated_only: false,
      }] };
      return { success: true, data: { s: 'ETH', l: [[{ p: '3200', a: '1', n: 1 }], [{ p: '3201', a: '1', n: 1 }]], t: Date.now() } };
    }) } as unknown as PacificaApi;
    const open = await preparePacificaMarketOrder({
      api, symbol: 'ETH', side: 'short', notionalUsd: '20', slippageBps: 100, builderCode: 'FADEHIM',
    });
    const close = await preparePacificaMarketOrder({
      api, symbol: 'ETH', side: 'long', notionalUsd: '20', slippageBps: 100,
      builderCode: 'FADEHIM', reduceOnly: true, exactBaseAmount: '0.0062',
    });
    expect((open.payload as { data: Record<string, unknown> }).data).toMatchObject({ builder_code: 'FADEHIM', reduce_only: false });
    expect((close.payload as { data: Record<string, unknown> }).data).toMatchObject({ builder_code: 'FADEHIM', reduce_only: true });
  });
});
