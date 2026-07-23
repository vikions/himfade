import { packOrderAppendix, unpackOrderAppendix } from '@nadohq/shared';
import { z } from 'zod';

const builderSchema = z.object({
  builderId: z.number().int().min(1).max(65535),
  builderFeeRate: z.number().int().min(0).max(1023),
});

export type NadoAppendixInput = z.infer<typeof builderSchema> & {
  reduceOnly?: boolean;
  orderExecutionType?: 'default' | 'ioc' | 'fok' | 'post_only';
};

export type DecodedNadoAppendix = {
  version: 1;
  orderType: 0 | 1 | 2 | 3;
  orderExecutionType: 'default' | 'ioc' | 'fok' | 'post_only';
  reduceOnly: boolean;
  isolated: boolean;
  builderId: number;
  builderFeeRate: number;
};

const orderTypeValues = {
  default: 0,
  ioc: 1,
  fok: 2,
  post_only: 3,
} as const;

export function buildNadoAppendix(input: NadoAppendixInput): bigint {
  const builder = builderSchema.parse(input);
  return packOrderAppendix({
    orderExecutionType: input.orderExecutionType ?? 'ioc',
    reduceOnly: input.reduceOnly ?? false,
    builder,
  });
}

export function decodeNadoAppendix(value: bigint | string): DecodedNadoAppendix {
  const unpacked = unpackOrderAppendix(value);
  if (!unpacked.builder) {
    throw new Error('Nado appendix does not contain builder attribution.');
  }
  return {
    version: 1,
    orderType: orderTypeValues[unpacked.orderExecutionType],
    orderExecutionType: unpacked.orderExecutionType,
    reduceOnly: unpacked.reduceOnly ?? false,
    isolated: Boolean(unpacked.isolated),
    builderId: unpacked.builder.builderId,
    builderFeeRate: unpacked.builder.builderFeeRate,
  };
}
