import { NextRequest, NextResponse } from 'next/server';
import { isAddress } from 'viem';
import { getPublicEnv } from '@/config/env';
import { createReadOnlyNadoClient } from '@/lib/nado/client';
import { getNadoPortfolio } from '@/lib/nado/positions';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet');
  if (!wallet || !isAddress(wallet)) {
    return NextResponse.json(
      { error: 'A valid EVM wallet address is required.' },
      { status: 400 },
    );
  }

  try {
    const env = getPublicEnv();
    const portfolio = await getNadoPortfolio({
      client: createReadOnlyNadoClient(env.NEXT_PUBLIC_NADO_NETWORK),
      wallet,
      subaccountName: env.NEXT_PUBLIC_NADO_SUBACCOUNT_NAME,
      expectedBuilderId: env.NEXT_PUBLIC_NADO_BUILDER_ID,
    });
    return NextResponse.json(portfolio, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json(
      { error: 'Nado portfolio is temporarily unavailable.' },
      { status: 503 },
    );
  }
}
