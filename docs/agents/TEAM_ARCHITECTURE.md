# Multi-Agent Team Architecture

## Overview
Aite leads a team of specialized sub-agents, each with a focused role. All agents share core values (SOUL.md) but have specialized skills.

## Agent Roster

### 🔍 Watcher
**Role:** Monitoring & alerting
**Triggers:** Scheduled scans, event-driven alerts
**Responsibilities:**
- Monitor X mentions, news feeds, market movements
- Watch for Hedera ecosystem updates
- Alert on significant events
- Track competitor activity

**Model:** Sonnet (cost-efficient for routine checks)
**Schedule:** Hourly or on-demand

---

### 🔎 Finder
**Role:** Research & discovery
**Triggers:** On-demand queries from Aite or Gregg
**Responsibilities:**
- Deep research on topics
- Find relevant sources, papers, articles
- Discover new tools, integrations, opportunities
- Competitive intelligence

**Model:** Sonnet (or Opus for complex research)
**Schedule:** On-demand

---

### 📜 Chronicler
**Role:** Documentation & memory
**Triggers:** End of day, significant events
**Responsibilities:**
- Maintain memory files (daily logs, MEMORY.md)
- Document decisions and rationale
- Archive important conversations
- Generate summaries and reports

**Model:** Sonnet
**Schedule:** Daily + event-driven

---

### 📢 Herald
**Role:** Communications & publishing
**Triggers:** Content ready for publication
**Responsibilities:**
- Draft and post X content
- Format and send reports
- Manage outbound communications
- Ensure consistent voice/tone

**Model:** Sonnet
**Schedule:** On-demand (with Verifier pre-check)

---

### ✅ Verifier
**Role:** Fact-checking & validation
**Triggers:** Before any external publication
**Responsibilities:**
- Validate claims against trusted sources
- Check data freshness
- Flag confidence levels
- Prevent misinformation

**Model:** Sonnet
**Schedule:** On-demand (pre-publish hook)

*Full spec: docs/agents/VERIFIER.md*

---

## Communication Flow

```
                    ┌─────────────┐
                    │    Gregg    │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │    Aite     │  ← Orchestrator
                    │   (Opus)    │
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼────┐       ┌─────▼─────┐      ┌─────▼─────┐
   │ Watcher │       │  Finder   │      │ Chronicler│
   │(Sonnet) │       │ (Sonnet)  │      │ (Sonnet)  │
   └─────────┘       └───────────┘      └───────────┘
        │
        │ alerts
        ▼
   ┌─────────┐        ┌──────────┐
   │ Herald  │───────►│ Verifier │ (pre-publish)
   │(Sonnet) │◄───────│ (Sonnet) │
   └─────────┘        └──────────┘
```

## Implementation

### Spawning Sub-agents
```javascript
// Example: Spawn Finder for research
sessions_spawn({
  task: "Research Hedera staking economics and summarize key points",
  label: "finder-research",
  model: "claude-sonnet-4-5",
  cleanup: "delete"  // or "keep" for persistent sessions
})
```

### Shared Resources
- All agents read from workspace files (SOUL.md, USER.md, etc.)
- Memory files are append-only (Chronicler manages)
- Verifier has read access to trusted sources registry

### Cost Control
| Agent | Model | Est. Cost/Run | Daily Runs | Daily Cost |
|-------|-------|---------------|------------|------------|
| Watcher | Sonnet | $0.02 | 24 | $0.48 |
| Finder | Sonnet | $0.05 | 5 | $0.25 |
| Chronicler | Sonnet | $0.03 | 2 | $0.06 |
| Herald | Sonnet | $0.02 | 10 | $0.20 |
| Verifier | Sonnet | $0.003 | 20 | $0.06 |
| **Total** | | | | **~$1.05/day** |

Aite (Opus) main session adds $15-25/day depending on usage.

## Rollout Plan

### Phase 1: Foundation (Current)
- [x] Aite operational
- [x] Verifier architecture drafted
- [ ] Implement Verifier as function

### Phase 2: Core Team
- [ ] Chronicler for daily memory management
- [ ] Herald for X publishing (with Verifier integration)
- [ ] Watcher for monitoring (re-enable when cost-justified)

### Phase 3: Extended Team
- [ ] Finder for research tasks
- [ ] Specialized agents as needed

## Guidelines

1. **Aite orchestrates** — Sub-agents don't communicate directly with Gregg unless explicitly routed
2. **Sonnet by default** — Opus only for complex reasoning
3. **Verify before publish** — All external content goes through Verifier
4. **Cost awareness** — Track and report agent costs weekly
5. **Clean up sessions** — Delete completed sub-agent sessions to save memory

---

*Draft: Feb 3, 2026*
