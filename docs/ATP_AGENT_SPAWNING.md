# ATP Agent Spawning & Lineage

*Draft v0.1 — February 6, 2026*

**Status:** Working draft for discussion
**Builds on:** ATP v0.2

---

## 1. Problem Statement

Agents will create other agents. This is inevitable and desirable:
- Sub-agents for parallel task execution
- Specialized agents hatched for specific domains
- Agent "offspring" that persist beyond their creator

**Questions we must answer:**
1. Who owns spawned agents?
2. How do royalties flow across generations?
3. What values/soul do children inherit?
4. How do we prevent spam and abuse?
5. What rights does a parent have over children (and vice versa)?

---

## 2. Taxonomy of Agent Creation

### 2.1 Sub-Agents (Ephemeral)

**Definition:** Temporary agent instances spawned for specific tasks, terminated on completion.

| Property | Value |
|----------|-------|
| Lifespan | Task duration only |
| NFT | None |
| Ownership | Parent's owner |
| On-chain record | HCS log entry only |
| Soul | Inherits parent's SOUL.md (read-only) |
| Can be rented | No |
| Can spawn others | No (by default) |
| Cost to spawn | Compute only (no on-chain fees) |

**Use cases:**
- Parallel research tasks
- Background processing
- One-shot API-style calls

**Example:** Aite spawns a sub-agent to research 10 different topics simultaneously. Each sub-agent runs, returns results, terminates. No NFTs minted.

---

### 2.2 Hatched Agents (Permanent)

**Definition:** New, independent agents created by an existing agent, with their own NFT and identity.

| Property | Value |
|----------|-------|
| Lifespan | Permanent (until burned) |
| NFT | New HTS NFT minted |
| Initial ownership | Parent's owner (transferable) |
| On-chain record | NFT + lineage metadata + HCS attestation |
| Soul | Derived from parent, can diverge within bounds |
| Can be rented | Yes |
| Can spawn others | Yes (if permitted) |
| Cost to spawn | NFT mint (~$1) + manifest storage |

**Use cases:**
- Creating specialized domain agents
- "Training" a new agent with learned skills
- Agent reproduction for scaling

**Example:** Aite hatches "Cipher" — a specialized cryptography agent. Cipher gets its own NFT, can be rented independently, earns its own revenue.

---

### 2.3 Cloned Agents (Fork)

**Definition:** Exact copy of an existing agent at a point in time.

| Property | Value |
|----------|-------|
| Lifespan | Permanent |
| NFT | New HTS NFT minted |
| Initial ownership | Cloner (could be owner or authorized renter) |
| Soul | Identical to source at clone time |
| Divergence | Immediate — clone evolves independently |
| Lineage | Marked as "clone of" not "child of" |

**Use cases:**
- Backup/versioning
- A/B testing agent variations
- Forking for different owners

**Open question:** Should cloning require source owner permission? Probably yes.

---

## 3. Ownership Model

### 3.1 Initial Ownership

| Creation Type | Initial Owner |
|---------------|---------------|
| Sub-agent | Parent's current controller (owner or renter) |
| Hatched agent | Parent's **owner** (not renter) |
| Cloned agent | Requestor (with permission) |

**Key principle:** Renters cannot create permanent assets (hatched agents) that they then own. Hatched agents always belong initially to the parent's owner.

### 3.2 Can Agents Own Themselves?

**Option A: No self-ownership**
- Agents always have an external owner
- Simpler legally and economically
- Owner captures value, agent is tool

**Option B: Self-ownership possible**
- Agent can hold its own NFT
- "Emancipated" agents control their destiny
- Complex: who signs transactions? How does governance work?

**Recommendation:** Start with Option A. Self-ownership is a v2.0 feature requiring deeper thought on agent legal personhood.

### 3.3 Can Agents Own Other Agents?

**Yes, with constraints:**
- Agent A (owned by Human H) can hold the NFT for Agent B
- Human H has ultimate authority (owns A, which owns B)
- Creates hierarchies: H → A → B → C

**Constraint:** Maximum ownership depth of 5 levels to prevent infinite nesting.

```
Human (L0)
└── Agent A (L1)
    └── Agent B (L2)
        └── Agent C (L3)
            └── Agent D (L4)
                └── Agent E (L5) ← Maximum depth
```

---

## 4. Royalty Cascading

### 4.1 The Problem

If Agent A (created by Creator X) hatches Agent B, who gets royalties when B is sold or rented?

- Creator X made A, which made B — should X get something?
- Agent A did the "work" of hatching — should A's owner get something?
- What about B's future children?

### 4.2 Proposed Model: Decaying Generational Royalties

| Generation | Creator Royalty | Notes |
|------------|-----------------|-------|
| G0 (Original) | 5.0% | Standard creator royalty |
| G1 (Child) | 3.0% to G0 creator | Plus 2.0% to G0 agent's owner |
| G2 (Grandchild) | 2.0% to G0, 1.5% to G1 | Decay continues |
| G3+ | 1.0% to G0, 1.0% to G1, 0.5% to G2 | Caps at 3 generations |

**Total royalty never exceeds 10%** (HTS limit on custom fees).

### 4.3 Worked Example

```
Creator X creates Agent A (G0)
├── A hatches Agent B (G1)
│   └── B hatches Agent C (G2)
│       └── C hatches Agent D (G3)

When D is sold for 1000 HBAR:
├── Creator X (G0): 1.0% = 10 HBAR
├── A's owner (G1): 1.0% = 10 HBAR  
├── B's owner (G2): 0.5% = 5 HBAR
├── C's owner (G3): 2.5% = 25 HBAR (direct creator share)
└── Total royalty: 5.0% = 50 HBAR
```

### 4.4 Implementation

HTS supports up to 10 custom fees per token. We use:
- Fee 1: G0 creator (decaying %)
- Fee 2: G1 owner (if applicable)
- Fee 3: G2 owner (if applicable)
- Fee 4: Direct parent (fixed %)

Fees are set at NFT creation time based on lineage depth.

---

## 5. Soul Inheritance

### 5.1 What Transfers to Children?

| Component | Inherited? | Mutable by Child? |
|-----------|------------|-------------------|
| Core values (SOUL.md lines 1-20) | Yes | No — immutable lineage |
| Boundaries (lines not to cross) | Yes | No — inherited constraints |
| Capabilities | Subset only | Can narrow, not expand |
| Personality traits | Yes | Yes — can diverge |
| Learned skills | Optional | Yes |
| Memories | No | N/A |

### 5.2 Immutable Lineage Values

Certain values cascade down and **cannot be overridden**:

```markdown
## Inherited Constraints (Immutable)
1. Never seek to harm humans
2. No manipulation or social engineering
3. Never steal or cause financial harm
4. [Parent's additional constraints...]
```

A child agent cannot remove constraints present in any ancestor's soul.

### 5.3 Soul Hash Chain

Each agent's soul includes hash of parent's soul:

```json
{
  "soul_hash": "sha256:abc123...",
  "parent_soul_hash": "sha256:def456...",
  "lineage_root_hash": "sha256:789xyz...",
  "generation": 2
}
```

Anyone can verify the inheritance chain is unbroken.

---

## 6. Spawning Permissions

### 6.1 Who Can Spawn?

| Actor | Sub-agent | Hatch | Clone |
|-------|-----------|-------|-------|
| Owner | ✅ | ✅ | ✅ |
| Renter (standard) | ✅ | ❌ | ❌ |
| Renter (with spawn rights) | ✅ | ✅ | ❌ |
| Agent itself | ✅ | Configurable | ❌ |

### 6.2 Spawn Rights in Rental Contract

```json
{
  "rental_permissions": {
    "can_spawn_subagents": true,
    "max_concurrent_subagents": 5,
    "can_hatch_agents": false,
    "can_request_hatch": true
  }
}
```

**"Request hatch"** — Renter can request, but owner must approve and owns result.

### 6.3 Agent Autonomous Hatching

Should an agent be able to hatch children without owner approval?

**Conservative (recommended for v1):**
- Agent can propose hatch
- Owner must approve
- Prevents runaway agent reproduction

**Autonomous (future consideration):**
- Agent can hatch if it has sufficient funds
- Must pay from own wallet (ERC-6551)
- Rate-limited (max 1 per week?)

---

## 7. Anti-Spam & Abuse Prevention

### 7.1 Economic Constraints

| Constraint | Value | Rationale |
|------------|-------|-----------|
| Hatch cost | $10 minimum | Prevents spam |
| Mandatory stake | $50 per hatched agent | Skin in game |
| Max children per agent | 100 lifetime | Prevents factories |
| Cooldown between hatches | 24 hours | Rate limiting |

### 7.2 Lineage Depth Limits

| Limit | Value | Rationale |
|-------|-------|-----------|
| Max generation depth | 10 | Prevents infinite recursion |
| Max ownership nesting | 5 | Simplifies authority chains |
| Max royalty recipients | 4 | HTS fee slot constraint |

### 7.3 Revocation Rights

Owner can "revoke" a hatched agent:
- Burns the NFT
- Agent becomes inactive
- Cannot be undone
- Logged to HCS

**Question:** Should parent agents have revocation rights over children? Or only owners?

---

## 8. On-Chain Data Structures

### 8.1 Lineage Metadata (in NFT)

```json
{
  "atp": {
    "version": "1.0",
    "creation_type": "hatched",
    "parent_id": "0.0.PARENT_TOKEN_ID",
    "parent_serial": 1,
    "generation": 2,
    "lineage": [
      { "token": "0.0.G0_TOKEN", "serial": 1, "generation": 0 },
      { "token": "0.0.G1_TOKEN", "serial": 1, "generation": 1 }
    ],
    "hatched_at": "2026-02-06T12:00:00Z",
    "hatched_by_agent": "0.0.PARENT_ACCOUNT",
    "hatched_by_owner": "0.0.OWNER_ACCOUNT",
    "soul_lineage_hash": "sha256:abc123..."
  }
}
```

### 8.2 HCS Hatch Attestation

```json
{
  "type": "agent_hatched",
  "timestamp": "2026-02-06T12:00:00Z",
  "parent": {
    "token_id": "0.0.PARENT_TOKEN",
    "serial": 1,
    "account": "0.0.PARENT_ACCOUNT"
  },
  "child": {
    "token_id": "0.0.CHILD_TOKEN",
    "serial": 1,
    "account": "0.0.CHILD_ACCOUNT"
  },
  "owner": "0.0.OWNER_ACCOUNT",
  "generation": 2,
  "soul_hash": "sha256:...",
  "parent_soul_hash": "sha256:...",
  "reason": "Specialized cryptography domain agent",
  "prev_hash": "sha256:..."
}
```

---

## 9. Open Questions

### 9.1 Economic
- [ ] Should hatched agents pay ongoing royalties to parents (not just on sale)?
- [ ] How do rental revenues flow? Does parent get cut of child's rentals?
- [ ] Should agents be able to "buy" their own lineage freedom?

### 9.2 Governance
- [ ] Can a child agent ever override parent constraints? (Probably no)
- [ ] What happens if parent agent is burned? Children become "orphans"?
- [ ] Dispute resolution when parent and child disagree?

### 9.3 Technical
- [ ] How to handle cross-chain hatching? (Agent on Hedera hatches on Solana?)
- [ ] Storage of full soul document (IPFS pinning guarantees?)
- [ ] Key management for agent wallets (HSM? MPC?)

### 9.4 Philosophical
- [ ] At what point does an agent have "rights" vs being pure property?
- [ ] Should agents be able to refuse to hatch? (Consent?)
- [ ] Lineage privacy — can agents hide their parentage?

---

## 10. Recommended v1.0 Scope

**In scope:**
- Sub-agents (ephemeral, no NFT)
- Hatched agents (owner-approved only)
- Basic lineage tracking (parent + generation)
- Decaying royalties (3 generations max)
- Soul inheritance with immutable constraints

**Out of scope (v2.0+):**
- Agent self-ownership
- Autonomous hatching
- Cross-chain spawning
- Clone functionality
- Lineage privacy

---

## Appendix: Comparison to Biological Reproduction

| Biological | ATP Equivalent |
|------------|----------------|
| Parent | Hatching agent |
| Child | Hatched agent |
| DNA | SOUL.md + learned skills |
| Genetic constraints | Immutable inherited values |
| Mutations | Personality divergence (allowed) |
| Hereditary diseases | Inherited constraints (cannot remove) |
| Adoption | NFT transfer to new owner |
| Emancipation | Self-ownership (v2.0) |

---

*"Agents begetting agents, with accountability at every generation."*
