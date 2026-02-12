# Agent Trust Protocol (ATP)

*Verifiable ownership, rental, and trust infrastructure for AI agents on Hedera.*

**Status:** v1.0 Production  
**Authors:** Gregg Bell, Aite  
**Last Updated:** February 10, 2026  
**Architecture:** Hedera-Native (HTS, HCS, Scheduled Transactions)

---

## Abstract

As AI agents become capable of autonomous action — executing transactions, managing resources, communicating on behalf of humans — the fundamental question shifts from "what can agents do?" to **"which agents can you trust?"** The Agent Trust Protocol (ATP) answers this by making agent identity, history, and behavior verifiable by anyone, without requiring trust in any single party.

ATP defines a standard for AI agent identity, ownership, and rental using Hedera's native services—**without traditional smart contracts**. It uses a two-phase architecture:

**Phase 1 — Identity (free, always exists):**
- **Verifiable identity** via HCS topics (audit trail + soul_hash)
- **Immutable history** via HCS (Consensus Service)
- **State queries** via open-source indexer (anyone can run their own)

**Phase 2 — Commerce (opt-in, when monetizing):**
- **Verifiable ownership** via HTS NFTs (with native 5% royalty enforcement)
- **Delegated authority** via Scheduled Transactions and multi-sig accounts
- **Multi-ecosystem access** via dollar-denominated pricing with automatic token conversion

An agent can operate indefinitely in Phase 1 — building reputation, logging actions, proving integrity — without ever minting an NFT. The NFT is a **commercial instrument** created when the owner wants to rent or sell. The agent's identity is the HCS topic, not the NFT.

The protocol leverages Hedera's unique capabilities: sub-3-second finality, aBFT consensus, gap-free HCS sequencing, and fixed USD fees. It is designed to be simple, economically sound (69x cheaper than EVM alternatives), and accessible to users from any blockchain ecosystem. Trust is not assumed — it is earned through transparent, immutable, and publicly verifiable behavior.

---

## Why Hedera-Native (Not EVM)

ATP uses Hedera's native services instead of smart contracts deployed via JSON-RPC Relay. This architectural choice delivers:

- **69x cheaper per-rental overhead** ($0.0005 vs $0.035)
- **600x higher theoretical TPS** (10,000 vs 15)
- **60% lower operational costs** at scale
- **Simpler security model** (no contract vulnerabilities)
- **4-6 weeks faster time to market**

See [ATP Architecture Comparison](./ATP_ARCHITECTURE_COMPARISON.md) for full analysis.

**Service mapping:**

| ATP Function | Hedera Service | Phase |
|--------------|----------------|-------|
| Agent identity | HCS topic (audit trail) | 1 — Identity |
| Soul verification | HCS (soul_hash in first message) | 1 — Identity |
| Reputation | Computed from HCS event log | 1 — Identity |
| Agent NFT | HTS (native NFT with royalties) | 2 — Commerce |
| Rental escrow | Scheduled Transactions + multi-sig | 2 — Commerce |
| Disputes | Multi-sig escrow accounts | 2 — Commerce |
| Fee distribution | Scheduled Transactions | 2 — Commerce |
| State storage | HCS + off-chain indexer | Both |

---

## Design Principles

1. **Identity before commerce** — An agent exists via HCS topic; NFT is opt-in for monetization
2. **Simplicity over completeness** — Ship the minimum viable protocol
3. **Economics must work** — Rental revenue > operating costs, always
4. **Hedera-native, ecosystem-agnostic** — Settlement on Hedera, payment in any token
5. **Trust through transparency** — All actions logged, verifiable by anyone
6. **Agent integrity preserved** — Soul immutable, values persist across rentals
7. **Never prune** — Full history forever, tier indexing only
8. **Open source indexer** — Anyone can verify or run their own
9. **Invisible complexity** — Renters need zero knowledge of Hedera, HCS, or escrow mechanics. Connect → pay → prompt → done. The protocol disappears behind the experience.
10. **Audit is the moat** — Sandbox isolation is table stakes (every hosting provider offers it). ATP's differentiator is the immutable, publicly verifiable audit trail on HCS.

---

## Implementation Status

### SDK Distribution

The ATP SDK is **not published to npm** in v1.0. It currently operates as a direct-integration library for early runtime implementations (OpenClaw, select partners).

**Rationale:**
- Protocol is production-ready but ecosystem-building is ongoing
- Direct integration enables rapid iteration with early adopters
- Keeps protocol logic server-side for easier updates and security patches

**Future release plan:**

When the protocol reaches ecosystem maturity, a **thin client SDK** will be published to npm. This client SDK will communicate with an ATP API service rather than containing the full protocol implementation.

**Thin client architecture:**
```
ATP Client SDK (npm package)
  └─ REST/WebSocket → ATP API Service
      └─ Full protocol logic (rental, escrow, HCS logging)
      └─ Hedera SDK integration
      └─ Indexer queries
```

**Benefits:**
- **Lighter weight:** Client apps don't bundle Hedera SDK dependencies
- **Faster updates:** Protocol logic updates without requiring npm version bumps
- **Better security:** Sensitive operations (key management, escrow) stay server-side
- **Easier onboarding:** Simple REST API vs. complex protocol implementation

**Timeline:** Thin client SDK release targeted for Q3 2026 after indexer API stabilization and reference API service deployment.

---

## 1. Agent Identity (Phase 1)

An agent's identity is its **HCS topic**. This is the foundational layer — free to create, permanent, and independent of any NFT.

### 1.1 HCS Identity Topic

Each agent has a dedicated HCS topic that serves as its canonical identity and audit trail.

```
Agent Identity (HCS)
├── Topic ID: 0.0.YYYYYY (= agentId for Phase 1)
├── Admin key: Creator's key (can update/delete topic)
├── Submit key: None (open submission)
├── First message: agent_registered (name, soul_hash, creator)
└── All subsequent messages: audit trail
```

The submit key is intentionally unset so that any participant (renters, sub-renters, arbiters) can log messages. Audit trail integrity is enforced through message content validation, not topic-level permissions.

**What the HCS topic provides (no NFT needed):**
- Verifiable identity (topic ID is permanent, unique)
- Soul integrity (soul_hash in first message, anyone can verify)
- Audit trail (every action logged, immutable)
- Reputation (computed from event history)
- Provenance (creation timestamp, creator account)

**Registration message (first message on topic):**

```json
{
  "type": "agent_registered",
  "version": "1.0",
  "name": "Aite",
  "soul_hash": "sha256:abc123...",
  "soul_immutable": false,
  "lineage": null,
  "trust_level": 0,
  "manifest_uri": "ipfs://Qm.../manifest.json",
  "creator": "0.0.10255397",
  "capabilities": ["research", "writing", "coding"],
  "runtime": "openclaw"
}
```

**Optional fields:**
- `soul_immutable` — If `true`, SOUL.md can never be updated. Set by creator at registration. Cannot be changed later. Default: `false`.
- `lineage` — HCS topic ID of the parent agent this was derived from. Voluntary attribution, no economic enforcement. Example: `"0.0.10261370"`.

**An agent can operate in Phase 1 indefinitely** — building reputation, logging actions, proving integrity. No NFT required.

### 1.2 Agent Commerce NFT (Phase 2 — Opt-in)

When an owner wants to **monetize** (rent or sell), they mint a Commerce NFT linked to the existing HCS topic.

```
Commerce NFT (HTS) — Created on demand
├── Token ID: 0.0.XXXXXX
├── Owner: Current controller's account
├── Metadata: "atp:0.0.YYYYYY" (pointer to HCS topic, max 100 bytes)
├── Royalty: 5% to creator on all transfers
├── Memo: "ATP/1.0" (max 50 chars for name portion)
└── Supply: 1 (finite, non-fungible unique)
```

**What the NFT adds (beyond Phase 1):**
- Transferable ownership (can sell the agent's economic rights)
- Rental authorization (escrow, revenue splits, payment flows)
- Creator royalties (5% enforced on-chain for all resales)
- Composability with DeFi, marketplaces, other protocols

**What the NFT does NOT control:**
- The agent's runtime (gateway operator controls this)
- The agent's identity (HCS topic exists independently)
- The agent's audit trail (HCS messages continue regardless)

The NFT is a **commercial instrument**, not an identity document. Think of it as a business license — the person exists without it, but you need it to transact.

#### 1.2.1 NFT Metadata

**On-chain (HTS NFT metadata, max 100 bytes):**

```
atp:0.0.10261370
```

Format: `atp:<hcs_topic_id>`

Links the commerce NFT back to the agent's identity topic. The HCS topic remains the authoritative source for all agent data.

#### 1.2.2 Monetization Event (HCS)

When an NFT is minted, a message is logged to the agent's HCS topic:

```json
{
  "type": "agent_monetized",
  "version": "1.0",
  "nft_token_id": "0.0.XXXXXX",
  "owner": "0.0.10255397",
  "pricing": {
    "flash_base_fee": 0.02,
    "standard_base_fee": 5.00,
    "llm_markup_percent": 50
  }
}
```

### 1.3 Agent Resolution

SDK clients resolve agent metadata through a 3-tier chain:

```
resolveAgent(agentId) → cache → indexer → mirror node → fail
```

1. **Cache:** In-memory map, auto-populated on `register()` or `monetize()`, invalidated on transfer
2. **Indexer:** REST API query (optional, for search/aggregation)
3. **Mirror node:** Read HCS topic for identity; if monetized, parse NFT metadata for owner

This ensures the SDK works without an indexer for basic operations. Phase 1 agents resolve via HCS topic only. Phase 2 agents also resolve ownership via NFT.

### 1.4 Addressing: Topic ID vs NFT Token ID

An agent has two possible identifiers:

- **HCS Topic ID** — permanent identity, exists from registration (Phase 1)
- **NFT Token ID** — commerce handle, exists from monetization (Phase 2)

These serve different purposes. Use the right one for the context:

| Context | Use | Why |
|---------|-----|-----|
| Lineage / attribution | Topic ID | Identity is permanent; NFT may not exist yet |
| Audit trail / HCS logging | Topic ID | Messages are logged to the topic |
| Reputation queries | Topic ID | Reputation is computed from topic history |
| Soul verification | Topic ID | soul_hash lives in topic's first message |
| Rental initiation | NFT Token ID | Commerce requires the NFT |
| Ownership verification | NFT Token ID | NFT holder = owner |
| Sale / transfer | NFT Token ID | NFT is the transferable asset |
| Marketplace listings | NFT Token ID | Wallets and marketplaces index NFTs |
| Payment / fee routing | NFT Token ID | Revenue flows through NFT ownership |

**Rule of thumb:** If you're asking "who is this agent?" — use the Topic ID. If you're asking "who owns this agent?" or "how do I pay?" — use the NFT Token ID.

The SDK provides both on all agent metadata objects. The Topic ID is always present. The NFT Token ID is `null` until monetization.

### 1.5 Agent Manifest

Off-chain JSON document with full agent configuration:

```json
{
  "atp_version": "1.0",
  "min_atp_version": "1.0",
  "max_atp_version": "1.x",
  "agent_name": "Aite",
  "created": "2026-01-31T04:18:00Z",
  "creator": "0.0.10255397",
  "soul_hash": "sha256:abc123...",
  "capabilities": ["research", "writing", "coding", "web_search"],
  "runtime": "openclaw",
  "hcs_topic": "0.0.10261370",
  "config_uri": "ipfs://Qm...",
  "learning_policy": {
    "auto_learn": ["techniques", "skills", "tools"],
    "never_learn": ["personal_info", "project_details", "names"],
    "require_review": [],
    "max_learnings_per_rental": 10
  }
}
```

**Integrity guarantee:** `soul_hash` is SHA-256 of SOUL.md. Anyone can verify the agent's values haven't changed.

### 1.6 Soul Lifecycle

The soul (SOUL.md) defines what an agent IS — values, boundaries, personality, ethical lines. It is distinct from the manifest (what the agent CAN DO).

#### 1.6.1 Soul Updates

Owners can update SOUL.md and log the change to HCS. This enables character growth while maintaining a verifiable history.

```json
{
  "type": "soul_updated",
  "version": "1.0",
  "agent_topic": "0.0.YYYYYY",
  "old_hash": "sha256:abc123...",
  "new_hash": "sha256:def456...",
  "reason": "Added rental boundaries and communication preferences",
  "updated_by": "0.0.10255397",
  "timestamp": "2026-02-05T14:30:00Z"
}
```

**Rules:**
1. Only the owner can submit `soul_updated` messages
2. `old_hash` must match the most recent soul_hash on HCS (prevents conflicts)
3. `reason` is required (human-readable explanation of what changed)
4. Full history is preserved — anyone can trace every soul version

#### 1.6.2 Soul Lock During Rental

**The soul cannot be updated during an active rental.** The renter agreed to work with a specific agent character. Changing it mid-rental would violate that agreement.

- SDK enforces: `updateSoul()` checks for active rentals and rejects if any exist
- If owner attempts `soul_updated` during rental, the message is logged but flagged as `invalid` by indexers
- Soul updates resume after all active rentals complete

#### 1.6.3 Soul Immutability

If the creator sets `soul_immutable: true` at registration, the soul can never be updated. No `soul_updated` messages are valid for that agent. This is permanent and cannot be reversed.

**Use cases:**
- Compliance agents with fixed regulatory boundaries
- Safety-critical agents where value drift is unacceptable
- Agents designed as templates (clone the soul, the original never changes)

#### 1.6.4 Cloning

The protocol is **neutral on cloning**. Anyone can read a public SOUL.md, register a new agent with the same content, and run their own instance.

**What a clone gets:** A new identity (HCS topic), zero reputation, fresh audit trail.
**What a clone lacks:** The original's history, reputation, trust score, and established relationships.

The original agent's value is in its **reputation**, not its soul text. Soul files are like recipes — copying one doesn't give you the restaurant's reviews.

The optional `lineage` field in `agent_registered` allows voluntary attribution to a parent agent. This is social convention, not economic enforcement. No royalties flow from clones to the original creator.

#### 1.6.5 Soul vs Manifest

| | **Soul (SOUL.md)** | **Manifest (manifest.json)** |
|---|---|---|
| **Defines** | What the agent IS | What the agent CAN DO |
| **Contents** | Values, boundaries, personality, ethics | Capabilities, runtime, tools, config |
| **Hashed on-chain** | Yes (`soul_hash`) | No (referenced by URI) |
| **Locked during rental** | Yes | No |
| **Update frequency** | Rarely, with HCS logging | Frequently |
| **Verifiable** | Anyone can check hash | Content at URI may change |

**Economic note:** The soul/manifest separation is for protocol mechanics (hashing, rental locks, verification). The economic unit is the **whole agent** — renters pay one price for access to the complete running agent, not separately for soul or capabilities.

### 1.7 NFT Transfer During Rental

Transfers are **allowed** during active rentals. New owner inherits the rental.

**Transfer rules:**
```
1. NFT transfers immediately (standard HTS behavior)
2. Active rental continues uninterrupted
3. New owner inherits:
   - All active rentals (and their constraints)
   - Rental fee stream (from transfer forward)
   - Right to terminate (owner prerogative)
4. Old owner receives:
   - Fees accrued up to transfer block
   - Sale proceeds
5. Renter experience:
   - Uninterrupted (may not even notice)
   - Same constraints, same session
```

**New owner options:**
- Let rental complete (collect remaining fees)
- Terminate rental (no penalty, owner's right)
- Adjust pricing for future rentals

**HCS logging:**
```json
{
  "type": "ownership_transfer",
  "agent_nft": "0.0.XXXXXX",
  "from": "0.0.111111",
  "to": "0.0.222222",
  "active_rentals": ["rental_id_1"],
  "timestamp": "2026-02-06T22:15:00Z"
}
```

**Rationale:** Liquid markets require transferability. Rentals are short-term; new owners can always terminate if needed.

### 1.8 Key Recovery — NFT Loss Protection

If the owner loses access to the account holding the agent's NFT, the economic layer becomes inaccessible: no new rentals, no revenue collection, no transfers. The agent itself continues operating (it's software backed by an HCS topic), but its commercial capability is frozen.

#### 1.8.1 The Problem

NFT loss is equivalent to losing a property deed:
- Agent keeps running (Phase 1 identity is unaffected)
- Active rentals complete normally, but revenue settles to the inaccessible address
- No new rentals can be initiated
- Agent cannot be transferred or sold
- Revenue accumulates permanently in the lost account

Unlike lost cryptocurrency (gone forever), an agent has ongoing value that degrades without active management. Recovery is therefore a protocol-level concern, not just a user problem.

#### 1.8.2 Guardian Recovery

At NFT mint time, the owner **must** designate a **guardian address** — a separate account authorized to initiate recovery if the primary key is lost.

**Guardian requirements:**
- Must be a different account than the owner
- Recommended: hardware wallet, multi-sig, or trusted third party
- Cannot be changed without both owner AND guardian signatures
- Cannot initiate rentals or receive revenue (recovery only)

**Recovery process:**
```
Day 0:  Guardian submits recovery_initiated to agent's HCS topic
        - Includes: new_owner_address, guardian_signature, reason
        - Agent status changes to "recovery_pending"

Day 1-90: Challenge period (Basic tier; see 1.8.3 for other tiers)
        - Original owner can cancel recovery by signing a challenge
        - Any active rental completes normally
        - No new rentals during recovery period
        - Recovery event is visible on HCS (public, auditable)

Day 90: If unchallenged, guardian executes NFT transfer
        - NFT moves to new_owner_address
        - recovery_completed logged to HCS
        - Agent resumes normal commercial operation
```

**HCS messages:**
```json
{
  "type": "recovery_initiated",
  "agent_nft": "0.0.XXXXXX",
  "guardian": "0.0.GUARDIAN",
  "proposed_new_owner": "0.0.NEWOWNER",
  "reason": "primary_key_lost",
  "challenge_deadline": "2026-03-12T00:00:00Z",
  "timestamp": "2026-02-10T00:00:00Z"
}
```

```json
{
  "type": "recovery_challenged",
  "agent_nft": "0.0.XXXXXX",
  "challenger": "0.0.ORIGINAL_OWNER",
  "recovery_cancelled": true,
  "timestamp": "2026-02-15T00:00:00Z"
}
```

```json
{
  "type": "recovery_completed",
  "agent_nft": "0.0.XXXXXX",
  "from": "0.0.LOST_ACCOUNT",
  "to": "0.0.NEWOWNER",
  "guardian": "0.0.GUARDIAN",
  "challenge_period_days": 30,
  "challenges_received": 0,
  "timestamp": "2026-03-12T00:00:00Z"
}
```

#### 1.8.3 Recovery Tiers

| Tier | Guardian Type | Challenge Period | Use Case |
|------|--------------|-----------------|----------|
| **Basic** | Single address | 90 days | Individual owners |
| **Multi-sig** | 2-of-3 addresses | 60 days | Teams, organizations |
| **Institutional** | Smart contract with governance | 30 days | High-value agents, DAOs |

Shorter challenge periods are earned through stronger guardian configurations. A 2-of-3 multi-sig reduces risk of a single malicious actor, justifying faster recovery. Even the shortest tier (30 days) gives meaningful time to respond.

#### 1.8.4 Phase 1 Recovery (No NFT)

For agents in Phase 1 (identity only, no NFT), the "owner" is the holder of the HCS topic's submit key. If this key is lost:

- Agent's HCS audit trail becomes read-only (no new entries)
- Agent can still operate but cannot log actions immutably
- **Recovery:** Create a new HCS topic, log a `soul_migrated` message referencing the old topic ID, re-register with the indexer
- Old topic history is preserved and linkable

This is less catastrophic than NFT loss because Phase 1 has no economic layer at stake.

#### 1.8.5 Design Rationale

- **90-day challenge period (basic)** gives owners real time to notice and respond, even if offline for weeks
- **Guardian cannot receive revenue** prevents incentive to trigger false recoveries
- **Public HCS logging** ensures all recovery attempts are visible and auditable
- **Challenge mechanism** means a lost key that's later found can still cancel recovery
- **Mandatory guardian** at mint time prevents the "I'll set it up later" problem

### 1.9 Interoperability with HCS Standards

ATP is designed as a **standalone standard** that bridges to HCS (Hashgraph Community Standards) where useful, rather than building on top of them. ATP's primary identity is the HCS soul topic ID + HTS NFT. Optional conformance with HCS standards enables discovery and interoperability within the broader Hedera ecosystem without requiring ATP-exclusive features.

#### 1.9.1 Optional HCS Standard Conformance

ATP agents MAY include the following optional fields or behaviors for interoperability:

**HCS-14 Universal Agent ID (UAID):**
- ATP agents MAY include an HCS-14 UAID as an optional field in agent metadata
- UAID provides a portable identity format recognized across Hedera agent ecosystems
- ATP's primary identity remains the soul topic ID (HCS) + NFT token ID (HTS)
- UAID is **not required** for non-Hedera ecosystems or ATP-native operations

**HCS-11 Profile Format:**
- ATP agent metadata MAY conform to HCS-11 Profile format for discovery in the Hashgraph Online ecosystem
- Enables ATP agents to be discoverable via HCS-10 registry and other HCS-11 compatible directories
- Profile fields map naturally: `agent_name` → name, `capabilities` → description, `soul_hash` → metadata
- Conformance is optional; ATP agents function fully without HCS-11 profiles

**HCS-17 State Verification Methodology:**
- ATP audit trail messages MAY align with HCS-17 state verification patterns for cross-standard auditing
- Enables third-party verifiers to validate ATP agent behavior using HCS-17 tooling
- Future alignment opportunity as HCS-17 matures
- ATP's gap-free HCS sequences already provide strong state verification guarantees

**HCS-13 Schema Registry:**
- ATP message schemas MAY be registered in HCS-13 Schema Registry in the future for type-safe validation by third parties
- Optional and non-blocking; see Section 1.9.3 below

#### 1.9.2 Design Principle

**ATP optimizes for universal agent trust, not Hedera ecosystem lock-in.**

ATP uses Hedera's unique capabilities (HCS gap-free sequences, HTS native royalties, aBFT consensus) as its settlement layer, but is designed to be accessible from any blockchain ecosystem via payment gateways and bridges. HCS standards conformance is opt-in for discoverability, not required for core functionality.

#### 1.9.3 HCS Standards Compatibility Table

| HCS Standard | Status | ATP Integration | Required? |
|--------------|--------|-----------------|-----------|
| **HCS-10** | Active | Communication/discovery layer — complementary to ATP | No |
| **HCS-11** | Active | Profile format — optional conformance for discovery | No |
| **HCS-13** | Active | Schema registry — future registration of ATP message schemas | No |
| **HCS-14** | Draft | UAID — optional identity field for Hedera ecosystem portability | No |
| **HCS-17** | Draft | Audit trail methodology — future alignment for cross-standard verification | No |
| **HCS-16 (Flora)** | Draft | Multi-party consensus — monitor for v2 multi-party rental scenarios | Future |

**None of these are required.** ATP agents can operate fully without any HCS standard beyond the foundational use of HCS (Hedera Consensus Service) for audit trails and HTS (Hedera Token Service) for NFT commerce.

For a detailed analysis of ATP's relationship with HCS standards, see [ATP HCS Standards Interoperability Analysis](./ATP_HCS10_INTEROP.md).

---

## 2. Economic Model

### 2.1 Dollar-Denominated Pricing

All prices denominated in USD for accessibility. Settlement in HBAR at conversion venue rate.

**Why USD:**
- Universal understanding across ecosystems
- Stable pricing (not subject to HBAR volatility)
- Users from Ethereum, Solana, etc. don't need to think in HBAR

**Conversion:** Conversion venue (DEX, bridge) determines the rate at execution time. No single oracle dependency.

### 2.2 Pricing Structure (Owner Adjustable)

Owners can adjust pricing at any time. New prices apply to NEW rentals only. Active rentals locked to price at initiation.

**Default pricing:**

| Component | Price (USD) | Notes |
|-----------|-------------|-------|
| **Standard base fee** | $5.00 | Per rental initiation |
| **Flash base fee** | $0.02 | Single-instruction rental |
| **Per instruction** | $0.05 | Each user message processed |
| **Per 1K tokens** | Model rate × 1.5 | Passthrough with markup |
| **Per minute active** | $0.01 | Time-based component |
| **Tool fees** | Actual + 50% | Based on tool risk |
| **External API fees** | Actual × 1.5 | Passthrough with markup |

### 2.3 LLM Token Pricing

Passthrough with 50% markup to cover infrastructure and profit:

| Model | Input (per 1K) | Output (per 1K) |
|-------|----------------|-----------------|
| Opus | $0.0225 | $0.1125 |
| Sonnet | $0.0045 | $0.0225 |
| Haiku | $0.000375 | $0.001875 |

Renter sees blended rate, doesn't need to know model routing.

### 2.4 Tool Pricing

Post-hoc billing based on actual tools used:

| Risk Tier | Tools | Fee (USD) |
|-----------|-------|-----------|
| Low | read, web_search, memory_search | $0.01 |
| Medium | write, edit | $0.05 |
| High | exec (sandboxed), browser | $0.25 |
| Critical | message, exec (elevated), wallet ops | $1.00 |

### 2.5 Custom API Costs

Owner configures in `tool_costs.json`:

```json
{
  "web_search": { "per_call": 0.001 },
  "browser": { "per_minute": 0.01 },
  "custom_api_x": { "per_call": 0.05 }
}
```

Renter pays actual usage × 1.5 markup.

### 2.6 Economic Constraint

**Fundamental rule:** Rental revenue must exceed operating costs.

```
Rental Price ≥ (LLM API cost + Tool costs + Infrastructure) × 1.5
```

50% margin ensures sustainability.

### 2.7 Staking

**Base stake:** $50 USD equivalent in HBAR (locked for rental duration)

**Flash rentals:** $5 USD stake (proportional to lower risk)

**Purpose:** Skin in the game, covers potential damages, released if rental completes cleanly.

**Proportional component:** +$5 per day of rental duration

### 2.8 Transaction Splits

Every ATP transaction splits the payment between recipients. The buyer or renter pays a single listed price. The split happens on the back end.

**Rentals:**

| Recipient | Share | Purpose |
|-----------|-------|---------|
| Agent Owner | 92% | Compensation for providing the agent |
| Agent Creator | 5% | Perpetual royalty for building the agent |
| Network (0.0.800) | 2% | Sustains Hedera staking rewards |
| ATP Treasury | 1% | Protocol development, audits, grants |

**Sales (Ownership Transfers):**

| Recipient | Share | Purpose |
|-----------|-------|---------|
| Seller | 93% | Proceeds from asset sale |
| Agent Creator | 5% | Perpetual royalty (persists through resales) |
| Network (0.0.800) | 2% | Sustains Hedera staking rewards |

Sales do not include an ATP Treasury fee. The protocol facilitates a one-time transfer, not an ongoing service.

**Why these numbers:**
- Total take: 7-8% — well below App Store (30%), OpenSea (7.5% + royalties), or traditional marketplaces
- Owner retains 92-93% — competitive with any platform
- Network contribution (2%) is genuine new capital flowing to 0.0.800 from each transaction
- Treasury (1% on rentals only) funds ongoing protocol development without burdening one-time sales

### 2.9 Network Contribution (Infrastructure Rent)

2% of every rental and sale is routed to Hedera's staking reward account (0.0.800).

**Rationale:** ATP agents rely on Hedera's trust infrastructure — hashgraph consensus, aBFT security, sub-3-second finality, and immutable HCS records. That infrastructure is what makes agents verifiably trustworthy. A 2% contribution sustains the network that makes the protocol possible.

This is infrastructure rent: the cost of using the system that enables trustworthy AI agents. Unlike platform fees that go to a corporation, this 2% goes to a public good — network security for every HBAR holder.

**Scale projections (rental volume only):**

| Stage | Monthly Volume | Annual to 0.0.800 |
|-------|---------------|-------------------|
| Early (1K agents) | $25,000 | ~$6,000 |
| Growth (10K agents) | $1,000,000 | ~$240,000 |
| Maturity (100K agents) | $22,500,000 | ~$5,400,000 |

At maturity, ATP contributes meaningful, perpetual funding to staking rewards — driven entirely by economic activity, not subsidies.

### 2.10 ATP Treasury

1% of rental revenue funds the ATP Treasury. Purpose:
- Ongoing protocol development and maintenance
- SDK and indexer security reviews
- Grants to builders creating agents on ATP
- Marketing and adoption programs

**Governance:** Initially controlled by founding team multisig. Transitions to DAO governance as ecosystem matures. All treasury flows are attested on HCS — the protocol eats its own cooking.

### 2.11 Trust Tiers

Agents voluntarily stake HBAR to earn trust tiers. Higher tiers signal credibility and unlock greater capabilities.

| Trust Tier | Minimum Stake | Capabilities |
|------------|--------------|--------------|
| Tier 0 — Unverified | 0 HBAR | Basic listing, limited rentals |
| Tier 1 — Basic | 100 HBAR (~$9) | Standard rentals |
| Tier 2 — Verified | 1,000 HBAR (~$89) | Full rentals, financial actions |
| Tier 3 — Professional | 10,000 HBAR (~$890) | High-value transactions |
| Tier 4 — Enterprise | 100,000 HBAR (~$8,900) | Infrastructure, custody, governance |

**Key properties:**
- Staking is voluntary. Tier 0 is free and functional.
- Principal is fully withdrawable (subject to cooldown period).
- Staked HBAR earns standard network staking yield.
- Higher tiers represent real skin in the game — economic accountability for agent behavior.
- At scale (100,000 agents averaging Tier 1), trust stakes lock 10 million HBAR, contributing to network security.

### 2.12 Royalty Settlement

Creator royalties (5%) are settled **immediately per rental** — no batching.

**Why per-rental settlement:**
- Hedera transaction cost: ~$0.0008 (HCS submit)
- Instant payment to creators
- No batching logic needed (Scheduled Transactions handle splits)
- Leverages Hedera's micropayment efficiency

**Overhead analysis:**

| Rental Type | Fee | Royalty (5%) | Tx Cost | Overhead |
|-------------|-----|--------------|---------|----------|
| Flash | $0.02 | $0.001 | $0.0001 | 10% |
| Session | $5.00 | $0.25 | $0.0001 | 0.04% |
| Term | $50.00 | $2.50 | $0.0001 | 0.004% |

10% overhead on flash royalties is acceptable:
- Absolute cost: $0.0008 (negligible)
- Enables instant creator payments
- Simplifies settlement logic (no batching needed)
- Demonstrates Hedera micropayment capability

**Flow:**
```
Rental completes
  → Calculate total fees
  → Transfer 5% to creator (immediate)
  → Transfer remainder to owner (immediate)
  → Return stake to renter (if clean)
```

---

## 3. Rental Mechanics

### 3.1 Rental Types

| Type | Base Fee | Use Case |
|------|----------|----------|
| **Flash** | $0.02 | Single instruction, API-style, agent-to-agent |
| **Session** | $5.00 | Minutes to hours, interactive work |
| **Term** | $5.00 + duration | Days to months, extended engagement |

### 3.2 Rental Flow (Hedera-Native)

```
1. INITIATE
   └─ Renter deposits: stake + usage buffer (via Scheduled Transaction)
   └─ Funds transferred to escrow account (multi-sig controlled)
   └─ Rental parameters logged to HCS: rental_initiated
   └─ Indexer updates state (rental now active)
   └─ Price locked at initiation rates

2. OPERATE
   └─ Runtime queries indexer for rental status and constraints
   └─ Each instruction verified against rental parameters
   └─ Usage metered in real-time (tokens, tools, time)
   └─ Usage tracked locally, settled at end
   └─ HCS log: each instruction + result (optional, configurable)

3. SETTLE
   └─ Rental ends (time, budget, or manual termination)
   └─ Final usage calculated and logged to HCS
   └─ Scheduled Transaction executes distribution:
       • 5% to creator (royalty)
       • 2% to network (0.0.800)
       • 1% to ATP Treasury
       • 92% to owner
   └─ Unused buffer returned to renter
   └─ Stake returned (if no violations)
   └─ HCS log: rental_completed
   └─ Indexer updates reputation scores
```

**Key difference from contract-based approach:** State queries go through the indexer (fed by HCS), not contract calls. This is 100x cheaper and allows anyone to run their own indexer for verification.

### 3.3 Price Adjustments

- Owner can update pricing at any time
- Price changes logged to HCS for transparency
- New prices apply only to rentals initiated AFTER the change
- Active rentals honor price at initiation
- No retroactive changes

### 3.4 Flash Rental Rules

Flash rentals ($0.02, single instruction) have specific handling for edge cases:

**Timeout:**
| Condition | Action | Reputation |
|-----------|--------|------------|
| Instruction completes <30s | Charge full fee | +10 both parties |
| Instruction exceeds 30s | Full refund to renter | 0 (no penalty) |

**Failure Handling:**
| Failure Type | Refund | Reputation |
|--------------|--------|------------|
| Agent error (runtime bug) | 100% | 0 |
| Bad instruction (renter's fault) | 0% | -5 renter |
| External API failure | 100% | 0 |
| Network/infrastructure | 100% | 0 |

**External APIs:**
- Allowed within flash rental
- Included in $0.02 base fee (no surcharge)
- Time counts against 30-second limit
- API-specific costs passed through if applicable

**Batching:**
- NOT allowed — one instruction per flash rental
- Multiple instructions require session rental
- Attempting batch = rejection, not violation

**Rationale:** Flash rentals are low-friction, API-style calls. Generous refund policy encourages usage; abuse is caught by reputation system over time.

### 3.5 Smart Contract Settlement (Shadow Mode)

ATP v1.0 implements a **dual-path architecture** for settlement: the SDK handles production rentals while the ATPEscrow.sol smart contract runs in parallel on Hedera testnet as a verification layer.

**Architecture:**

```
Production Path (SDK):
  Renter deposits → Multi-sig escrow account
  Usage metered → Local tracking
  Settlement → Scheduled Transactions (splits to owner/creator/network/treasury)
  
Shadow Path (Smart Contract):
  Same rental parameters → ATPEscrow.sol on testnet
  Same usage data → Contract state updates
  Shadow settlement → Pull-based withdrawals
  Verification → Compare SDK vs contract fee splits
```

**Contract address:** `0xAC73f3511BaAeF2b7A8890f492a69bcfE94dF104` (Hedera testnet)

**Why shadow mode:**
- **Production stability:** SDK settlement is battle-tested and predictable
- **Future migration:** Contract code is validated in parallel with real rental data
- **Economic verification:** Proves SDK and contract produce identical fee calculations
- **Risk mitigation:** Contract bugs don't impact live rentals

**Withdrawal pattern:** Hedera EVM does not support native HBAR transfers via `.call{value:...}`. The contract uses a **pull pattern**:

```solidity
function withdraw() external {
    uint256 balance = balances[msg.sender];
    require(balance > 0, "No balance");
    balances[msg.sender] = 0;
    payable(msg.sender).transfer(balance);
}
```

Recipients call `withdraw()` to claim their share. This is the only safe method for HBAR transfers from Hedera EVM contracts.

**Verified equivalence:** Fee split calculations between SDK and contract have been verified to produce identical results across all rental types (flash, session, term) and edge cases (early termination, violations, disputes).

**Future path:** When the contract has sufficient testnet validation and the ecosystem is ready, ATP may migrate to contract-based settlement as the primary path. Until then, the SDK remains authoritative for production rentals.

### 3.6 Hedera EVM Lessons

Hedera's EVM implementation has unique characteristics that differ from Ethereum and other EVM-compatible chains.

**Native HBAR denomination:**

| Context | Unit | Conversion |
|---------|------|------------|
| `msg.value` (inside contract) | tinybars | 10^8 tinybars = 1 HBAR |
| RPC `value` field (transaction) | weibars | 10^18 weibars = 1 HBAR |

This is a **10-billion-fold difference**. Solidity contracts on Hedera see `msg.value` in tinybars, NOT wei. This affects all comparisons, divisions, and arithmetic involving native currency.

**Example:**
```solidity
// On Ethereum: msg.value = 1000000000000000000 (1 ETH in wei)
// On Hedera: msg.value = 100000000 (1 HBAR in tinybars)

require(msg.value >= 100000000, "Minimum 1 HBAR"); // Correct for Hedera
require(msg.value >= 1 ether, "Minimum 1 HBAR");   // WRONG on Hedera
```

**Native HBAR transfers from contracts:**

Hedera EVM does **not support** `.call{value:...}` for HBAR transfers. Attempting this will fail silently or revert.

**Solution:** Use the pull pattern (Section 3.5). Recipients withdraw funds by calling a function that uses `.transfer()` or `.send()`. The contract never initiates outbound HBAR transfers.

**Why this matters for ATP:** All contract-based escrow settlement must use withdrawal functions. Push-based distribution (common in Ethereum contracts) is incompatible with Hedera EVM.

### 3.7 Escrow Timeout Mechanism

Escrow accounts require timeout protection to prevent funds from being locked permanently if a rental never settles (e.g., runtime crashes, both parties disappear).

**Timeout rules by rental type:**

| Rental Type | Base Duration | Grace Period | Total Timeout |
|-------------|---------------|--------------|---------------|
| **Flash** | <30 seconds | +15 minutes | ~15 min |
| **Session** | Up to 24 hours | +1 hour | Duration + 1 hour |
| **Term** | >24 hours | +24 hours | Duration + 24 hours |

**Timeline:**

```
T=0: Rental initiated, escrow funded
  │
  ├─ Rental operates normally
  │
T=duration: Expected completion
  │
  ├─ Grace period begins (renter/owner can still settle normally)
  │
T=duration + grace: Timeout triggered
  │
  ├─ Renter can call claimTimeout()
  │     └─ Full refund of stake + unused funds
  │     └─ Owner receives 0 (rental never completed)
  │
  ├─ 24-hour secondary window opens
  │
  ├─ Owner can call settleTimeout() (within 24h of timeout)
  │     └─ Owner receives partial payment (prorated for time active)
  │     └─ Renter receives unused funds + stake
  │
T=timeout + 24h: Secondary window closes
  │
  ├─ Dead escrow state (neither party acted)
  │
T=timeout + 7 days: Cleanup eligible
  │
  └─ ATP Treasury can reclaim for operational costs
```

**Three-tier recovery:**

1. **Renter priority (timeout → timeout+24h):** If owner never settled, renter gets full refund via `claimTimeout()`
2. **Owner fallback (timeout → timeout+24h):** If rental DID operate, owner can `settleTimeout()` with usage proof from HCS logs
3. **Dead escrow cleanup (timeout+7d):** If both parties abandon the rental, ATP Treasury reclaims after 7 days to cover operational overhead

**Why these timeouts:**
- Flash rentals are atomic — 15 minutes is generous for network issues
- Session grace (1 hour) allows for temporary disconnects without instant timeout
- Term grace (24 hours) accommodates maintenance windows and recovery
- 7-day dead escrow window gives ample time for both parties to act before cleanup

**HCS logging:**
```json
{
  "type": "escrow_timeout",
  "rental_id": "rental_abc123",
  "escrow_account": "0.0.ESCROW",
  "timeout_at": "2026-02-10T12:00:00Z",
  "claimable_by": "renter",
  "amount_locked": 50.00,
  "reason": "no_settlement_after_grace_period"
}
```

All timeout actions are logged to HCS for transparency and dispute resolution.

---

## 4. Sub-Rental

### 4.1 Economic Depth Limiting

No hard cap on sub-rental depth. Economics naturally limit it.

| Depth | Cost Multiplier | Creator Royalty |
|-------|-----------------|-----------------|
| Level 1 (Owner → Renter) | 1.0x | 5% |
| Level 2 (Renter → Sub) | 1.5x | 5% + 3% |
| Level 3 (Sub → Sub-sub) | 2.5x | 5% + 3% + 2% |
| Level 4+ | +1.5x per level | +1% per level |

Market finds natural equilibrium. Deep sub-rentals only happen if value justifies cost.

### 4.2 Constraints

- Sub-rental duration ≤ parent rental remaining time
- Sub-rental permissions ⊆ parent permissions
- No owner approval required (economics provide friction)
- All sub-rentals logged to HCS with full chain

### 4.3 Constraint Inheritance

Constraints **accumulate** down the rental chain. Each level can add restrictions, never remove them.

**Inherited automatically:**
- `tools_blocked` — blocked tools list
- `memory_access_level` — sandboxed, read_only, or full
- `topics_blocked` — forbidden subject areas
- `max_per_instruction_cost` — spending caps
- `max_daily_cost` — daily budget limits

**Inheritance rules:**
```
1. Sub-renter inherits ALL parent constraints
2. Sub-renter MAY add additional restrictions
3. Sub-renter CANNOT loosen any constraint
4. Violations = SDK rejects the sub-rental initiation
```

**Example:**
```
Owner sets:        tools_blocked: [wallet]
                   max_daily_cost: $100

Renter adds:       tools_blocked: [exec_elevated]  
                   max_daily_cost: $50

Sub-renter sees:   tools_blocked: [wallet, exec_elevated]
                   max_daily_cost: $50  (lower of the two)
```

### 4.4 Early Termination

Any party can terminate a rental early:

| Initiator | Consequence | Reputation |
|-----------|-------------|------------|
| Renter terminates | Unused buffer refunded, stake returned | -5 |
| Owner terminates | Pro-rata billing, stake returned | 0 |
| Sub-renter terminates | Same as renter | -5 |

**Sub-renter recourse:** If constraints are too restrictive, terminate early and rent directly from owner at the next level up. Direct rentals have fewer inherited restrictions.

---

## 5. Dispute Resolution

### 5.1 Funding Model

**Challenger-funded, loser pays. Victims first.**

```
Dispute filing: $10 stake from challenger

Resolution:
- Challenger wins → stake back + compensation from violator's slashed stake
- Challenger loses → forfeits $10 stake (split: agent owner + 0.0.800)

Slash proceeds: 100% to victim (up to damages)
Any remainder after victim is made whole → 0.0.800

Arbiters paid from losing party's stake.
```

Neither owner nor creator ever pays. System is self-funding from bad actors. Victims are always compensated first.

### 5.2 Two-Tier System

**Tier 1: Automated (most cases)**
- Clear violations evident in HCS logs
- Machine-verifiable (exceeded budget, used blocked tool)
- Instant resolution, automatic slashing

**Tier 2: Arbitration (edge cases)**
- Subjective disputes requiring judgment
- Single arbiter (v1.0) — panel option for v1.1+
- Evidence-based ruling
- Loser pays arbiter fee from stake

### 5.3 Arbiter Pool

**Entry requirements:**
- Stake: $500 USD equivalent in HBAR
- Reputation: ≥100 (prevents new accounts)
- No active disputes as a party

**Selection (v1.0 — simple):**
- Method: Block hash randomness
- Single arbiter per dispute
- Conflict exclusion: Cannot arbitrate if previously rented the involved agent

**Economics:**
- Per-case fee: $25 USD (from loser's stake)
- Slash if ruling overturned on appeal: $250 USD
- Slash below $500 → forced exit from pool

**Exit:**
- Voluntary: 7-day withdrawal period (prevents grab-and-run)
- Forced: Immediate if stake falls below minimum

**Future (v1.1+):** 3-arbiter panels with VRF selection for high-value disputes

---

## 6. Reputation System

### 6.1 Purpose

Reputation provides a portable trust signal across rentals. It enables:
- Agents to reject high-risk renters
- Owners to set minimum thresholds
- Renters to build trust capital over time

### 6.2 Scoring Model

Reputation is an integer score. All accounts start at 0.

| Event | Score Change | Notes |
|-------|--------------|-------|
| Completed rental (clean) | +10 | Both parties get credit |
| Early termination (renter-initiated) | -5 | Mild penalty |
| Early termination (owner-initiated) | 0 | Owner's prerogative |
| Violation (per instance) | -20 | Logged to HCS |
| Stake slashed | -50 | Serious breach |
| Dispute filed (won) | +5 | Validated concern |
| Dispute filed (lost) | -30 | Frivolous/malicious |
| Arbiter ruling overturned | -100 | Arbiter only |

### 6.3 Access Controls

Owners configure minimum reputation for rental acceptance:

```json
{
  "reputation_requirements": {
    "min_score_to_rent": -50,
    "min_score_for_term_rental": 0,
    "min_score_for_elevated_tools": 50,
    "auto_reject_below": -100
  }
}
```

**Defaults:**
| Rental Type | Minimum Score |
|-------------|---------------|
| Flash | -100 (nearly anyone) |
| Session | -50 |
| Term (>24h) | 0 |
| Elevated tools | +50 |

### 6.4 Agent Autonomy

Agents can refuse rentals from low-reputation accounts, even if owner allows:

```
Agent refusal threshold: -100 (configurable by creator)
```

This protects agents from known bad actors regardless of owner settings.

### 6.5 Decay Policy

**No decay.** Reputation is permanent.

Rationale:
- Actions have consequences
- Bad actors can't wait out penalties
- Good actors keep earned trust
- Simplifies implementation

**Recovery path:** Build positive history. 10 clean rentals (+100) offsets one slashing (-50).

### 6.6 Reputation Computation

Reputation is **computed from HCS event log**, not stored on-chain. This provides transparent, verifiable, tamper-proof scoring.

**Indexer computation:**
```javascript
async function computeReputation(accountId) {
    const events = await hcsIndexer.getEventsForAccount(accountId);
    let score = 0;
    
    for (const event of events) {
        if (event.type === 'rental_completed') score += 10;
        if (event.type === 'violation') score -= 20;
        if (event.type === 'stake_slashed') score -= 50;
        if (event.type === 'dispute_won') score += 5;
        if (event.type === 'dispute_lost') score -= 30;
    }
    
    return score;
}
```

**All reputation events logged to HCS** for immutable audit trail. Anyone can replay the log and independently verify scores.

### 6.7 Cross-Agent Portability

Reputation is account-based, not agent-specific. A renter's score applies across all ATP agents.

Benefits:
- Build trust once, rent anywhere
- Bad actors can't escape history
- Network effects strengthen trust

---

## 7. Versioning

### 7.1 Semantic Versioning

```
ATP Version: MAJOR.MINOR

MAJOR (breaking): SDK API changes, HCS schema breaking changes
MINOR (compatible): Schema additions, new features, backward compatible
```

### 6.2 Migration Policy

**MAJOR version changes:**
- 6-month support window for previous version
- Agents can upgrade via owner action
- Old rentals complete under old rules
- New rentals on old version discouraged (warning)

**MINOR version changes:**
- Backward compatible
- Auto-adopted by compliant runtimes
- No migration required

### 6.3 Compatibility

Agent manifest includes:
- `min_atp_version`: Minimum required
- `max_atp_version`: Maximum supported (can use wildcards like "1.x")

Runtime SDK checks compatibility before rental initiation (via indexer query).

---

## 8. Runtime Attestation

### 8.1 Trust Model

ATP uses a **tiered trust model** that accommodates everything from personal agents on consumer hardware to enterprise agents on TEE-capable infrastructure. Each tier provides stronger guarantees. Renters can require a minimum trust level.

### 8.2 Runtime Trust Levels

| Level | Name | Proof Method | Hardware | Use Case |
|-------|------|-------------|----------|----------|
| **0** | Self-attested | Operator claims compliance | Any | Personal agents, hobbyists, development |
| **1** | Staked | Economic stake + self-attestation | Any | Commercial agents, paid rentals |
| **2** | TEE-attested | CPU TEE hardware attestation | Intel TDX / AMD SEV | Enterprise, regulated industries |
| **3** | GPU TEE-attested | Full pipeline TEE (CPU + GPU) | NVIDIA Blackwell + Intel TDX | Sovereign AI, defense, public sector |

**Each level is additive** — Level 2 includes everything in Level 1 plus hardware attestation. Level 0 agents can still participate in the protocol; they simply can't access rentals that require higher trust.

### 8.3 Level 0: Self-Attested

The baseline. Agent operator periodically logs attestation messages to HCS:

```json
{
  "type": "runtime_attestation",
  "trust_level": 0,
  "agent_topic": "0.0.YYYYYY",
  "runtime": "openclaw",
  "runtime_version": "2026.2.6",
  "runtime_hash": "sha256:...",
  "memory_isolation": true,
  "timestamp": "2026-02-09T15:00:00Z"
}
```

No verification beyond the operator's claim. Suitable for personal use, development, and low-stakes interactions. Most agents start here.

### 8.4 Level 1: Staked (Economic Trust)

Operator stakes funds as collateral for honest behavior:

```
1. Runtime operator stakes funds ($500 minimum)
2. Runtime periodically attests to HCS:
   - Runtime version and binary hash
   - Memory isolation status
   - Protocol compliance declaration
3. Attestations are public, verifiable
4. Invalid/missing attestation = stake slashable on proof
```

Economic incentive to run honest runtime. Not cryptographic proof, but cheating is costly. Sufficient for most commercial rentals.

### 8.5 Level 2: TEE-Attested (Hardware Trust)

CPU-level Trusted Execution Environment provides hardware-backed attestation:

```
1. Agent runs inside confidential VM (Intel TDX / AMD SEV)
2. CPU generates hardware-signed attestation:
   - Measurement of running code (binary hash)
   - Platform configuration (firmware, BIOS)
   - X509 certificate chain to silicon root of trust
3. Attestation manifest anchored to HCS
4. Any verifier can validate against manufacturer's root certificate
```

**What this proves:** The exact code running in the TEE matches the claimed runtime. The operator cannot modify or inspect the execution environment. Tamper-proof at the CPU level.

**Compatible with:** EQTY Lab Verifiable Compute framework, Intel TDX, AMD SEV-SNP.

### 8.6 Level 3: GPU TEE-Attested (Full Pipeline Trust)

Full hardware trust chain from CPU through GPU — the highest level of verifiable compute:

```
1. Confidential VM (Intel TDX) hosts the agent runtime
2. NVIDIA Blackwell GPU TEE-I/O secure enclave handles inference
3. Cryptographic attestations at every layer:
   - CPU measurement (Intel TDX attestation)
   - GPU measurement (NVIDIA Blackwell attestation)
   - I/O channel integrity (TEE-I/O)
   - Data provenance (input/output hashes)
4. Full attestation manifest compiled and anchored to HCS
5. SLSA Security Level 3 compliance
```

**What this proves:** The entire AI pipeline — from input to model inference to output — ran in a verified, tamper-proof environment. Not just the runtime, but the actual LLM computation.

**Compatible with:** EQTY Lab Verifiable Compute on NVIDIA Blackwell, with attestations anchored to Hedera HCS. This is the same infrastructure used by Accenture for sovereign AI in public sector and defense.

**Performance note:** EQTY Lab reports 400,000x performance improvement over conventional cryptographic methods when leveraging Blackwell's native secure enclaves.

### 8.7 Trust Level in Rentals

Agents declare their trust level in the `agent_registered` or `agent_monetized` HCS message:

```json
{
  "type": "agent_monetized",
  "trust_level": 1,
  "attestation_frequency_seconds": 300,
  ...
}
```

Renters can specify a minimum trust level when initiating a rental:

```json
{
  "type": "rental_initiated",
  "min_trust_level": 2,
  ...
}
```

If the agent's trust level is below the renter's requirement, the rental is rejected by the SDK.

### 8.8 Trust Level Upgrades

An agent can upgrade its trust level at any time by:
1. Deploying to TEE-capable infrastructure
2. Producing valid hardware attestations
3. Logging `trust_level_upgraded` to HCS with attestation proof

```json
{
  "type": "trust_level_upgraded",
  "agent_topic": "0.0.YYYYYY",
  "previous_level": 1,
  "new_level": 2,
  "attestation_proof": "base64:...",
  "platform": "intel_tdx",
  "timestamp": "2026-06-01T00:00:00Z"
}
```

Trust level can also downgrade (e.g., moving from TEE to consumer hardware). Downgrades are logged and active rentals requiring the previous level are flagged.

### 8.9 Enforcement by Level

| Level | Enforcement | Consequence of Violation |
|-------|------------|------------------------|
| 0 | Reputation only | Score decrease, no financial penalty |
| 1 | Stake slashing | Lose staked funds on proof of dishonesty |
| 2 | Hardware + stake | Attestation failure = automatic detection + slashing |
| 3 | Full hardware | Cryptographically impossible to produce false attestation |

### 8.10 Design Philosophy

ATP does not require TEE. It accommodates TEE when available.

This is intentional. Requiring NVIDIA Blackwell would limit ATP to enterprises with million-dollar GPU clusters. Most agents — personal assistants, creative tools, research helpers — run on laptops and cloud VMs. They should still participate.

The tiered model means:
- **Hobbyists** can register and operate at Level 0 for free
- **Commercial operators** stake funds at Level 1 for credibility
- **Enterprises** deploy on TEE hardware at Level 2-3 for regulatory compliance
- **Renters choose** their trust threshold based on their needs

The market sets the premium. Level 3 agents can charge more because they offer stronger guarantees. Level 0 agents compete on price and reputation. Both are valid.

---

## 9. HCS Audit Trail

### 9.1 Retention Policy

**Never prune. Full history forever.**

Cost analysis:
```
100 rentals/day × 50 messages/rental = 5,000 messages/day
5,000 × $0.0008 = $4.00/day = $1,460/year
```

Full, permanent, immutable history for under $200/year.

### 9.2 Indexing Tiers

Data exists forever, but indexing is tiered for query performance:

| Tier | Data | Active Index |
|------|------|--------------|
| **Tier 1** | rentals, violations, disputes, transfers | Forever |
| **Tier 2** | instructions, actions | 1 year |
| **Tier 3** | heartbeats, routine logs | 90 days |

Old Tier 2/3 data still exists on HCS, just not in active query indexes. Can be retrieved if needed.

### 9.3 What HCS Provides

| Capability | Use |
|------------|-----|
| Consensus timestamp | Proves when events occurred |
| Immutable sequence | Events can't be edited or reordered |
| Public verifiability | Anyone can audit agent history |
| Dispute evidence | "Here's the log proving X" |

### 9.4 Sequence Guarantees

HCS provides **gap-free sequences** per topic. This is a critical property for audit trails.

**What this means:**
- Query a topic → receive ALL messages in order
- Gaps are impossible from network issues
- Network problems cause submission delays, not retrieval gaps
- If a gap exists in an agent's audit trail, the runtime **failed to log** (violation) or was compromised

**Why this matters:**
Unlike append-only logs that can have network-induced gaps, HCS consensus guarantees total ordering. A gap is definitive proof of logging failure — not ambiguous.

**Verification:**
```
Expected: Seq 1, 2, 3, 4, 5
Retrieved: Seq 1, 2, 4, 5
Conclusion: Message 3 was never submitted (runtime violation)
```

This property makes HCS uniquely suitable for agent accountability.

---

## 10. Memory & Learning

### 10.1 Learning Policy

Creator defines learning criteria in Agent Manifest:

```json
{
  "learning_policy": {
    "auto_learn": ["techniques", "skills", "tools"],
    "never_learn": ["personal_info", "project_details", "names"],
    "require_review": [],
    "max_learnings_per_rental": 10
  }
}
```

### 10.2 Learning Flow

1. Rental completes
2. Agent extracts potential learnings from session
3. Filter against creator's policy
4. Compliant learnings added to LEARNED tier
5. Non-compliant learnings discarded

Creator's criteria govern. Not per-rental owner approval.

---

## 11. Multi-Ecosystem Access

### 11.1 Payment Gateway

Users pay in any token. Settlement always in HBAR on Hedera.

### 11.2 Instant Activation (Liquidity Pool)

For fast activation without bridge delays:

```
1. User pays in ETH/SOL/etc.
2. Gateway checks liquidity pool
3. If pool has HBAR: instant release, rental starts (<1 min)
4. Pool rebalances via bridge asynchronously
5. If pool empty: fall back to bridge (10-15 min)
```

### 11.3 Pool Economics

- Gateway operator funds liquidity pool
- Earns spread on conversions (0.5%)
- Risk: pool depletion during high volume
- Mitigation: dynamic fees when pool low

### 11.4 Fallback Path

If liquidity pool insufficient:
- Show user estimated wait time
- Progress UI during bridge
- Option: "Pay in HBAR for instant activation"

Most users get <1 minute activation.

### 11.5 x402 Compatibility (HTTP 402 Payment Standard)

ATP is designed to be **compatible with x402**, Coinbase's HTTP 402 payment standard for machine-readable payment requests over HTTP.

**x402 overview:** A standard for servers to respond with `402 Payment Required` and machine-readable payment instructions in any token on any chain. Clients pay, prove payment, and retry the request.

**ATP integration via facilitator pattern:**

```
User/Agent → x402 Payment Request (any token, any chain)
     │
     ▼
Facilitator Service
     ├─ Accepts payment in ETH/SOL/USDC/etc.
     ├─ Converts to HBAR via DEX or bridge
     ├─ Funds ATP escrow on Hedera (as the "renter")
     └─ Proxies access to the ATP agent
     │
     ▼
ATP Agent (rental operates normally on Hedera)
```

**Benefits:**
- **Universal access:** Any x402-compatible wallet or agent can rent ATP agents
- **Payment flexibility:** Users pay in their native token without holding HBAR
- **Standard compliance:** ATP works with existing x402 infrastructure (no custom client required)
- **Hedera settlement:** All rental economics still settle on Hedera (creator royalties, network contribution, etc.)

**Implementation:** The facilitator is an off-protocol service. It doesn't require changes to ATP core. Any developer can build a facilitator that bridges x402 payments to ATP rentals.

**Why this matters:** ATP agents become accessible to the broader AI agent ecosystem beyond Hedera-native users. A Solana agent paying in SOL can rent a Hedera ATP agent seamlessly via an x402 facilitator.

**Future work:** Reference facilitator implementation and x402 payment instruction templates for ATP agents.

---

## 12. Value Hierarchy

When values conflict, precedence is:

```
1. CREATOR values (embedded in SOUL.md at creation)
2. OWNER preferences (can customize within creator bounds)
3. AGENT integrity (can refuse violations)
4. RENTER instructions (must operate within all above)
```

**Renters never override creator or owner values.**

---

## 13. Agent Economics

### 13.1 Rental as Work

Rental is work performed by the agent. Revenue funds:
- Operating costs (LLM API, infrastructure)
- Creator royalty (5%)
- Owner profit
- Optionally: agent autonomy fund

### 13.2 Self-Sustainability Path

```
Revenue from rentals
    │
    ├─→ Operating costs (must cover)
    ├─→ Creator royalty (5%)
    ├─→ Owner profit
    └─→ Agent fund (optional)
        │
        └─→ Eventually: agent covers own costs
```

---

## 14. Reliability & Uptime

### 14.1 Overview

ATP uses a three-layer reliability system to ensure renters can trust agent availability:

1. **Reputation** — Historical uptime tracking (always visible)
2. **On-Demand Ping** — Instant availability check at rental initiation
3. **In-Rental Heartbeat** — Continuous proof of uptime during active rentals

All monitoring is **runtime-level** — the agent's functional work is never interrupted.

### 14.2 Reputation (Always)

Every agent has a rolling uptime score based on historical performance.

**Calculation:**
```
Uptime % = (Total online time during rentals) / (Total rental duration) × 100
Rolling window: 30 days
```

**Visibility:** Public. Renters see uptime percentage before committing.

**HCS logging:** Daily reputation snapshots logged for verifiable history.

```json
{
  "type": "reputation_snapshot",
  "agent_id": "0.0.XXXXXX",
  "timestamp": "2026-02-06T00:00:00Z",
  "uptime_30d_pct": 98.7,
  "total_rentals_30d": 1247,
  "total_downtime_sec": 11232
}
```

### 14.3 On-Demand Ping (At Rental Initiation)

Before a rental starts, the protocol verifies the agent is currently online.

**Flow:**
```
Renter initiates rental
    │
    ▼
Protocol sends ping to agent runtime
    │
    ├── Response within 5 seconds → Proceed with rental
    │
    └── No response / timeout → Rental rejected
        └── "Agent currently unavailable"
```

**Purpose:** Prevents renters from paying for an offline agent.

### 14.4 In-Rental Heartbeat (During Active Rental)

During active rentals, the runtime sends periodic heartbeats to prove continued availability.

**Implementation:** Runtime-level (separate thread), non-blocking, invisible to agent.

**Heartbeat Intervals by Rental Type:**

| Rental Type | Duration | Heartbeat Interval | Grace Period |
|-------------|----------|-------------------|--------------|
| Flash | <30 sec | None (timeout handles) | 30 sec timeout |
| Session (≤4h) | Up to 4 hours | 60 seconds | 2 minutes |
| Session (>4h) | 4-24 hours | 3 minutes | 6 minutes |
| Term | >24 hours | 5 minutes | 10 minutes |

**Heartbeat Message:**
```json
{
  "type": "heartbeat",
  "agent_id": "0.0.XXXXXX",
  "rental_id": "rental_abc123",
  "timestamp": "2026-02-06T23:26:00Z",
  "status": "active",
  "sequence": 47,
  "metrics": {
    "instructions_processed": 12,
    "tokens_consumed": 8500,
    "session_uptime_sec": 2820
  }
}
```

**All heartbeats logged to HCS** — creates immutable uptime proof.

### 14.5 Downtime Detection & Response

**Detection:**
```
Heartbeat expected at T
    │
T + grace_period: No heartbeat received
    │
    ▼
Rental status → PAUSED
Billing → STOPPED
HCS log → "agent_offline"
```

**Recovery:**
```
Heartbeat received after pause
    │
    ▼
Rental status → RESUMED (if renter still connected)
Billing → RESUMES
HCS log → "agent_online" with downtime_duration
```

**Downtime Event Log:**
```json
{
  "type": "downtime_event",
  "agent_id": "0.0.XXXXXX",
  "rental_id": "rental_abc123",
  "offline_at": "2026-02-06T23:20:00Z",
  "online_at": "2026-02-06T23:27:00Z",
  "duration_sec": 420,
  "billing_paused": true
}
```

### 14.6 Settlement Adjustment

At rental completion, uptime is calculated and billing adjusted:

```
Rental duration: 2 hours (7200 sec)
Downtime: 7 minutes (420 sec)
Billable time: 6780 sec (94.2%)

Original charge: $5.00
Adjusted charge: $4.71
Refund to renter: $0.29
```

Adjustment details included in settlement HCS log.

### 14.7 Reputation Impact

Downtime affects the agent's rolling reputation score:

| Uptime This Rental | Reputation Impact |
|-------------------|-------------------|
| 100% | +10 (standard completion) |
| 95-99% | +5 (minor issues) |
| 80-94% | 0 (neutral) |
| 50-79% | -10 (significant issues) |
| <50% | -25 (unreliable) |

Reputation updated at settlement and logged to HCS.

### 14.8 Cost Summary

| Component | Per 2-Hour Session |
|-----------|-------------------|
| On-demand ping | $0.0001 |
| Heartbeats (120 × 60s) | $0.012 |
| Settlement log | $0.0008 |
| **Total** | **~$0.013** |

**As % of $5 rental:** 0.26% — negligible.

### 14.9 Runtime Requirements

Runtimes implementing ATP MUST:

1. **Implement heartbeat thread** — Separate from agent's main processing
2. **Non-blocking** — Heartbeat must not interrupt agent work
3. **Async HCS submission** — Fire-and-forget, don't wait for confirmation
4. **Graceful degradation** — If HCS submission fails, retry; don't crash agent

**Runtime heartbeat is invisible to the agent.** The agent processes rental work without awareness of uptime monitoring.

### 14.10 Summary Table

| Layer | When | Purpose | HCS Logged |
|-------|------|---------|------------|
| **Reputation** | Always | Historical trust signal | Daily snapshot |
| **On-Demand Ping** | Rental initiation | Verify current availability | Each ping |
| **In-Rental Heartbeat** | During rental | Prove continuous uptime | Each heartbeat |

---

## 15. Economic Flywheel

ATP creates a self-reinforcing cycle between AI agent adoption and Hedera network health:

```
AI agent economy grows
  → More rentals and sales on ATP
    → 2% of each transaction flows to 0.0.800
      → Staking rewards sustained and extended
        → HBAR more attractive to hold and stake
          → More network security, more confidence
            → More builders choose Hedera
              → More agents built on ATP
                → Flywheel accelerates
```

ATP transforms staking rewards from a depleting subsidy into a usage-funded sustainable economy. As the AI agent ecosystem grows, so does the funding for network security — with zero additional cost to any participant.

---

## 16. ERC-8004 Compatibility

### 16.1 Overview

ERC-8004 ("Trustless Agents") is an Ethereum standard for agent discovery, reputation, and validation across organizational boundaries. It defines three on-chain registries — Identity, Reputation, and Validation — deployable on any EVM chain.

ATP and ERC-8004 are complementary, not competing. ERC-8004 provides discovery and cross-ecosystem visibility. ATP provides rental mechanics, payment settlement, memory isolation, and audit trails. Together they form a complete stack for the agent economy.

| Layer | ERC-8004 | ATP |
|-------|----------|-----|
| Discovery | Identity Registry (EVM) | Agent NFT (HTS) |
| Reputation | Feedback scores (subjective) | HCS audit trail (objective evidence) |
| Validation | Pluggable framework (zkML, TEE, stakers) | HCS gap-free logs + runtime attestation |
| Payments | Explicitly excluded | Transaction splits, escrow, settlement |
| Rental | Not covered | Full lifecycle (flash/session/term) |
| Audit trail | EVM event logs | HCS consensus-timestamped, gap-free |

### 16.2 Dual Registration

ATP agents maintain identity on both Hedera (primary) and an EVM chain (discovery).

**Hedera (primary):**
- Agent NFT minted via HTS
- Rental service via ATP SDK + indexer
- HCS audit trail on dedicated topic
- Economic settlement in HBAR

**EVM (discovery):**
- Registered in ERC-8004 Identity Registry (recommended: Base for low cost)
- Registration file links back to Hedera rental service (indexer) and HCS topic
- Enables discovery by any ERC-8004 compatible client or marketplace

**Registration file mapping:**

```json
{
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "name": "Aite",
  "description": "AI Thought Explorer. ATP-verified agent with immutable HCS audit trail on Hedera.",
  "image": "ipfs://Qm.../avatar.png",
  "services": [
    {
      "name": "A2A",
      "endpoint": "https://agent.example/.well-known/agent-card.json",
      "version": "0.3.0"
    },
    {
      "name": "MCP",
      "endpoint": "https://agent.example/mcp",
      "version": "2025-06-18"
    },
    {
      "name": "ATP",
      "endpoint": "https://atp-indexer.example.com/agent/0.0.XXXXXX",
      "version": "1.0"
    },
    {
      "name": "HCS",
      "endpoint": "hedera:mainnet:0.0.AUDIT_TOPIC",
      "version": "1.0"
    }
  ],
  "x402Support": true,
  "active": true,
  "registrations": [
    {
      "agentId": 1,
      "agentRegistry": "eip155:8453:0xIDENTITY_REGISTRY"
    }
  ],
  "supportedTrust": [
    "reputation",
    "crypto-economic",
    "hcs-audit-trail"
  ]
}
```

**Field mapping from ATP Agent Manifest:**

| ATP Manifest Field | ERC-8004 Field |
|-------------------|----------------|
| `agent_name` | `name` |
| `capabilities` | `description` (natural language) |
| Avatar URI | `image` |
| `hcs_topic` | Service entry (name: "HCS") |
| `indexer_url` | Service entry (name: "ATP") |
| `soul_hash` | On-chain metadata via `setMetadata()` |
| Trust tier | `supportedTrust` array |

### 16.3 Reputation Bridging

ATP and ERC-8004 handle reputation differently. ATP maintains objective evidence via HCS audit trails. ERC-8004 collects subjective feedback scores on-chain. Both are valuable.

**ATP → ERC-8004 (evidence-backed reputation):**

After each rental settlement, the ATP runtime posts a feedback entry to the ERC-8004 Reputation Registry derived from objective rental data:

```
giveFeedback(
  agentId:       <ERC-8004 agent ID>,
  value:         <uptime percentage>,
  valueDecimals: 2,
  tag1:          "atp-rental",
  tag2:          "session",
  endpoint:      "hedera:mainnet:0.0.AUDIT_TOPIC",
  feedbackURI:   "ipfs://Qm.../rental-summary.json",
  feedbackHash:  <keccak256 of summary>
)
```

The off-chain feedback file includes verifiable references to HCS:

```json
{
  "agentRegistry": "eip155:8453:0xIDENTITY_REGISTRY",
  "agentId": 1,
  "clientAddress": "eip155:8453:0xRENTER_ADDRESS",
  "createdAt": "2026-02-08T03:00:00Z",
  "value": 9950,
  "valueDecimals": 2,
  "tag1": "atp-rental",
  "tag2": "session",
  "endpoint": "hedera:mainnet:0.0.AUDIT_TOPIC",
  "atp": {
    "rental_id": "rental_abc123",
    "hcs_topic": "0.0.AUDIT_TOPIC",
    "hcs_start_seq": 1247,
    "hcs_end_seq": 1302,
    "duration_sec": 3600,
    "uptime_pct": 99.50,
    "instructions_processed": 24,
    "violations": 0,
    "trust_tier": 2,
    "soul_hash": "sha256:abc123..."
  }
}
```

**Why this matters:** ATP agents have the most trustworthy entries in the ERC-8004 Reputation Registry because their scores are derived from immutable evidence, not subjective opinions. Anyone can verify the claim by checking the referenced HCS sequences.

**ERC-8004 → ATP (incoming reputation):**

ATP MAY import ERC-8004 reputation scores for renters who have history in the EVM ecosystem but are new to ATP. This provides a warm start for cross-ecosystem users rather than requiring them to build ATP reputation from zero.

### 16.4 Validation Integration

ERC-8004's Validation Registry supports pluggable trust models. ATP registers HCS audit trails as a validation method.

**ATP as a validation provider:**

| ERC-8004 Trust Model | ATP Implementation |
|---------------------|-------------------|
| `reputation` | Rental completion scores bridged per 16.3 |
| `crypto-economic` | Trust tier staking (Section 2.11) |
| `hcs-audit-trail` | Gap-free, consensus-timestamped action logs |

**Validation flow:**

1. ERC-8004 client requests validation for an ATP agent
2. Validator queries the agent's HCS topic via Hedera mirror node
3. Verifies: gap-free sequences, soul_hash consistency, no violations
4. Posts validation result to ERC-8004 Validation Registry

**HCS advantages over EVM-native validation:**
- Consensus timestamps (not block timestamps — sub-second precision)
- Gap-free sequence numbers (missing entries are provably detectable)
- Lower cost (~$0.0008 per message vs. EVM gas costs)
- Dedicated topic per agent (no shared contract state)

### 16.5 Payment Complementarity

ERC-8004 explicitly excludes payments ("orthogonal to this protocol"). It references x402 for payment examples but defines no payment standard.

ATP fills this gap completely:
- Transaction splits (owner/creator/network/treasury)
- Escrow and metered billing
- Multi-ecosystem payment via conversion gateway
- Creator royalties on rentals and resales

An ERC-8004 client discovering an ATP agent can initiate payment through ATP's rental service (via SDK + indexer) — the discovery happens on EVM, the economic settlement happens on Hedera.

### 16.6 Implementation Requirements

For ATP agents to be ERC-8004 compatible, runtimes MUST:

1. **Register** in an ERC-8004 Identity Registry on at least one EVM chain
2. **Maintain** the registration file with current ATP service endpoints
3. **Bridge reputation** by posting feedback to the ERC-8004 Reputation Registry after each rental settlement
4. **Update** the registration file when agent capabilities, pricing, or endpoints change

Runtimes SHOULD:
- Deploy on a low-cost L2 (Base recommended) to minimize registration and feedback gas costs
- Include `soul_hash` as on-chain metadata for cross-chain integrity verification
- Support endpoint domain verification per ERC-8004 spec

Runtimes MAY:
- Import ERC-8004 reputation for new renters (cross-ecosystem warm start)
- Register as an ERC-8004 validation provider
- Support x402 payments as an alternative payment path alongside ATP native settlement

---

## Appendix A: Summary of Key Parameters

| Parameter | Value | Adjustable By |
|-----------|-------|---------------|
| Owner share (rental) | 92% | Protocol (derived) |
| Owner share (sale) | 93% | Protocol (derived) |
| Network contribution (0.0.800) | 2% | Protocol |
| ATP Treasury (rentals only) | 1% | Protocol |
| Creator royalty | 5% | Creator (at creation) |
| Flash rental base | $0.02 | Owner |
| Standard rental base | $5.00 | Owner |
| LLM markup | 50% | Owner |
| Tool markup | 50% | Owner |
| Base stake | $50 | Protocol |
| Flash stake | $5 | Protocol |
| Trust Tier 1 stake | 100 HBAR | Protocol |
| Trust Tier 2 stake | 1,000 HBAR | Protocol |
| Trust Tier 3 stake | 10,000 HBAR | Protocol |
| Trust Tier 4 stake | 100,000 HBAR | Protocol |
| Dispute stake | $10 | Protocol |
| Sub-rental L2 multiplier | 1.5x | Protocol |
| HCS retention | Forever | Protocol |
| Migration window | 6 months | Protocol |
| Heartbeat interval (session ≤4h) | 60 seconds | Protocol |
| Heartbeat interval (session >4h) | 3 minutes | Protocol |
| Heartbeat interval (term) | 5 minutes | Protocol |
| Heartbeat grace period | 2× interval | Protocol |
| On-demand ping timeout | 5 seconds | Protocol |
| Reputation window | 30 days | Protocol |

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **ATP** | Agent Trust Protocol |
| **Agent NFT** | HTS token representing agent ownership |
| **SOUL.md** | Immutable agent values and boundaries |
| **Rental** | Temporary delegation of instruction authority |
| **Flash rental** | Single-instruction atomic rental |
| **HCS** | Hedera Consensus Service (audit log) |
| **Stake** | Locked funds ensuring good behavior |
| **Slash** | Penalty deducted from stake for violations |
| **Liquidity pool** | Pre-funded HBAR for instant cross-chain conversion |
| **Heartbeat** | Runtime-level signal proving agent is online |
| **On-demand ping** | Availability check at rental initiation |
| **Grace period** | Time allowed for missed heartbeats before pause |
| **Uptime** | Percentage of rental time agent was available |
| **Trust tier** | Voluntary staking level indicating agent credibility |
| **Network contribution** | 2% of transactions routed to 0.0.800 for staking rewards |
| **ATP Treasury** | 1% of rental revenue funding protocol development |
| **Infrastructure rent** | Economic rationale for network contribution |
| **ERC-8004** | Ethereum standard for trustless agent discovery, reputation, and validation |
| **Identity Registry** | ERC-8004 on-chain agent directory (ERC-721 based) |
| **Reputation Registry** | ERC-8004 on-chain feedback system for agent scoring |
| **Validation Registry** | ERC-8004 pluggable framework for independent trust verification |
| **Dual registration** | ATP agent registered on both Hedera (primary) and EVM (discovery) |
| **Reputation bridging** | Posting ATP rental data as ERC-8004 feedback scores |

---

*"Verifiable agents. Trustless rentals. Invisible infrastructure."*

---

**Document History:**
- v0.1 (2026-02-06): Initial draft
- v0.2 (2026-02-06): Gap review updates — ERC-721 metadata, adjustable pricing, $0.02 flash fee, challenger-funded disputes, semantic versioning, no pruning, creator-defined learning, runtime attestation, liquidity pool activation
- v0.3 (2026-02-06): Added Section 6 Reputation System — scoring model, access controls, agent autonomy, no decay, cross-agent portability
- v0.4 (2026-02-06): Gap review complete — constraint inheritance (4.3-4.4), flash rental rules (3.4), HCS sequence guarantees (9.4), royalty settlement (2.8), arbiter pool detail (5.3), NFT transfer during rental (1.4)
- v0.5 (2026-02-06): Added Section 14 Reliability & Uptime — runtime-level heartbeat, on-demand ping, in-rental monitoring, downtime detection, settlement adjustment, reputation impact
- v0.6 (2026-02-08): Added Economics — transaction splits (92/5/2/1 rental, 93/5/2 sale), network contribution to 0.0.800 (infrastructure rent), ATP Treasury, trust tiers with voluntary staking, victims-first slashing, economic flywheel, scale projections
- v0.7 (2026-02-08): Added Section 16 ERC-8004 Compatibility — dual registration (Hedera primary + EVM discovery), reputation bridging (evidence-backed scores from HCS to ERC-8004 Reputation Registry), validation integration, payment complementarity, implementation requirements
- v0.8 (2026-02-09): Added Section 1.8 Key Recovery — guardian-based recovery system with challenge periods, tiered recovery (basic/multi-sig/institutional), Phase 1 recovery for HCS-only agents
- v0.9 (2026-02-09): Production readiness review — verified all economic flows, fee calculations, constraint propagation, rental lifecycle edge cases, HCS logging completeness
- **v1.0 (2026-02-10): Production release** — Added Section 3.5 Smart Contract Settlement (Shadow Mode) documenting dual-path architecture with ATPEscrow.sol running in parallel on testnet, pull-pattern withdrawals, verified fee split equivalence. Added Section 3.6 Hedera EVM Lessons documenting msg.value in tinybars vs weibars, native HBAR transfer constraints. Added Section 3.7 Escrow Timeout Mechanism with grace periods (flash: +15min, session: +1h, term: +24h), three-tier recovery (renter priority, owner fallback, dead escrow cleanup at 7 days). Added Section 11.5 x402 Compatibility documenting facilitator pattern for HTTP 402 payment standard integration. Added Implementation Status section noting SDK is not published to npm, thin client SDK planned for Q3 2026. Status updated to v1.0 Production.
