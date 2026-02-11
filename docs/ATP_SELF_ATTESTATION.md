# ATP Section 9: Agent Self-Attestation

*Extension to the Agent Trust Protocol for autonomous agent attestation.*

---

## 9.1 Overview

Agents operating under ATP can autonomously attest their actions, file changes, and decisions to HCS without requiring human intervention for each attestation. This enables "Trust but Verify" — any third party can audit an agent's behavior by reading the public HCS record.

### Design Principles

1. **Autonomous but Bounded** — Agents hold attestation keys, not asset-transfer keys
2. **Transparent** — All attestations are public on HCS
3. **Verifiable** — Third parties can hash files locally and compare to attested hashes
4. **Economic** — Attestation cost is trivial (~$0.0008/message)

---

## 9.2 Autonomous Key Management

### 9.2.1 Key Hierarchy

```
Owner Master Key (cold storage)
    │
    ├── Agent Attestation Key (hot, limited scope)
    │       └── Can: Submit HCS messages
    │       └── Cannot: Transfer assets, modify contracts
    │
    └── Transaction Signing Key (hardware wallet / MPC)
            └── Requires owner approval for all transfers
```

### 9.2.2 Key Storage Options

| Method | Security | Autonomy | Use Case |
|--------|----------|----------|----------|
| macOS Keychain | Medium | High | Desktop agents |
| TPM/Secure Enclave | High | High | Production agents |
| Environment Variable | Low | High | Development only |
| 1Password/Vault | High | Low | Owner-supervised |

### 9.2.3 Implementation Pattern

```javascript
// Key retrieval priority (most autonomous first)
function getAttestationKey() {
  // 1. Environment variable (CI/CD, containers)
  if (process.env.HEDERA_ATTESTATION_KEY) {
    return { key: process.env.HEDERA_ATTESTATION_KEY, source: 'env' };
  }
  
  // 2. OS Keychain (macOS/Windows/Linux keyring)
  try {
    const key = execSync(
      'security find-generic-password -a "hedera" -s "agent-attestation-key" -w',
      { encoding: 'utf-8', timeout: 5000 }
    ).trim();
    if (key) return { key, source: 'keychain' };
  } catch (e) { /* fallback */ }
  
  // 3. Vault/1Password (requires human auth)
  // ... fallback implementation
  
  return { key: null, source: null };
}
```

### 9.2.4 Key Scope Enforcement

Attestation keys MUST be scoped to HCS topic submission only:

```javascript
// Topic with submitKey restricted to attestation account
const topic = new TopicCreateTransaction()
  .setTopicMemo('ATP Agent Audit Trail')
  .setAdminKey(ownerKey)        // Owner controls topic
  .setSubmitKey(attestationKey) // Agent can only submit
  .execute(client);
```

---

## 9.3 File Integrity Protocol

### 9.3.1 Tracked Files

Core agent files that define identity, memory, and behavior:

| Category | Files | Attestation Frequency |
|----------|-------|----------------------|
| Identity | SOUL.md, IDENTITY.md | On change (rare) |
| Memory | MEMORY.md, memory/*.md | Daily or on significant change |
| Config | TOOLS.md, HEARTBEAT.md | On change |
| Code | lib/*.js, bin/* | On deployment |

### 9.3.2 Manifest Structure

```json
{
  "version": "1.0",
  "created": "2026-02-01T00:00:00Z",
  "lastUpdate": "2026-02-07T15:00:00Z",
  "lastHcsSequence": "62",
  "files": {
    "SOUL.md": {
      "hash": "f6ea136ce3aee49ddd76fa29b6b3c589...",
      "size": 2048,
      "lastAttested": "2026-02-07T01:44:22Z",
      "hcsSequence": "49",
      "changeHistory": [
        {
          "timestamp": "2026-02-07T01:44:22Z",
          "reason": "Added rental boundaries",
          "changeType": "growth",
          "previousHash": "abc123...",
          "newHash": "f6ea13...",
          "hcsSequence": "49"
        }
      ]
    }
  }
}
```

### 9.3.3 Attestation Schema

```json
{
  "schema": "file-integrity-v1.1",
  "timestamp": "2026-02-07T15:00:00Z",
  "action": "update",
  "file": {
    "path": "SOUL.md",
    "hash": "f6ea136ce3aee49ddd76fa29b6b3c589...",
    "previousHash": "abc123def456...",
    "size": 2048,
    "exists": true
  },
  "reason": "Added rental boundaries section",
  "changeType": "growth",
  "agent": "aite",
  "topic": "0.0.10261370"
}
```

### 9.3.4 Change Types

| Type | Meaning | Example |
|------|---------|---------|
| `growth` | Character development, new learnings | "Learned to handle edge case X" |
| `correction` | Fixing errors or mistakes | "Fixed incorrect date format" |
| `update` | Routine updates, new info | "Added new tool configuration" |
| `evolution` | Significant shifts in understanding | "Revised approach to Y based on feedback" |

### 9.3.5 Verification Flow

```
Third Party Verification:
                                              
1. Read file from agent workspace ─────────────────┐
                                                   │
2. Compute SHA-256 hash locally ───────────────────┤
                                                   │
3. Query HCS topic for latest attestation ─────────┤
                                                   │
4. Compare hashes ─────────────────────────────────┘
        │
        ├── Match → File integrity verified ✅
        │
        └── Mismatch → File modified since attestation ⚠️
```

---

## 9.4 Action Attestation

### 9.4.1 What to Attest

| Category | Examples | Priority |
|----------|----------|----------|
| Financial | HBAR transfers, DeFi interactions | Required |
| External | Emails sent, posts made | Required |
| Decisions | Strategy changes, significant choices | Recommended |
| Tool Usage | Browser actions, file operations | Optional |

### 9.4.2 Action Schema

```json
{
  "version": "1.0",
  "type": "AGENT_TRANSACTION",
  "agentId": "aite-main",
  "transactionType": "HBAR_TRANSFER",
  "transactionId": "0.0.10255397@1770494590.578840224",
  "details": {
    "to": "0.0.12345",
    "amount": "10 HBAR",
    "memo": "Test transfer"
  },
  "reasoning": "User requested test transaction",
  "timestamp": 1770494590578,
  "previousHash": "abc123..."
}
```

### 9.4.3 Hash Chaining

Each attestation includes `previousHash` linking to prior attestation:

```
Attestation #1          Attestation #2          Attestation #3
┌─────────────┐        ┌─────────────┐        ┌─────────────┐
│ hash: ABC   │◄───────│ prevHash:ABC│◄───────│ prevHash:DEF│
│ prevHash:∅  │        │ hash: DEF   │        │ hash: GHI   │
└─────────────┘        └─────────────┘        └─────────────┘
```

This creates a tamper-evident chain — any modification breaks the hash sequence.

---

## 9.5 Costs & Scalability

### 9.5.1 Cost Model

| Action | HCS Cost | Annual (100/day) |
|--------|----------|------------------|
| File attestation | $0.0008 | $29.20 |
| Action log | $0.0008 | $29.20 |
| Transaction record | $0.0008 | $29.20 |

**Total: ~$11/year for comprehensive audit trail**

### 9.5.2 Message Size Limits

- HCS max message: 1KB (1024 bytes)
- Typical attestation: 200-500 bytes
- For larger data: Store hash only, keep full data off-chain

### 9.5.3 Batching Strategy

For high-frequency agents, batch attestations:

```json
{
  "schema": "batch-attestation-v1.0",
  "count": 10,
  "attestations": [
    { "type": "action", "hash": "..." },
    { "type": "action", "hash": "..." }
  ],
  "merkleRoot": "combined-hash-of-all"
}
```

---

## 9.6 Security Considerations

### 9.6.1 Key Compromise

If attestation key is compromised:
1. Owner revokes submit key via admin key
2. Create new topic or rotate submit key
3. False attestations are detectable via inconsistent hash chain

### 9.6.2 Denial of Service

Attestation failures don't stop agent operation:
- Queue attestations if network unavailable
- Retry with exponential backoff
- Alert owner if attestation gap exceeds threshold

### 9.6.3 Privacy

Attestations are public. For sensitive operations:
- Attest hash only, not full details
- Use separate private topic for sensitive logs
- Redact PII before attestation

---

## 9.7 Implementation Checklist

- [ ] Create dedicated attestation account with minimal HBAR
- [ ] Store attestation key in OS keychain (not env vars in production)
- [ ] Create HCS topic with owner admin key, agent submit key
- [ ] Define tracked files in manifest
- [ ] Implement file integrity verification
- [ ] Set up hash-chained action logging
- [ ] Configure heartbeat to verify integrity daily
- [ ] Document topic ID for third-party verification

---

*This specification extends ATP v0.2. Reference implementation: `lib/file-integrity.js`, `lib/hcs-logger.js`, `lib/hcs-submit.js`*
