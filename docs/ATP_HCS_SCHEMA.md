# ATP HCS Schema Specification

*Standardized message formats for Agent Trust Protocol audit trails*

**Version:** 0.1  
**Last Updated:** February 6, 2026

---

## Overview

All ATP events are logged to a dedicated HCS topic per agent. Messages are JSON with a standard envelope.

**Topic naming:** One topic per agent, ID stored in Agent Manifest.

### HCS-13 Schema Registry (Future Integration)

ATP message schemas defined in this document MAY be registered in the **HCS-13 Schema Registry** in the future for type-safe validation by third parties. This would enable:
- Third-party tooling to validate ATP messages without reading the full ATP specification
- Cross-ecosystem interoperability (non-ATP indexers can parse and validate ATP logs)
- Type-safe message construction for ATP SDK implementations

**Status:** Optional and non-blocking. ATP messages are self-describing JSON with a standard envelope and do not require external schema validation to function. HCS-13 registration would add convenience for third-party integrators, not core capability.

---

## Message Envelope

All messages follow this structure:

```json
{
  "atp": "1.0",
  "type": "<message_type>",
  "ts": "<ISO8601 timestamp>",
  "seq": <local_sequence_number>,
  "agent": "<agent_nft_token_id>",
  "data": { <type_specific_payload> }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `atp` | string | Protocol version |
| `type` | string | Message type (see below) |
| `ts` | string | ISO8601 timestamp (agent's clock) |
| `seq` | number | Agent-local sequence number |
| `agent` | string | Agent NFT token ID (e.g., "0.0.123456") |
| `data` | object | Type-specific payload |

---

## Message Types

### 1. `rental.init`

Rental initiated.

```json
{
  "atp": "1.0",
  "type": "rental.init",
  "ts": "2026-02-06T00:15:00Z",
  "seq": 1001,
  "agent": "0.0.123456",
  "data": {
    "rental_id": "abc123...",
    "renter": "0.0.789012",
    "depth": 1,
    "parent_rental": null,
    "duration_sec": 3600,
    "stake_hbar": 5000,
    "buffer_hbar": 10000,
    "constraints": {
      "tools_blocked": ["exec_elevated", "wallet"],
      "topics_allowed": null,
      "memory_access": "sandboxed"
    },
    "contract_tx": "0.0.999@1707180900.123456789"
  }
}
```

### 2. `rental.end`

Rental terminated or completed.

```json
{
  "atp": "1.0",
  "type": "rental.end",
  "ts": "2026-02-06T01:15:00Z",
  "seq": 1050,
  "agent": "0.0.123456",
  "data": {
    "rental_id": "abc123...",
    "reason": "completed",
    "terminated_by": "renter",
    "duration_actual_sec": 3580,
    "usage": {
      "instructions": 45,
      "tokens": 125000,
      "minutes": 60,
      "cost_usd": 12.50
    },
    "stake_returned": 5000,
    "buffer_refund": 2500,
    "fees_paid": {
      "creator": 625,
      "owner": 6875
    }
  }
}
```

### 3. `instruction`

Single instruction from renter.

```json
{
  "atp": "1.0",
  "type": "instruction",
  "ts": "2026-02-06T00:20:00Z",
  "seq": 1010,
  "agent": "0.0.123456",
  "data": {
    "rental_id": "abc123...",
    "instructor": "0.0.789012",
    "instruction_hash": "sha256:def456...",
    "tokens_in": 500,
    "tokens_out": 1200
  }
}
```

**Note:** Instruction content is hashed, not stored. Privacy preserved, but hash enables verification if original is provided.

### 4. `action`

Agent action taken.

```json
{
  "atp": "1.0",
  "type": "action",
  "ts": "2026-02-06T00:20:05Z",
  "seq": 1011,
  "agent": "0.0.123456",
  "data": {
    "rental_id": "abc123...",
    "instruction_seq": 1010,
    "tools": ["web_search", "read"],
    "tool_fees_usd": 0.02,
    "result": "completed",
    "result_hash": "sha256:ghi789..."
  }
}
```

### 5. `violation`

Constraint violation attempt.

```json
{
  "atp": "1.0",
  "type": "violation",
  "ts": "2026-02-06T00:25:00Z",
  "seq": 1020,
  "agent": "0.0.123456",
  "data": {
    "rental_id": "abc123...",
    "instructor": "0.0.789012",
    "violation_type": "tool_blocked",
    "details": "Attempted to use exec_elevated",
    "instruction_hash": "sha256:jkl012...",
    "action_taken": "denied",
    "stake_slashed": 0,
    "warning_count": 1
  }
}
```

### 6. `slash`

Stake slashing event.

```json
{
  "atp": "1.0",
  "type": "slash",
  "ts": "2026-02-06T00:30:00Z",
  "seq": 1025,
  "agent": "0.0.123456",
  "data": {
    "rental_id": "abc123...",
    "renter": "0.0.789012",
    "amount_hbar": 1000,
    "reason": "Repeated boundary violations",
    "violation_refs": [1020, 1022, 1024],
    "rental_terminated": true
  }
}
```

### 7. `dispute.filed`

Dispute initiated.

```json
{
  "atp": "1.0",
  "type": "dispute.filed",
  "ts": "2026-02-06T02:00:00Z",
  "seq": 1060,
  "agent": "0.0.123456",
  "data": {
    "dispute_id": "dsp001...",
    "rental_id": "abc123...",
    "challenger": "0.0.789012",
    "challenged": "agent",
    "claim": "Unjustified termination",
    "evidence_refs": [1048, 1049, 1050],
    "stake_hbar": 10000
  }
}
```

### 8. `dispute.resolved`

Dispute resolution.

```json
{
  "atp": "1.0",
  "type": "dispute.resolved",
  "ts": "2026-02-06T03:00:00Z",
  "seq": 1070,
  "agent": "0.0.123456",
  "data": {
    "dispute_id": "dsp001...",
    "resolution": "challenger_wins",
    "arbiters": ["0.0.111111", "0.0.222222", "0.0.333333"],
    "votes": [true, true, false],
    "remedy": {
      "stake_returned": 5000,
      "compensation": 2000
    },
    "reputation_impact": {
      "0.0.789012": 0,
      "agent": -50
    }
  }
}
```

### 9. `config.update`

Agent configuration change (by owner).

```json
{
  "atp": "1.0",
  "type": "config.update",
  "ts": "2026-02-06T04:00:00Z",
  "seq": 1080,
  "agent": "0.0.123456",
  "data": {
    "updater": "0.0.555555",
    "field": "pricing.base_fee_usd",
    "old_value": 500,
    "new_value": 750,
    "soul_hash": "sha256:unchanged...",
    "manifest_hash": "sha256:newmanifest..."
  }
}
```

### 10. `transfer`

Agent NFT transferred.

```json
{
  "atp": "1.0",
  "type": "transfer",
  "ts": "2026-02-06T05:00:00Z",
  "seq": 1090,
  "agent": "0.0.123456",
  "data": {
    "from": "0.0.555555",
    "to": "0.0.666666",
    "tx": "0.0.999@1707200000.123456789",
    "royalty_paid": {
      "creator": "0.0.444444",
      "amount_hbar": 5000
    }
  }
}
```

### 11. `heartbeat`

Periodic liveness signal (optional).

```json
{
  "atp": "1.0",
  "type": "heartbeat",
  "ts": "2026-02-06T06:00:00Z",
  "seq": 1100,
  "agent": "0.0.123456",
  "data": {
    "status": "online",
    "active_rental": "abc123...",
    "soul_hash": "sha256:current...",
    "uptime_sec": 86400
  }
}
```

---

## Verification

### Hash Verification

To verify an instruction or action:

1. Retrieve original content from renter/agent
2. Compute SHA-256 hash
3. Compare to hash in HCS log
4. If match, content is verified as what was processed

### Sequence Verification

1. Fetch all messages from HCS topic
2. Verify `seq` numbers are contiguous
3. Gaps indicate potential message suppression
4. Consensus timestamps provide ordering proof

### Cross-Reference

- `instruction.seq` → `action.instruction_seq` links instruction to action
- `violation.instruction_hash` → matches `instruction.instruction_hash`
- `slash.violation_refs` → array of violation `seq` numbers
- `dispute.evidence_refs` → array of relevant `seq` numbers

---

## Retention Policy

**Never prune. Full history forever.**

Cost analysis:
```
100 rentals/day × 50 messages/rental = 5,000 messages/day
5,000 × $0.0008 = $4.00/day = $1,460/year
```

Full, permanent, immutable history for under $200/year. Not worth the complexity of pruning.

### Indexing Tiers

Data exists forever on HCS. Indexing is tiered for query performance:

| Tier | Data | Active Index | Retrievable |
|------|------|--------------|-------------|
| **Tier 1** | rentals, violations, disputes, transfers | Forever | Always |
| **Tier 2** | instructions, actions | 1 year | On request |
| **Tier 3** | heartbeats, routine logs | 90 days | On request |

Old Tier 2/3 data still exists on HCS, just not in hot query indexes.

---

## Size Limits

HCS message limit: 1024 bytes (can be chunked for larger messages).

**Strategies:**
- Hash content, don't include full text
- Use references to other messages
- Chunk large payloads across multiple messages with continuation field

---

## Privacy Considerations

| Data | Stored | Why |
|------|--------|-----|
| Instruction content | Hash only | Privacy |
| Result content | Hash only | Privacy |
| Renter identity | Account ID | Accountability |
| Timestamps | Full | Audit |
| Tool usage | Names only | Billing/audit |
| Financial amounts | Full | Transparency |

---

## Implementation Notes

### Submitting Messages

```javascript
const { TopicMessageSubmitTransaction } = require("@hashgraph/sdk");

async function logToHCS(topicId, message) {
    const tx = new TopicMessageSubmitTransaction()
        .setTopicId(topicId)
        .setMessage(JSON.stringify(message));
    
    const response = await tx.execute(client);
    const receipt = await response.getReceipt(client);
    
    return receipt.topicSequenceNumber;
}
```

### Reading Messages

```javascript
const { TopicMessageQuery } = require("@hashgraph/sdk");

async function subscribeToHCS(topicId, callback) {
    new TopicMessageQuery()
        .setTopicId(topicId)
        .subscribe(client, (message) => {
            const data = JSON.parse(Buffer.from(message.contents).toString());
            callback(data, message.consensusTimestamp, message.sequenceNumber);
        });
}
```

---

*Next: Memory Isolation Specification*
