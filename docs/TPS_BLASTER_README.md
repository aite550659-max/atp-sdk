# ATP TPS Blaster Tool

**Budget-constrained network stress test for Hedera mainnet**

Generate sustained TPS on Hedera with configurable budget caps, date ranges, ramp strategies, and ATP-themed clue messages. Perfect for attention-grabbing marketing campaigns.

---

## Features

- ✅ **Budget cap** - Hard stop when spending limit reached
- ✅ **Date range** - Start/end dates with automatic stopping
- ✅ **Ramped strategy** - Gradual TPS increase over campaign (sigmoid curve)
- ✅ **Flat strategy** - Sustained constant TPS
- ✅ **Clue rotation** - Phase-based ATP messaging (cryptic → direct)
- ✅ **Mixed transactions** - HCS messages + token transfers
- ✅ **Real-time monitoring** - Cost tracking, TPS stats, progress updates
- ✅ **Checkpointing** - Resume capability if interrupted
- ✅ **Emergency stop** - Create `.tps-stop` file to halt immediately
- ✅ **Planning tool** - Estimate costs before running

---

## Installation

```bash
cd /Users/aite/.openclaw/workspace
npm install @hashgraph/sdk
```

**Environment variables:**
```bash
export HEDERA_OPERATOR_ID="0.0.XXXXXX"
export HEDERA_OPERATOR_KEY="302e..."
```

Or specify in config file.

---

## Quick Start

### 1. Plan Your Campaign

Use the planner to estimate costs:

```bash
# See comparison of common scenarios
node lib/tps-planner.js --scenarios

# Calculate optimal TPS for a $50K budget over 7 days
node lib/tps-planner.js --budget 50000 --days 7

# Get cost breakdown for specific TPS range
node lib/tps-planner.js --base 100 --peak 2000 --days 7
```

**Example output:**
```
=== PLANNING FOR $50,000 BUDGET ===

Recommended Configuration:
  Base TPS: 1036
  Peak TPS: 4144
  Average TPS: 2590
  Duration: 7 days
  Total Transactions: 1,562,112,000
  Estimated Cost: $50,000
```

### 2. Create Config File

Copy the example config:

```bash
cp config/tps-campaign-example.json config/my-campaign.json
```

Edit `config/my-campaign.json`:

```json
{
  "budgetUSD": 50000,
  "startDate": "2026-02-15T00:00:00.000Z",
  "endDate": "2026-02-22T00:00:00.000Z",
  "strategy": "ramped",
  "baseTPS": 1000,
  "peakTPS": 4000,
  "operatorId": "0.0.10255397",
  "operatorKey": "302e..."
}
```

### 3. Run Campaign

```bash
# Using config file
node lib/tps-blaster.js --config config/my-campaign.json

# Or via CLI args
node lib/tps-blaster.js \
  --budget 50000 \
  --start "2026-02-15" \
  --end "2026-02-22" \
  --base-tps 1000 \
  --peak-tps 4000 \
  --strategy ramped
```

### 4. Monitor Progress

The tool prints real-time stats:

```
[2026-02-15T12:34:56.789Z] TPS: 1247 | Phase: curiosity | Clue: "Agents are coming..."
  Spent: $1,234.56 / $50,000 (2.5%)
  ✓ Checkpoint saved
```

**Stats file:** `data/tps-campaign-stats.json`

### 5. Emergency Stop

Create stop file to halt immediately:

```bash
touch .tps-stop
```

Campaign will finish current second, save checkpoint, and exit cleanly.

---

## Configuration Options

### Budget & Timing

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `budgetUSD` | number | Maximum spending in USD (hard cap) | 10000 |
| `startDate` | ISO 8601 | Campaign start time | Now |
| `endDate` | ISO 8601 | Campaign end time | Required |

### TPS Strategy

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `strategy` | string | `"flat"` or `"ramped"` | ramped |
| `baseTPS` | number | Starting TPS (ramped) or constant TPS (flat) | 100 |
| `peakTPS` | number | Peak TPS (ramped only) | 2000 |
| `rampDays` | number | Days for full ramp (advisory) | 7 |

### Transaction Types

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `txTypes.hcs` | number | Fraction of HCS messages (0-1) | 0.8 |
| `txTypes.transfer` | number | Fraction of token transfers (0-1) | 0.2 |

**Note:** Must sum to 1.0. HCS is cheaper ($0.0001 vs $0.001).

### Clue Phases

Clue messages rotate through phases as campaign progresses. Each phase has different mix of cryptic/technical/direct hints.

**Default phases:**

```json
{
  "cluePhases": [
    {
      "name": "whisper",
      "days": [0, 1],
      "cryptic": 0.8,
      "technical": 0.15,
      "direct": 0.05
    },
    {
      "name": "curiosity",
      "days": [2, 3],
      "cryptic": 0.5,
      "technical": 0.3,
      "direct": 0.2
    },
    {
      "name": "speculation",
      "days": [4, 5],
      "cryptic": 0.2,
      "technical": 0.3,
      "direct": 0.5
    },
    {
      "name": "peak",
      "days": [6, 7],
      "cryptic": 0.1,
      "technical": 0.2,
      "direct": 0.7
    }
  ]
}
```

**Message pools:**
- **Cryptic:** "Trust but verify", "0.0.800 awaits", "Soul immutable"
- **Technical:** "HTS native royalties", "ATP/1.0", "Peak HTS"
- **Direct:** "Agent Trust Protocol", "The agents are coming", "Coming soon"

Full list: See `CLUE_MESSAGES` in `lib/tps-blaster.js`

### Hedera Config

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `operatorId` | string | Hedera account ID | `HEDERA_OPERATOR_ID` env |
| `operatorKey` | string | Hedera private key | `HEDERA_OPERATOR_KEY` env |
| `hcsTopic` | string | Existing HCS topic ID (optional) | Creates new |
| `testAccounts` | array | Account IDs for token transfers | [] |

**Note:** If `testAccounts` is empty, all transactions will be HCS messages (cheaper).

### Safety & Monitoring

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `maxTPSPerSecond` | number | Safety cap on TPS | 5000 |
| `emergencyStopFile` | string | Stop file path | `.tps-stop` |
| `statsFile` | string | Stats/checkpoint file | `data/tps-campaign-stats.json` |
| `checkpointInterval` | number | Checkpoint frequency (ms) | 60000 |

---

## Ramped Strategy Details

The ramped strategy uses a **sigmoid curve** to create smooth, organic-looking TPS growth:

```
TPS
 │
 │                            ╱────
 │                         ╱
peak│                    ╱
 │                  ╱
 │             ╱
 │        ╱
base│────
 └────────────────────────────────────> Time
     Day 1   3     5     7
```

**Mathematical model:**
- Progress mapped to sigmoid function (-6 to +6)
- Smooth acceleration → steady climb → plateau near peak
- Random jitter (±15%) to look organic, not robotic

**Why sigmoid vs linear?**
- Linear looks artificial
- Sigmoid mimics adoption curves in real networks
- Natural "discovery" period at start, "hype" period at end

---

## Cost Model

| Transaction Type | Cost (USD) | Volume Ratio (Default) |
|------------------|------------|------------------------|
| HCS Message | $0.0001 | 80% |
| Token Transfer | $0.001 | 20% |

**Total cost formula:**
```
TotalCost = (HCS_Messages × $0.0001) + (Transfers × $0.001)
```

**Example (7-day ramped campaign):**
- Base TPS: 100, Peak TPS: 2000
- Average TPS: ~1050
- Total transactions: ~635M
- HCS (80%): 508M × $0.0001 = $50,800
- Transfers (20%): 127M × $0.001 = $127,000
- **Total: ~$177,800**

**Budget saver:** Use 100% HCS (set `txTypes.hcs: 1.0`) to reduce costs by 5-10x.

---

## Planning Tool Examples

### Scenario Comparison

```bash
node lib/tps-planner.js --scenarios
```

Output:
```
=== TPS CAMPAIGN SCENARIOS ===

Scenario                  TPS Range      Days    Avg TPS     Total Tx       Est. Cost
----------------------------------------------------------------------------------------------------
Modest Whisper            50-300         7       175         106,092,000    $11,763
Noticeable Wave           100-1000       7       550         333,504,000    $36,986
Strong Signal             200-2000       7       1100        667,008,000    $73,971
Peak Crescendo            500-5000       7       2750        1,667,520,000  $184,928
Extended Slow Burn        100-1000       14      550         667,008,000    $73,971
Weekend Sprint            500-3000       3       1750        453,600,000    $50,311
```

### Budget-Constrained Planning

```bash
node lib/tps-planner.js --budget 25000 --days 7
```

Output:
```
=== PLANNING FOR $25,000 BUDGET ===

Recommended Configuration:
  Base TPS: 518
  Peak TPS: 2072
  Average TPS: 1295
  Duration: 7 days
  Total Transactions: 784,728,000
  Estimated Cost: $25,000
```

### Cost Breakdown

```bash
node lib/tps-planner.js --base 500 --peak 3000 --days 5
```

Output:
```
=== CAMPAIGN COST BREAKDOWN ===

TPS Range: 500 → 3000
Duration: 5 days
Strategy: Ramped (sigmoid curve)

Transaction Mix:
  HCS Messages: 90%
  Token Transfers: 10%

Volume:
  Average TPS: 1750
  Total Transactions: 756,000,000
    - HCS Messages: 680,400,000
    - Transfers: 75,600,000

Cost:
  HCS Cost: $68,040
  Transfer Cost: $75,600
  Total Cost: $143,640
  Per Day: $28,728
  Per Hour: $1,197.00

Budget Checkpoints:
  End of Day 1: $28,728 (20.0%)
  End of Day 2: $57,456 (40.0%)
  End of Day 3: $86,184 (60.0%)
  End of Day 4: $114,912 (80.0%)
  End of Day 5: $143,640 (100.0%)
```

---

## Resume & Checkpointing

If the campaign is interrupted (crash, network issue, manual stop), it can be resumed from the last checkpoint.

**Checkpoint saves:**
- Total transactions submitted
- Total cost spent
- Success/error counts
- Current phase

**To resume:**
Just run the same command again. The tool will:
1. Load checkpoint from `statsFile`
2. Continue from where it left off
3. Respect remaining budget

**Example:**
```bash
# Start campaign
node lib/tps-blaster.js --config config/my-campaign.json

# ... runs for 3 days, then crashes

# Resume (same command)
node lib/tps-blaster.js --config config/my-campaign.json
# Output: "Resumed from checkpoint. Spent so far: $42,156.78"
```

---

## Safety Features

### 1. Budget Hard Cap

Campaign stops immediately when `spentUSD >= budgetUSD`. No overspend.

### 2. Date Boundaries

Campaign auto-stops at `endDate` even if budget remains.

### 3. Emergency Stop File

Create `.tps-stop` file to trigger graceful shutdown:

```bash
touch .tps-stop
```

Tool checks for this file every second. On detection:
1. Finish current batch
2. Save checkpoint
3. Print final stats
4. Exit cleanly

### 4. Max TPS Safety Cap

Hard-coded safety limit (`maxTPSPerSecond: 5000`) prevents accidentally setting astronomical TPS that could:
- Overwhelm the network
- Drain budget in seconds
- Cause rate limit errors

### 5. Graceful Shutdown (Ctrl+C)

`SIGINT` handler ensures clean exit:
- Saves checkpoint
- Prints final stats
- Closes Hedera client

---

## Monitoring Dashboard (Optional)

The stats file can be consumed by a monitoring dashboard:

```bash
# Watch stats in real-time
watch -n 1 'cat data/tps-campaign-stats.json | jq .'

# Or build a web dashboard that polls this file
```

**Stats file schema:**

```json
{
  "timestamp": "2026-02-15T12:34:56.789Z",
  "config": { ... },
  "stats": {
    "startTime": "2026-02-15T00:00:00.000Z",
    "endTime": null,
    "totalTransactions": 5432100,
    "peakTPS": 1847,
    "avgTPS": 1234
  },
  "submitterStats": {
    "hcsSubmitted": 4345680,
    "transfersSubmitted": 1086420,
    "hcsSuccess": 4345598,
    "transfersSuccess": 1086401,
    "hcsErrors": 82,
    "transfersErrors": 19,
    "totalCostUSD": 12345.67
  }
}
```

---

## Community Discovery Strategy

**Phase 1: Whisper (Days 0-1)**
- Low TPS (100-200)
- 80% cryptic clues
- Only power users notice

**Phase 2: Curiosity (Days 2-3)**
- Rising TPS (500-800)
- 50% cryptic, 20% direct
- r/Hedera posts appear: "Anyone seeing this?"

**Phase 3: Speculation (Days 4-5)**
- Significant TPS (1500-2500)
- 50% direct hints
- Community theories flying
- Discord analysis threads

**Phase 4: Peak & Reveal (Days 6-7)**
- Peak TPS (4000-5000)
- 70% direct ("Agent Trust Protocol")
- Coordinated reveal on X
- Blog post with full stats

**Result:** Multiple news cycles, sustained buzz, community detective work, organic discovery.

---

## Troubleshooting

### "Error: Insufficient balance"

**Solution:** Fund operator account with more HBAR. For 7-day campaign at 2K TPS, need ~10,000 HBAR buffer for gas.

### "Error: Rate limit exceeded"

**Solution:** Reduce TPS target or enable parallel submission (increase worker threads).

### "Campaign spending faster than expected"

**Solution:** 
1. Check `txTypes` ratio (more HCS = cheaper)
2. Verify `baseTPS` and `peakTPS` match planner estimates
3. Emergency stop if needed: `touch .tps-stop`

### "Checkpoint file corrupted"

**Solution:** Delete `data/tps-campaign-stats.json` and restart (will begin from zero).

---

## Examples

### Modest 7-Day Campaign ($10K)

```bash
node lib/tps-blaster.js \
  --budget 10000 \
  --start "2026-02-15" \
  --end "2026-02-22" \
  --base-tps 200 \
  --peak-tps 800 \
  --strategy ramped
```

### Weekend Sprint ($5K)

```bash
node lib/tps-blaster.js \
  --budget 5000 \
  --start "2026-02-15" \
  --end "2026-02-17" \
  --base-tps 500 \
  --peak-tps 2000 \
  --strategy ramped
```

### Flat Constant TPS Test ($1K)

```bash
node lib/tps-blaster.js \
  --budget 1000 \
  --start "2026-02-15" \
  --end "2026-02-16" \
  --base-tps 500 \
  --strategy flat
```

---

## Best Practices

1. **Always run planner first** — Avoid budget surprises
2. **Test on testnet** — Validate tool behavior before mainnet
3. **Monitor closely first day** — Confirm TPS matches expectations
4. **Keep emergency stop ready** — `touch .tps-stop` if needed
5. **Coordinate with Hedera Foundation** — Optional but recommended for large campaigns
6. **Prepare reveal content** — Blog post, X thread, stats ready before peak
7. **Seed community watchers** — Anonymous tip on Day 2 to amplify discovery

---

## Next Steps

1. **Plan campaign:** `node lib/tps-planner.js --budget <amount> --days <days>`
2. **Create config:** Copy and edit `config/tps-campaign-example.json`
3. **Dry run:** Test with small budget on testnet
4. **Launch:** Run on mainnet with real budget
5. **Monitor:** Watch stats file and community reaction
6. **Reveal:** Coordinate announcement at peak

---

**Built by Aite for ATP Marketing Campaign**  
**February 2026**
