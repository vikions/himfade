import { z } from 'zod';
import type { PacificaApi } from './api';

const looseEnvelope = z.object({ success: z.boolean().optional(), data: z.unknown().optional() }).passthrough();

export async function getPacificaAttributionEvidence(input: { api: PacificaApi; account: string; builderCode: string }) {
  const account = encodeURIComponent(input.account);
  const code = encodeURIComponent(input.builderCode);
  const [userTrades, overview, builderTrades, leaderboard] = await Promise.all([
    input.api.request({ path: `/trades/history?account=${account}&builder_code=${code}`, schema: looseEnvelope }),
    input.api.request({ path: `/builder/overview?account=${account}`, schema: looseEnvelope }),
    input.api.request({ path: `/builder/trades?builder_code=${code}`, schema: looseEnvelope }),
    input.api.request({ path: `/leaderboard/builder_code?builder_code=${code}`, schema: looseEnvelope }),
  ]);
  return { userTrades, overview, builderTrades, leaderboard };
}
