# Fade Him

> Trade the other side of questionable decisions.

Fade Him is a non-custodial perpetuals product built around one deliberately narrow idea: present a curated public position, invert its direction, and turn that thesis into a reviewable trade.

Nado on Ink is the primary execution venue. Pacifica is available as a secondary route for Solana users. Fade Him avoids the shape of a conventional trading terminal: there are no charts, order books, custody, automated trader discovery, or unattended copy trading.

## How it works

1. A manually curated public position becomes a signal dossier.
2. Fade Him derives the inverse side and prepares an order for the selected venue.
3. The user connects a wallet, funds their trading balance in-app, and chooses any size supported by their account.
4. The user reviews the trade and signs the venue-native payload.
5. Fade Him submits the order and records the resulting fill.
6. `/proof` presents the execution history and venue order references.

Opening and closing trades are separate orders. Closing is always reduce-only.

## Product model

Fade Him is Ink-native: Ink is the wallet and settlement environment for the primary Nado route. Nado supplies live perpetual markets, account state, wallet-signed deposits and execution, and fill history.

The differentiator is the decision flow. Fade Him starts with a curated, inspectable public-position thesis and prepares only its inverse. The user still controls the venue, amount, review, wallet signature, and close.

Both venues implement the same product-level adapter contract while keeping protocol-specific behavior isolated:

- **Nado — primary:** EVM wallet, Ink mainnet, in-app USDT0 funding, account-aware position sizing, and wallet-signed execution.
- **Pacifica — secondary:** Solana wallet and signed venue-native execution.

## Safety boundaries

- Wallets sign directly; Fade Him never holds user keys or funds.
- Every deposit and trade requires an explicit wallet confirmation.
- Execution fails closed when a required venue integration is unavailable.
- There is no simulated-fill fallback in the production interface.
- Order review is mandatory before signing.
- Available size and slippage are checked before submission.
- Secrets, signatures, authorization material, and session data are excluded from copied receipts.

Perpetuals are leveraged, high-risk products. Users can lose their posted collateral and may be liquidated.

## Architecture

```text
app/                  Next.js routes and Pacifica proxy
components/           dossier, account funding, trade review, receipts
config/               curated signal and runtime configuration
lib/trading/          shared venue contract, sizing, risk, receipts
lib/nado/             Nado funding, market, execution, and fill adapter
lib/pacifica/         Pacifica auth, API, and execution adapter
docs/                 architecture and integration notes
tests/                unit and browser coverage
```

The application uses Next.js 16, React 19, strict TypeScript, wagmi/viem, Solana wallet-adapter, TanStack Query, Zod, decimal.js, the official Nado TypeScript SDK, Vitest, and Playwright.

More detail is available in [architecture](docs/architecture.md) and [integration notes](docs/integration-notes.md).

## Local development

Requirements: Node.js 20.9+, pnpm 10, and an EVM and/or Solana wallet.

```powershell
pnpm install
Copy-Item .env.example .env.local
pnpm dev
```

Quality checks:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Environment defaults are provided in [.env.example](.env.example). Production verification is tracked separately in [the live trading checklist](docs/live-trading-checklist.md).
