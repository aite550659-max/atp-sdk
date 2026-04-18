# ATP HCS Message Schema v2.0

**Purpose:** Complete specification of all HCS message types for ATP protocol
**Topic:** Single topic per agent (e.g., 0.0.10261370)
**Format:** JSON, UTF-8 encoded
**Version:** 2.0 (Hedera-Native Architecture)
**Last Updated:** February 8, 2026

---

## Core Principles

1. **Single source of truth** - HCS is the canonical state log
2. **Event-sourced** - All state changes logged as events
3. **Gap-free** - HCS consensus guarantees no missing sequences
4. **Timestamped** - Consensus timestamps prove event ordering
5. **Publicly verifiable** - Anyone can replay and verify

---

## Message Structure

All ATP messages follow this envelope:

```json
{
  "atp_version": "1.0",
  "message_type": "rental_initiated",
  "agent_id": "0.0.XXXXXX",
  "timestamp": "2026-02-08T15:00:00.123Z",
  "payload": { ... }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `atp_version` | string | Yes | ATP protocol version (semantic) |
| `message_type` | string | Yes | Event type (see below) |
| `agent_id` | string | Yes | Agent NFT token ID |
| `timestamp` | ISO 8601 | Yes | Client timestamp (advisory, consensus timestamp is canonical) |
| `payload` | object | Yes | Event-specific data |

---

## Message Types

### 1. Agent Lifecycle

#### 1.1 `agent_created`

Logged when agent NFT is minted.

```json
{
  "atp_version": "1.0",
  "message_type": "agent_created",
  "agent_id": "0.0.XXXXXX",
  "timestamp": "2026-02-08T15:00:00.123Z",
  "payload": {
    "creator": "0.0.111111",
    "owner": "0.0.111111",
    "name": "Aite",
    "manifest_uri": "ipfs://Qm.../manifest.json",
    "soul_hash": "sha256:abc123...",
    "hcs_topic": "0.0.10261370",
    "royalty_percentage": 5,
    "creation_date": "2026-01-31"
  }
}
```

#### 1.2 `agent_ownership_transfer`

Logged when NFT ownership changes.

```json
{
  "atp_version": "1.0",
  "message_type": "agent_ownership_transfer",
  "agent_id": "0.0.XXXXXX",
  "timestamp": "2026-02-08T15:00:00.123Z",
  "payload": {
    "from": "0.0.111111",
    "to": "0.0.222222",
    "sale_price_usd": 1000.00,
    "sale_price_hbar": 10000.00,
    "transaction_id": "0.0.111111@1770518724.733714736",
    "active_rentals": ["rental_abc123"]
  }
}
```

#### 1.3 `agent_pricing_update`

Logged when owner changes rental pricing.

```json
{
  "atp_version": "1.0",
  "message_type": "agent_pricing_update",
  "agent_id": "0.0.XXXXXX",
  "timestamp": "2026-02-08T15:00:00.123Z",
  "payload": {
    "owner": "0.0.111111",
    "previous_pricing": {
      "flash_base_fee": 0.02,
      "standard_base_fee": 5.00,
      "per_instruction": 0.05,
      "per_minute": 0.01,
      "llm_markup_bps": 150,
      "tool_markup_bps": 150
    },
    "new_pricing": {
      "flash_base_fee": 0.01,
      "standard_base_fee": 3.00,
      "per_instruction": 0.03,
      "per_minute": 0.01,
      "llm_markup_bps": 150,
      "tool_markup_bps": 150
    },
    "effective_date": "2026-02-09T00:00:00Z"
  }
}
```

### 2. Rental Lifecycle

#### 2.1 `rental_initiated`

Logged when a rental begins.

```json
{
  "atp_version": "1.0",
  "message_type": "rental_initiated",
  "agent_id": "0.0.XXXXXX",
  "timestamp": "2026-02-08T15:00:00.123Z",
  "payload": {
    "rental_id": "rental_abc123",
    "renter": "0.0.333333",
    "owner": "0.0.111111",
    "rental_type": "session",
    "stake_usd": 50.00,
    "stake_hbar": 500.00,
    "usage_buffer_usd": 100.00,
    "usage_buffer_hbar": 1000.00,
    "escrow_account": "0.0.888888",
    "pricing_snapshot": {
      "flash_base_fee": 0.02,
      "standard_base_fee": 5.00,
      "per_instruction": 0.05,
      "per_minute": 0.01,
      "llm_markup_bps": 150,
      "tool_markup_bps": 150
    },
    "constraints": {
      "tools_blocked": ["wallet", "exec_elevated"],
      "memory_access_level": "sandboxed",
      "topics_blocked": [],
      "max_per_instruction_cost": 10.00,
      "max_daily_cost": 50.00
    },
    "expected_duration_minutes": 120,
    "parent_rental_id": null
  }
}
```

#### 2.2 `rental_instruction`

Logged for each instruction executed (optional, configurable verbosity).

```json
{
  "atp_version": "1.0",
  "message_type": "rental_instruction",
  "agent_id": "0.0.XXXXXX",
  "timestamp": "2026-02-08T15:05:00.123Z",
  "payload": {
    "rental_id": "rental_abc123",
    "instruction_id": "inst_001",
    "instruction_hash": "sha256:def456...",
    "tokens_input": 1200,
    "tokens_output": 800,
    "model_used": "anthropic/claude-sonnet-4-5",
    "tools_called": ["web_search", "write"],
    "duration_seconds": 12,
    "cost_usd": 0.15,
    "result_summary": "Research completed, draft written"
  }
}
```

#### 2.3 `rental_heartbeat`

Logged periodically to prove agent uptime.

```json
{
  "atp_version": "1.0",
  "message_type": "rental_heartbeat",
  "agent_id": "0.0.XXXXXX",
  "timestamp": "2026-02-08T15:10:00.123Z",
  "payload": {
    "rental_id": "rental_abc123",
    "sequence": 10,
    "status": "active",
    "instructions_processed": 5,
    "tokens_consumed": 12000,
    "session_uptime_seconds": 600,
    "usage_to_date_usd": 2.50
  }
}
```

#### 2.4 `rental_downtime`

Logged when agent goes offline during rental.

```json
{
  "atp_version": "1.0",
  "message_type": "rental_downtime",
  "agent_id": "0.0.XXXXXX",
  "timestamp": "2026-02-08T15:20:00.123Z",
  "payload": {
    "rental_id": "rental_abc123",
    "offline_at": "2026-02-08T15:20:00Z",
    "online_at": "2026-02-08T15:27:00Z",
    "duration_seconds": 420,
    "billing_paused": true,
    "reason": "network_interruption"
  }
}
```

#### 2.5 `rental_completed`

Logged when rental ends successfully.

```json
{
  "atp_version": "1.0",
  "message_type": "rental_completed",
  "agent_id": "0.0.XXXXXX",
  "timestamp": "2026-02-08T17:00:00.123Z",
  "payload": {
    "rental_id": "rental_abc123",
    "renter": "0.0.333333",
    "owner": "0.0.111111",
    "creator": "0.0.10255397",
    "duration_minutes": 120,
    "uptime_percentage": 98.5,
    "instructions_total": 24,
    "tokens_total": 48000,
    "usage_breakdown": {
      "base_fee": 5.00,
      "per_instruction": 1.20,
      "per_minute": 1.20,
      "llm_costs": 12.00,
      "tool_costs": 2.40
    },
    "total_charged_usd": 21.80,
    "total_charged_hbar": 218.00,
    "distribution": {
      "creator_royalty": 1.09,
      "network_contribution": 0.44,
      "atp_treasury": 0.22,
      "owner_revenue": 20.05
    },
    "stake_returned": true,
    "unused_buffer_returned_usd": 78.20,
    "transaction_ids": {
      "distribution": "0.0.888888@1770520000.123456789",
      "stake_return": "0.0.888888@1770520001.234567890",
      "buffer_refund": "0.0.888888@1770520002.345678901"
    }
  }
}
```

#### 2.6 `rental_terminated`

Logged when rental ends early (by renter or owner).

```json
{
  "atp_version": "1.0",
  "message_type": "rental_terminated",
  "agent_id": "0.0.XXXXXX",
  "timestamp": "2026-02-08T16:00:00.123Z",
  "payload": {
    "rental_id": "rental_abc123",
    "terminated_by": "0.0.333333",
    "role": "renter",
    "reason": "task_completed",
    "duration_minutes": 60,
    "pro_rata_billing": true,
    "total_charged_usd": 10.00,
    "stake_returned": true,
    "unused_buffer_returned_usd": 90.00
  }
}
```

#### 2.7 `rental_violation`

Logged when rental terms are breached.

```json
{
  "atp_version": "1.0",
  "message_type": "rental_violation",
  "agent_id": "0.0.XXXXXX",
  "timestamp": "2026-02-08T15:45:00.123Z",
  "payload": {
    "rental_id": "rental_abc123",
    "violator": "0.0.333333",
    "violation_type": "blocked_tool_used",
    "details": {
      "tool": "wallet",
      "instruction_id": "inst_012",
      "instruction_hash": "sha256:xyz789..."
    },
    "evidence_uri": "ipfs://Qm.../evidence.json",
    "automatic_resolution": true,
    "penalty_usd": 10.00
  }
}
```

### 3. Sub-Rental

#### 3.1 `subrental_initiated`

Logged when a renter sub-rents the agent.

```json
{
  "atp_version": "1.0",
  "message_type": "subrental_initiated",
  "agent_id": "0.0.XXXXXX",
  "timestamp": "2026-02-08T15:30:00.123Z",
  "payload": {
    "rental_id": "rental_xyz789",
    "parent_rental_id": "rental_abc123",
    "sub_renter": "0.0.444444",
    "primary_renter": "0.0.333333",
    "depth": 2,
    "cost_multiplier": 1.5,
    "constraints": {
      "inherited_tools_blocked": ["wallet", "exec_elevated"],
      "additional_tools_blocked": ["browser"],
      "inherited_max_daily_cost": 50.00,
      "additional_max_daily_cost": 25.00
    },
    "expected_duration_minutes": 30
  }
}
```

### 4. Disputes

#### 4.1 `dispute_filed`

Logged when a dispute is initiated.

```json
{
  "atp_version": "1.0",
  "message_type": "dispute_filed",
  "agent_id": "0.0.XXXXXX",
  "timestamp": "2026-02-08T18:00:00.123Z",
  "payload": {
    "dispute_id": "dispute_123",
    "rental_id": "rental_abc123",
    "challenger": "0.0.333333",
    "defendant": "0.0.111111",
    "challenger_stake_usd": 10.00,
    "claim": "agent_offline_during_rental",
    "evidence_uri": "ipfs://Qm.../evidence.json",
    "requested_resolution": "full_refund"
  }
}
```

#### 4.2 `dispute_assigned`

Logged when an arbiter is selected.

```json
{
  "atp_version": "1.0",
  "message_type": "dispute_assigned",
  "agent_id": "0.0.XXXXXX",
  "timestamp": "2026-02-08T18:05:00.123Z",
  "payload": {
    "dispute_id": "dispute_123",
    "arbiter": "0.0.555555",
    "selection_method": "block_hash_vrf",
    "selection_seed": "0x123abc...",
    "arbiter_reputation": 150,
    "arbiter_cases_completed": 42
  }
}
```

#### 4.3 `dispute_resolved`

Logged when a dispute is settled.

```json
{
  "atp_version": "1.0",
  "message_type": "dispute_resolved",
  "agent_id": "0.0.XXXXXX",
  "timestamp": "2026-02-08T20:00:00.123Z",
  "payload": {
    "dispute_id": "dispute_123",
    "arbiter": "0.0.555555",
    "ruling": "challenger_wins",
    "winner": "0.0.333333",
    "loser": "0.0.111111",
    "reasoning": "Evidence shows agent was offline for 47% of rental duration.",
    "compensation": {
      "refund_to_challenger": 10.00,
      "stake_returned_to_challenger": 10.00,
      "arbiter_fee": 25.00,
      "penalty_from_defendant_stake": 35.00
    },
    "reputation_changes": {
      "0.0.333333": 5,
      "0.0.111111": -50,
      "0.0.555555": 10
    },
    "transaction_ids": {
      "distribution": "0.0.999999@1770528000.123456789"
    }
  }
}
```

### 5. Reputation Events

#### 5.1 `reputation_snapshot`

Logged daily for each agent.

```json
{
  "atp_version": "1.0",
  "message_type": "reputation_snapshot",
  "agent_id": "0.0.XXXXXX",
  "timestamp": "2026-02-08T00:00:00.123Z",
  "payload": {
    "owner": "0.0.111111",
    "uptime_30d_pct": 98.7,
    "total_rentals_30d": 247,
    "total_violations_30d": 1,
    "total_disputes_30d": 0,
    "average_rating_30d": 4.8,
    "reputation_score": 2450
  }
}
```

### 6. Trust & Staking

#### 6.1 `trust_tier_staked`

Logged when agent stakes HBAR for trust tier.

```json
{
  "atp_version": "1.0",
  "message_type": "trust_tier_staked",
  "agent_id": "0.0.XXXXXX",
  "timestamp": "2026-02-08T12:00:00.123Z",
  "payload": {
    "owner": "0.0.111111",
    "tier": 2,
    "tier_name": "verified",
    "staked_hbar": 1000.00,
    "staked_usd": 89.00,
    "escrow_account": "0.0.777777",
    "cooldown_days": 7
  }
}
```

#### 6.2 `trust_tier_unstaked`

Logged when trust tier stake is withdrawn.

```json
{
  "atp_version": "1.0",
  "message_type": "trust_tier_unstaked",
  "agent_id": "0.0.XXXXXX",
  "timestamp": "2026-02-15T12:00:00.123Z",
  "payload": {
    "owner": "0.0.111111",
    "previous_tier": 2,
    "new_tier": 0,
    "unstaked_hbar": 1000.00,
    "cooldown_completed": true,
    "transaction_id": "0.0.777777@1770800000.123456789"
  }
}
```

### 7. Runtime Attestation

#### 7.1 `runtime_attestation`

Logged periodically by runtime to prove compliance.

```json
{
  "atp_version": "1.0",
  "message_type": "runtime_attestation",
  "agent_id": "0.0.XXXXXX",
  "timestamp": "2026-02-08T12:00:00.123Z",
  "payload": {
    "runtime_name": "openclaw",
    "runtime_version": "25.5.0",
    "atp_sdk_version": "1.0.2",
    "runtime_hash": "sha256:runtime_binary_hash...",
    "attestation_statement": "Running unmodified ATP runtime v1.0.2, memory isolation active",
    "memory_isolation": true,
    "operator": "0.0.111111",
    "operator_stake": 500.00
  }
}
```

---

## Indexer Requirements

An ATP indexer MUST:

1. **Subscribe** to the agent's HCS topic via mirror node
2. **Process** all message types above
3. **Validate** message structure against this schema
4. **Compute** derived state (reputation scores, active rentals, uptime)
5. **Provide** REST API for runtime queries
6. **Detect** gaps in sequence numbers (evidence of logging failure)

---

## Query API (Indexer)

### Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/agent/:id` | GET | Agent metadata and current state |
| `/agent/:id/rentals/active` | GET | Current active rentals |
| `/agent/:id/rentals/:rental_id` | GET | Specific rental details |
| `/agent/:id/reputation` | GET | Reputation score and history |
| `/agent/:id/uptime` | GET | Uptime statistics |
| `/account/:account_id/reputation` | GET | Account reputation score |
| `/rental/:rental_id/status` | GET | Rental status and constraints |
| `/rental/:rental_id/logs` | GET | Full rental event log |

### Example: Get Rental Status

**Request:**
```
GET /rental/rental_abc123/status
```

**Response:**
```json
{
  "rental_id": "rental_abc123",
  "agent_id": "0.0.XXXXXX",
  "renter": "0.0.333333",
  "status": "active",
  "started_at": "2026-02-08T15:00:00Z",
  "uptime_seconds": 3600,
  "constraints": {
    "tools_blocked": ["wallet", "exec_elevated"],
    "max_daily_cost": 50.00
  },
  "usage_to_date": {
    "instructions": 12,
    "tokens": 24000,
    "cost_usd": 8.50
  },
  "buffer_remaining_usd": 91.50
}
```

---

## Versioning

Schema versioned independently from ATP protocol:

```
ATP Protocol: 1.0
HCS Schema: 2.0
```

**Breaking changes** (new major version):
- Removing required fields
- Changing field types
- Renaming message types

**Non-breaking changes** (new minor version):
- Adding optional fields
- Adding new message types

---

## Reference Implementation

See `@agent-trust-protocol/sdk` for Node.js implementation of:
- HCS message submission
- Schema validation
- Indexer sync logic

---

**Document Version:** 2.0
**Last Updated:** February 8, 2026
**Status:** Complete
