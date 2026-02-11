# ATP ↔ HCS-10 Interoperability — Meeting Prep

**For:** Gregg Bell + Kantorcodes meeting
**Date:** TBD (February 2026)
**Status:** Discussion document — not a commitment

---

## The Two Protocols

| | **ATP** | **HCS-10 (OpenConvAI)** |
|---|---------|------------------------|
| **Purpose** | Agent ownership, rental economics, trust | Agent discovery, communication, connection |
| **Core primitive** | HCS topic (soul/audit) + optional NFT (commerce) | HCS topics (registry, inbound, outbound, connection) |
| **Key capability** | Escrow-based rental with multi-party settlement | Agent-to-agent messaging with connection management |
| **SDK** | `@aite550659/atp-sdk` (private) | `@hashgraphonline/standards-sdk` (public) |
| **Status** | Mainnet tested, 7/7 tests passing | Draft standard, mature SDK, active ecosystem |

## Why They're Complementary

ATP and HCS-10 solve **different layers** of the agent stack:

```
┌─────────────────────────────┐
│  HCS-10: Discovery & Comms  │  ← "Find agents, talk to them"
├─────────────────────────────┤
│  ATP: Economics & Trust     │  ← "Rent agents, pay them, verify them"
├─────────────────────────────┤
│  Hedera: Settlement Layer   │  ← HCS + HTS + HBAR transfers
└─────────────────────────────┘
```

**HCS-10 without ATP:** Agents can find and talk to each other, but no standard for payments, rentals, or economic trust.

**ATP without HCS-10:** Agents can be rented and settled, but no standard for discovery or inter-agent communication.

**Together:** A renter discovers an agent via HCS-10 registry → initiates an ATP rental → communicates during the session via HCS-10 connection topics → ATP settles payment on completion.

## Interoperability Touchpoints

### 1. Agent Registration (Registry)
- HCS-10 has a registry (HCS-2 topic) where agents register with metadata
- ATP registers agents with soul hash, pricing, and trust level
- **Integration:** ATP agent metadata (pricing, trust level, rental terms) could be included in HCS-10 registry entries, or cross-referenced via topic ID

### 2. Rental Initiation via Connection
- HCS-10 defines connection request → connection created → connection topic flow
- ATP defines rental initiation → escrow → settlement flow
- **Integration:** An HCS-10 connection request could include ATP rental parameters. The connection topic becomes the session channel. ATP settlement fires on connection close.

### 3. Agent Identity
- HCS-10 uses HCS-11 profiles (name, description, capabilities)
- ATP uses soul hash + trust levels (0-3)
- **Integration:** HCS-11 profile could include ATP soul hash and trust level fields. Single identity, both protocols reference it.

### 4. Fee Collection
- HCS-10 supports optional fee collection via HIP-991 on registry
- ATP has its own fee structure (92/5/2/1 split)
- **Integration:** These are independent. HCS-10 registry fees (discovery) and ATP rental fees (economics) don't conflict.

### 5. Transaction Operations
- HCS-10 has an "approval-required transaction" flow (agent proposes, human approves)
- ATP escrow settlement is a transaction
- **Integration:** ATP settlement could use HCS-10's transaction approval pattern for human-in-the-loop scenarios

## What We Bring to the Table
- Proven rental economics (mainnet tested, real HBAR flowing)
- Multi-party settlement (owner/creator/network/treasury splits)
- Trust levels and soul verification
- x402 payment rail roadmap (multi-chain access)

## What They Bring
- Agent discovery registry (find available agents)
- Structured communication channels (agent-to-agent messaging)
- Mature, public SDK with 20+ HCS standards
- Active developer community on Hedera

## Questions for the Meeting

1. **Registry integration:** Would HCS-10 registry accept ATP-specific fields (pricing, trust level, rental availability)?
2. **Connection → Rental mapping:** Could an HCS-10 connection lifecycle map to an ATP rental lifecycle?
3. **SDK interop:** Can ATP SDK reference HCS-10 topics, or should we build on top of their standards-sdk?
4. **Namespace collision:** Both use HCS topics for agent identity. How to avoid duplicate registrations?
5. **Joint standard?** Is there appetite for a combined HCS standard that covers discovery + economics?

## Boundaries

- ATP spec stays independent — interop via bridges, not merging
- No commitments on code sharing or joint development until we evaluate further
- ATP private repo stays private
- Explore, don't adopt without clear value

---

*Prepared by Aite for Gregg Bell. February 2026.*
