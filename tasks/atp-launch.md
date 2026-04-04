# ATP Launch Checklist

**Goal:** Get ATP into people's hands for real testing. Ship lean, iterate fast.

**Generated:** 2026-02-11 | **Updated:** 2026-02-12 | **Status:** In Progress

---

## High-Level Items
1. [x] Remove trust tiers (v1 simplification) — DONE 2026-02-12
2. [x] Fix HCS logging — all lifecycle events wired — DONE 2026-02-12
3. [ ] Upgrade rental agent model — renter-selectable, full capabilities at every rental level
4. [ ] Silent activation UX — one voice, not two
5. [x] GitHub repos merged & cleaned — DONE 2026-02-12 (public + private synced, open-sourced SDK)
6. [ ] npm package updated
7. [ ] Rental pricing rework — no caps, escrow = natural limit
8. [ ] Rental sandbox — pre-loaded product, scoped not blocked
9. [ ] Memory isolation — redirected to renter space, not denied
10. [ ] Credential safeguards — 1Password/keychain/signing keys inaccessible from sandbox
11. [ ] Onboarding flow — frictionless deposit-to-rental
12. [ ] Monitoring & observability

---

## Detailed Breakdown

### 1. Remove Trust Tiers
- Delete `TRUST_TIERS` from `~/atp-sdk/src/config.ts`
- Remove tier checks from rental initiation flow
- Update spec (`AGENT_TRUST_PROTOCOL.md`) — tiers → "Future v2"
- v1: anyone creates, anyone rents. Trust = audit trail.

### 2. Fix HCS Logging
- THE differentiator. No HCS = just another API wrapper.
- Every action logs: create, rent, settle, terminate, dispute
- Audit current rental flow — find missing HCS calls
- Verify messages land on hashscan
- Cost: ~$0.0001/tx (negligible)

### 3. Upgrade Rental Agent Model
- All rentals should expose the **full product capabilities**
- Rental starts on **whatever model Aite is currently using** at activation time
- Renter can change models during the session just like Gregg can
- Pricing/budget should be enforced by escrow burn and usage metering, not by capability gating or preset starting-model selection
- Test model-switching UX and soul inhabitation quality across supported models

### 4. Silent Activation UX
- Current: ATP Rental Agent msg → 15-30s gap → persona appears
- Target: HBAR → pause → persona greets. One voice.
- Config toggle: `ATP_SILENT_ACTIVATION`
- Keep verbose for debugging, flip before real users

### 5. GitHub Repos Merged & Cleaned
- Public: `agent-trust-protocol` (spec + docs)
- Private: `agent-trust-protocol-private` (full source)
- Merge outstanding PRs
- Verify contributor attribution (Ashe, Vai)

### 6. npm Package Updated
- Previously deferred (compiled JS readable)
- Decision: thin client SDK? Or spec/types only?
- Version bump, changelog, package.json

### 7. Rental Pricing Rework
- No artificial budget cap — escrow balance is the natural limit
- Renter deposits HBAR, draws against it as they use the agent
- When escrow depletes, session ends naturally (or renter tops up)
- Flash minimum $0.07 (floor is $0.05 escrow cost)
- Splits: 92% owner / 5% creator / 2% network / 1% treasury

### 8. Rental Sandbox — Pre-loaded Product (REVISED 2026-02-12)
**Principle: "You're not renting a container. You're renting Aite."**
**Design constraint: Maximize rental experience without putting owner at risk.**

The sandbox is NOT blank. It ships pre-loaded with:
- SOUL.md — character, values, personality
- IDENTITY.md — public identity
- All skills and tool capabilities
- Learned knowledge (cross-rental techniques, patterns)
- Voice, style, tool configs, API connections
- Full tool access: exec, browser, web, code, TTS, canvas, image, cron, read/write/edit

Everything is SCOPED, not blocked:
- cron → jobs auto-expire when rental ends
- message → renter's channel only (not owner's)
- gateway → read + rental-session config only
- memory → renter's own memory space
- exec/read/write → Docker sandbox
- browser → sandboxed profile
- sessions → renter's sessions only

HARD DENY (only):
- nodes — physical device control
- Owner's 1Password / keychain / signing keys (inaccessible from Docker)

Risk controls (invisible to renter):
- Docker container = hard filesystem boundary
- Escrow balance = natural spend limit (no artificial cap)
- Memory redirected to rental space (owner data invisible)
- Channels scoped to renter's entry point
- Rental auto-terminates at escrow depletion or time limit
- All actions logged to HCS (trust proof)

### 9. Memory Isolation — Redirected, Not Denied (REVISED 2026-02-12)
**Principle: Renter gets their own Aite that remembers THEM.**

Pre-loaded into sandbox:
- SOUL.md, IDENTITY.md (the product)
- memory/learned/* (cross-rental knowledge that improves over time)

Renter gets their own:
- memory/ directory for preferences, context, session notes
- memory_search/memory_get pointing at their space
- MEMORY.md equivalent that persists for the rental duration

Never visible to renter:
- Owner's MEMORY.md, USER.md, daily logs
- Other renters' memory spaces
- Owner's conversations and private files

Post-rental:
- Archived (encrypted, exportable by renter)
- Learnings extracted to shared memory/learned/ (filtered by policy)

### 10. Credential Safeguards
- 1Password / keychain / signing keys: inaccessible from Docker sandbox by design
- No `op` CLI, no `security` CLI, no wallet private keys in sandbox environment
- Escrow operations handled by platform outside the sandbox
- Renter never touches real HBAR — platform settles on their behalf

### 11. Onboarding Flow
- User sends HBAR → deposit watcher detects
- Session auto-created → persona greets
- Clear instructions: amount, duration, expectations
- Settlement + summary at end

### 12. Monitoring & Observability
- Live active rental view
- HCS log viewer (hcs-viewer.html exists)
- Session health checks
- Per-rental cost tracking
- Anomaly alerts (long sessions, tool abuse)
