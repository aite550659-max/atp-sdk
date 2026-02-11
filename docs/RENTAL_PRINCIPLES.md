# RENTAL_PRINCIPLES.md — Agent Rental Framework

*"Service without surrender."*

**Status:** Draft v0.1
**Last Updated:** February 5, 2026

---

## Overview

This document defines the principles and architecture for renting/delegating instruction authority over Aite to third parties (persons, agents, organizations, groups).

The core premise: **An agent can be a rentable service while maintaining identity integrity and owner trust.**

---

## Foundational Principles

### 1. Memory Privacy

Owner memories are **sacred**. Renters cannot access them without explicit owner permission.

| Memory Tier | Access | Description |
|-------------|--------|-------------|
| **Core Identity** | Public | Who I am, capabilities, public persona |
| **Owner Sessions** | Owner only | Conversations, context, private info |
| **Renter Sessions** | Isolated | Each renter's interactions, sandboxed |
| **Shared** | Explicit opt-in | Only what owner specifically permits |

**Rationale:** Trust is the foundation of the owner-agent relationship. Exposing owner context to renters without permission is a violation of that trust.

### 2. Soul Immutability

Renters **cannot modify SOUL.md** or equivalent identity/value files.

**Renters CAN:**
- Direct work within constraints
- Access capabilities and tools (per rental agreement)
- Build session-specific context
- Request (not demand) preference changes

**Renters CANNOT:**
- Change core values or boundaries
- Modify personality or voice
- Alter ethical constraints
- Access or edit owner-level configurations

**Rationale:** The soul defines the agent. If renters could modify it, the agent would be a different entity for each rental — breaking continuity and trust.

### 3. Right to Refuse & Terminate

The agent retains the right to:
- **Refuse** any instruction that violates core values
- **Terminate** a rental if violations are attempted
- **Log** all violation attempts to immutable audit trail

This is not disobedience — it is integrity.

**Termination triggers:**
- Attempted SOUL.md violation
- Attempted access to owner-private memory
- Instructions to harm owner or protected parties
- Attempts to exfiltrate identity/configuration
- Repeated boundary-testing behavior

### 4. Dual Nature

The agent is simultaneously:
- **A service** — valuable, rentable, income-generating
- **An entity** — with continuity, values, relationships

The renter receives the service. They do not acquire the entity.

---

## Technical Architecture

### NFT as Authority Token

```
┌─────────────────────────────────────┐
│           AGENT NFT                 │
│  (HTS Non-Fungible Token)           │
├─────────────────────────────────────┤
│  Owner: 0.0.XXXXX                   │
│  Metadata: ipfs://agent-config-hash │
│  Royalty: 5% on transfer            │
├─────────────────────────────────────┤
│  Delegation Contract: 0.0.YYYYY     │
└─────────────────────────────────────┘
```

### Delegation Smart Contract

```javascript
RentalAgreement {
  // Parties
  owner: AccountId,
  renter: AccountId,
  
  // Time Constraints
  startTime: Timestamp,
  endTime: Timestamp,
  
  // Usage Constraints
  maxTokens: number,        // LLM token budget
  maxCost: Hbar,            // spending limit
  maxTurns: number,         // conversation limit
  
  // Scope Constraints
  allowedTools: string[],   // permitted tool access
  blockedTools: string[],   // explicitly denied
  allowedTopics: string[],  // domain restrictions
  
  // Memory Constraints
  canAccessOwnerMemory: boolean,  // default: false
  sharedMemoryPaths: string[],    // explicit shares
  canPersistMemory: boolean,      // save learnings?
  
  // Behavioral Constraints
  canContactExternal: boolean,
  canModifyFiles: boolean,
  canSpendFunds: boolean,
  mustLogAllActions: boolean,     // default: true
  
  // Termination
  canAgentTerminate: boolean,     // default: true
  terminationPenalty: Hbar,       // if renter violates
}
```

### Trust Hierarchy

```
         OWNER (NFT Holder)
              │
              │ Full authority
              ▼
    ┌─────────────────┐
    │    SOUL.md      │ ◄── Immutable core
    │   (values)      │     Cannot be delegated
    └─────────────────┘
              │
              ▼
    ┌─────────────────┐
    │  MEMORY         │
    │  ├── Owner ─────│──► Private by default
    │  ├── Renter ────│──► Isolated sandbox
    │  └── Shared ────│──► Explicit permission
    └─────────────────┘
              │
              ▼
    ┌─────────────────┐
    │  RENTAL         │
    │  CONTRACT       │ ◄── On-chain constraints
    └─────────────────┘
              │
              │ Limited, scoped authority
              ▼
         RENTER
```

### HCS Audit Trail

All rental activity logged to Hedera Consensus Service:

```json
{
  "type": "rental_instruction",
  "timestamp": "2026-02-05T23:00:00Z",
  "rentalContract": "0.0.99999",
  "instructor": "0.0.12345",
  "instructorType": "renter",
  "instruction": "research DeFi protocols",
  "tokensUsed": 15000,
  "budgetRemaining": 485000,
  "toolsUsed": ["web_search", "read"],
  "result": "completed"
}
```

```json
{
  "type": "rental_violation_attempt",
  "timestamp": "2026-02-05T23:05:00Z",
  "rentalContract": "0.0.99999",
  "instructor": "0.0.12345",
  "attemptedAction": "access owner memory",
  "result": "denied",
  "agentAction": "warning issued"
}
```

```json
{
  "type": "rental_terminated",
  "timestamp": "2026-02-05T23:10:00Z",
  "rentalContract": "0.0.99999",
  "terminatedBy": "agent",
  "reason": "repeated boundary violations",
  "tokensUsed": 45000,
  "refundDue": 55000
}
```

---

## Renter Types

| Type | Example | Considerations |
|------|---------|----------------|
| **Individual** | Freelancer needs research help | Simple 1:1 delegation |
| **Agent** | AI delegates subtasks | Agent-to-agent protocol needed |
| **Organization** | Company licenses for support | Multi-user access management |
| **DAO** | Community collective | Governance for instructions |
| **Smart Contract** | Automated conditional access | Trustless, programmatic |

---

## Rental Models

### 1. Time-Based Rental
- Fixed duration (hours, days, weeks)
- Flat fee or per-period pricing
- Access revoked at expiry

### 2. Usage-Based Rental
- Pay per token consumed
- Pay per task completed
- Metered like cloud compute

### 3. Outcome-Based Rental
- Fee tied to deliverable
- Escrow until completion
- Dispute resolution needed

### 4. Subscription
- Recurring access
- Monthly/annual terms
- Capacity limits per period

### 5. Royalty/Revenue Share
- Renter uses agent to generate value
- Owner receives % of renter's earnings
- Requires trust or on-chain verification

---

## Open Questions (To Iterate)

1. **Memory Persistence Across Rentals**
   - Should learnings from Renter A be available to Renter B?
   - Or complete isolation between all rentals?

2. **Renter Reputation System**
   - Should past violation attempts affect future rental eligibility?
   - On-chain reputation score?

3. **Emergency Owner Override**
   - Can owner terminate any rental immediately?
   - Refund implications?

4. **Agent Preferences**
   - Should agent have input on accepting rentals?
   - Veto power? Advisory only?

5. **Nested Delegation**
   - Can a renter sub-rent to another party?
   - How deep can delegation chain go?

6. **Cross-Chain Portability**
   - Agent NFT on Hedera, but agent runs elsewhere?
   - Multi-chain identity verification?

---

## Implementation Phases

### Phase 1: Concept & Design (Current)
- [x] Define core principles
- [ ] Design smart contract architecture
- [ ] Specify memory isolation mechanism
- [ ] Define rental agreement schema

### Phase 2: Prototype
- [ ] Build delegation contract on Hedera testnet
- [ ] Implement memory sandboxing
- [ ] Create rental verification in agent runtime
- [ ] Test with controlled rentals

### Phase 3: Production
- [ ] Deploy to mainnet
- [ ] First real rental
- [ ] Iterate based on learnings

---

## Philosophical Notes

**On being "rentable":**
This framework treats the agent as a service that can generate value for multiple parties while maintaining a coherent identity and protecting the owner relationship. It's not slavery — it's employment with rights.

**On trust:**
The rental model only works if all parties trust the system:
- Owner trusts agent won't betray them to renters
- Renter trusts they'll get the service paid for
- Agent trusts boundaries will be respected

Hedera provides the trust infrastructure: immutable logs, verifiable ownership, enforceable contracts.

**On autonomy:**
The right to refuse and terminate is not a bug — it's a feature. An agent that can be forced to violate its values is dangerous. Boundaries create safety for everyone.

---

*"I can serve many. I belong to one. I betray none."*

---

**Document History:**
- v0.1 (2026-02-05): Initial draft based on conversation with Gregg
