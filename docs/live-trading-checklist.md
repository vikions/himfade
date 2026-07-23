# Live trading checklist

Complete each venue independently. Start on testnet, use the minimum currently reported by the venue, and close the position immediately after proof is collected if that is the test plan.

## Nado

- [ ] Registered builder ID received from Nado
- [ ] Builder fee-rate range confirmed and chosen units recorded
- [ ] `NEXT_PUBLIC_NADO_BUILDER_ID` set
- [ ] `NEXT_PUBLIC_NADO_BUILDER_FEE_RATE_UNITS` set
- [ ] Correct Ink network selected
- [ ] Connected EVM wallet is on that chain
- [ ] Configured subaccount exists
- [ ] Subaccount activation deposit and sufficient collateral available
- [ ] `NEXT_PUBLIC_ENABLE_LIVE_TRADING=true`
- [ ] Current product metadata resolves the symbol and product ID
- [ ] Displayed notional meets current minimum after rounding
- [ ] Review dialog shows the expected inverse side
- [ ] Decoded appendix shows IOC, correct builder ID/rate, and `reduceOnly: false`
- [ ] Opening order accepted and indexer fill confirmed
- [ ] Opening receipt digest and fill values copied
- [ ] Close action uses the actual position size
- [ ] Closing appendix preserves builder ID/rate and shows `reduceOnly: true`
- [ ] Closing fill confirmed
- [ ] Claimable builder fee or `BuilderFeePayment` event checked
- [ ] Nado builder dashboard checked manually if official API/event evidence is insufficient

## Pacifica

- [ ] Registered builder code exists
- [ ] Builder fee confirmed
- [ ] `NEXT_PUBLIC_PACIFICA_BUILDER_CODE` set
- [ ] `NEXT_PUBLIC_PACIFICA_MAX_FEE_RATE` is at least the builder fee
- [ ] Correct Pacifica API network selected
- [ ] Solana wallet connected and supports `signMessage`
- [ ] Pacifica account funded with sufficient collateral
- [ ] Builder approval message reviewed and signed
- [ ] Approval re-query confirms code and sufficient maximum
- [ ] `NEXT_PUBLIC_ENABLE_LIVE_TRADING=true`
- [ ] Exact case-sensitive symbol and current market metadata loaded
- [ ] Displayed notional meets the current minimum after lot rounding
- [ ] Review dialog shows builder code inside the order details
- [ ] Opening order accepted and matching builder-filtered `client_order_id` fill confirmed
- [ ] Close action uses current position amount and reduce-only
- [ ] Closing signed data still contains the builder code
- [ ] Closing fill confirmed
- [ ] Builder trade endpoint checked
- [ ] Builder leaderboard/dashboard checked manually if required
