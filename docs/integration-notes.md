# Protocol integration notes

Research date: 2026-07-13. These notes record the official sources and installed package definitions used by the application. They are implementation evidence, not a claim that a live order was executed.

## Nado

### Sources inspected

- [Builder integration](https://docs.nado.xyz/developer-resources/api/builder-integration)
- [Order appendix](https://docs.nado.xyz/developer-resources/api/order-appendix)
- [Current endpoints](https://docs.nado.xyz/developer-resources/api/endpoints)
- [Core concepts](https://docs.nado.xyz/developer-resources/get-started/core-concepts)
- [TypeScript SDK](https://docs.nado.xyz/developer-resources/typescript-sdk)
- [Manage orders](https://docs.nado.xyz/developer-resources/typescript-sdk/how-to/manage-orders)
- [Official TypeScript SDK source](https://github.com/nadohq/nado-typescript-sdk), installed package source and `.d.ts` files at version `0.25.0`

### Packages and endpoints

The application pins `@nadohq/client`, `@nadohq/engine-client`, `@nadohq/indexer-client`, and `@nadohq/shared` to `0.25.0`. The SDK requires exact peers `viem@2.52.0` and `bignumber.js@11.1.1`; both are pinned.

| Service | Ink mainnet | Ink Sepolia |
|---|---|---|
| Gateway REST | `https://gateway.prod.nado.xyz/v1` | `https://gateway.test.nado.xyz/v1` |
| Gateway V2 | `https://gateway.prod.nado.xyz/v2` | `https://gateway.test.nado.xyz/v2` |
| Gateway websocket | `wss://gateway.prod.nado.xyz/v1/ws` | `wss://gateway.test.nado.xyz/v1/ws` |
| Archive/indexer | `https://archive.prod.nado.xyz/v1` | `https://archive.test.nado.xyz/v1` |
| Archive V2 | `https://archive.prod.nado.xyz/v2` | `https://archive.test.nado.xyz/v2` |
| Trigger | `https://trigger.prod.nado.xyz/v1` | `https://trigger.test.nado.xyz/v1` |

Contract deployments are loaded from `NADO_DEPLOYMENTS` through `createNadoClient('inkMainnet' | 'inkTestnet', ...)`. The app does not hardcode endpoint, clearinghouse, engine, or querier addresses.

### Wallet, accounts, and signing

- Writes use EIP-712. Reads do not require a signature.
- The main connected EVM wallet signs through wagmi/viem; no private key is accepted or stored.
- A subaccount combines the wallet address and a name of at most 12 bytes. `default` is the default name.
- Current docs state that a minimum $5 USDT0 deposit activates a subaccount. Trading additionally requires sufficient health/collateral for the requested order.
- The app intentionally does not create, fund, or link an unrestricted signer.

### Builder attribution and appendix

The current appendix is a 128-bit integer:

| Bits | Field |
|---|---|
| 0-7 | version (`1`) |
| 8 | isolated |
| 9-10 | order type (`0` default, `1` IOC, `2` FOK, `3` post-only) |
| 11 | reduce-only |
| 12-13 | trigger type |
| 14-37 | reserved, zero |
| 38-47 | builder fee rate, 10 bits |
| 48-63 | builder ID, 16 bits |
| 64-127 | isolated/TWAP value |

Builder IDs are registered values from 1 through 65535. Fee units are 0.1 bps each and must fall within the builder's registered range. Error `2118` is `InvalidBuilder`. `lib/nado/appendix.ts` validates the fields, calls the official `packOrderAppendix`, and exposes an official-decoder-backed debug representation. The opening IOC and reduce-only closing order both receive the same builder fields.

### Orders, markets, fills, and proof

- `market.getSymbols({ productType: PERP })` supplies product ID, price/size increments, and minimum base size.
- `market.getLatestMarketPrice` supplies bid and ask in x18 form. Long orders cross the ask; short orders cross the bid. Slippage creates an aggressive IOC limit using current increments.
- `market.placeOrder` handles nonce resolution, EIP-712 construction, signature, and engine submission.
- Engine acceptance is not a fill. The app polls `market.getHistoricalOrders({ digests })` until `baseFilled` is non-zero or the deadline passes.
- Historical orders include base/quote fill, fees, `builderFee`, appendix, timestamps, and balance snapshots.
- Stronger onchain evidence can use `BuilderFeePayment` and `getClaimableBuilderFee(0, builderId)` on the current OffchainExchange. The address is read through the current Clearinghouse rather than hardcoded.

The docs' order example still demonstrates testnet mint/deposit scaffolding and a hand-selected product ID. This app does not copy either assumption: it resolves the product ID from live symbol metadata and never mints or funds on behalf of a user.

## Pacifica

### Sources inspected

- [Builder program](https://pacifica.gitbook.io/docs/programs/builder-program)
- [REST API](https://pacifica.gitbook.io/docs/api-documentation/api/rest-api)
- [Signing overview](https://pacifica.gitbook.io/docs/api-documentation/api/signing)
- [Signing implementation](https://pacifica.gitbook.io/docs/api-documentation/api/signing/implementation)
- [Create market order](https://pacifica.gitbook.io/docs/api-documentation/api/rest-api/orders/create-market-order)
- [Market info](https://pacifica.gitbook.io/docs/api-documentation/api/rest-api/markets/get-market-info)
- [Account info](https://pacifica.gitbook.io/docs/api-documentation/api/rest-api/account/get-account-info)
- [Positions](https://pacifica.gitbook.io/docs/api-documentation/api/rest-api/account/get-positions)
- [Trade history](https://pacifica.gitbook.io/docs/api-documentation/api/rest-api/account/get-trade-history)

Mainnet base: `https://api.pacifica.fi/api/v1`. Testnet base: `https://test-api.pacifica.fi/api/v1`.

### Wallet and deterministic signing

- The connected Solana public key is the Pacifica account.
- Every POST is signed; GET requests and subscriptions are unsigned.
- The signed message is `{ timestamp, expiry_window, type, data }`.
- Object keys are recursively alphabetized, array order is preserved, JSON is compacted without whitespace, and UTF-8 bytes are signed with Ed25519.
- The resulting 64-byte signature is Base58 encoded. The final REST body flattens `data` next to `account`, `agent_wallet`, signature, timestamp, and expiry.
- `lib/pacifica/canonical-json.ts` and `signing.ts` contain the browser-safe implementation. Unit fixtures cover nested sorting, arrays, stable insertion order, builder placement, and exact bytes.

Pacifica recommends its Python SDK, but no official browser TypeScript SDK was found in the inspected official sources. The small browser implementation exists because wallet-adapter `signMessage` is required; it does not use Node cryptography.

### Builder authorization and orders

- Approval signs type `approve_builder_code` with `builder_code` and string `max_fee_rate`, then posts to `/account/builder_codes/approve`.
- Approvals are re-queried at `/account/builder_codes/approvals?account=...`.
- The user's approved maximum must be at least the registered builder fee. Missing approval/low fee returns 403, unknown builder returns 404, and invalid format returns 400.
- Market order signing type is `create_market_order`. The signed data contains symbol, decimal amount, `bid`/`ask`, slippage percentage, reduce-only, UUID client order ID, and builder code.
- Builder code is inserted before canonicalization and signing. It is never appended afterward.
- Close orders reuse the actual position amount, reverse the side, set reduce-only, and include the builder code before signing.

### Markets, fills, proxy, and proof

- `/info` supplies exact case-sensitive symbols, lot/tick sizes, minimum USD size, and leverage constraints.
- `/book?symbol=...` supplies a timestamped two-sided price used only for calculation; the product deliberately does not display an order book.
- `/account` and `/positions` validate account/collateral and current positions.
- A 200 response is only submission acceptance. The app polls `/trades/history?account=...&builder_code=...` and matches `client_order_id`.
- Official proof endpoints also include `/builder/overview`, `/builder/trades`, and `/leaderboard/builder_code`.
- The Next.js proxy accepts only allowlisted protocol paths, forwards already-signed bodies unchanged, applies a small in-memory rate limit, and never logs a signed payload.

Known limitation: response bodies for builder overview/trades/leaderboard are kept as sanitized raw evidence because the builder page documents endpoints but not a stable complete schema for every response. User trade history and core account/order schemas are validated with Zod.

## External blockers at handoff

No live transaction was attempted. Live proof still requires registered Nado builder credentials and fee bounds, a registered Pacifica builder code and fee, funded test accounts, compatible connected wallets, and explicit user signatures. The app fails closed when any public builder configuration is missing.
