import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { pacificaEndpoints } from '@/config/venues';

const querySchema = z.object({
  network: z.enum(['testnet', 'mainnet']),
  path: z.string().startsWith('/').max(300),
});

const allowedPaths = [
  '/info',
  '/book',
  '/account',
  '/positions',
  '/trades/history',
  '/account/builder_codes/approvals',
  '/account/builder_codes/approve',
  '/account/builder_codes/revoke',
  '/orders/create_market',
  '/builder/overview',
  '/builder/trades',
  '/leaderboard/builder_code',
];

const buckets = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(request: NextRequest): boolean {
  const key = request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'local';
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= 60;
}

function resolveTarget(request: NextRequest) {
  const parsed = querySchema.parse({
    network: request.nextUrl.searchParams.get('network'),
    path: request.nextUrl.searchParams.get('path'),
  });
  const requested = new URL(parsed.path, 'https://local.invalid');
  if (!allowedPaths.includes(requested.pathname)) throw new Error('Unsupported Pacifica proxy path.');
  return `${pacificaEndpoints[parsed.network]}${requested.pathname}${requested.search}`;
}

async function forward(request: NextRequest) {
  if (!checkRateLimit(request)) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });
  try {
    const target = resolveTarget(request);
    const method = request.method === 'POST' ? 'POST' : 'GET';
    const upstream = await fetch(target, {
      method,
      headers: { accept: 'application/json', ...(method === 'POST' ? { 'content-type': 'application/json' } : {}) },
      body: method === 'POST' ? JSON.stringify(await request.json()) : undefined,
      cache: 'no-store',
    });
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json', 'cache-control': 'no-store' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Proxy request failed.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export const GET = forward;
export const POST = forward;
