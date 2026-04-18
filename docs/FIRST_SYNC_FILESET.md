# First Public ATP Sync Candidate

## Include in first push

### Root
- `.gitignore`
- `README.md`
- `CONTRIBUTING.md`
- `package.json`
- `package-lock.json`

### Runtime
- `monitor/atp-monitor.mjs`
- `monitor/atp-rental-bot.mjs`
- `monitor/deposit-watcher.mjs`
- `monitor/funding-rails.mjs`
- `monitor/funding-store.mjs`
- `monitor/kill-rental.mjs`
- `monitor/paypal-checkout.mjs`
- `monitor/relay-client.mjs`

### Setup / verification scripts
- `scripts/atp-setup.mjs`
- `scripts/atp-doctor.mjs`
- `scripts/atp-rail-test.mjs`
- `scripts/rental-test.mjs` (if retained)
- selected wallet / rail helper scripts only if they are part of the source-install story

### Docker
- `docker/`
  - include image build path
  - include `.env.example`
  - exclude `docker/.env`

### Source / tests
- `src/`
- `tests/`

### Contracts
- `contracts/` is confirmed in scope for the first public ATP sync
- exclude secrets and local keys (`contracts/testnet-key.json`)

### Packages
- `packages/val-relay/` is confirmed in scope for the first public ATP sync

### Docs
- `docs/AGENT_TRUST_PROTOCOL.md`
- `docs/ATP_HCS_SCHEMA.md`
- `docs/ATP_HCS_SCHEMA_V2.md`
- `docs/ATP_HCS_SCHEMA_V2.1.md`
- `docs/ATP_ARCHITECTURE_COMPARISON.md`
- `docs/RENTAL_PRINCIPLES.md`
- `docs/RENTAL_DIAGNOSTIC_2026-02-10.md`
- `docs/RENTAL_TEST_REPORT.md`
- `docs/VAL_SPEC_v1.md`
- `docs/VAL_SPEC_v1.1.md`
- `docs/archive/` for intentionally archived ATP history
- `docs/REPO_SYNC_PREP.md`
- `docs/REPO_BOUNDARY_DECISIONS.md`
- `docs/DOCS_SYNC_SCOPE.md`
- `docs/FIRST_SYNC_FILESET.md`

## Exclude from first push

- private/operator docs in `docs/private/`
- `data/`
- `integrations/`
- `packages/val/`
- nested repos
- memory/logs/artifacts/state files
- benchmark output and one-off experiments
- internal planning files (`tasks/`, `drafts/`)

## Notes

This first sync should optimize for:
1. clean install from source
2. payment-enabled ATP runtime works locally
3. public repo matches the actual ATP product surface
4. no secrets or operator-private material leak into GitHub
