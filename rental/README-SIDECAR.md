# ATP Rental Sidecar - HCS Logger

Automated cron job that polls the ATP rental agent's session history and logs new interactions to Hedera Consensus Service (HCS) following the Agent Trust Protocol v1.0 schema.

## Overview

The sidecar runs independently of OpenClaw, reading session transcript files directly from disk and submitting privacy-preserving audit logs to HCS. This enables transparent, immutable logging of all rental agent interactions without requiring integration with the main agent runtime.

## Files

- **`scripts/rental-sidecar.mjs`** - Main sidecar script
- **`rental/hcs-config.json`** - Configuration (topic ID, budget cap, constraints)
- **`rental/hcs-watermark.json`** - Processing state (tracks last processed line)
- **Session transcripts** - `~/.openclaw/agents/atp-rental/sessions/*.jsonl`

## Configuration

### `rental/hcs-config.json`

```json
{
  "hcs_topic_id": "0.0.10272696",
  "network": "mainnet",
  "hedera_operator_id": "0.0.10255397",
  "budget_cap_usd": 10.00,
  "session_timeout_sec": 3600,
  "topic_memo": "ATP Rental Audit Log — Agent Trust Protocol v1.0",
  "default_constraints": { ... }
}
```

### `rental/hcs-watermark.json`

```json
{
  "last_processed_line": 0,
  "last_processed_timestamp": null,
  "rental_id": null,
  "cumulative_cost": 0,
  "interaction_count": 0
}
```

This file is automatically created and updated by the sidecar.

## Usage

### Prerequisites

1. **Hedera Account** with ECDSA key
   - Account ID: `0.0.10255397` (configured in `hcs-config.json`)
   - Private key stored in 1Password as "Hashpack Private Key"

2. **1Password CLI** for secure key retrieval
   ```bash
   # Install if needed
   brew install --cask 1password-cli

   # Sign in (if not already)
   eval $(op signin)
   ```

3. **Node.js** v18+ with ES modules support

### Running Manually

#### Dry Run (Testing)
Test the sidecar without submitting to HCS:

```bash
cd /Users/aite/.openclaw/workspace
DRY_RUN=1 node scripts/rental-sidecar.mjs
```

This will:
- Load configuration
- Parse session files
- Show what *would* be submitted to HCS
- Update the watermark file

#### Live Run (HCS Submission)
Submit actual transactions to HCS:

```bash
cd /Users/aite/.openclaw/workspace
HEDERA_OPERATOR_KEY=$(op read 'op://Personal/Hashpack Private Key/password') \
  node scripts/rental-sidecar.mjs
```

### Setting Up Cron

Run every 5 minutes to log new interactions:

```bash
# Edit crontab
crontab -e

# Add this line:
*/5 * * * * cd /Users/aite/.openclaw/workspace && HEDERA_OPERATOR_KEY=$(op read 'op://Personal/Hashpack Private Key/password' 2>/dev/null) node scripts/rental-sidecar.mjs >> /tmp/rental-sidecar.log 2>&1
```

**Note:** Make sure 1Password CLI is configured to allow background access:
```bash
# Configure 1Password CLI for CLI integration
# Settings > Developer > CLI > Integrate with 1Password CLI
```

### Alternative: Using Hedera Key Directly

If you prefer not to use 1Password, export the key directly:

```bash
# Export key (WARNING: visible in process list)
export HEDERA_OPERATOR_KEY='302e020100300506032b657004220420...'

# Run sidecar
node scripts/rental-sidecar.mjs
```

For production, store the key in a secure secrets manager or environment variable service.

## How It Works

### 1. Session File Discovery
The sidecar finds the most recent session file from:
```
~/.openclaw/agents/atp-rental/sessions/*.jsonl
```

### 2. Interaction Parsing
Reads the JSONL file line-by-line, looking for user/assistant message pairs:
- **User message**: `{ type: "message", message: { role: "user", ... } }`
- **Assistant response**: `{ type: "message", message: { role: "assistant", ... } }`

### 3. Privacy-Preserving Hashing
Both the user prompt and agent response are SHA-256 hashed before submission:
```javascript
instruction_hash: sha256(userPrompt)
response_hash: sha256(agentResponse)
```

### 4. ATP Message Construction
Builds an ATP v1.0 compliant message:
```json
{
  "atp": "1.0",
  "type": "instruction",
  "ts": "2026-02-10T18:17:32.152Z",
  "rental_id": "rental_1770748012_abc123...",
  "data": {
    "instruction_hash": "8ec183575a4e649...",
    "response_hash": "1e4ddf992c15ef7...",
    "tool_calls": ["web_search", "web_fetch"],
    "estimated_cost_usd": 0.018825,
    "cumulative_cost_usd": 0.05489355,
    "model": "claude-sonnet-4-5",
    "tokens_in": 10,
    "tokens_out": 466
  }
}
```

### 5. HCS Submission
Submits the message to the configured HCS topic using `@hashgraph/sdk`:
```javascript
TopicMessageSubmitTransaction()
  .setTopicId(TopicId.fromString('0.0.10272696'))
  .setMessage(JSON.stringify(atpMessage))
  .execute(client)
```

### 6. Watermark Update
Updates `rental/hcs-watermark.json` with:
- Last processed line number
- Last timestamp
- Cumulative cost
- Interaction count

### 7. Budget Cap Enforcement
If `cumulative_cost >= budget_cap_usd`, the sidecar exits without processing further interactions. A warning is logged to stdout.

## Budget Management

The sidecar tracks cumulative costs and enforces the budget cap configured in `hcs-config.json`.

### Resetting Budget
To reset the budget and continue logging:

```bash
# Reset watermark
cat > rental/hcs-watermark.json <<EOF
{
  "last_processed_line": 0,
  "last_processed_timestamp": null,
  "rental_id": null,
  "cumulative_cost": 0,
  "interaction_count": 0
}
EOF
```

### Increasing Budget Cap
Edit `rental/hcs-config.json`:
```json
{
  "budget_cap_usd": 50.00
}
```

## Monitoring

### Check Watermark Status
```bash
cat rental/hcs-watermark.json
```

### View Recent Logs
If running via cron with log file:
```bash
tail -f /tmp/rental-sidecar.log
```

### View HCS Topic on Hashscan
```
https://hashscan.io/mainnet/topic/0.0.10272696
```

## Troubleshooting

### "HEDERA_OPERATOR_KEY environment variable is required"
The private key isn't set. Options:
1. Use 1Password CLI: `HEDERA_OPERATOR_KEY=$(op read '...')`
2. Export directly: `export HEDERA_OPERATOR_KEY='302e...'`
3. Run in dry-run mode: `DRY_RUN=1 node scripts/rental-sidecar.mjs`

### "No session files found"
The rental agent hasn't created any sessions yet. Check:
```bash
ls -la ~/.openclaw/agents/atp-rental/sessions/
```

### "Budget cap exceeded"
Reset the watermark or increase `budget_cap_usd` in config.

### "authorization timeout" (1Password)
1Password CLI session expired. Run:
```bash
eval $(op signin)
```

## Architecture Notes

### Why Not Use `sessions_history`?
The sidecar is designed to run independently of OpenClaw as a cron job. The `sessions_history` tool is only available within the agent runtime, so we read session files directly from disk instead.

### Why JSONL?
OpenClaw stores session transcripts as JSON Lines (one JSON object per line), which allows for efficient streaming and incremental processing. The sidecar can resume from any line number without re-parsing the entire file.

### Why SHA-256 Hashing?
To preserve user privacy while maintaining verifiability. The hashes prove that specific content was processed without revealing the actual content on-chain. This follows ATP v1.0 best practices for public audit logs.

## Security Considerations

1. **Private Key Storage**: Never commit the private key to git. Use 1Password CLI, environment variables, or a secrets manager.

2. **Watermark File**: Contains cost/interaction metadata but no sensitive content. Safe to commit.

3. **Session Files**: Contain full conversation history. Never commit these files. They're stored in `~/.openclaw/` outside the git repo.

4. **HCS Messages**: Only contain SHA-256 hashes, not plaintext. Public but privacy-preserving.

## License

Part of the Agent Trust Protocol (ATP) SDK.
