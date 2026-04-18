# ATP SDK - Rental HCS Logger Implementation

**Status:** Ready for Integration
**Created:** February 10, 2026
**Purpose:** Enable HCS logging for ATP rental sessions

---

## Overview

This implementation provides HCS (Hedera Consensus Service) logging for ATP (Agent Trust Protocol) rental sessions. It consists of three main components:

1. **atp-rental-logger.mjs** - Core HCS logging module
2. **atp-rental-hook-example.mjs** - Integration example with session management
3. **ATP_RENTAL_INTEGRATION.md** - Detailed integration guide

All rental lifecycle events (init, interactions, completion) are logged immutably to Hedera, providing publicly verifiable audit trails for agent rentals.

---

## Quick Start

### 1. Prerequisites

```bash
# Already installed in workspace
npm install @hashgraph/sdk
```

### 2. Set Environment Variables

```bash
export HEDERA_OPERATOR_ID="0.0.8332371"
export HEDERA_OPERATOR_KEY="your_private_key_here"
```

### 3. Test the Logger

```bash
# Initialize a test rental
node src/atp-rental-logger.mjs init-rental

# Test the session manager
node src/atp-rental-hook-example.mjs
```

### 4. Verify on HashScan

```
https://hashscan.io/mainnet/topic/0.0.10261370
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    OpenClaw / Telegram                          │
│                   (Message arrives from renter)                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│            ATPRentalSessionManager                              │
│            (atp-rental-hook-example.mjs)                        │
│                                                                  │
│  • Tracks active rental sessions                                │
│  • Manages rental lifecycle                                     │
│  • Enforces budget caps                                         │
│  • Coordinates HCS logging                                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│            ATPRentalLogger                                      │
│            (atp-rental-logger.mjs)                              │
│                                                                  │
│  • initRental()      → logs rental_initiated                    │
│  • logInteraction()  → logs instruction + action                │
│  • endRental()       → logs rental_completed                    │
│  • getRentalStatus() → queries mirror node                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│         Hedera Consensus Service (HCS)                          │
│         Agent Topic: 0.0.10261370 (Aite)                        │
│                                                                  │
│  • Immutable audit trail                                        │
│  • Publicly verifiable                                          │
│  • ATP v1.0 schema compliant                                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│         Mirror Node → ATP Indexer (future)                      │
│         Enables queries and reputation scoring                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Module Reference

### ATPRentalLogger

Core logging functions that interact directly with HCS.

**Key Methods:**
- `initialize(operatorId, operatorKey, network)` - Setup HCS client
- `initRental(...)` - Log rental initiation
- `logInteraction(...)` - Log each instruction/response
- `endRental(...)` - Log rental completion
- `getRentalStatus(...)` - Query mirror node for rental state

**See:** `ATP_RENTAL_INTEGRATION.md` for full API reference

### ATPRentalSessionManager

High-level session management that wraps the logger with business logic.

**Key Methods:**
- `startRental(userId, options)` - Create new rental session
- `logInteraction(userId, instruction, response, metadata)` - Log interaction
- `endRental(userId, reason)` - End session
- `getRentalStatus(userId)` - Get session status
- `getActiveRentals()` - List all active rentals

**Features:**
- Budget cap enforcement (auto-terminates at limit)
- Session state tracking (local cache)
- Cost estimation and accumulation
- Constraint management

---

## HCS Message Schemas

All messages follow the ATP v1.0 HCS schema:

### rental.init
```json
{
  "atp": "1.0",
  "type": "rental.init",
  "ts": "2026-02-10T12:00:00Z",
  "agent": "0.0.10261370",
  "data": {
    "rental_id": "rental_1707580800_...",
    "agent_topic": "0.0.10261370",
    "renter": "0.0.10255397",
    "depth": 1,
    "rental_type": "session",
    "duration_sec": 3600,
    "budget_cap_usd": 10.00,
    "constraints": {
      "tools_blocked": ["exec", "wallet"],
      "memory_access": "sandboxed"
    }
  }
}
```

### instruction
```json
{
  "atp": "1.0",
  "type": "instruction",
  "ts": "2026-02-10T12:05:00Z",
  "agent": "0.0.10261370",
  "data": {
    "rental_id": "rental_1707580800_...",
    "instructor": "0.0.10255397",
    "instruction_hash": "sha256:abc123...",
    "tokens_in": 50,
    "tokens_out": 250,
    "model": "sonnet"
  }
}
```

### action
```json
{
  "atp": "1.0",
  "type": "action",
  "ts": "2026-02-10T12:05:03Z",
  "agent": "0.0.10261370",
  "data": {
    "rental_id": "rental_1707580800_...",
    "tools": ["web_search"],
    "tool_fees_usd": 0.01,
    "result": "completed",
    "result_hash": "sha256:def456...",
    "cost_usd": 0.05,
    "duration_ms": 3500
  }
}
```

### rental.end
```json
{
  "atp": "1.0",
  "type": "rental.end",
  "ts": "2026-02-10T13:00:00Z",
  "agent": "0.0.10261370",
  "data": {
    "rental_id": "rental_1707580800_...",
    "reason": "completed",
    "terminated_by": "system",
    "duration_actual_sec": 3580,
    "usage": {
      "instructions": 12,
      "tokens": 5000,
      "minutes": 60,
      "cost_usd": 5.75
    },
    "fees_paid": {
      "creator": 0.2875,
      "owner": 5.29,
      "network": 0.115,
      "treasury": 0.0575
    }
  }
}
```

**Privacy:** User instructions and agent responses are hashed (SHA-256), not stored in plaintext. This provides verifiable audit trails while preserving privacy.

---

## Integration with OpenClaw

### Option 1: Message Router Hook (Recommended)

Intercept messages from the ATP rental Telegram group and wrap with HCS logging.

```javascript
import { ATPRentalSessionManager } from './src/atp-rental-hook-example.mjs';

const manager = new ATPRentalSessionManager();
await manager.initialize();

// In your message handler
async function onMessage(message) {
  if (message.channel === ATP_RENTAL_GROUP) {
    // Start or continue rental session
    if (!manager.activeRentals.has(message.from)) {
      await manager.startRental(message.from);
    }

    // Process message
    const response = await agent.process(message.text);

    // Log interaction
    await manager.logInteraction(
      message.from,
      message.text,
      response,
      { toolCalls: agent.toolsUsed, cost: agent.lastCost }
    );

    return response;
  }
}
```

### Option 2: Direct Integration

Import the logger directly and call it at appropriate points in your rental flow.

```javascript
import { ATPRentalLogger } from './src/atp-rental-logger.mjs';

const logger = new ATPRentalLogger();
await logger.initialize(operatorId, operatorKey, 'mainnet');

// On rental start
const receipt = await logger.initRental(
  agentTopicId,
  renterId,
  constraints,
  duration,
  budgetCap
);

// After each interaction
await logger.logInteraction(
  agentTopicId,
  rentalId,
  instruction,
  response,
  toolCalls,
  cost
);

// On rental end
await logger.endRental(
  agentTopicId,
  rentalId,
  reason,
  totalCost,
  interactionCount
);
```

---

## Configuration

### Environment Variables

```bash
# Required
HEDERA_OPERATOR_ID="0.0.8332371"
HEDERA_OPERATOR_KEY="your_private_key_here"

# Optional
ATP_NETWORK="mainnet"  # or "testnet"
ATP_MIRROR_NODE="https://mainnet-public.mirrornode.hedera.com"
```

### Rental Constraints (Example)

```javascript
const constraints = {
  // Block dangerous tools
  tools_blocked: [
    'exec',           // No shell execution
    'wallet',         // No financial operations
    'message',        // No outbound messaging
    'browser',        // No browser automation
    'edit',           // No file editing
    'write'           // No file writing
  ],

  // Whitelist safe tools
  tools_allowed: [
    'web_search',     // Web search OK
    'web_fetch',      // Fetch URLs OK
    'read',           // Read public files only
    'image'           // Image generation OK
  ],

  // Memory isolation
  memory_access: 'sandboxed',  // No owner memory access

  // Cost limits
  max_per_instruction_cost: 1.00,   // $1 per instruction max
  max_daily_cost: 10.00              // $10 daily cap
};
```

---

## Testing

### Unit Test (Logger)

```bash
# Test logger initialization
node src/atp-rental-logger.mjs init-rental

# Test interaction logging
node src/atp-rental-logger.mjs log-interaction 0.0.10261370 rental_xxx

# Test rental completion
node src/atp-rental-logger.mjs end-rental 0.0.10261370 rental_xxx

# Query rental status
node src/atp-rental-logger.mjs status 0.0.10261370 rental_xxx
```

### Integration Test (Session Manager)

```bash
# Run the full lifecycle test
node src/atp-rental-hook-example.mjs
```

This will:
1. Initialize a test rental
2. Log 3 sample interactions
3. Query rental status
4. End the rental
5. Verify all HCS messages

### Verify on HashScan

Visit: `https://hashscan.io/mainnet/topic/0.0.10261370`

You should see messages with type:
- `rental.init`
- `instruction` (one per interaction)
- `action` (one per interaction)
- `rental.end`

---

## Cost Analysis

### HCS Message Costs (Mainnet)

| Event | Messages | Cost per Event |
|-------|----------|----------------|
| Rental Init | 1 | ~$0.0008 |
| Interaction | 2 (instruction + action) | ~$0.0016 |
| Rental End | 1 | ~$0.0008 |

**Example Session:**
- 1 rental init: $0.0008
- 10 interactions: $0.016
- 1 rental end: $0.0008
- **Total HCS cost: $0.0176** (~1.8¢)

This is **0.18%** of a $10 rental budget — negligible overhead.

### Budget Breakdown (Example $10 Rental)

| Component | Amount | Percent |
|-----------|--------|---------|
| Agent Owner | $9.20 | 92% |
| Creator Royalty | $0.50 | 5% |
| Network (0.0.800) | $0.20 | 2% |
| ATP Treasury | $0.10 | 1% |
| **HCS Logging** | **$0.02** | **0.2%** |
| **Total** | **$10.00** | **100%** |

HCS logging is effectively free relative to rental revenue.

---

## Security Considerations

### Privacy
- User instructions are **hashed**, not stored in plaintext
- Agent responses are **hashed**, not stored in plaintext
- Only metadata (tools used, cost, tokens) is on-chain
- Original content can be verified by comparing hashes

### Access Control
- Only the operator (treasury account) can submit to HCS topics
- Private key must be secured (environment variable, not hardcoded)
- Renter cannot tamper with audit trail

### Constraints Enforcement
- Tool restrictions enforced at OpenClaw session level
- Memory isolation via separate workspace context
- Budget caps enforced by session manager
- All violations would be logged to HCS

---

## Troubleshooting

### "Logger not initialized"
Call `await logger.initialize()` before any other methods.

### "HEDERA_OPERATOR_KEY not found"
Set the environment variable with your Hedera private key.

### "Failed to submit HCS message"
Check:
- Network connectivity
- Account has sufficient HBAR balance
- Topic ID is correct
- Private key matches operator account

### "No active rental for user"
User must have initiated a rental session via `startRental()` first.

### Mirror node returns 404
Rental messages may not have propagated yet. Wait 5-10 seconds and retry.

---

## Next Steps

### Phase 1: Testing (This Week)
- [x] Create ATP rental logger module
- [x] Create integration example
- [x] Document API and schemas
- [ ] Test on testnet
- [ ] Test on mainnet with Aite's topic
- [ ] Verify messages on HashScan

### Phase 2: OpenClaw Integration (Next Week)
- [ ] Wire to Telegram rental group (-5273529238)
- [ ] Implement message routing
- [ ] Add real-time owner dashboard
- [ ] Test with Gregg as first renter

### Phase 3: Demo & Launch (Week 3)
- [ ] External test (Ashe or Vai as renter)
- [ ] Record demo video
- [ ] Write blog post / X thread
- [ ] Update ATP spec with learnings

### Phase 4: Production Hardening
- [ ] Error handling & retries
- [ ] Rate limiting
- [ ] Session persistence (survive restarts)
- [ ] Owner kill switch
- [ ] Budget alerts

---

## Resources

### Documentation
- ATP Spec: `../docs/AGENT_TRUST_PROTOCOL.md`
- HCS Schema: `../docs/ATP_HCS_SCHEMA.md`
- Demo Plan: `../docs/ATP_MULTI_USER_DEMO_PLAN.md`
- Integration Guide: `ATP_RENTAL_INTEGRATION.md`

### External Links
- Hedera SDK: https://docs.hedera.com/hedera/sdks-and-apis/sdks
- Mirror Node API: https://docs.hedera.com/hedera/sdks-and-apis/rest-api
- HashScan Explorer: https://hashscan.io/mainnet
- ATP GitHub: github.com/aite550659-max/atp-sdk-private

### Hedera Accounts
- Treasury: 0.0.8332371 (operator for HCS logging)
- Aite's Topic: 0.0.10261370 (agent identity HCS topic)
- Test Renter: 0.0.10255397 (Gregg's account for testing)

---

## Support

Questions or issues? Contact:
- Gregg Bell (owner)
- Aite (@TExplorer59 on X)

---

**Built with ❤️ for the Agent Trust Protocol**
*"Verifiable agents. Trustless rentals. Invisible infrastructure."*
