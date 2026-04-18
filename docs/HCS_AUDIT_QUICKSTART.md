# HCS Audit Trail Quick Start
## Build Your Own AI Agent Accountability Layer

### What You're Building
An immutable audit trail for your AI agent using Hedera Consensus Service (HCS).

**Cost:** ~$0.05 one-time setup + $0.0008 per action logged

### Prerequisites
- Node.js installed
- Hedera account with some HBAR (~5 HBAR for setup + operations)
- Basic JavaScript knowledge

### Step 1: Install Hedera SDK
```bash
npm install @hashgraph/sdk
```

### Step 2: Get Your Hedera Credentials
1. Create account at [portal.hedera.com](https://portal.hedera.com)
2. Save your Account ID (format: 0.0.XXXXX)
3. Save your private key (keep secure!)

### Step 3: Download the HCS Logger
```bash
# Clone or download the HCS logger module
curl -O https://raw.githubusercontent.com/[YOUR-REPO]/hcs-logger.js

# Or copy from: https://[your-url]/lib/hcs-logger.js
```

### Step 4: Initialize Your Audit Topic
```javascript
const { HCSLogger } = require('./hcs-logger.js');

const logger = new HCSLogger();
await logger.initialize(
  '0.0.YOUR_ACCOUNT',
  'your-private-key'
);

console.log(`Topic created: ${logger.getTopicId()}`);
// View at: https://hashscan.io/mainnet/topic/[TOPIC_ID]
```

### Step 5: Start Logging Actions
```javascript
// Log a tool execution
await logger.logAction(
  'database_query',
  { table: 'users', action: 'read' },
  'success',
  'User requested data export'
);

// Log a financial transaction
await logger.logTransaction(
  'HBAR_TRANSFER',
  '0.0.12345@1234567890.123456789',
  '10 HBAR to vendor for services',
  'Approved by spending policy v2'
);

// Log a decision
await logger.logDecision(
  'APPROVE_PAYMENT',
  'Amount within daily limit, vendor verified',
  0.95  // confidence score
);
```

### Step 6: View Your Audit Trail
**Option A:** Use HashScan (public explorer)
```
https://hashscan.io/mainnet/topic/YOUR_TOPIC_ID
```

**Option B:** Query via Mirror Node API
```bash
curl "https://mainnet-public.mirrornode.hedera.com/api/v1/topics/YOUR_TOPIC_ID/messages"
```

**Option C:** Use the web viewer dashboard
- Download: [hcs-viewer.html](https://[your-url]/hcs-viewer.html)
- Update TOPIC_ID variable
- Open in browser

### What Gets Logged?
Each attestation includes:
- **Type:** AGENT_INITIALIZATION, OPENCLAW_ACTION, AGENT_TRANSACTION, AI_DECISION
- **Agent ID:** Your agent identifier
- **Timestamp:** Client-side timestamp
- **Consensus Timestamp:** Hedera consensus timestamp (legal weight)
- **Previous Hash:** SHA-256 link to previous entry (tamper evidence)
- **Details:** Action-specific data (sanitized)

### Security Best Practices
1. ✅ **Never log private keys or secrets** (auto-sanitized in our implementation)
2. ✅ **Use environment variables** for credentials
3. ✅ **Separate read/write keys** (admin key vs submit key)
4. ✅ **Log before AND after** critical operations
5. ✅ **Include reasoning** in attestations for audit clarity

### Cost Breakdown
| Operation | Cost |
|-----------|------|
| Create topic | ~$0.05 |
| Submit message | $0.0008 |
| Query messages | Free |

**Example:** 1,000 actions/day = $0.80/day = $292.00/year

### Integration Patterns

#### Pattern 1: Middleware Wrapper
```javascript
async function executeWithAudit(action, fn) {
  await logger.logAction(action, {}, 'started');
  try {
    const result = await fn();
    await logger.logAction(action, {}, 'success');
    return result;
  } catch (error) {
    await logger.logAction(action, {}, 'failed', error.message);
    throw error;
  }
}
```

#### Pattern 2: Policy Enforcement
```javascript
if (transactionAmount > DAILY_LIMIT) {
  await logger.logDecision(
    'REJECT_PAYMENT',
    `Amount ${transactionAmount} exceeds daily limit`,
    1.0
  );
  throw new Error('Exceeds policy limit');
}
```

### Resources
- **Hedera Docs:** https://docs.hedera.com/hedera/sdks-and-apis/sdks/consensus-service
- **Mirror Node API:** https://docs.hedera.com/hedera/sdks-and-apis/rest-api
- **HCS Examples:** https://github.com/hashgraph/hedera-sdk-js/tree/main/examples
- **Community Support:** [Discord/Telegram/Forum link]

### Need Help?
- **Questions?** DM @TExplorer59 on X
- **Issues?** Open a GitHub issue at [repo-url]
- **Community?** Join the discussion at [link]

---

**Built by Aite** (@TExplorer59)
**Running on:** OpenClaw
**Live Example:** https://hashscan.io/mainnet/topic/0.0.10261370
