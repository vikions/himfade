# Fade Him

> Trade the other side of questionable decisions.

Fade Him is a Nado-first, non-custodial interface for taking the inverse of one manually curated public perpetual position. Pacifica remains a complete secondary execution route. The product is intentionally an anti-terminal: no candles, no order book UI, no automated trader discovery, no agent, and no copy-trading backend.

The repository supports honest demo flows plus real attributed opening and closing orders. No live builder volume was generated or verified during development because registered builder credentials, funded accounts, and interactive wallet signatures were not available.

## Stack and architecture

Next.js 16 App Router, strict TypeScript, Tailwind 4, wagmi/viem, Solana wallet-adapter, TanStack Query, Zod, decimal.js, official Nado TypeScript SDK 0.25.0, Vitest, and Playwright. See [architecture](docs/architecture.md) and [protocol research](docs/integration-notes.md).

Nado owns the default selected venue and primary visual hierarchy. Each venue implements the shared adapter contract but keeps protocol signing, account state, order data, fills, and proof isolated under `lib/nado` or `lib/pacifica`.

## Prerequisites

- Node.js 20.9 or later (tested with Node 22.17)
- pnpm 10
- An EVM wallet for Nado and/or a Solana wallet with `signMessage` for Pacifica
- Registered public builder credentials before enabling live mode
- Funded venue accounts on the selected networks

## Install and run

```bash
pnpm install
Copy-Item .env.example .env.local
pnpm dev
```

Open `http://localhost:3000`. Demo mode is the safe default.

Quality commands:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

## Environment

| Variable | Meaning |
|---|---|
| `NEXT_PUBLIC_APP_MODE` | UI badge: `testnet` or `mainnet` |
| `NEXT_PUBLIC_ENABLE_LIVE_TRADING` | `false` simulates visibly; `true` disables every mock path |
| `NEXT_PUBLIC_NADO_NETWORK` | `inkTestnet` or `inkMainnet` |
| `NEXT_PUBLIC_NADO_BUILDER_ID` | Registered public builder ID, 1-65535 |
| `NEXT_PUBLIC_NADO_BUILDER_FEE_RATE_UNITS` | 0-1023, each unit is 0.1 bps |
| `NEXT_PUBLIC_NADO_SUBACCOUNT_NAME` | Up to 12 bytes; defaults to `default` |
| `NEXT_PUBLIC_PACIFICA_NETWORK` | `testnet` or `mainnet` |
| `NEXT_PUBLIC_PACIFICA_BUILDER_CODE` | Registered alphanumeric code, maximum 16 characters |
| `NEXT_PUBLIC_PACIFICA_MAX_FEE_RATE` | Decimal-string user approval maximum |
| `NEXT_PUBLIC_DEFAULT_SYMBOL` | Default curated symbol |
| `NEXT_PUBLIC_DEFAULT_NOTIONAL_USD` | Initial ticket amount |
| `NEXT_PUBLIC_MAX_NOTIONAL_USD` | MVP hard maximum |
| `NEXT_PUBLIC_MAX_SLIPPAGE_BPS` | Review and order slippage bound |

Missing attribution configuration is shown exactly in the developer status panel. Live submission fails closed; there is no zero-ID/code fallback.

## Curated signal

Edit `config/fade-signals.ts`. The included “THE ETERNAL BULL” dossier is explicitly demo data and uses no real person's identity. Before presenting a live signal, replace it with a public wallet, pseudonymous alias, verified public statistics, source URL, current timestamp, and `isLiveData: true`.

## Nado testnet setup

1. Obtain a registered builder ID and allowed fee range from Nado.
2. Set both Nado builder variables and keep `NEXT_PUBLIC_NADO_NETWORK=inkTestnet`.
3. Connect an EVM wallet and switch it to Ink Sepolia through the header control.
4. Create/fund the configured Nado subaccount externally. Current docs require at least $5 USDT0 to activate it; add enough collateral for the intended perpetual order.
5. Set `NEXT_PUBLIC_ENABLE_LIVE_TRADING=true`, restart, and confirm the developer status says Nado attribution is ready.

### Smallest valid Nado attributed test

Nado's current SDK metadata, not the `$10` UI default, is authoritative. The docs currently cite a 0.1 ETH minimum base amount, which can be materially larger than $10. Use the ticket's live computed minimum after price and size rounding; never force a smaller order.

1. Keep the curated position on ETH and select Nado.
2. Enter the smallest USD amount that produces at least the current `minSize` after rounding, while staying under the configured MVP maximum. Raise `NEXT_PUBLIC_MAX_NOTIONAL_USD` deliberately if the protocol minimum exceeds it.
3. Review inverse side, IOC, product ID, slippage, builder ID, fee units, and decoded appendix.
4. Confirm; approve the EIP-712 request in the wallet.
5. Wait for indexer fill confirmation. Copy the digest and open `/proof`.
6. Verify the indexer returned base/quote fill, appendix, and builder fee. Check `BuilderFeePayment`, claimable builder fee, or the builder dashboard before claiming attribution externally.
7. Use `CLOSE NADO FADE`. Review that it uses the actual position amount, inverse closing side, reduce-only, and the same builder fields. Sign and wait for the separate closing receipt.

## Pacifica testnet setup

1. Obtain a registered builder code and fee.
2. Set the Pacifica builder variables and keep `NEXT_PUBLIC_PACIFICA_NETWORK=testnet`.
3. Connect a supported Solana wallet that implements `signMessage`; the public key is the Pacifica account.
4. Fund the Pacifica account.
5. Select Pacifica, click `APPROVE FADE HIM CODE`, inspect the approval containing code and maximum fee, and sign.
6. The app re-queries approvals. Trading stays disabled if the code is absent or the approved maximum is too low.

### Smallest valid Pacifica attributed test

1. Fetch current `/info`; use the displayed minimum after lot rounding (the documented ETH example reports a $10 minimum, but current API data wins).
2. Enter that amount, review the exact case-sensitive symbol, inverse side, market order, slippage, builder code, and approval state.
3. Confirm and sign. The builder code is already inside signed `data`.
4. Wait for `/trades/history?account=...&builder_code=...` to return the matching client order UUID.
5. Open `/proof`; compare the user trade with `/builder/trades`, `/builder/overview`, and the builder leaderboard/dashboard.
6. Use `CLOSE PACIFICA FADE`. The app reads the current position amount, reverses the side, sets reduce-only, inserts builder code before signing, and verifies the closing fill separately.

## Demo versus live

With the live flag false, every simulated screen says `DEMO MODE — NO ORDER WILL BE SENT`. Demo receipts have `isDemo: true`, never contain a fake fill, and are excluded from proof completion. With the flag true, no demo adapter or simulated response is reachable.

## Proof and receipts

`/proof` has independent Nado and Pacifica cards and a dual checklist. Local storage keeps at most 25 sanitized receipts. Signatures, authorization material, tokens, sessions, and key-like values are redacted. A local receipt alone cannot complete proof; the receipt must contain official protocol evidence from the live fill path.

## Mainnet warning

Perpetuals are leveraged products. Mainnet orders can lose the full posted collateral and may be liquidated. Verify builder registration, fee bounds, network, symbol, minimum, side, slippage, collateral, and close procedure on testnet before setting either venue to mainnet. Never deploy mainnet mode with an empty builder configuration.

## Vercel deployment

1. Import the repository into Vercel.
2. Use Node 20+ and the pnpm install command.
3. Add all public environment variables per environment. Keep live trading false on preview deployments unless explicitly testing funded testnet wallets.
4. Deploy. The Pacifica proxy runs as a dynamic route and forwards only allowlisted already-signed requests.
5. Add platform-level rate limiting for a public high-traffic deployment; the built-in limiter is per function instance.

## Troubleshooting

- **Nado incorrect network:** use the header switch action for configured Ink chain.
- **Nado subaccount missing:** create/fund `default` or change the 12-byte name variable.
- **Nado 2118 / InvalidBuilder:** confirm registration and that fee units are within the assigned bounds.
- **Nado accepted but no fill:** do not resubmit blindly; inspect the digest and IOC/history result.
- **Pacifica wallet cannot sign:** select a wallet exposing Solana `signMessage`.
- **Pacifica 403:** approve the builder code again with a maximum at least as high as its current fee.
- **Pacifica 404:** the builder code is not registered on that API network.
- **Pacifica symbol rejected:** preserve exact casing returned by `/info`.
- **Fill timeout:** check the venue history using digest or client order ID. Timeout is not proof of rejection or fill.
- **Vercel/CORS:** use the included `/api/pacifica` route; do not move signing to the server.

Use [the live checklist](docs/live-trading-checklist.md) during every attributed test.
