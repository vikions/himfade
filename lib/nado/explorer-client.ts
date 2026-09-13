import { z } from 'zod';

const LEADERBOARD_PATH = '/api/traders/leaderboard';
const DEFAULT_BASE_URL = 'https://nadoexplorer.com';

const leaderboardRowSchema = z
  .object({
    entityType: z.literal('subaccount'),
    entityId: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
    walletAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
    subaccount: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
    periodDays: z.number().int().positive(),
    periodStart: z.string(),
    periodEnd: z.string(),
    volumeUsd: z.number().finite().nonnegative(),
    pnlUsd: z.number().finite(),
    feesUsd: z.number().finite().nonnegative(),
    winRate: z.number().finite().min(0).max(1),
    closedTrades: z.number().int().nonnegative(),
    activeDays: z.number().int().nonnegative(),
    equityUsd: z.number().finite(),
    roi: z.number().finite().nullable().optional(),
    fillCount: z.number().int().nonnegative(),
    lastActivityAt: z.string(),
    maxDrawdownUsd: z.number().finite().nonnegative().nullable().optional(),
    maxDrawdownPct: z.number().finite().nonnegative().nullable().optional(),
  })
  .passthrough();

const leaderboardResponseSchema = z
  .object({
    hasMore: z.boolean(),
    limit: z.number().int(),
    offset: z.number().int(),
    rows: z.array(leaderboardRowSchema),
  })
  .passthrough();

const livePositionsResponseSchema = z
  .object({
    liveTables: z
      .object({
        positions: z.array(
          z
            .object({
              productId: z.number().int(),
              symbol: z.string(),
            })
            .passthrough(),
        ),
      })
      .passthrough(),
  })
  .passthrough();

export type ExplorerLeaderboardRow = z.infer<typeof leaderboardRowSchema>;

type Fetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export class NadoExplorerClient {
  private readonly baseUrl: string;
  private readonly fetcher: Fetcher;
  private readonly timeoutMs: number;

  constructor(
    input: {
      baseUrl?: string;
      fetcher?: Fetcher;
      timeoutMs?: number;
    } = {},
  ) {
    this.baseUrl = input.baseUrl ?? DEFAULT_BASE_URL;
    this.fetcher = input.fetcher ?? fetch;
    this.timeoutMs = input.timeoutMs ?? 5_000;
  }

  async getLosingSubaccounts(input: {
    maxPnlUsd: number;
  }): Promise<ExplorerLeaderboardRow[]> {
    const url = new URL(LEADERBOARD_PATH, this.baseUrl);
    url.search = new URLSearchParams({
      entity: 'subaccount',
      period: '30',
      sort: 'pnl',
      limit: '50',
      maxPnl: String(input.maxPnlUsd),
      minVolume: '1000',
      minTrades: '10',
      minActiveDays: '2',
      minEquity: '1',
    }).toString();

    const response = await this.fetcher(url.toString(), {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(this.timeoutMs),
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(`Nado Explorer request failed with ${response.status}`);
    }

    return leaderboardResponseSchema.parse(await response.json()).rows;
  }

  async hasOpenPosition(subaccount: string): Promise<boolean> {
    const url = new URL(
      `/api/traders/${encodeURIComponent(subaccount)}/live`,
      this.baseUrl,
    );
    url.searchParams.set('section', 'positions');
    const response = await this.fetcher(url.toString(), {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(this.timeoutMs),
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(`Nado Explorer request failed with ${response.status}`);
    }

    return (
      livePositionsResponseSchema.parse(await response.json()).liveTables
        .positions.length > 0
    );
  }
}
