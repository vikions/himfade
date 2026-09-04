'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, SpinnerGap, Wallet } from '@phosphor-icons/react';
import { useSwitchChain } from 'wagmi';
import Decimal from 'decimal.js';
import type { NadoAccountOverview } from '@/lib/nado/funding';

function usd(value?: string, decimals = 2) {
  return value === undefined ? '—' : `$${new Decimal(value).toFixed(decimals)}`;
}

export function NadoAccountPanel({
  connected,
  correctChain,
  requiredChainId,
  requiredChainName,
  account,
  loading,
  funding,
  fundingStatus,
  withdrawing,
  withdrawalStatus,
  onDeposit,
  onWithdraw,
}: {
  connected: boolean;
  correctChain: boolean;
  requiredChainId: number;
  requiredChainName: string;
  account: NadoAccountOverview | null;
  loading: boolean;
  funding: boolean;
  fundingStatus?: string;
  withdrawing: boolean;
  withdrawalStatus?: string;
  onDeposit: (amount: string) => Promise<void>;
  onWithdraw: (amount: string) => void;
}) {
  const [amount, setAmount] = useState('5');
  const [transferMode, setTransferMode] = useState<'deposit' | 'withdraw'>(
    'deposit',
  );
  const { switchChain } = useSwitchChain();

  return (
    <section className="account-strip" aria-label="Trading balance">
      <div className="account-strip-heading">
        <div>
          <Wallet size={16} />
          <strong>Trading balance</strong>
        </div>
        {loading && (
          <span>
            <SpinnerGap size={13} className="animate-spin" /> Refreshing
          </span>
        )}
      </div>
      {!connected ? (
        <p className="account-empty">
          Connect your Ink wallet to see your balance and available position
          size.
        </p>
      ) : !correctChain ? (
        <button
          className="account-chain-action"
          type="button"
          onClick={() => switchChain({ chainId: requiredChainId })}
        >
          Switch to {requiredChainName}
        </button>
      ) : !account ? (
        <p className="account-empty">
          {loading
            ? 'Loading your trading balance…'
            : 'Your trading balance is unavailable. Refresh the page and try again.'}
        </p>
      ) : (
        <>
          <dl className="account-metrics">
            <div>
              <dt>Account equity</dt>
              <dd>
                {account?.accountEquityUsd
                  ? usd(account.accountEquityUsd)
                  : '$0.00'}
              </dd>
            </div>
            <div>
              <dt>Wallet USDT0</dt>
              <dd>{account ? usd(account.walletBalanceUsd) : '—'}</dd>
            </div>
            <div>
              <dt>Position available</dt>
              <dd>
                {account?.maximumNotionalUsd
                  ? usd(account.maximumNotionalUsd)
                  : account?.exists
                    ? '—'
                    : '$0.00'}
              </dd>
            </div>
          </dl>
          <div className="funding-tabs" aria-label="Collateral action">
            <button
              type="button"
              aria-pressed={transferMode === 'deposit'}
              onClick={() => setTransferMode('deposit')}
            >
              <ArrowDown size={13} /> Deposit
            </button>
            <button
              type="button"
              aria-pressed={transferMode === 'withdraw'}
              disabled={!account?.exists}
              onClick={() => setTransferMode('withdraw')}
            >
              <ArrowUp size={13} /> Withdraw
            </button>
          </div>
          <div className="deposit-row">
            <label>
              <span>
                {transferMode === 'deposit'
                  ? account?.exists
                    ? 'Add collateral'
                    : 'Fund your account'
                  : `Withdrawable · ${usd(account?.maximumWithdrawableUsd)}`}
              </span>
              <div>
                <b>$</b>
                <input
                  aria-label="Deposit amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
                {transferMode === 'withdraw' &&
                  account?.maximumWithdrawableUsd && (
                    <button
                      type="button"
                      className="amount-max"
                      onClick={() =>
                        setAmount(account.maximumWithdrawableUsd ?? '0')
                      }
                    >
                      MAX
                    </button>
                  )}
              </div>
            </label>
            <button
              type="button"
              disabled={funding || withdrawing || loading}
              onClick={() =>
                transferMode === 'deposit'
                  ? void onDeposit(amount)
                  : onWithdraw(amount)
              }
            >
              {funding || withdrawing ? (
                <>
                  <SpinnerGap size={14} className="animate-spin" />{' '}
                  {fundingStatus ?? withdrawalStatus ?? 'Working'}
                </>
              ) : transferMode === 'withdraw' ? (
                'Review withdrawal'
              ) : account?.exists ? (
                'Deposit'
              ) : (
                'Deposit & activate'
              )}
            </button>
          </div>
          {!account?.exists && (
            <small className="deposit-note">
              First deposit: at least $5 in USDT0 already on Ink.
            </small>
          )}
        </>
      )}
    </section>
  );
}
