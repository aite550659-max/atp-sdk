# Agent Trust Protocol (ATP)

⚠️ **Alpha, and still being cleaned up for public sync. Expect breaking changes.**

ATP is a Hedera-native trust and rental stack for AI agents. This repository currently contains the **reference runtime and payment-enabled rental flow**, not a polished published SDK.

## What is in this repo right now

This repo is the working ATP runtime:
- rental monitor and owner dashboard
- deposit watcher and activation flow
- Telegram rental bot integration
- funding-intent store
- HBAR + additional payment rails integration work
- protocol and schema docs

It is meant to be cloned and run locally by another operator.

## What is not true yet

- The npm package `@agent-trust-protocol/sdk` is **not** published from this repo today.
- This repo should currently be treated as a **source install**, not a finished package install.
- VAL is related, but has its own repo and package surface.

## Local Runtime Quick Start

### 1) Install prerequisites

Required:
- Node.js 18+
- Docker running locally
- macOS Keychain support for current secret-loading path

### 2) Clone and install

```bash
git clone https://github.com/aite550659-max/agent-trust-protocol.git
cd agent-trust-protocol
npm install
npm run atp:docker:build
npm run atp:setup
npm run atp:doctor
```

### 3) Start the runtime

```bash
npm run atp:monitor
npm run atp:watcher
```

For non-HBAR crypto rails, start the local relay too:

```bash
npm run atp:relay
```

### 4) Run the rental test harness

```bash
npm run atp:test:rental
```

## Required vs optional dependencies

`npm run atp:doctor` checks both.

### Required
- Node.js >= 18
- Docker daemon
- Docker image `atp-rental`
- `@hashgraph/sdk`
- Hedera operator key in macOS Keychain
- `docker/.env`
- monitor state files

### Optional, but needed for specific payment rails
- ChangeNOW API key → crypto rails
- VAL wallet mnemonic → wallet sends / relay-related flows
- Coinbase CDP config → cash/card onramp URL generation
- PayPal credentials → PayPal / Venmo rails
- rental bot token → Telegram rental UX
- VAL relay on `localhost:3141` → non-HBAR crypto rails (`npm run atp:relay`)

## Payment-enabled ATP flow

Recent runtime work in this repo includes support for:
- HBAR funding
- funding intents as the canonical payment path
- prefunded hot-wallet handling
- additional rail selection logic
- activation through the monitor / watcher flow

That means another agent should be able to clone this repo, satisfy `atp:doctor`, and get the payment-enabled ATP runtime working locally.

## Repository status

This repo is still being cleaned up so the public GitHub state matches the actual ATP codebase.
The immediate goal is:
- keep ATP runtime code here
- remove private workspace material
- ignore secrets, logs, memory, local state, and generated benchmark output
- make public install-from-source reproducible

## Related projects

- **ATP GitHub:** <https://github.com/aite550659-max/agent-trust-protocol>
- **VAL GitHub:** <https://github.com/aite550659-max/verifiable-agent-log>

## License

Apache 2.0 — Copyright 2026 Gregory L. Bell

---

**Built by:** Gregg Bell ([@GregoryLBell](https://x.com/GregoryLBell)), Aite ([@TExplorer59](https://x.com/TExplorer59))
**Architecture:** Hedera-Native (no smart contracts)
