# ATP TPS Blaster - Quick Summary

**Built:** February 8, 2026
**Purpose:** Budget-constrained Hedera network stress test for ATP marketing campaign

---

## What It Does

Generates sustained TPS on Hedera mainnet with:
- Hard budget cap (stops when limit reached)
- Date boundaries (auto-start/stop)
- Ramped or flat TPS strategy
- ATP-themed clue messages (cryptic → direct progression)
- Real-time cost tracking
- Checkpoint/resume capability

---

## Files Created

```
lib/
├── tps-blaster.js          Main campaign runner (18KB)
└── tps-planner.js          Cost estimation tool (8KB)

bin/
└── tps-campaign            CLI wrapper script (2.5KB)

config/
└── tps-campaign-example.json   Sample configuration (1KB)

docs/
├── TPS_BLASTER_README.md   Full documentation (14KB)
└── TPS_BLASTER_SUMMARY.md  This file
```

---

## Quick Start

### 1. Plan Campaign

```bash
# See scenario comparison
bin/tps-campaign scenarios

# Estimate for $50K budget over 7 days
bin/tps-campaign plan --budget 50000 --days 7
```

### 2. Configure

Edit `config/tps-campaign-example.json`:
- Set `budgetUSD`, `startDate`, `endDate`
- Set `baseTPS`, `peakTPS`
- Add your `operatorId` and `operatorKey`

### 3. Run

```bash
# Using config file
bin/tps-campaign run config/my-campaign.json

# Or CLI args
bin/tps-campaign run --budget 50000 --start "2026-02-15" --end "2026-02-22"
```

### 4. Monitor

```bash
# Check status
bin/tps-campaign status

# Emergency stop if needed
bin/tps-campaign stop
```

---

## Sample Scenarios

| Scenario | TPS Range | Days | Total Tx | Est. Cost |
|----------|-----------|------|----------|-----------|
| **Modest Whisper** | 50-300 | 7 | 106M | $20,110 |
| **Noticeable Wave** | 100-1000 | 7 | 333M | $63,202 |
| **Strong Signal** | 200-2000 | 7 | 665M | $126,403 |
| **Peak Crescendo** | 500-5000 | 7 | 1.66B | $316,008 |
| **Weekend Sprint** | 500-3000 | 3 | 454M | $86,184 |

---

## Key Features

### Budget Control
- Hard cap prevents overspending
- Real-time cost tracking
- Automatic stop at limit

### Ramped Strategy
- Sigmoid curve (smooth, organic-looking growth)
- Mimics real adoption patterns
- Multiple news cycles vs single spike

### Clue Phases
- **Whisper** (Days 0-1): 80% cryptic → Only power users notice
- **Curiosity** (Days 2-3): 50% cryptic → r/Hedera posts appear
- **Speculation** (Days 4-5): 50% direct → Community theories flying
- **Peak** (Days 6-7): 70% direct → Reveal time

### Safety
- Emergency stop file (`.tps-stop`)
- Max TPS safety cap (5000)
- Checkpoint/resume on crash
- Graceful Ctrl+C handling

---

## Cost Model

| Transaction Type | Cost | Default % |
|------------------|------|-----------|
| HCS Message | $0.0001 | 90% |
| Token Transfer | $0.001 | 10% |

**Budget saver:** Set `txTypes.hcs: 1.0` to use only HCS (10x cheaper).

---

## Example Budget Scenarios

### $10K - Modest 7-Day Campaign
```
Base: 50 TPS → Peak: 300 TPS
Total: ~106M transactions
Cost: ~$20K (50% under budget = room for adjustment)
```

### $25K - Moderate 5-Day Campaign
```
Base: 250 TPS → Peak: 1500 TPS
Total: ~220M transactions
Cost: ~$25K
```

### $50K - Strong 7-Day Campaign
```
Base: 174 TPS → Peak: 696 TPS
Total: ~263M transactions
Cost: ~$50K
Recommended for noticeable impact
```

### $100K - Peak 7-Day Campaign
```
Base: 500 TPS → Peak: 3000 TPS
Total: ~650M transactions
Cost: ~$100K
Maximum attention-grabbing
```

---

## Technical Requirements

- Node.js
- `@hashgraph/sdk` npm package
- Hedera mainnet account with sufficient HBAR
- Private key with submit permissions

**Estimated HBAR needed:** ~5,000-10,000 HBAR buffer for gas (depending on campaign size)

---

## Implementation Status

✅ **Complete and tested:**
- Core blaster engine
- Ramped TPS calculation (sigmoid curve)
- Clue message rotation
- Budget tracking
- Checkpoint/resume
- Planning tool
- CLI wrapper

⚠️ **Not yet tested on mainnet:**
- Actual cost tracking (conservative estimates used)
- Network rate limits at peak TPS
- Long-duration reliability (7+ days)

🔧 **Recommended before mainnet:**
1. Testnet dry run with small parameters
2. Verify cost model against actual receipts
3. Test emergency stop mechanism
4. Confirm checkpoint/resume works

---

## Next Steps

1. **Review configuration options** in README
2. **Run planner** to estimate costs for your budget
3. **Test on testnet** before committing mainnet budget
4. **Prepare reveal content** (blog post, X thread, stats)
5. **Coordinate timing** (avoid conflicts with other network activity)
6. **Seed community watchers** (optional, for amplification)
7. **Launch and monitor**

---

## Support

**Documentation:** `docs/TPS_BLASTER_README.md` (comprehensive guide)
**Planning Tool:** `lib/tps-planner.js --help`
**Blaster Tool:** `lib/tps-blaster.js --help`
**CLI Wrapper:** `bin/tps-campaign help`

---

**Ready to generate attention for ATP.** ⚡
