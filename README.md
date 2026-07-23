# Fade Him

> Trade the other side of questionable decisions.

Fade Him is a Nado-first, non-custodial interface for taking the inverse of one manually curated public perpetual position. Pacifica remains a complete secondary execution route. The product is intentionally an anti-terminal: no candles, no order book UI, automated trader discovery, agent, custody, or copy-trading backend.

The application implements attributed opening and reduce-only closing orders. Execution is fail-closed until registered builder credentials are present and the production activation flag is enabled; there is no simulated fill path.

## Stack and architecture

Next.js 16 App Router, strict TypeScript, Tailwind 4, wagmi/viem, Solana wallet-adapter, TanStack Query, Zod, decimal.js, official Nado TypeScript SDK 0.25.0, Vitest, and Playwright. See [architecture](docs/architecture.md) and [protocol research](docs/integration-notes.md).

Nado owns the default selected venue and primary visual hierarchy. Each venue implements the shared adapter contract but keeps protocol signing, account state, order data, fills, and proof isolated under `lib/nado` or `lib/pacifica`.

## Prerequisites

- Node.js 20.9 or later
- pnpm 10
- An EVM wallet for Nado and/or a Solana wallet with `signMessage` for Pacifica
- Registered public builder credentials before enabling execution
- Funded venue accounts on the selected mainnet networks

## Install and run

```powershell
pnpm install
Copy-Item .env.example .env.local
pnpm dev
```

Open `http://localhost:3000`. Mainnet presentation is the default; execution remains locked until explicitly activated.

Quality commands:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

## Environment

| Variable | Meaning |
|---|---|
| `NEXT_PUBLIC_APP_MODE` | Public environment badge; defaults to `mainnet` |
| `NEXT_PUBLIC_ENABLE_LIVE_TRADING` | Production kill switch: `false` blocks signing; `true` enables configured live adapters |
| `NEXT_PUBLIC_NADO_NETWORK` | `inkMainnet` for production |
| `NEXT_PUBLIC_NADO_BUILDER_ID` | Registered public builder ID, 1-65535 |
| `NEXT_PUBLIC_NADO_BUILDER_FEE_RATE_UNITS` | 0-1023, each unit is 0.1 bps |
| `NEXT_PUBLIC_NADO_SUBACCOUNT_NAME` | Up to 12 bytes; defaults to `default` |
| `NEXT_PUBLIC_PACIFICA_NETWORK` | `mainnet` for production |
| `NEXT_PUBLIC_PACIFICA_BUILDER_CODE` | Registered alphanumeric code, maximum 16 characters |
| `NEXT_PUBLIC_PACIFICA_MAX_FEE_RATE` | Decimal-string user approval maximum |
| `NEXT_PUBLIC_DEFAULT_SYMBOL` | Default curated symbol |
| `NEXT_PUBLIC_DEFAULT_NOTIONAL_USD` | Initial ticket amount |
| `NEXT_PUBLIC_MAX_NOTIONAL_USD` | Hard notional maximum |
| `NEXT_PUBLIC_MAX_SLIPPAGE_BPS` | Review and order slippage bound |

Missing attribution configuration is shown exactly in the developer status panel. Submission fails closed; there is no zero-ID/code fallback.

## Curated signal

Edit `config/fade-signals.ts`. Until a verified public source is connected, the dossier publishes no wallet address, performance statistics, or freshness claim. Before activating a signal, provide a public wallet, pseudonymous alias, verified public statistics, source URL, current timestamp, and `isLiveData: true`.

## Nado mainnet setup

1. Obtain a registered builder ID and allowed fee range from Nado.
2. Set both Nado builder variables with `NEXT_PUBLIC_NADO_NETWORK=inkMainnet`.
3. Connect an EVM wallet and switch it to Ink Mainnet.
4. Create and fund the configured Nado subaccount externally. Current docs require at least $5 USDT0 to activate it; add sufficient collateral for the intended order.
5. Verify symbol metadata, product ID, minimum size, IOC appendix, builder ID, fee units, side, and slippage.
6. Set `NEXT_PUBLIC_ENABLE_LIVE_TRADING=true` only after the funded-wallet preflight.
7. Submit the minimum intended order, wait for indexer fill confirmation, then verify the digest, appendix, builder fee, and `/proof`.
8. Close through the reduce-only action and verify the separate attributed closing fill.

## Pacifica mainnet setup

1. Confirm the registered builder code, owner wallet, and fee.
2. Set the Pacifica builder variables with `NEXT_PUBLIC_PACIFICA_NETWORK=mainnet`.
3. Connect a supported Solana wallet that implements `signMessage`; the public key is the Pacifica account.
4. Fund the Pacifica account.
5. Select Pacifica, approve the builder code, and verify the approval maximum is at least the registered fee.
6. Set `NEXT_PUBLIC_ENABLE_LIVE_TRADING=true` only after the funded-wallet preflight.
7. Submit the minimum intended order and match the resulting client order UUID in builder-filtered trade history.
8. Close with reduce-only and verify the separate attributed closing fill.

## Execution activation

With the live flag false, the interface remains available for review and public market metadata, but wallet signing and submission are blocked. Missing builder attribution is reported before wallet access. With the flag true, only real venue adapters are reachable.

## Proof and receipts

`/proof` has independent Nado and Pacifica cards and a dual checklist. Local storage keeps at most 25 sanitized live receipts. Signatures, authorization material, tokens, sessions, and key-like values are redacted. A local receipt alone cannot complete proof; it must contain official protocol evidence from a fill.

## Mainnet warning

Perpetuals are leveraged products. Mainnet orders can lose the full posted collateral and may be liquidated. Verify builder registration, fee bounds, network, symbol, minimum, side, slippage, collateral, and close procedure before enabling execution. Never activate mainnet submission with an empty builder configuration.

## Vercel deployment

1. Import the repository into Vercel.
2. Use Node 20+ and pnpm.
3. Add the public environment variables for Production and keep live trading false until preflight is complete.
4. Deploy. The Pacifica proxy runs as a dynamic route and forwards only allowlisted already-signed requests.
5. Add platform-level rate limiting before public trading traffic; the built-in limiter is per function instance.

## Troubleshooting

- **Nado incorrect network:** use the header switch action for Ink Mainnet.
- **Nado subaccount missing:** create and fund `default`, or change the configured 12-byte name.
- **Nado 2118 / InvalidBuilder:** confirm registration and fee-unit bounds.
- **Nado accepted but no fill:** do not resubmit blindly; inspect the digest and IOC/history result.
- **Pacifica wallet cannot sign:** select a wallet exposing Solana `signMessage`.
- **Pacifica 403:** approve the builder code again with a maximum at least as high as its current fee.
- **Pacifica 404:** confirm the builder code is registered on mainnet.
- **Pacifica symbol rejected:** preserve exact casing returned by `/info`.
- **Fill timeout:** inspect venue history using the digest or client order ID; timeout alone is not proof of rejection or fill.
- **Vercel/CORS:** use the included `/api/pacifica` route; signing remains client-side.

Use [the live checklist](docs/live-trading-checklist.md) during every attributed trade.
