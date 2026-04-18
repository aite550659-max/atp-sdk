# ATP Rental Integration Guide

**Purpose:** Wire the ATP SDK rental logger to OpenClaw for the ATP rental demo

**Created:** February 10, 2026
**Status:** Ready for integration

---

## Overview

This integration enables OpenClaw to log rental session events to Hedera Consensus Service (HCS) following the Agent Trust Protocol v1.0 specification. All rental interactions become immutably recorded and publicly verifiable on Hedera.

## Architecture

```
Telegram Message (Renter in ATP Rental Group)
  ↓
OpenClaw Message Router
  ↓
ATP Rental Session Detection
  ↓
┌─────────────────────────────────────┐
│  ATP Rental Logger                  │
│  (src/atp-rental-logger.mjs)       │
├─────────────────────────────────────┤
│  • initRental()                     │
│  • logInteraction()                 │
│  • endRental()                      │
│  • getRentalStatus()                │
└─────────────────────────────────────┘
  ↓
Hedera Consensus Service (HCS)
  ↓
Agent's HCS Topic (e.g., 0.0.YYYYYY)
  ↓
Mirror Node → ATP Indexer (future) → REST API
```

---

## Module API

### `ATPRentalLogger`

#### `initialize(operatorId, operatorKey, network)`
Initialize the HCS client.

**Parameters:**
- `operatorId` (string) - Hedera account ID (e.g., "0.0.8332371")
- `operatorKey` (string) - Private key (ECDSA, from env var)
- `network` (string) - "mainnet" or "testnet"

**Returns:** `Promise<boolean>`

**Example:**
```javascript
import { ATPRentalLogger } from './src/atp-rental-logger.mjs';

const logger = new ATPRentalLogger();
await logger.initialize(
  process.env.HEDERA_OPERATOR_ID,
  process.env.HEDERA_OPERATOR_KEY,
  'mainnet'
);
```

---

#### `initRental(agentTopicId, renterId, constraints, duration, budgetCap, options)`
Log rental initiation to HCS.

**Parameters:**
- `agentTopicId` (string) - Agent's HCS topic ID (e.g., "0.0.10261370")
- `renterId` (string) - Renter's Hedera account ID
- `constraints` (Object) - Rental constraints
  - `tools_blocked` (Array<string>) - Blocked tools (e.g., ['exec', 'wallet'])
  - `tools_allowed` (Array<string>|null) - Allowed tools (whitelist)
  - `memory_access` (string) - 'sandboxed', 'read_only', or 'full'
  - `topics_blocked` (Array<string>) - Forbidden topics
  - `max_per_instruction_cost` (number|null) - Max cost per instruction
  - `max_daily_cost` (number|null) - Max daily cost
- `duration` (number) - Duration in seconds
- `budgetCap` (number) - Budget cap in USD
- `options` (Object) - Additional options
  - `rental_id` (string) - Custom rental ID (auto-generated if omitted)
  - `rental_type` (string) - 'flash', 'session', or 'term'
  - `agent_nft_id` (string) - NFT token ID if agent is monetized
  - `stake_hbar` (number) - Stake amount in HBAR
  - `buffer_hbar` (number) - Buffer amount in HBAR

**Returns:** `Promise<Object>`
```javascript
{
  rentalId: 'rental_1707580800_a1b2c3d4e5f6g7h8',
  sequenceNumber: 1001,
  transactionId: '0.0.8332371@1707580800.123456789',
  consensusTimestamp: Timestamp,
  topicId: '0.0.10261370'
}
```

**Example:**
```javascript
const receipt = await logger.initRental(
  '0.0.10261370',           // Aite's topic ID
  '0.0.10255397',           // Gregg as renter (for testing)
  {
    tools_blocked: ['exec', 'wallet', 'message'],
    tools_allowed: ['web_search', 'web_fetch', 'read', 'image'],
    memory_access: 'sandboxed',
    topics_blocked: [],
    max_per_instruction_cost: 1.00,
    max_daily_cost: 10.00
  },
  3600,                     // 1 hour
  10.00,                    // $10 budget cap
  {
    rental_type: 'session',
    agent_nft_id: null      // Aite not yet monetized
  }
);

console.log(`Rental ID: ${receipt.rentalId}`);
```

---

#### `logInteraction(topicId, rentalId, instruction, response, toolCalls, cost, options)`
Log a single interaction (instruction + response).

**Parameters:**
- `topicId` (string) - Agent's HCS topic ID
- `rentalId` (string) - Rental session ID
- `instruction` (string) - User instruction (will be hashed)
- `response` (string) - Agent response (will be hashed)
- `toolCalls` (Array<string>) - Tools used (e.g., ['web_search'])
- `cost` (number) - Cost in USD
- `options` (Object) - Additional metadata
  - `instructor` (string) - Instructor account ID
  - `tokens_in` (number) - Input tokens
  - `tokens_out` (number) - Output tokens
  - `model` (string) - Model used (e.g., 'sonnet')
  - `tool_fees` (number) - Tool-specific fees
  - `duration_ms` (number) - Interaction duration

**Returns:** `Promise<Object>`
```javascript
{
  instructionSeq: 1002,
  actionSeq: 1003,
  transactionIds: ['0.0.8332371@...', '0.0.8332371@...']
}
```

**Example:**
```javascript
await logger.logInteraction(
  '0.0.10261370',
  'rental_1707580800_a1b2c3d4e5f6g7h8',
  'Search for latest AI news',
  'Here are the top AI stories from today...',
  ['web_search'],
  0.05,
  {
    instructor: '0.0.10255397',
    tokens_in: 50,
    tokens_out: 250,
    model: 'sonnet',
    duration_ms: 3500
  }
);
```

---

#### `endRental(topicId, rentalId, reason, totalCost, interactionCount, options)`
Log rental completion/termination.

**Parameters:**
- `topicId` (string) - Agent's HCS topic ID
- `rentalId` (string) - Rental session ID
- `reason` (string) - Completion reason
  - `'completed'` - Normal completion
  - `'timeout'` - Duration exceeded
  - `'budget_exceeded'` - Budget cap hit
  - `'terminated'` - Manual termination
  - `'violation'` - Constraint violation
- `totalCost` (number) - Total cost in USD
- `interactionCount` (number) - Number of interactions
- `options` (Object) - Additional metadata
  - `terminated_by` (string) - Who terminated ('renter', 'owner', 'system')
  - `duration_actual` (number) - Actual duration in seconds
  - `total_tokens` (number) - Total tokens used
  - `total_minutes` (number) - Active minutes
  - `stake_returned` (number) - Stake returned (HBAR)
  - `buffer_refund` (number) - Buffer refunded (HBAR)

**Returns:** `Promise<Object>`
```javascript
{
  sequenceNumber: 1050,
  transactionId: '0.0.8332371@...',
  consensusTimestamp: Timestamp
}
```

**Example:**
```javascript
await logger.endRental(
  '0.0.10261370',
  'rental_1707580800_a1b2c3d4e5f6g7h8',
  'completed',
  5.75,
  12,
  {
    terminated_by: 'renter',
    duration_actual: 3580,
    total_tokens: 5000,
    total_minutes: 60,
    stake_returned: 5000,
    buffer_refund: 4250
  }
);
```

---

#### `getRentalStatus(topicId, rentalId, options)`
Query rental status from Hedera Mirror Node.

**Parameters:**
- `topicId` (string) - Agent's HCS topic ID
- `rentalId` (string) - Rental session ID
- `options` (Object) - Query options
  - `mirrorNode` (string) - Mirror node URL (default: mainnet public)

**Returns:** `Promise<Object>`
```javascript
{
  status: 'active' | 'completed' | 'not_found',
  rentalId: 'rental_...',
  topicId: '0.0.10261370',
  messageCount: 25,
  interactions: 10,
  messages: [ /* HCS messages */ ],
  lastUpdate: '2026-02-10T12:00:00Z'
}
```

**Example:**
```javascript
const status = await logger.getRentalStatus(
  '0.0.10261370',
  'rental_1707580800_a1b2c3d4e5f6g7h8'
);

if (status.status === 'active') {
  console.log(`Rental active with ${status.interactions} interactions`);
}
```

---

## OpenClaw Integration

### Option 1: Message Hook (Recommended)

Create a message hook in OpenClaw that intercepts messages from the ATP rental group and wraps them with ATP logging.

**File:** `~/.openclaw/hooks/atp-rental-hook.mjs`

```javascript
import { ATPRentalLogger } from '../workspace/src/atp-rental-logger.mjs';

const logger = new ATPRentalLogger();
let initialized = false;
let activeRentals = new Map(); // rentalId -> session data

export async function onMessageReceived(message, context) {
  // Only process messages from ATP rental group
  const ATP_RENTAL_GROUP = '-5273529238';
  if (message.channel !== ATP_RENTAL_GROUP) {
    return; // Pass through
  }

  // Initialize logger once
  if (!initialized) {
    await logger.initialize(
      process.env.HEDERA_OPERATOR_ID || '0.0.8332371',
      process.env.HEDERA_OPERATOR_KEY,
      'mainnet'
    );
    initialized = true;
  }

  // Check if this is a new rental or continuation
  const userId = message.from;
  let rental = activeRentals.get(userId);

  if (!rental) {
    // New rental - initialize
    const receipt = await logger.initRental(
      '0.0.10261370',  // Aite's topic ID
      mapTelegramToHedera(userId),
      {
        tools_blocked: ['exec', 'wallet', 'message', 'browser'],
        tools_allowed: ['web_search', 'web_fetch', 'read', 'image'],
        memory_access: 'sandboxed'
      },
      3600,   // 1 hour
      10.00   // $10 cap
    );

    rental = {
      rentalId: receipt.rentalId,
      startTime: Date.now(),
      interactions: 0,
      totalCost: 0
    };
    activeRentals.set(userId, rental);
  }

  // Process message through agent
  const startTime = Date.now();
  const response = await context.processMessage(message.text);
  const duration = Date.now() - startTime;

  // Extract metadata
  const toolsUsed = extractToolsUsed(context);
  const cost = calculateCost(context);

  // Log interaction
  await logger.logInteraction(
    '0.0.10261370',
    rental.rentalId,
    message.text,
    response,
    toolsUsed,
    cost,
    {
      instructor: mapTelegramToHedera(userId),
      duration_ms: duration
    }
  );

  rental.interactions++;
  rental.totalCost += cost;

  // Check budget cap
  if (rental.totalCost >= 10.00) {
    await logger.endRental(
      '0.0.10261370',
      rental.rentalId,
      'budget_exceeded',
      rental.totalCost,
      rental.interactions
    );
    activeRentals.delete(userId);
  }

  return response;
}

export async function onSessionEnd(userId) {
  const rental = activeRentals.get(userId);
  if (rental) {
    await logger.endRental(
      '0.0.10261370',
      rental.rentalId,
      'completed',
      rental.totalCost,
      rental.interactions
    );
    activeRentals.delete(userId);
  }
}

// Helper: Map Telegram user to Hedera account
// (For demo, use a test account; production would need proper mapping)
function mapTelegramToHedera(telegramUserId) {
  return '0.0.10255397'; // Placeholder
}

// Helper: Extract tools from context
function extractToolsUsed(context) {
  return context.toolCalls?.map(t => t.name) || [];
}

// Helper: Calculate interaction cost
function calculateCost(context) {
  // Simple cost model - expand as needed
  const tokenCost = (context.tokens?.total || 0) * 0.000005;
  const toolCost = (context.toolCalls?.length || 0) * 0.01;
  return tokenCost + toolCost;
}
```

---

### Option 2: Standalone Service

Run the ATP logger as a standalone service that OpenClaw calls via IPC or HTTP.

**File:** `src/atp-rental-service.mjs`

```javascript
import express from 'express';
import { ATPRentalLogger } from './atp-rental-logger.mjs';

const app = express();
app.use(express.json());

const logger = new ATPRentalLogger();
await logger.initialize(
  process.env.HEDERA_OPERATOR_ID,
  process.env.HEDERA_OPERATOR_KEY,
  'mainnet'
);

app.post('/rental/init', async (req, res) => {
  const { topicId, renterId, constraints, duration, budgetCap, options } = req.body;
  const receipt = await logger.initRental(topicId, renterId, constraints, duration, budgetCap, options);
  res.json(receipt);
});

app.post('/rental/interaction', async (req, res) => {
  const { topicId, rentalId, instruction, response, toolCalls, cost, options } = req.body;
  const receipt = await logger.logInteraction(topicId, rentalId, instruction, response, toolCalls, cost, options);
  res.json(receipt);
});

app.post('/rental/end', async (req, res) => {
  const { topicId, rentalId, reason, totalCost, interactionCount, options } = req.body;
  const receipt = await logger.endRental(topicId, rentalId, reason, totalCost, interactionCount, options);
  res.json(receipt);
});

app.get('/rental/status/:topicId/:rentalId', async (req, res) => {
  const { topicId, rentalId } = req.params;
  const status = await logger.getRentalStatus(topicId, rentalId);
  res.json(status);
});

app.listen(3000, () => {
  console.log('ATP Rental Service listening on port 3000');
});
```

Then from OpenClaw:
```javascript
// Call the service
await fetch('http://localhost:3000/rental/init', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    topicId: '0.0.10261370',
    renterId: '0.0.10255397',
    constraints: { tools_blocked: ['exec', 'wallet'] },
    duration: 3600,
    budgetCap: 10.00
  })
});
```

---

## Environment Variables

Set these in your shell or `.env` file:

```bash
# Required
export HEDERA_OPERATOR_ID="0.0.8332371"
export HEDERA_OPERATOR_KEY="your_private_key_here"

# Optional
export ATP_NETWORK="mainnet"  # or "testnet"
export ATP_MIRROR_NODE="https://mainnet-public.mirrornode.hedera.com"
```

---

## CLI Usage

The module includes a CLI for testing:

```bash
# Initialize a test rental
node src/atp-rental-logger.mjs init-rental 0.0.10261370 0.0.10255397

# Log an interaction
node src/atp-rental-logger.mjs log-interaction 0.0.10261370 rental_xxx

# End a rental
node src/atp-rental-logger.mjs end-rental 0.0.10261370 rental_xxx

# Query status
node src/atp-rental-logger.mjs status 0.0.10261370 rental_xxx
```

---

## Testing Checklist

- [ ] Install dependencies: `npm install @hashgraph/sdk`
- [ ] Set `HEDERA_OPERATOR_KEY` environment variable
- [ ] Test `initRental()` on testnet first
- [ ] Verify HCS messages on HashScan
- [ ] Test `logInteraction()` with sample data
- [ ] Test `endRental()` and verify fee calculations
- [ ] Test `getRentalStatus()` against mirror node
- [ ] Test budget cap enforcement
- [ ] Test constraint violation handling
- [ ] Run full rental lifecycle on mainnet

---

## Next Steps

1. **Test on Testnet** - Run through the full lifecycle with test data
2. **Wire to OpenClaw** - Implement Option 1 (message hook) for the rental group
3. **Create Demo Flow** - Document the user experience from rental to completion
4. **Add Monitoring** - Real-time rental dashboard for owner
5. **Build ATP Indexer** - Ashe's task (separate project)

---

## Resources

- ATP Spec: `docs/AGENT_TRUST_PROTOCOL.md`
- HCS Schema: `docs/ATP_HCS_SCHEMA.md`
- Demo Plan: `docs/ATP_MULTI_USER_DEMO_PLAN.md`
- Hedera SDK: https://docs.hedera.com/hedera/sdks-and-apis/sdks
- Mirror Node API: https://docs.hedera.com/hedera/sdks-and-apis/rest-api

---

**Status:** Module ready for integration. Next: wire to OpenClaw rental session handler.
