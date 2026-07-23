import Decimal from 'decimal.js';
import { z } from 'zod';
import type { PacificaApi } from './api';
import { buildPacificaOperation, signPacificaOperation, type PacificaSigner } from './signing';

const approvalSchema = z.object({
  builder_code: z.string(),
  description: z.string().optional(),
  max_fee_rate: z.string(),
  updated_at: z.number().optional(),
});
const approvalsSchema = z.union([
  z.array(approvalSchema),
  z.object({ success: z.boolean(), data: z.array(approvalSchema) }).transform((v) => v.data),
]);

export async function getPacificaBuilderApproval(input: {
  api: PacificaApi;
  account: string;
  builderCode: string;
}) {
  const approvals = await input.api.request({
    path: `/account/builder_codes/approvals?account=${encodeURIComponent(input.account)}`,
    schema: approvalsSchema,
  });
  return approvals.find((item) => item.builder_code === input.builderCode) ?? null;
}

export async function approvePacificaBuilder(input: {
  api: PacificaApi;
  account: string;
  builderCode: string;
  maxFeeRate: string;
  signMessage: PacificaSigner;
}) {
  const operation = buildPacificaOperation({
    type: 'approve_builder_code',
    expiryWindow: 5_000,
    data: { builder_code: input.builderCode, max_fee_rate: input.maxFeeRate },
  });
  const body = await signPacificaOperation({
    account: input.account,
    operation,
    signMessage: input.signMessage,
  });
  await input.api.raw({ method: 'POST', path: '/account/builder_codes/approve', body });
  return getPacificaBuilderApproval(input);
}

export async function revokePacificaBuilder(input: {
  api: PacificaApi;
  account: string;
  builderCode: string;
  signMessage: PacificaSigner;
}) {
  const operation = buildPacificaOperation({
    type: 'revoke_builder_code',
    expiryWindow: 5_000,
    data: { builder_code: input.builderCode },
  });
  const body = await signPacificaOperation({ account: input.account, operation, signMessage: input.signMessage });
  return input.api.raw({ method: 'POST', path: '/account/builder_codes/revoke', body });
}

export function isPacificaFeeApprovalSufficient(
  approvedMaximum: string | undefined,
  required: string,
) {
  return approvedMaximum !== undefined && new Decimal(approvedMaximum).gte(required);
}
