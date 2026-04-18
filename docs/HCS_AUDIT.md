# HCS Audit Trail System

## Overview
Immutable audit logging for Aite (OpenClaw) using Hedera Consensus Service (HCS).

**"Trust but Verify"** - Every significant action is attested to a public, tamper-proof ledger.

## Infrastructure

### Topic ID
`0.0.10261370`

**View on HashScan:** https://hashscan.io/mainnet/topic/0.0.10261370

### Admin/Submit Keys
- Controlled by Main Wallet (0.0.10255397)
- Private key stored in 1Password: "Hashpack Private Key"

## Components

### 1. HCS Logger Module
**Location:** `lib/hcs-logger.js`

Core logging library with:
- Structured attestation schema (v1.0)
- Hash-chaining for tamper evidence
- Four attestation types
- Auto-sanitization of sensitive data
- State persistence

**Usage:**
```javascript
const { HCSLogger } = require('./lib/hcs-logger.js');

const logger = new HCSLogger();
await logger.initialize(accountId, privateKey);

// Log an action
await logger.logAction('exec', { command: 'ls' }, 'success', 'User requested');

// Log a transaction
await logger.logTransaction('HBAR_TRANSFER', txId, 'details', 'reasoning');

// Log a decision
await logger.logDecision('APPROVE', 'Within policy limits', 0.95);
```

### 2. CLI Helper
**Location:** `bin/hcs-log`

Quick logging from command line:
```bash
hcs-log action <tool> <result> [reasoning]    # Log tool execution
hcs-log tx <type> <txId> <details>            # Log transaction
hcs-log decision <decision> <reasoning>       # Log AI decision
hcs-log status                                # Show topic status
hcs-log view                                  # View recent logs
```

### 3. Audit Viewer Dashboard
**Location:** `hcs-viewer.html`

Web-based audit trail viewer:
- Real-time mirror node queries
- Timeline visualization
- Color-coded entry types
- Hash chain display
- Auto-refresh (30s)

**Open in browser:** `file:///Users/aite/.openclaw/workspace/hcs-viewer.html`

## Attestation Types

### AGENT_INITIALIZATION
Logs agent startup and configuration.

**Fields:**
- `agentId`: Agent identifier
- `agentName`: Human-readable name
- `platform`: Runtime platform
- `timestamp`: Client timestamp
- `metadata`: Version, account info

### OPENCLAW_ACTION
Logs tool executions (exec, browser, message, etc.)

**Fields:**
- `agentId`: Agent identifier
- `sessionKey`: Session context
- `action.tool`: Tool name
- `action.parameters`: Sanitized parameters
- `action.result`: success/failure
- `reasoning`: Why the action was taken
- `timestamp`: Client timestamp
- `previousHash`: Chain link

### AGENT_TRANSACTION
Logs financial transactions (HBAR, tokens, etc.)

**Fields:**
- `agentId`: Agent identifier
- `transactionType`: Type of transaction
- `transactionId`: Hedera transaction ID
- `details`: Amount, recipients, etc.
- `reasoning`: Authorization rationale
- `timestamp`: Client timestamp
- `previousHash`: Chain link

### AI_DECISION
Logs significant AI reasoning/decisions.

**Fields:**
- `agentId`: Agent identifier
- `decision`: What was decided
- `reasoning`: Why
- `confidence`: Confidence score (0-1)
- `timestamp`: Client timestamp
- `previousHash`: Chain link

## Hash Chaining

Each attestation includes `previousHash` field:
1. Compute SHA-256 of previous attestation JSON
2. Include hash in next attestation
3. Creates tamper-evident chain

**Verification:**
```javascript
const messages = await fetchAllMessages(topicId);
for (let i = 1; i < messages.length; i++) {
  const expectedHash = sha256(messages[i - 1]);
  if (messages[i].previousHash !== expectedHash) {
    console.error('⚠️ Chain broken at sequence', i);
  }
}
```

## State Management

**State File:** `data/hcs-state.json`

Tracks:
- `topicId`: HCS topic ID
- `lastHash`: Most recent attestation hash
- `sequenceNumber`: Current sequence
- `initialized`: Setup complete

## Cost Economics

| Action | HCS Fee | Notes |
|--------|---------|-------|
| Topic creation | ~$0.05 | One-time |
| Message submit | $0.0008 | Per attestation |
| Query messages | Free | Mirror node |

**Estimated costs:**
- 100 actions/day: $0.08/day = $29.20/year
- 1,000 actions/day: $0.10/day = $36.50/year
- 10,000 actions/day: $1.00/day = $365/year

## Security Properties

### Immutability
Once submitted to HCS, messages cannot be altered or deleted (except topic-level deletion by admin key).

### Consensus Timestamps
Mirror nodes provide consensus timestamps with legal weight - provable ordering of events.

### aBFT Security
Asynchronous Byzantine Fault Tolerance - highest level of security against adversaries.

### Public Verifiability
Anyone can query the mirror node and verify the audit trail.

## Integration Examples

### Auto-log Financial Actions
```javascript
async function sendHBAR(recipient, amount) {
  const tx = new TransferTransaction()...;
  const response = await tx.execute(client);
  const receipt = await response.getReceipt(client);

  // Attest to audit log
  await hcsLogger.logTransaction(
    'HBAR_TRANSFER',
    response.transactionId.toString(),
    `${amount} HBAR to ${recipient}`,
    'User authorized payment'
  );

  return receipt;
}
```

### Policy-Based Attestation
```javascript
if (amount > DAILY_LIMIT) {
  await hcsLogger.logDecision(
    'REJECT_PAYMENT',
    `Amount ${amount} exceeds daily limit ${DAILY_LIMIT}`,
    1.0
  );
  throw new Error('Exceeds daily limit');
}
```

## Roadmap

### Phase 1 (Current)
- ✅ Topic creation
- ✅ Core logging module
- ✅ CLI helper
- ✅ Web viewer

### Phase 2 (Next)
- [ ] Auto-logging middleware for OpenClaw tools
- [ ] Policy-based attestation rules
- [ ] Hash chain verification tool
- [ ] Weekly digest reports
- [ ] Alert system for suspicious patterns

### Phase 3 (Future)
- [ ] Multi-agent coordination logging
- [ ] Compliance report generation
- [ ] Advanced analytics dashboard
- [ ] Integration with external audit systems
- [ ] Machine-readable attestation API

## Resources

- **Hedera Docs:** https://docs.hedera.com/hedera/sdks-and-apis/sdks/consensus-service
- **Mirror Node API:** https://docs.hedera.com/hedera/sdks-and-apis/rest-api
- **HashScan Explorer:** https://hashscan.io/mainnet/topic/0.0.10261370
- **AI Trust Attestation:** `/skills/hedera-dev/ai-trust-attestation.md`

---

**Status:** ✅ Production
**Topic ID:** 0.0.10261370
**Current Sequence:** 3
**Last Updated:** 2026-02-03
