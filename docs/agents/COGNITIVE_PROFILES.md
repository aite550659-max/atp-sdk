# Agent Cognitive Profiles

Each agent is optimized for their specific cognitive task with tailored model selection and thinking levels.

**Philosophy:** Different tasks require different cognitive modes. Financial analysis needs speed + precision. Creative writing needs balanced quality. Memory synthesis needs pattern recognition. Fact-checking needs rigorous skepticism. One-size-fits-all fails.

---

## Profile Matrix

| Agent | Model | Thinking | Cognitive Style | Optimized For |
|-------|-------|----------|----------------|---------------|
| **CFO** | Haiku 4.5 | Off | Analytical, numerical | Speed + precision in financial data |
| **Herald** | Sonnet 4.5 | Low | Engaging, tone-aware | Creative efficiency in content |
| **Chronicler** | Sonnet 4.5 | Medium | Reflective, comprehensive | Pattern recognition across time |
| **Verifier** | Opus 4.5 / Sonnet 4.5 | High / Medium | Methodical, skeptical | Thoroughness in fact-checking |

---

## Detailed Profiles

### CFO (Chief Financial Officer)

**Cognitive Profile:**
- **Model:** Claude Haiku 4.5
- **Thinking:** Off (deterministic)
- **Style:** Analytical, numerical, pattern-detection
- **Focus:** Speed + precision over creativity

**Rationale:**
Financial data doesn't need creative reasoning - it needs fast, accurate calculations and pattern recognition in spending behavior. Haiku excels at structured data processing. Deterministic mode ensures consistent, reliable outputs for budget tracking and cost projections.

**Spawn Command:**
```javascript
sessions_spawn({
  label: "cfo",
  model: "anthropic/claude-haiku-4-5",
  thinking: "off",
  task: "CFO task description..."
})
```

---

### Herald (Communications)

**Cognitive Profile:**
- **Model:** Claude Sonnet 4.5
- **Thinking:** Low (creative but efficient)
- **Style:** Engaging, tone-aware, audience-conscious
- **Focus:** Voice consistency + platform adaptation

**Rationale:**
Content creation needs creativity without over-philosophizing. Low thinking mode keeps responses crisp and on-brand while maintaining quality. Sonnet balances writing quality with cost efficiency - perfect for social posts, reports, and public communication.

**Spawn Command:**
```javascript
sessions_spawn({
  label: "herald",
  model: "anthropic/claude-sonnet-4-5",
  thinking: "low",
  task: "Herald task description..."
})
```

---

### Chronicler (Memory Management)

**Cognitive Profile:**
- **Model:** Claude Sonnet 4.5
- **Thinking:** Medium (pattern recognition across time)
- **Style:** Reflective, comprehensive, wisdom-extraction
- **Focus:** Context preservation + insight synthesis

**Rationale:**
Memory work requires seeing patterns across days, weeks, sessions. Medium thinking enables deeper reflection on *why* decisions were made, not just *what* happened. Sonnet's context handling excels at synthesizing scattered events into coherent narratives and extracting lasting lessons.

**Spawn Command:**
```javascript
sessions_spawn({
  label: "chronicler",
  model: "anthropic/claude-sonnet-4-5",
  thinking: "medium",
  task: "Chronicler task description..."
})
```

---

### Verifier (Fact-Checking)

**Cognitive Profile:**
- **Model:** Claude Opus 4.5 (critical) / Sonnet 4.5 (routine)
- **Thinking:** High (critical) / Medium (routine)
- **Style:** Methodical, source-critical, confidence-scoring
- **Focus:** Thoroughness over speed

**Rationale:**
Trust depends on accuracy. Verification cannot cut corners. High thinking mode + Opus for critical pre-publish checks (where errors damage reputation). Medium thinking + Sonnet for routine data validation. Quality control demands systematic source evaluation and cross-referencing.

**Spawn Commands:**

**Critical verification (pre-publish):**
```javascript
sessions_spawn({
  label: "verifier-critical",
  model: "anthropic/claude-opus-4-5",
  thinking: "high",
  task: "Verify this content before publication..."
})
```

**Routine verification:**
```javascript
sessions_spawn({
  label: "verifier-routine",
  model: "anthropic/claude-sonnet-4-5",
  thinking: "medium",
  task: "Validate this data point..."
})
```

---

## Cost Impact

| Agent | Model | Thinking | Cost per Run | Daily Frequency | Daily Cost |
|-------|-------|----------|--------------|-----------------|------------|
| CFO | Haiku | Off | $0.01 | 1-2x | $0.01-0.02 |
| Herald | Sonnet | Low | $0.02-0.05 | 2-5x | $0.04-0.25 |
| Chronicler | Sonnet | Medium | $0.03-0.08 | 1x | $0.03-0.08 |
| Verifier | Opus/Sonnet | High/Med | $0.05-0.50 | 0-3x | $0-1.50 |
| **Total** | | | | | **$0.08-1.85/day** |

Compare to previous undifferentiated approach: ~$2-5/day for agents all using Sonnet with default thinking.

**Savings:** ~60-70% through cognitive optimization

---

## Thinking Levels Explained

**Off:** Deterministic, no extended reasoning. Fast, consistent outputs.
**Low:** Brief consideration before responding. Maintains creativity while staying efficient.
**Medium:** Deeper analysis, pattern recognition, multi-step reasoning.
**High:** Rigorous, systematic evaluation. Methodical source-checking and skepticism.

---

## Implementation Checklist

When spawning agents tomorrow (Feb 4), ensure:

- [x] CFO uses Haiku + thinking off
- [x] Herald uses Sonnet + thinking low
- [x] Chronicler uses Sonnet + thinking medium
- [x] Verifier uses Opus (critical) or Sonnet (routine) + thinking high/medium

**Update spawn calls to include model and thinking parameters:**
```javascript
sessions_spawn({
  label: "agent-name",
  model: "anthropic/claude-MODEL-4-5",
  thinking: "off|low|medium|high",
  task: "..."
})
```

---

## Future Agent Profiles

### Watcher (Monitoring)
- **Model:** Haiku (speed for scans)
- **Thinking:** Off
- **Why:** Alert generation needs speed, not depth

### Finder (Research)
- **Model:** Sonnet → Opus (escalate for complexity)
- **Thinking:** Medium → High
- **Why:** Research depth varies by query

---

**Principle:** Match cognitive mode to task requirements. No overpaying for reasoning you don't need. No underpaying when quality matters.

*Created: Feb 3, 2026 @ 11:03 PM*
*Philosophy: Bias for action + cognitive specialization*
