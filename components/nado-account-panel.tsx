'use client';

import { useState } from 'react';
import { SpinnerGap, Wallet } from '@phosphor-icons/react';
import { useSwitchChain } from 'wagmi';
import type { NadoAccountOverview } from '@/lib/nado/funding';

export function NadoAccountPanel({
  connected,
  correctChain,
  requiredChainId,
  requiredChainName,
  account,
  loading,
  funding,
  fundingStatus,
  onDeposit,
}: {
  connected: boolean;
  correctChain: boolean;
  requiredChainId: number;
  requiredChainName: string;
  account: NadoAccountOverview | null;
  loading: boolean;
  funding: boolean;
  fundingStatus?: string;
  onDeposit: (amount: string) => Promise<void>;
}) {
  const [amount, setAmount] = useState('10');
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
                  ? `$${account.accountEquityUsd}`
                  : '$0'}
              </dd>
            </div>
            <div>
              <dt>Wallet USDT0</dt>
              <dd>{account ? `$${account.walletBalanceUsd}` : '—'}</dd>
            </div>
            <div>
              <dt>Position available</dt>
              <dd>
                {account?.maximumNotionalUsd
                  ? `$${account.maximumNotionalUsd}`
                  : account?.exists
                    ? '—'
                    : '$0'}
              </dd>
            </div>
          </dl>
          <div className="deposit-row">
            <label>
              <span>{account?.exists ? 'Add funds' : 'Fund your account'}</span>
              <div>
                <b>$</b>
                <input
                  aria-label="Deposit amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </div>
            </label>
            <button
              type="button"
              disabled={funding || loading}
              onClick={() => void onDeposit(amount)}
            >
              {funding ? (
                <>
                  <SpinnerGap size={14} className="animate-spin" />{' '}
                  {fundingStatus ?? 'Working'}
                </>
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
