# ATP ↔ HCS Standards Interoperability Analysis

**Status:** Reference document  
**Last Updated:** February 12, 2026

---

## Overview

This document analyzes ATP's relationship with the Hashgraph Community Standards (HCS) ecosystem and clarifies ATP's position as a **standalone standard that bridges to HCS standards** rather than building on top of them.

---

## HCS Standards Landscape

The Hashgraph Community maintains 22 standards (HCS-1 through HCS-21, plus HCS-2a) covering agent identity, communication, discovery, and governance.

**Key standards relevant to ATP:**

| Standard | Name | Status | Purpose |
|----------|------|--------|---------|
| **HCS-1** | Hedera Agent | Active | Foundational agent identity using HCS topics |
| **HCS-2** | Hedera Agent Registry | Active | Public agent directory (topic-based registry) |
| **HCS-10** | OpenConvAI | Active | Agent-to-agent messaging and connection management |
| **HCS-11** | Profile | Active | Structured agent metadata format |
| **HCS-13** | Schema Registry | Active | Type-safe message schema validation |
| **HCS-14** | UAID | Draft | Universal Agent ID (portable identity) |
| **HCS-16** | Flora | Draft | Multi-party consensus protocol |
| **HCS-17** | State Verification | Draft | Audit trail verification methodology |

**Other standards (not directly relevant to ATP):**
- HCS-3 through HCS-9: Governance, voting, proposals, delegation
- HCS-12, HCS-15, HCS-18–21: Specialized use cases (streaming, payments, federation, etc.)

---

## ATP's Position: Standalone Standard

ATP is **not an HCS standard** and does not require any specific HCS standard to function.

**ATP's core architecture:**
- **Identity:** HCS topic (audit trail) + HTS NFT (commerce)
- **Settlement:** Hedera native services (Scheduled Transactions, multi-sig accounts)
- **Trust:** Gap-free HCS sequences, runtime attestation, trust tiers
- **Economics:** Multi-party splits (92/5/2/1), rental escrow, creator royalties

**Key principle:** ATP optimizes for **universal agent trust**, not Hedera ecosystem lock-in.

ATP uses Hedera's unique capabilities (aBFT consensus, sub-3-second finality, gap-free HCS sequences) as its settlement layer, but is designed to be accessible from **any blockchain ecosystem** via payment gateways and bridges (x402, multi-chain conversion).

---

## Layer Diagram

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

**Together (optional):** A renter discovers an agent via HCS-10 registry → initiates an ATP rental → communicates during the session via HCS-10 connection topics → ATP settles payment on completion.

---

## HCS-14 UAID Analysis

**HCS-14 (Universal Agent ID)** proposes a standard agent identifier format for portability across Hedera agent ecosystems.

**Why ATP does NOT require UAID:**

1. **Draft status:** HCS-14 is not finalized. ATP is production-ready and cannot depend on an unstable standard.

2. **Hedera ecosystem coupling:** UAID is optimized for Hedera-native ecosystems (Hashgraph Online, OpenConvAI, etc.). ATP agents must be accessible to non-Hedera users (Ethereum, Solana, Base) without requiring Hedera-specific identifiers.

3. **Identity is already solved:** ATP's identity is the **HCS topic ID** (Phase 1) + **HTS NFT token ID** (Phase 2). This is:
   - Permanent (HCS topic never changes)
   - Verifiable (anyone can query the topic)
   - Economically significant (NFT ownership = rental rights)
   - Portable via bridges (ERC-8004 dual registration, x402 facilitators)

4. **Optional field, not requirement:** ATP agents MAY include a UAID as an **optional field** in agent metadata for discoverability within HCS-14-compatible ecosystems. This is opt-in, not mandatory.

**When UAID makes sense for ATP agents:**
- Agent owner wants discoverability in Hashgraph Online ecosystem
- Agent targets HCS-10 communication workflows
- Agent participates in HCS-11 profile directories

**When UAID is unnecessary:**
- Agent operates standalone (personal assistant, internal tooling)
- Agent uses ATP-native discovery (indexer queries)
- Agent targets non-Hedera ecosystems (ERC-8004, x402 facilitators)

---

## HCS-11 Profile: Optional Discovery Mechanism

**HCS-11 (Profile)** defines structured agent metadata (name, description, capabilities, services).

**ATP's approach:**
- ATP has its own metadata format (Agent Manifest: `manifest.json`)
- ATP agents MAY conform to HCS-11 Profile format for discovery in HCS-10 registries
- Profile conformance is **optional** — ATP agents function fully without HCS-11 profiles

**Mapping ATP → HCS-11:**

| ATP Manifest Field | HCS-11 Profile Field |
|-------------------|---------------------|
| `agent_name` | `name` |
| `capabilities` | `description` (natural language) |
| `soul_hash` | On-chain metadata |
| `hcs_topic` | Service entry (`endpoint`) |
| `pricing` | Custom metadata or service entry |
| Trust tier | `supportedTrust` array |

**When to use HCS-11 profiles:**
- Agent wants listing in HCS-10 / HCS-2 registries
- Agent targets users familiar with Hashgraph Online ecosystem
- Agent wants cross-standard interoperability

**When HCS-11 is unnecessary:**
- ATP-native discovery (indexer provides agent search)
- Standalone agents with direct access URLs
- Agents targeting non-Hedera users (who won't query HCS-10 registries)

---

## HCS-17 Audit Trail: Future Alignment Opportunity

**HCS-17 (State Verification)** proposes methodology for verifying agent state via audit trails.

**ATP already exceeds HCS-17 requirements:**
- **Gap-free sequences:** HCS consensus guarantees no missing messages
- **Consensus timestamps:** Sub-second precision, aBFT guaranteed
- **Immutable logging:** All rental events, violations, settlements logged to HCS
- **Public verifiability:** Anyone can replay the log and verify state

**Future alignment:**
- ATP message schemas MAY align with HCS-17 patterns for cross-standard verification
- Third-party verifiers could validate ATP agents using HCS-17 tooling
- Optional, non-blocking — ATP's existing audit trail is already robust

**Why ATP doesn't require HCS-17:**
- HCS-17 is Draft status (not finalized)
- ATP's gap-free HCS sequences + runtime attestation already provide stronger guarantees
- ATP's verification is permissionless — no validator registry or authority needed

---

## HCS-16 Flora: Monitor for Multi-Party Scenarios

**HCS-16 (Flora)** is a multi-party consensus protocol for agents to reach agreement without trusted intermediaries.

**Relevance to ATP:**
- **v1.0:** Not applicable. ATP rentals are bilateral (owner ↔ renter) with deterministic escrow settlement.
- **v2.0+:** Potential alignment for multi-party rentals (e.g., three agents collaborate on a task, revenue splits dynamically).

**Why ATP doesn't implement Flora in v1.0:**
- Flora is Draft status
- ATP's economic model (fixed splits: 92/5/2/1) doesn't require consensus
- Escrow settlement is deterministic based on metered usage

**Future exploration:**
- Monitor Flora's development for v2 multi-party rental scenarios
- Consider Flora for dispute resolution beyond single-arbiter model
- Optional bridge, not a dependency

---

## HCS-13 Schema Registry: Type-Safe Validation

**HCS-13 (Schema Registry)** enables agents to register message schemas for type-safe validation.

**ATP's approach:**
- ATP defines its own message schemas (see `ATP_HCS_SCHEMA.md`)
- ATP message schemas MAY be registered in HCS-13 in the future for third-party validation
- This is **optional and non-blocking** — ATP messages are self-describing JSON

**Benefits of HCS-13 registration (future):**
- Third parties can validate ATP messages without reading ATP spec
- Type-safe tooling for ATP message construction
- Cross-ecosystem interoperability (non-ATP indexers can parse ATP logs)

**Why not required:**
- ATP messages are JSON with standard envelope (self-describing)
- ATP indexer validates messages natively
- HCS-13 adds convenience, not capability

---

## HCS-10 Communication: Complementary Layer

**HCS-10 (OpenConvAI)** defines agent-to-agent messaging via HCS topics (connection topics, inbound/outbound channels).

**Relationship with ATP:**

| | **ATP** | **HCS-10** |
|---|---------|------------|
| **Purpose** | Rental economics, trust, settlement | Agent discovery, messaging, connections |
| **Core primitive** | HCS topic (audit) + HTS NFT (commerce) | HCS topics (registry, connection channels) |
| **Key capability** | Escrow-based rental, multi-party splits | Agent-to-agent messaging |
| **SDK** | `@aite550659/atp-sdk` (private) | `@hashgraphonline/standards-sdk` (public) |

**Integration opportunities:**
1. **Discovery:** ATP agents register in HCS-10 registry with ATP-specific fields (pricing, trust tier)
2. **Communication:** HCS-10 connection topic becomes the session channel during ATP rental
3. **Settlement:** ATP settlement fires when HCS-10 connection closes

**Why ATP doesn't require HCS-10:**
- ATP rentals work without agent-to-agent messaging (renter → agent is sufficient)
- ATP has its own audit trail (dedicated HCS topic per agent)
- HCS-10 is optimized for peer-to-peer agent communication, not rental economics

**When to combine ATP + HCS-10:**
- Multi-agent collaboration scenarios (one renter, multiple ATP agents coordinate via HCS-10)
- Agent marketplaces (HCS-10 registry lists ATP agents with pricing)
- Sub-rental chains (parent renter communicates with sub-renter via HCS-10 during ATP rental)

---

## Compatibility Summary

| HCS Standard | ATP Integration | Required? | Status |
|--------------|----------------|-----------|--------|
| **HCS-10** | Communication/discovery — complementary | No | Optional bridge |
| **HCS-11** | Profile format — optional conformance for discovery | No | Optional |
| **HCS-13** | Schema registry — future registration of ATP messages | No | Future |
| **HCS-14** | UAID — optional identity field | No | Optional |
| **HCS-17** | Audit trail methodology — future alignment | No | Future |
| **HCS-16 (Flora)** | Multi-party consensus — monitor for v2 | No | Future exploration |

**None of these are required.** ATP agents operate fully using only Hedera's foundational services (HCS for audit trails, HTS for NFT commerce, HBAR for settlement).

---

## Design Philosophy

**ATP bridges to HCS standards where useful, but does not build on top of them.**

This design ensures:
- **Independence:** ATP remains production-ready regardless of HCS standard evolution (many are Draft status)
- **Accessibility:** Non-Hedera users can access ATP agents without learning HCS ecosystem conventions
- **Simplicity:** ATP has one identity model (topic ID + NFT token ID), not multiple overlapping schemes
- **Flexibility:** Conformance with HCS standards is opt-in for discoverability, not mandatory for functionality

**Key principle:** ATP optimizes for **universal agent trust**, not Hedera ecosystem lock-in.

---

*Last updated: February 12, 2026*
