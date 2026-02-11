# Verifier Agent Architecture

## Purpose
Fact-checking agent that validates data accuracy before it reaches Gregg or gets published. Prevents errors like "Boeing still on Hedera council" from slipping through.

## Cognitive Profile

**Model:** Claude Opus 4.5 (critical verification), Sonnet 4.5 (routine checks)  
**Thinking Level:** High (rigorous skepticism)  
**Processing Style:** Methodical, source-critical, confidence-scoring  
**Cognitive Focus:** Thoroughness over speed - trust depends on accuracy

**Why this profile:**  
Verification cannot cut corners. High thinking mode enables systematic source evaluation, cross-referencing, and confidence assessment. Opus for critical pre-publish checks (where errors damage reputation), Sonnet for routine data validation. Quality control demands the deepest reasoning available.

## Core Functions

### 1. Claim Verification
- Cross-reference claims against multiple authoritative sources
- Flag confidence levels: ✅ Verified | ⚠️ Uncertain | ❌ Contradicted
- Cite sources for all verifications

### 2. Data Freshness Check
- Reject stale data (configurable threshold, default 24h for market data)
- Verify "as of" dates on all statistics
- Flag when source data is outdated

### 3. Source Credibility
- Maintain allowlist of trusted sources per domain:
  - **Crypto prices:** CoinGecko, CoinMarketCap, exchange APIs
  - **Hedera:** Official docs, mirror node, council announcements
  - **News:** Primary sources > aggregators > social
- Downweight or reject unverified social media claims

### 4. Consistency Check
- Compare new data against known facts in MEMORY.md
- Flag contradictions for review
- Prevent hallucinated statistics

## Integration Points

### Pre-publish Hook
Before any external post (X, email, public docs):
```
Content → Verifier → [PASS/FAIL/REVIEW] → Publish or Hold
```

### On-demand Verification
Called by other agents or main session:
```
Aite: "Verify: HBAR market cap is #15"
Verifier: "❌ Incorrect. Current rank: #18 (CoinGecko, 2 min ago)"
```

### Automated Monitoring
- Periodic fact-check of dashboard data
- Validate market prices before display
- Cross-check news claims before amplifying

## Implementation Options

### Option A: Sub-agent (Recommended)
- Spawn via `sessions_spawn` with verification task
- Uses cheaper model (Sonnet) for cost efficiency
- Returns structured verdict

### Option B: Tool/Function
- Dedicated verification function callable from any agent
- Faster but uses main context
- Good for quick inline checks

### Option C: Hybrid
- Quick checks inline (prices, dates)
- Deep verification as sub-agent (complex claims)

## Verdict Format
```json
{
  "claim": "HBAR is ranked #15 by market cap",
  "verdict": "FAIL",
  "confidence": 0.95,
  "actual": "HBAR is ranked #18 by market cap",
  "sources": [
    {"name": "CoinGecko", "url": "...", "timestamp": "2026-02-03T18:00:00Z"}
  ],
  "recommendation": "Update claim to reflect current rank"
}
```

## Priority Verification Domains
1. **Market data** — Prices, ranks, market caps, volumes
2. **Hedera ecosystem** — Council members, partnerships, TVL
3. **Dates/timelines** — Event dates, deadlines, historical facts
4. **Quotes/attributions** — Who said what, when

## Cost Estimate
- Sonnet model: ~$0.003 per verification
- Target: <$1/day for routine checks
- Budget alert if >$5/day

## Next Steps
1. [ ] Build verification function with source lookup
2. [ ] Create trusted sources registry
3. [ ] Integrate with X posting workflow
4. [ ] Add to morning briefing pipeline

---

*Draft: Feb 3, 2026*
