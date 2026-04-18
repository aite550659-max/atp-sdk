# DevBot Delegation Test Plan

## Pre-Deployment Checklist

- [x] DevBot workspace created (`~/.openclaw/agents/devbot/`)
- [x] Config files in place (`openclaw.json`, `AGENT.md`, `SOUL.md`)
- [x] Agent registry initialized with devbot-001
- [x] Task router integration complete
- [x] Start script created (`bin/start-devbot`)

## Test 1: Start DevBot

```bash
# Start DevBot instance
~/.openclaw/workspace/bin/start-devbot

# Verify running
ps aux | grep "openclaw.*devbot"

# Check logs
tail -f ~/.openclaw/agents/devbot/logs/devbot.log
```

**Expected:** DevBot process running, logs show successful startup

## Test 2: Register as Active

```bash
# From Aite's workspace
cd ~/.openclaw/workspace
node -e "
const AgentRegistry = require('./lib/agent-registry.js');
const registry = new AgentRegistry();
registry.updateStatus('devbot-001', 'active');
console.log('DevBot registered as active');
console.log(JSON.stringify(registry.get('devbot-001'), null, 2));
"
```

**Expected:** devbot-001 status = "active"

## Test 3: Simple Delegation (Manual)

**From Aite (this session):**

```javascript
sessions_send({
  label: "devbot-main",
  message: "ping"
});
```

**Expected:** DevBot receives message, responds with "pong" or similar

## Test 4: Coding Task Delegation

**Task:** "Write a simple hello world function with Jest test"

**From Aite:**

```javascript
sessions_send({
  label: "devbot-main",
  message: `Write a simple hello world function with Jest test.

Requirements:
- Create lib/hello.js with hello() function
- Create tests/hello.test.js with test
- Run test and confirm it passes
- Report results`
});
```

**Expected:**
- DevBot creates files
- Writes test
- Runs test
- Reports back with results

## Test 5: Automatic Routing

**From Aite:**

```javascript
const TaskRouter = require('./lib/task-router.js');
const router = new TaskRouter();

const task = {
  description: "Debug the ATP SDK transaction signing"
};

const decision = router.route(task);
const result = await router.execute(task, decision);

// Should delegate to DevBot automatically
console.log(result.instruction);
```

**Expected:** Router identifies as coding task, provides delegation instruction

## Test 6: Performance Tracking

**After task completion:**

```bash
node lib/agent-registry.js get devbot-001
```

**Expected:**
- `total_tasks` incremented
- `successful_tasks` incremented
- `performance_score` calculated

## Test 7: Error Handling

**Send invalid task:**

```javascript
sessions_send({
  label: "devbot-main",
  message: "Do something impossible"
});
```

**Expected:**
- DevBot attempts task
- Reports failure gracefully
- Error logged but doesn't crash

## Test 8: Concurrent Tasks

**Send two tasks simultaneously:**

```javascript
sessions_send({ label: "devbot-main", message: "Task 1: Write function A" });
sessions_send({ label: "devbot-main", message: "Task 2: Write function B" });
```

**Expected:**
- Both tasks received
- Processed sequentially (no parallel execution yet)
- Both complete successfully

## Test 9: Stop DevBot

```bash
pkill -f "openclaw.*devbot"

# Verify stopped
ps aux | grep "openclaw.*devbot"
```

**Expected:** Process terminated, no devbot processes running

## Test 10: Restart & Recovery

```bash
# Restart DevBot
~/.openclaw/workspace/bin/start-devbot

# Check session recovery
tail -f ~/.openclaw/agents/devbot/logs/devbot.log
```

**Expected:**
- Clean restart
- Sessions recovered
- Ready to receive tasks

---

## Success Criteria

- ✅ DevBot starts and runs stably
- ✅ Receives and responds to messages from Aite
- ✅ Executes coding tasks correctly
- ✅ Reports results in clear format
- ✅ Task router routes coding tasks to DevBot automatically
- ✅ Performance tracking works
- ✅ Error handling is graceful
- ✅ Can stop/restart without issues

---

## Next Steps After Successful Test

1. Deploy SocialBot (social media specialist)
2. Deploy YieldBot to VPS (24/7 DeFi monitoring)
3. Build agent dashboard for monitoring
4. Integrate autonomous loop with heartbeats
5. Create agent coordination patterns (agent-to-agent)

---

*Created: 2026-02-09*
*Status: Ready for deployment testing*
