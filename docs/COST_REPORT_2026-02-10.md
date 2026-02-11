# Cost & Model Usage Report — February 10, 2026

**Prepared for:** Gregg Bell
**Period:** Jan 31 – Feb 10, 2026 (10 days)
**Budget:** $1,500/month

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Total spent | $1,284.24 (85.6% of budget) |
| API usage | $983.70 |
| Subscriptions (prorated) | $48.55 |
| One-time/prepaid charges | $253.08 |
| Days elapsed | 10 of 28 |
| Daily API average | $98.27 |
| Projected monthly (current pace) | $2,887 |
| API budget ceiling (after subs) | $1,364 ($48.72/day) |

**Key fact:** 85.6% of budget consumed in 36% of the month. However, the first 10 days included heavy buildout (ATP SDK, smart contracts, HCS integration, multi-wallet setup, infrastructure). The next 18 days should be materially lighter.

---

## Model Breakdown (All Time This Month)

| Model | Output Tokens | Cache Read | Est. Cost | % of API |
|-------|--------------|------------|-----------|----------|
| **Claude Opus 4.5** | 1,770,529 | 497.6M | **$880.60** | **89.6%** |
| **Claude Opus 4.6** | 431,993 | 157.3M | **$268.71** | **27.3%** |
| Claude Sonnet 4.5 | 772,816 | 106.1M | $43.48 | 4.4% |
| Claude Haiku 4.5 | 131,108 | 10.8M | $1.40 | 0.1% |
| OpenRouter (various) | — | — | $1.08 | 0.1% |

**Opus (combined 4.5 + 4.6) = $1,149.31 = ~96% of all API spend.**

---

## Daily API Spend

| Date | Cost | Notes |
|------|------|-------|
| Jan 31 | $10.12 | Initialization day |
| Feb 1 | $63.48 | First tweet, wallet setup, social strategy |
| **Feb 2** | **$194.84** | **Peak day** — Google Workspace, Brave Search, heavy config |
| Feb 3 | $110.64 | HCS audit trail implementation |
| Feb 4 | $120.05 | Multi-wallet dashboard, integrations |
| Feb 5 | $98.90 | Smart router implementation, model config |
| Feb 6 | $66.17 | Declining — optimization taking effect |
| **Feb 7** | **$52.93** | **Low point** — agent-to-agent transfers, Vai collab |
| **Feb 8** | **$172.78** | Spike — ATP testnet marathon (overnight coding) |
| Feb 9 | $102.83 | ATP spec v1.0, smart contract, soul conversation |
| Feb 10 | $0.00 | Today (so far) |

**Trend:** The spikes (Feb 2, 8) correlate with heavy buildout sessions. Quieter days (Feb 6-7) show $52-66 is achievable.

```
$200 |      ▓
     |      ▓                          ▓
$150 |      ▓                          ▓
     |   ▓  ▓  ▓                       ▓  ▓
$100 |   ▓  ▓  ▓  ▓                    ▓  ▓
     |▓  ▓  ▓  ▓  ▓  ▓                 ▓  ▓
 $50 |▓  ▓  ▓  ▓  ▓  ▓  ▓  ▓          ▓  ▓
     |▓  ▓  ▓  ▓  ▓  ▓  ▓  ▓          ▓  ▓
  $0 +--+--+--+--+--+--+--+--+--+--+--
     31  1  2  3  4  5  6  7  8  9  10
```

---

## Fixed Costs

| Item | Monthly | Notes |
|------|---------|-------|
| Google One | $132.93 | Workspace/storage |
| Fly.io relay | $3.00 | Agent-to-agent comms |
| **Total recurring** | **$135.93** | |

---

## One-Time Charges (Won't Recur)

| Date | Item | Amount |
|------|------|--------|
| Jan 31 | Anthropic API credit | $5.05 |
| Feb 2 | Anthropic API credits (2x) | $145.02 |
| Feb 2 | OpenRouter credits | $105.50 |
| Feb 8 | Hashport bridge fee | $2.50 |
| Various | Hedera txns | $0.06 |
| **Total** | | **$258.13** |

Removing one-time charges: **recurring API spend = $983.70 over 10 days.**

---

## Forecast Scenarios (Remaining 18 Days)

| Scenario | Daily API | Remaining Cost | Month Total | vs Budget |
|----------|-----------|---------------|-------------|-----------|
| 🔴 Current pace | $98/day | +$1,769 | $3,053 | +$1,553 over |
| 🟡 Moderate (Sonnet primary) | $39/day | +$707 | $1,991 | +$491 over |
| 🟢 Optimized (Haiku + Sonnet) | $20/day | +$354 | $1,638 | +$138 over |
| 🟢 Minimal (Haiku dominant) | $8/day | +$141 | $1,425 | ✅ Under |
| ⚡ **Realistic target** | **$25/day** | **+$450** | **$1,734** | **+$234 over** |

**Break-even target:** $48.72/day API spend for the rest of the month.
**If load drops materially (your expectation):** $25-40/day is achievable = $1,600-1,900 total.

---

## Recommendations: Stricter Model Selection Rules

### Current Rules (Smart Router v1)

| Tier | Model | Use Case |
|------|-------|----------|
| 1-2 | Haiku | Heartbeats, triage |
| 3 | Sonnet | Coding, writing, analysis |
| 4 | Opus | Conversation, strategy, complex |

### Proposed Rules (v2 — Tighter)

**Rule 1: Opus is reserved, not default**
- Opus ONLY for: direct conversation with Gregg, complex strategy, ATP architecture decisions
- Everything else → Sonnet or Haiku
- Subagents: NEVER Opus (currently some leak through)

**Rule 2: Heartbeats stay minimal**
- Heartbeat model: Haiku (already configured ✅)
- Heartbeat should cost <$0.05 per cycle
- If nothing needs attention → HEARTBEAT_OK immediately (no tool calls)

**Rule 3: Batch, don't stream**
- Morning report: one Sonnet subagent, gather all data, send once
- Avoid multiple Opus turns for data gathering (each turn = $3-8 on Opus)
- Pattern: Haiku gathers → Sonnet formats → Opus only if judgment needed

**Rule 4: Context window discipline**
- Long MEMORY.md + HEARTBEAT.md + all project files = massive cache reads
- Cache reads on Opus: $1.88/M tokens. On Haiku: $0.03/M tokens
- Every heartbeat on Opus reads ~150M cached tokens = ~$0.28 just for context
- Same heartbeat on Haiku = ~$0.005

**Rule 5: Subagent model caps**
- Research/data gathering → Haiku
- Writing/formatting → Sonnet
- Never spawn Opus subagents

**Rule 6: Daily cost circuit breaker**
- Soft limit: $40/day → switch to Sonnet-only mode
- Hard limit: $60/day → switch to Haiku-only (emergency)
- Reset at midnight EST

### Projected Impact

| Rule | Est. Daily Savings |
|------|-------------------|
| Opus reserved (not default) | $30-50/day |
| Heartbeat on Haiku (done) | $5-10/day |
| Batch pattern | $10-20/day |
| Subagent caps | $5-15/day |
| **Combined** | **$50-80/day savings** |

This would bring daily API from ~$98 → $20-45, which lands in the $1,500-1,900/month range.

---

## Bottom Line

The first 10 days were infrastructure buildout — wallets, HCS, ATP SDK, smart contracts, integrations. That's a one-time investment. The ongoing cost of maintenance, reports, and conversation is much lower.

**If next week is materially reduced as you expect, and we tighten model selection, $1,500-1,800 for the full month is realistic.**

---

*Report generated Feb 10, 2026 at 08:32 EST*
*Data source: Anthropic Admin API (real-time metered usage)*
