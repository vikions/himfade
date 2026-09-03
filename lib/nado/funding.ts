import type { NadoClient } from '@nadohq/client';
import BigNumber from 'bignumber.js';
import Decimal from 'decimal.js';
import type { Address, Hash } from 'viem';
import type { PositionSide } from '@/lib/trading/types';
import { fromNadoX18 } from '@/lib/nado/markets';

const QUOTE_DECIMALS = 6;
const QUOTE_PRODUCT_ID = 0;

export type NadoAccountOverview = {
  exists: boolean;
  walletBalanceUsd: string;
  accountEquityUsd?: string;
  availableCollateralUsd?: string;
  maximumBaseAmount?: string;
  maximumNotionalUsd?: string;
};

export function toQuoteTokenUnits(amountUsd: string): string {
  const amount = new Decimal(amountUsd);
  if (!amount.isFinite() || !amount.isPositive()) {
    throw new Error('Deposit amount must be greater than zero.');
  }
  if (amount.decimalPlaces() > QUOTE_DECIMALS) {
    throw new Error(
      `Deposit amount supports up to ${QUOTE_DECIMALS} decimal places.`,
    );
  }
  return amount.mul(new Decimal(10).pow(QUOTE_DECIMALS)).toFixed(0);
}

export function fromQuoteTokenUnits(amount: bigint): string {
  return new Decimal(amount.toString())
    .div(new Decimal(10).pow(QUOTE_DECIMALS))
    .toString();
}

async function waitForSuccess(client: NadoClient, hash: Hash): Promise<void> {
  const receipt = await client.context.publicClient.waitForTransactionReceipt({
    hash,
  });
  if (receipt.status !== 'success') {
    throw new Error('The wallet transaction was not completed.');
  }
}

export async function depositNadoCollateral(input: {
  client: NadoClient;
  wallet: Address;
  subaccountName?: string;
  amountUsd: string;
  onStatus?: (
    status: 'checking' | 'approving' | 'depositing' | 'confirming',
  ) => void;
}): Promise<{ approvalTxHash?: Hash; depositTxHash: Hash }> {
  input.onStatus?.('checking');
  const amount = toQuoteTokenUnits(input.amountUsd);
  const allowance = await input.client.spot.getTokenAllowance({
    address: input.wallet,
    productId: QUOTE_PRODUCT_ID,
  });
  let approvalTxHash: Hash | undefined;

  if (allowance.lt(new BigNumber(amount))) {
    input.onStatus?.('approving');
    approvalTxHash = await input.client.spot.approveAllowance({
      productId: QUOTE_PRODUCT_ID,
      amount,
    });
    await waitForSuccess(input.client, approvalTxHash);
  }

  input.onStatus?.('depositing');
  const depositTxHash = await input.client.spot.deposit({
    subaccountName: input.subaccountName ?? 'default',
    productId: QUOTE_PRODUCT_ID,
    amount,
  });
  input.onStatus?.('confirming');
  await waitForSuccess(input.client, depositTxHash);

  return { approvalTxHash, depositTxHash };
}

export async function getNadoAccountOverview(input: {
  client: NadoClient;
  wallet: Address;
  subaccountName?: string;
  productId: number;
  side: PositionSide;
  price: string;
}): Promise<NadoAccountOverview> {
  const subaccountName = input.subaccountName ?? 'default';
  const [walletBalance, summary] = await Promise.all([
    input.client.spot.getTokenWalletBalance({
      address: input.wallet,
      productId: QUOTE_PRODUCT_ID,
    }),
    input.client.subaccount.getSubaccountSummary({
      subaccountOwner: input.wallet,
      subaccountName,
    }),
  ]);

  const overview: NadoAccountOverview = {
    exists: summary.exists,
    walletBalanceUsd: fromQuoteTokenUnits(walletBalance),
  };
  if (!summary.exists) return overview;

  const maximumBaseAmount = await input.client.market.getMaxOrderSize({
    subaccountOwner: input.wallet,
    subaccountName,
    productId: input.productId,
    price: new BigNumber(input.price),
    side: input.side,
    reduceOnly: false,
  });

  const maximumBase = fromNadoX18(maximumBaseAmount);
  return {
    ...overview,
    accountEquityUsd: fromNadoX18(summary.health.unweighted.health),
    availableCollateralUsd: fromNadoX18(summary.health.initial.health),
    maximumBaseAmount: maximumBase,
    maximumNotionalUsd: new Decimal(maximumBase)
      .mul(input.price)
      .toFixed(2, Decimal.ROUND_DOWN),
  };
}
