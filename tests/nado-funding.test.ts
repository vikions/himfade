import BigNumber from 'bignumber.js';
import { describe, expect, it, vi } from 'vitest';
import type { NadoClient } from '@nadohq/client';
import {
  depositNadoCollateral,
  fromQuoteTokenUnits,
  getNadoAccountOverview,
  toNadoWithdrawalUnits,
  toQuoteTokenUnits,
  withdrawNadoCollateral,
} from '@/lib/nado/funding';

const x18 = new BigNumber(10).pow(18);

describe('Nado funding and capacity', () => {
  it('converts USDT0 wallet units without floating point drift', () => {
    expect(toQuoteTokenUnits('10.25')).toBe('10250000');
    expect(fromQuoteTokenUnits(12_500_000n)).toBe('12.5');
    expect(toNadoWithdrawalUnits('4.25')).toBe('4250000');
  });

  it('approves only when needed and deposits into the default subaccount', async () => {
    const waitForTransactionReceipt = vi
      .fn()
      .mockResolvedValue({ status: 'success' });
    const approveAllowance = vi.fn().mockResolvedValue('0xapprove');
    const deposit = vi.fn().mockResolvedValue('0xdeposit');
    const client = {
      spot: {
        getTokenAllowance: vi.fn().mockResolvedValue(new BigNumber(0)),
        approveAllowance,
        deposit,
      },
      context: { publicClient: { waitForTransactionReceipt } },
    } as unknown as NadoClient;

    const result = await depositNadoCollateral({
      client,
      wallet: '0x0000000000000000000000000000000000000001',
      subaccountName: 'default',
      amountUsd: '10',
    });

    expect(approveAllowance).toHaveBeenCalledWith({
      productId: 0,
      amount: '10000000',
    });
    expect(deposit).toHaveBeenCalledWith({
      subaccountName: 'default',
      productId: 0,
      amount: '10000000',
    });
    expect(waitForTransactionReceipt).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      approvalTxHash: '0xapprove',
      depositTxHash: '0xdeposit',
    });
  });

  it('uses Nado max_order_size for the connected account ceiling', async () => {
    const client = {
      spot: { getTokenWalletBalance: vi.fn().mockResolvedValue(2_000_000n) },
      subaccount: {
        getSubaccountSummary: vi.fn().mockResolvedValue({
          exists: true,
          balances: [],
          health: {
            unweighted: {
              health: new BigNumber(12).times(x18),
              assets: new BigNumber(12).times(x18),
              liabilities: new BigNumber(0),
            },
            initial: {
              health: new BigNumber('11.5').times(x18),
              assets: new BigNumber(12).times(x18),
              liabilities: new BigNumber('0.5').times(x18),
            },
            maintenance: {
              health: new BigNumber('11.8').times(x18),
              assets: new BigNumber(12).times(x18),
              liabilities: new BigNumber('0.2').times(x18),
            },
          },
        }),
      },
      market: {
        getMaxOrderSize: vi
          .fn()
          .mockResolvedValue(new BigNumber('0.05').times(x18)),
      },
    } as unknown as NadoClient;
    client.spot.getMaxWithdrawable = vi
      .fn()
      .mockResolvedValue(new BigNumber('4.25').times(x18));

    const overview = await getNadoAccountOverview({
      client,
      wallet: '0x0000000000000000000000000000000000000001',
      subaccountName: 'default',
      productId: 4,
      side: 'short',
      price: '2400',
    });

    expect(overview).toMatchObject({
      exists: true,
      walletBalanceUsd: '2',
      accountEquityUsd: '12',
      availableCollateralUsd: '11.5',
      maximumBaseAmount: '0.05',
      maximumNotionalUsd: '120.00',
      maximumWithdrawableUsd: '4.25',
    });
  });

  it('preserves deposited balance data when max_order_size is unavailable', async () => {
    const client = {
      spot: {
        getTokenWalletBalance: vi.fn().mockResolvedValue(0n),
        getMaxWithdrawable: vi
          .fn()
          .mockResolvedValue(new BigNumber(5).times(x18)),
      },
      subaccount: {
        getSubaccountSummary: vi.fn().mockResolvedValue({
          exists: true,
          balances: [],
          health: {
            unweighted: { health: new BigNumber(5).times(x18) },
            initial: { health: new BigNumber(5).times(x18) },
          },
        }),
      },
      market: {
        getMaxOrderSize: vi.fn().mockRejectedValue(new Error('unavailable')),
      },
    } as unknown as NadoClient;

    await expect(
      getNadoAccountOverview({
        client,
        wallet: '0x0000000000000000000000000000000000000001',
        subaccountName: 'default',
        productId: 2,
        side: 'short',
        price: '3200',
      }),
    ).resolves.toEqual({
      exists: true,
      walletBalanceUsd: '0',
      accountEquityUsd: '5',
      availableCollateralUsd: '5',
      maximumWithdrawableUsd: '5',
    });
  });

  it('signs a withdrawal only after checking the live maximum', async () => {
    const withdraw = vi.fn().mockResolvedValue({ data: { error: null } });
    const client = {
      spot: {
        getMaxWithdrawable: vi
          .fn()
          .mockResolvedValue(new BigNumber('4.5').times(x18)),
        withdraw,
      },
    } as unknown as NadoClient;

    await withdrawNadoCollateral({
      client,
      wallet: '0x0000000000000000000000000000000000000001',
      subaccountName: 'default',
      amountUsd: '4.25',
    });

    expect(withdraw).toHaveBeenCalledWith({
      subaccountName: 'default',
      productId: 0,
      amount: '4250000',
    });
  });

  it('rounds the x18 withdrawal quote down to USDT0 precision', async () => {
    const client = {
      spot: {
        getTokenWalletBalance: vi.fn().mockResolvedValue(0n),
        getMaxWithdrawable: vi
          .fn()
          .mockResolvedValue(new BigNumber('3.854936218936565297').times(x18)),
      },
      subaccount: {
        getSubaccountSummary: vi.fn().mockResolvedValue({
          exists: true,
          balances: [],
          health: {
            unweighted: { health: new BigNumber(5).times(x18) },
            initial: { health: new BigNumber(5).times(x18) },
          },
        }),
      },
      market: {
        getMaxOrderSize: vi.fn().mockRejectedValue(new Error('unavailable')),
      },
    } as unknown as NadoClient;

    const overview = await getNadoAccountOverview({
      client,
      wallet: '0x0000000000000000000000000000000000000001',
      subaccountName: 'default',
      productId: 2,
      side: 'short',
      price: '3200',
    });

    expect(overview.maximumWithdrawableUsd).toBe('3.854936');
  });

  it('blocks withdrawals above the engine maximum before requesting a signature', async () => {
    const withdraw = vi.fn();
    const client = {
      spot: {
        getMaxWithdrawable: vi
          .fn()
          .mockResolvedValue(new BigNumber(2).times(x18)),
        withdraw,
      },
    } as unknown as NadoClient;

    await expect(
      withdrawNadoCollateral({
        client,
        wallet: '0x0000000000000000000000000000000000000001',
        subaccountName: 'default',
        amountUsd: '2.01',
      }),
    ).rejects.toThrow('maximum withdrawable amount is $2');
    expect(withdraw).not.toHaveBeenCalled();
  });
});
