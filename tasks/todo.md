# ATP payment rails implementation plan — 2026-04-05

## Goal
Make ATP rentals fundable through more than HBAR by introducing a unified funding layer that supports:
- HBAR
- additional crypto rails
- cash/card-style rails

## Phase 1 — unify the funding path
- [ ] Audit current ATP rental payment flow end to end
- [ ] Route HBAR funding through the funding-intent store as the canonical path
- [ ] Verify activation remains idempotent and durable across restarts

## Phase 2 — add crypto rails
- [ ] Reuse VAL relay / ChangeNOW flow for ATP rental funding intents
- [ ] Add renter-facing crypto selection in the Telegram rental bot
- [ ] Persist swap metadata and expose renter status updates
- [ ] Normalize successful crypto funding into the existing ATP activation path

## Phase 3 — add cash/card rail MVP
- [ ] Identify the cleanest already-available fiat/onramp path in the repo/config
- [ ] Implement renter-facing cash/card button flow against that provider
- [ ] Persist cash/onramp intent metadata in the same funding store
- [ ] Normalize successful fiat funding into the same ATP activation path

## Verification
- [ ] HBAR path still works through the new flow
- [ ] Crypto path produces a funding intent and activation path cleanly
- [ ] Cash/card path produces a valid checkout/onramp flow cleanly
- [ ] No duplicate activations from repeated polling or retries

## Review
- In progress.
- Priority: build the ATP funding layer, not one-off payment hacks.
