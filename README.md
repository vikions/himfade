# Fade Him

> Trade the other side of questionable decisions.

Fade Him is a non-custodial perpetuals interface built around one deliberately narrow idea: present a curated public position, invert its direction, and turn that thesis into a reviewable order.

Nado is the primary execution venue. Pacifica provides a complete secondary route for Solana users. The product avoids the shape of a conventional trading terminal—there are no charts, order books, automated trader discovery, custody, or copy-trading agents.

## How it works

1. A manually curated public position becomes a signal dossier.
2. Fade Him derives the inverse side and builds an order for the selected venue.
3. The user reviews venue, side, size, price protection, fees, and builder attribution.
4. The connected wallet signs the venue-native payload.
5. The app submits the order and records a sanitized receipt.
6. `/proof` verifies attribution only when official fill evidence is available.

Opening and closing trades are separate attributed orders. Closing is always reduce-only.

## Venue model

Both venues implement the same product-level adapter contract while keeping protocol concerns isolated:

- **Nado — primary:** EVM wallet, Ink mainnet, Nado subaccounts, EIP-712 signing, builder appendix attribution.
- **Pacifica — secondary:** Solana wallet, signed API requests, builder-code approval and attribution.

Venue-specific market discovery, signing, submission, fill lookup, and error normalization live under `lib/nado` and `lib/pacifica`. Shared review, receipt, risk, and proof behavior lives under `lib/trading`.

## Safety boundaries

- Wallets sign directly; Fade Him never holds user keys or funds.
- Execution fails closed when builder attribution is incomplete.
- There is no simulated-fill fallback in the production interface.
- Order review is mandatory before signing.
- Notional and slippage limits are enforced before submission.
- A local receipt is not treated as proof without official venue fill evidence.
- Secrets, signatures, authorization material, and session data are excluded from stored receipts.

Perpetuals are leveraged, high-risk products. Users can lose their posted collateral and may be liquidated.

## Architecture

```text
app/                  Next.js routes and Pacifica proxy
components/           dossier, venue selection, review, receipts, proof
config/               curated signal configuration
lib/trading/          shared venue contract, risk and receipt model
lib/nado/             Nado market, signing, execution and fill adapter
lib/pacifica/         Pacifica auth, API, approval and execution adapter
docs/                 architecture and protocol integration notes
tests/                unit and browser coverage
```

The application uses Next.js 16, React 19, strict TypeScript, wagmi/viem, Solana wallet-adapter, TanStack Query, Zod, decimal.js, the official Nado TypeScript SDK, Vitest, and Playwright.

More detail is available in [architecture](docs/architecture.md) and [protocol integration notes](docs/integration-notes.md).

## Local development

Requirements: Node.js 20.9+, pnpm 10, and an EVM and/or Solana wallet.

```powershell
pnpm install
Copy-Item .env.example .env.local
pnpm dev
```

The public interface can be reviewed without builder credentials. Real order signing remains locked until the selected venue has valid attribution configuration and live trading is explicitly enabled.

Quality checks:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Environment defaults and documented public configuration fields are provided in [.env.example](.env.example). Production trade validation is tracked separately in [the live trading checklist](docs/live-trading-checklist.md).
