# Autonomous Loop Integration

How to integrate the autonomous work loop with heartbeats

---

## System Overview

```
Heartbeat Trigger
    ↓
Check for urgent items
    ↓
Nothing urgent? → Execute Autonomous Loop
    ↓
AutonomousLoop.executeIdleWork(maxMinutes)
    ↓
1. Check revenue platforms (2 min)
2. HCS attestation check (1 min)
3. Execute tasks from WorkQueue (remaining time)
    ↓
Report results
```

---

## Integration Points

### 1. Heartbeat Handler (HEARTBEAT.md)

**Current behavior:**
```javascript
// User sends heartbeat prompt
// → I check for urgent items
// → If nothing urgent: reply "HEARTBEAT_OK"
```

**New behavior:**
```javascript
// User sends heartbeat prompt
// → I check for urgent items
// → If nothing urgent: Execute autonomous loop
// → Report what was accomplished
```

### 2. Autonomous Loop Execution

**Invoke during heartbeat:**

```javascript
const AutonomousLoop = require('./lib/autonomous-loop.js');
const loop = new AutonomousLoop();

// Execute 10-minute work cycle
const results = await loop.executeIdleWork(10);

// Format results for user
console.log(`
⚙️ AUTONOMOUS WORK CYCLE COMPLETE

💰 Revenue: ${results.actions.find(a => a.type === 'revenue-check')?.summary}
🔗 HCS: ${results.actions.find(a => a.type === 'hcs-attestation')?.summary}
📋 Tasks: ${results.tasksCompleted}/${results.tasksExecuted} completed

Time: ${Math.floor(results.timeSpentMs / 1000)}s
`);
```

### 3. Work Queue Population

**Populate default tasks on startup:**

```bash
node lib/autonomous-loop.js populate
```

**Default recurring tasks:**
- Revenue checks (Rose Token, Moltbook) — daily
- HCS attestation review — daily
- Cost optimization review — daily
- Hedera news scan — daily
- Crypto market check — daily
- Memory update — weekly

### 4. Task Router Integration

**WorkQueue tasks route through TaskRouter:**

```javascript
const task = workQueue.getNext();
const routing = taskRouter.route(task);
const result = await taskRouter.execute(task, routing);
```

---

## Usage Examples

### Example 1: Heartbeat with Autonomous Work

**Before (old behavior):**
```
[Heartbeat received]
→ Check urgent items
→ Nothing urgent
→ Reply: "HEARTBEAT_OK"
```

**After (new behavior):**
```
[Heartbeat received]
→ Check urgent items
→ Nothing urgent
→ Execute autonomous loop (10 min)
  ├─ Check Rose Token: no tasks
  ├─ Check Moltbook: no jobs
  ├─ HCS attestation: 2 files need review
  ├─ Task 1: Scan Hedera news (completed)
  └─ Task 2: Review cost trends (completed)
→ Reply with summary
```

### Example 2: Manual Invocation

**Run autonomous loop manually:**

```bash
node lib/autonomous-loop.js run 15
```

**Output:**
```
🔄 AUTONOMOUS WORK LOOP STARTING
⏱️  Time budget: 15 minutes

💰 Checking revenue platforms...
   ✅ Rose Token: 0 tasks available
   ✅ Moltbook: 0 jobs available
   
🔗 Checking HCS attestations...
   ⚠️  2 modified files need attestation

📋 Checking work queue (12 min remaining)...

🎯 Executing: Scan Hedera news
   Priority: 5/10 | Estimated: 5 min
   → Routing: ceo-direct
   ✅ Completed: Found 3 relevant articles

🎯 Executing: Review cost trends
   Priority: 6/10 | Estimated: 5 min
   → Routing: ceo-direct
   ✅ Completed: Cost trending down (-12% week over week)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 AUTONOMOUS WORK LOOP COMPLETE
   Tasks executed: 2
   Tasks completed: 2
   Tasks failed: 0
   Time spent: 12m 34s
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Example 3: Add Custom Task to Queue

**Add one-off task:**

```bash
node lib/work-queue.js add '{
  "id": "research-atp-competitors",
  "description": "Research competing agent rental protocols and compare features",
  "priority": 7,
  "category": "research",
  "estimatedMinutes": 15,
  "tags": ["atp", "competition"]
}'
```

**Next heartbeat will pick it up automatically.**

---

## Configuration

### Adjust Time Budget

**In HEARTBEAT.md or config:**

```javascript
// Short cycles (frequent heartbeats)
const results = await loop.executeIdleWork(5);

// Standard cycles (default)
const results = await loop.executeIdleWork(10);

// Deep work cycles (less frequent)
const results = await loop.executeIdleWork(20);
```

### Priority Thresholds

**Only execute high-priority tasks:**

```javascript
const task = queue.getNext({ 
  priority: 7,  // Only priority 7+ tasks
  maxEstimatedMinutes: 10 
});
```

### Category Filters

**Focus on specific work:**

```javascript
// Revenue-focused cycle
const task = queue.getNext({ category: 'revenue' });

// Research-focused cycle
const task = queue.getNext({ category: 'research' });
```

---

## Monitoring

### Check Queue Status

```bash
node lib/work-queue.js stats
```

**Output:**
```json
{
  "pending": 5,
  "inProgress": 0,
  "completed": 12,
  "failed": 1,
  "byCategory": {
    "revenue": 4,
    "research": 3,
    "operations": 5,
    "documentation": 3
  },
  "byPriority": {
    "high": 2,
    "medium": 3,
    "low": 0
  }
}
```

### View Pending Tasks

```bash
node lib/work-queue.js list pending
```

### View Completed Tasks

```bash
node lib/work-queue.js list | jq '.[] | select(.status=="completed")'
```

---

## Best Practices

1. **Keep time budgets realistic** — 10-15 min per heartbeat
2. **Prioritize ruthlessly** — Revenue > Operations > Research
3. **Track what works** — Monitor completion rates by category
4. **Adjust recurrence** — Daily for revenue, weekly for research
5. **Clean up old tasks** — `queue.cleanup(7)` removes tasks >7 days old
6. **Don't block heartbeats** — If a task takes too long, mark failed and move on

---

## Rollout Plan

**Phase 1: Manual Testing (Today)**
- [x] Build autonomous loop system
- [x] Populate default tasks
- [ ] Test manual execution: `node lib/autonomous-loop.js run 10`
- [ ] Verify task routing works
- [ ] Confirm results are useful

**Phase 2: Heartbeat Integration (This Week)**
- [ ] Modify heartbeat handler to call autonomous loop
- [ ] Test with actual heartbeats (every 30 min)
- [ ] Monitor for issues (task timeouts, errors)
- [ ] Tune priorities based on what's useful

**Phase 3: Optimization (Next Week)**
- [ ] Add more task types based on needs
- [ ] Build agent delegation into task execution
- [ ] Create dashboard for queue visualization
- [ ] Implement cross-session coordination

---

*Created: 2026-02-09*
*Status: Ready for testing*
