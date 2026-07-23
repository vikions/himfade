import { z } from 'zod';

const optionalInteger = z.preprocess(
  (value) => (value === '' || value === undefined ? undefined : value),
  z.coerce.number().int().optional(),
);

const optionalDecimalString = z.preprocess(
  (value) => (value === '' || value === undefined ? undefined : value),
  z.string().regex(/^\d+(?:\.\d+)?$/).optional(),
);

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_MODE: z.enum(['testnet', 'mainnet']).default('testnet'),
  NEXT_PUBLIC_ENABLE_LIVE_TRADING: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  NEXT_PUBLIC_NADO_NETWORK: z
    .enum(['inkTestnet', 'inkMainnet'])
    .default('inkTestnet'),
  NEXT_PUBLIC_NADO_BUILDER_ID: optionalInteger.pipe(
    z.number().int().min(1).max(65535).optional(),
  ),
  NEXT_PUBLIC_NADO_BUILDER_FEE_RATE_UNITS: optionalInteger.pipe(
    z.number().int().min(0).max(1023).optional(),
  ),
  NEXT_PUBLIC_NADO_SUBACCOUNT_NAME: z.string().min(1).max(12).default('default'),
  NEXT_PUBLIC_PACIFICA_NETWORK: z
    .enum(['testnet', 'mainnet'])
    .default('testnet'),
  NEXT_PUBLIC_PACIFICA_BUILDER_CODE: z.preprocess(
    (value) => (value === '' || value === undefined ? undefined : value),
    z.string().regex(/^[A-Za-z0-9]{1,16}$/).optional(),
  ),
  NEXT_PUBLIC_PACIFICA_MAX_FEE_RATE: optionalDecimalString,
  NEXT_PUBLIC_DEFAULT_SYMBOL: z.string().min(1).default('ETH'),
  NEXT_PUBLIC_DEFAULT_NOTIONAL_USD: z.coerce.number().positive().default(10),
  NEXT_PUBLIC_MAX_NOTIONAL_USD: z.coerce.number().positive().default(100),
  NEXT_PUBLIC_MAX_SLIPPAGE_BPS: z.coerce.number().int().min(1).max(1000).default(100),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export function readPublicEnv(
  source: Record<string, string | undefined> = process.env,
): PublicEnv {
  return publicEnvSchema.parse(source);
}

export function getPublicEnv(): PublicEnv {
  return readPublicEnv({
    NEXT_PUBLIC_APP_MODE: process.env.NEXT_PUBLIC_APP_MODE,
    NEXT_PUBLIC_ENABLE_LIVE_TRADING:
      process.env.NEXT_PUBLIC_ENABLE_LIVE_TRADING,
    NEXT_PUBLIC_NADO_NETWORK: process.env.NEXT_PUBLIC_NADO_NETWORK,
    NEXT_PUBLIC_NADO_BUILDER_ID: process.env.NEXT_PUBLIC_NADO_BUILDER_ID,
    NEXT_PUBLIC_NADO_BUILDER_FEE_RATE_UNITS:
      process.env.NEXT_PUBLIC_NADO_BUILDER_FEE_RATE_UNITS,
    NEXT_PUBLIC_NADO_SUBACCOUNT_NAME:
      process.env.NEXT_PUBLIC_NADO_SUBACCOUNT_NAME,
    NEXT_PUBLIC_PACIFICA_NETWORK: process.env.NEXT_PUBLIC_PACIFICA_NETWORK,
    NEXT_PUBLIC_PACIFICA_BUILDER_CODE:
      process.env.NEXT_PUBLIC_PACIFICA_BUILDER_CODE,
    NEXT_PUBLIC_PACIFICA_MAX_FEE_RATE:
      process.env.NEXT_PUBLIC_PACIFICA_MAX_FEE_RATE,
    NEXT_PUBLIC_DEFAULT_SYMBOL: process.env.NEXT_PUBLIC_DEFAULT_SYMBOL,
    NEXT_PUBLIC_DEFAULT_NOTIONAL_USD:
      process.env.NEXT_PUBLIC_DEFAULT_NOTIONAL_USD,
    NEXT_PUBLIC_MAX_NOTIONAL_USD:
      process.env.NEXT_PUBLIC_MAX_NOTIONAL_USD,
    NEXT_PUBLIC_MAX_SLIPPAGE_BPS:
      process.env.NEXT_PUBLIC_MAX_SLIPPAGE_BPS,
  });
}

export type VenueConfigStatus = {
  ready: boolean;
  missing: string[];
};

export function getVenueConfigStatus(
  env: PublicEnv,
  venue: 'nado' | 'pacifica',
): VenueConfigStatus {
  const missing: string[] = [];
  if (venue === 'nado') {
    if (env.NEXT_PUBLIC_NADO_BUILDER_ID === undefined)
      missing.push('NEXT_PUBLIC_NADO_BUILDER_ID');
    if (env.NEXT_PUBLIC_NADO_BUILDER_FEE_RATE_UNITS === undefined)
      missing.push('NEXT_PUBLIC_NADO_BUILDER_FEE_RATE_UNITS');
  } else {
    if (!env.NEXT_PUBLIC_PACIFICA_BUILDER_CODE)
      missing.push('NEXT_PUBLIC_PACIFICA_BUILDER_CODE');
    if (!env.NEXT_PUBLIC_PACIFICA_MAX_FEE_RATE)
      missing.push('NEXT_PUBLIC_PACIFICA_MAX_FEE_RATE');
  }
  return { ready: missing.length === 0, missing };
}
