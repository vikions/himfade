# Architecture

Fade Him is a stateless Next.js App Router application. The page is Nado-first, while the Pacifica route stays fully isolated and selectable.

## Layers

1. `config/` contains public runtime configuration and the manually curated signal. No discovery service or database exists.
2. `components/` owns UI state, independent wallets, review confirmation, lifecycle messages, and local receipt presentation.
3. `lib/trading/` defines normalized market/account/position/order/fill contracts, errors, side reversal, and decimal-safe calculations.
4. `lib/nado/` owns SDK client creation, current market metadata, official appendix packing, EIP-712 order placement, indexer fill polling, positions, closing, and proof queries.
5. `lib/pacifica/` owns canonical JSON, Ed25519 wallet signing, builder approval, signed market orders, fill polling, positions, and builder proof endpoints.
6. `lib/receipts/` stores sanitized recent receipts in browser local storage. Receipts are UX artifacts, never standalone proof.
7. `app/api/pacifica/` is a narrow CORS proxy. It cannot sign and has no custody.

## Trust boundaries

- Wallet private keys never enter the app. wagmi requests EIP-712 signatures and Solana wallet-adapter requests message signatures.
- Public builder IDs/codes are client configuration. Missing values disable only live execution for that venue.
- Venue adapters never return mock data. When the public activation flag is false, execution stops before wallet signing and no receipt is created.
- A submitted response is kept distinct from a fill. Proof promotion requires protocol-returned evidence saved in `officialEvidence`.
- Diagnostics recursively redact signatures, tokens, sessions, authorization values, and private-key-like fields.

## Order sequence

The shared UI creates a venue adapter, validates account and attribution, prepares the exact inverse order, presents the prepared details, and waits for explicit confirmation. Only then does the adapter request a wallet signature, submit, poll for a fill, and create a sanitized receipt. Closing uses the same adapter and attribution configuration with reduce-only enabled.

## Deployment

The application has no persistent server state and is deployable to Vercel. The Pacifica proxy's in-memory rate limiter is best-effort per function instance; production abuse protection can additionally use Vercel Firewall or a durable rate-limit service without changing signing custody.
