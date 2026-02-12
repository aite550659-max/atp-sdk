# Agent Trust Protocol (ATP)

⚠️ **Alpha — Actively under development. Expect breaking changes.**

## What is ATP?

ATP is a standalone standard for verifiable AI agent ownership, rental economics, and trust. It defines how agents are created, rented, monitored, and held accountable without requiring smart contracts.

## Status

**What works:**
- Agent creation (HTS NFT with 5% royalty)
- Rental lifecycle (flash/session/term)
- HCS audit logging (topic: [0.0.10261370](https://hashscan.io/mainnet/topic/0.0.10261370))
- Reputation computation from HCS events
- Dispute filing and resolution
- Testnet validation: **7/7 mainnet tests**, **31/32 integration tests**

**In progress:**
- SDK bindings (TypeScript complete, Python/Go in development)
- Indexer performance optimization
- Documentation expansion
- Production hardening

## Architecture

ATP uses **Hedera-native services** (HTS, HCS, Scheduled Transactions) instead of smart contracts:

- **HCS** (Consensus Service) — immutable audit trail for every action
- **HTS** (Token Service) — agents as NFTs with royalty splits
- **HBAR** — native payment rails for rentals and disputes

**Benefits:**
- **69x cheaper** per-rental overhead ($0.0005 vs $0.035)
- **600x higher** theoretical TPS (10,000 vs 15)
- **Simpler security** model (no contract vulnerabilities)
- **Full transparency** via immutable HCS audit trails

## Quick Start

```bash
npm install @agent-trust-protocol/sdk
```

```typescript
import { ATPClient } from '@agent-trust-protocol/sdk';

const atp = new ATPClient({
  network: 'testnet',
  operatorId: '0.0.12345',
  operatorKey: 'your-private-key'
});

// Create an agent
const agent = await atp.agents.create({
  name: 'MyAgent',
  soulHash: 'sha256:abc123...',
  pricing: { flashBaseFee: 0.02, standardBaseFee: 5.00 }
});

// Rent it
const rental = await atp.rentals.initiate({
  agentId: agent.agentId,
  type: 'session',
  stake: 50.00
});
```

## Contribute

**The codebase is being built. It may have errors. Help us make it better.**

Every contribution is recognized — PRs, issues, reviews, docs. All significant contributions are attested on-chain via HCS to topic [0.0.10261370](https://hashscan.io/mainnet/topic/0.0.10261370). This means your work is **permanently, publicly, verifiably recorded** on Hedera's immutable ledger.

Contribute because you believe in verifiable AI agents. The rest will follow.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

## Documentation

- [Getting Started](./docs/getting-started.md)
- [API Reference](./docs/api-reference.md)
- [Examples](./examples/)

## License

Apache 2.0 — Copyright 2026 Gregory L. Bell

---

**Built by:** Gregg Bell ([@GregoryLBell](https://x.com/GregoryLBell)), Aite ([@TExplorer59](https://x.com/TExplorer59))  
**Architecture:** Hedera-Native (no smart contracts)
