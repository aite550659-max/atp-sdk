# ATP Repo Boundary Decisions (Draft)

## Ship in the public ATP repo

### Core runtime
- `monitor/`
- `scripts/`
- `docker/`
- `src/`
- `tests/`
- `package.json`
- `README.md`
- `CONTRIBUTING.md`

**Scripts note:** most of `scripts/` looks ATP-runtime-adjacent and useful for source installs, testing, and payment-flow verification. Keep by default unless a script is clearly just a benchmark or workspace helper.

### Product docs
- `docs/AGENT_TRUST_PROTOCOL.md`
- `docs/ATP_HCS_SCHEMA*.md`
- `docs/VAL_SPEC_v1*.md` (only if needed as boundary/reference docs)
- `docs/archive/` for intentionally archived ATP docs
- `docs/REPO_SYNC_PREP.md`

### Payment-related code likely needed for installable runtime
- `monitor/funding-rails.mjs`
- `monitor/funding-store.mjs`
- `monitor/deposit-watcher.mjs`
- `monitor/atp-rental-bot.mjs`
- `monitor/kill-rental.mjs`
- `packages/val-relay/` (if non-HBAR crypto rails are part of the public install story)

### Core protocol/runtime source
- `src/`
  - includes ATP rental logger, integration guide, examples, and tests tied to the runtime story

## Probably keep out of the ATP repo

### Private operator / workspace files
- `AGENTS.md`
- `SOUL.md`
- `USER.md`
- `MEMORY.md`
- `HEARTBEAT.md`
- `SERVICES.md`
- `TOOLS.md`
- `IDENTITY.md`

### Nested repos / separate products
- `verifiable-agent-log/`
- `val-web/`
- `coinbase-agentkit-pr/`
- `repos/`

### Internal planning / workspace notes
- `tasks/` (except if a specific public roadmap file is intentionally curated into the repo later)
- `drafts/`

### Local runtime state
- `.openclaw/`
- `.agents/`
- `memory/`
- `logs/`
- `artifacts/`
- lock files / state JSON / log files

### Generated experiment output
- TPS result JSON/CSV files
- benchmark rerun files
- one-off presentation output

## Needs explicit decision before push

### `data/`
Classified as **do not publish in the ATP repo**. It is overwhelmingly local analytics, receipts, wallet/config state, cost tracking, and private/operator material. If ATP eventually needs public example data, add sanitized samples elsewhere.

### `integrations/`
Classified as **VAL-side integration work**, not ATP runtime. Current contents are `val-langchain` and `val-crewai`, which belong with VAL, not the ATP runtime repo.

### `assets/`, `config/`, `bin/`, `deploy/`, `knowledge/`
Still needs review.
`deploy/agent-relay/` remains optional and separate from the confirmed first-sync ATP runtime surface.

### `contracts/`
**Confirmed in scope for first public ATP sync.**
Keep the full `contracts/` surface needed by the repo, while still excluding secrets/local keys.
Exclude `contracts/testnet-key.json`.

### `lib/`
Mixed. Most contents look like workspace tooling rather than ATP runtime. Keep out by default unless a file is proven part of the public ATP install path.
Likely candidates for separate review:
- `lib/val-wallets.mjs`
- `lib/wallet-balances.js`
- any helper actually invoked by ATP runtime or docs

### `packages/`
Split boundary:
- `packages/val-relay/` → **confirmed keep** for ATP public sync
- `packages/val/` → **move out / exclude** from ATP repo surface, belongs with VAL

### top-level one-off docs / HTML / scripts
Examples:
- `ATP_CODE_REVIEW.md`
- `AUTONOMOUS_MODE.md`
- `aite-hq.html`
- `dashboard.html`
- benchmark scripts
These need case-by-case review.

## Immediate recommendation

Prepare the first public sync around this ATP surface:
- `package.json`
- `README.md`
- `contracts/`
- `docker/`
- `monitor/`
- `scripts/`
- `src/`
- `tests/`
- curated `docs/`
- `packages/val-relay/`

Everything else should either be:
- ignored
- moved out
- archived intentionally
- or reviewed before inclusion
