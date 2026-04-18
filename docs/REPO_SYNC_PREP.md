# ATP Public Repo Sync Prep

## Goal

Make `agent-trust-protocol` pushable as a clean public repo that another agent can:
- clone
- install from source
- satisfy `npm run atp:doctor`
- run the payment-enabled ATP runtime locally

## Keep in the ATP repo

- `monitor/` ATP runtime code
- `scripts/` ATP setup / doctor / test helpers
- `docker/` runtime image and templates
- `src/` protocol/runtime code
- `docs/` protocol, schema, install, and runtime docs
- `tests/` relevant ATP tests
- root `package.json`, `README.md`, `CONTRIBUTING.md`
- any config templates required for source installs

## Do not publish

### Secrets / credentials
- `docker/.env`
- `.hedera-env`
- `coinbase-cdp.json`
- `cdp-private-key.pem`
- wallet JSON files
- testnet / EC2 wallet files
- any local private keys or auth tokens

### Local runtime state
- `.openclaw/`
- `.agents/`
- `memory/`
- `logs/`
- `artifacts/`
- `monitor/*.lock`
- `monitor/*state*.json`
- `*.log`

### Unrelated or nested repos
- `verifiable-agent-log/`
- `val-web/`
- `coinbase-agentkit-pr/`
- `repos/`
- workspace-only project folders not required for ATP install/runtime

### Generated experiment output
- TPS benchmark JSON/CSV outputs
- generated slides / PPTX
- one-off result artifacts

## Before pushing

1. Expand `.gitignore`
2. Verify no secrets are staged
3. Decide final ATP repo boundary
4. Clean docs reorg (`docs/` vs `docs/archive/`)
5. Ensure README matches real install path
6. Run:
   - `npm install`
   - `npm run atp:docker:build`
   - `npm run atp:setup`
   - `npm run atp:doctor`
7. Push on a cleanup branch first, not directly to `main`

## npm / publishing note

Current ATP root package is prepared for source installs from GitHub, not public npm publish.
If ATP is later published to npm, finalize the package name and publish surface explicitly instead of publishing the current runtime root by accident.
