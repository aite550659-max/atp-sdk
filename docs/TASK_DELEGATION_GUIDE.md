# Task Delegation Guide

How to delegate tasks from Aite (CEO) to specialist agents

---

## Architecture

```
User Request
    ↓
Aite (CEO Agent) — Receives, analyzes
    ↓
TaskRouter — Analyzes task properties
    ↓
Routing Decision:
    ├→ DevBot (coding tasks)
    ├→ SocialBot (social media)
    ├→ YieldBot (DeFi monitoring)
    ├→ Sub-agent (quick ephemeral tasks)
    └→ CEO Direct (complex reasoning, sequential)
    ↓
Execute & Report Back
```

---

## How to Delegate (From Aite)

### Method 1: Automatic Routing

```javascript
const TaskRouter = require('./lib/task-router.js');
const router = new TaskRouter();

// Analyze and route
const decision = router.route({
  description: "Write unit tests for ATP SDK"
});

// Execute routing decision  
const result = await router.execute(task, decision);

// Result contains instructions for delegation
console.log(result.instruction);
// → "Use sessions_send({ label: 'devbot-001', message: '...' })"
```

### Method 2: Direct Delegation

```javascript
// Send task directly to DevBot
sessions_send({
  label: "devbot-main",  // DevBot's session label
  message: "Debug the transaction signing issue in lib/hedera-client.js"
});
```

### Method 3: Spawn Sub-Agent

```javascript
// For quick, disposable tasks
sessions_spawn({
  task: "Search for latest Hedera news and summarize top 3 articles",
  cleanup: "delete",  // Auto-cleanup after completion
  runTimeoutSeconds: 300
});
```

---

## Routing Rules (Automatic)

| Task Type | Routes To | Why |
|-----------|-----------|-----|
| **Coding/debugging** | DevBot | Specialization = coding |
| **Social media** | SocialBot | Specialization = social-media |
| **DeFi monitoring** | YieldBot | Specialization = defi-monitoring |
| **Quick (<5 min)** | Sub-agent | Ephemeral, low overhead |
| **Parallelizable** | Fan-out | Multiple sub-agents + synthesize |
| **Sequential reasoning** | CEO Direct | Avoid -39% multi-agent penalty |
| **Complex strategy** | CEO Direct | Needs full context |

---

## DevBot Usage Examples

### Example 1: Write Tests

**Task:** "Write unit tests for the ATP rental flow"

**Aite delegates:**
```javascript
sessions_send({
  label: "devbot-main",
  message: `Write comprehensive unit tests for the ATP SDK rental flow.

Requirements:
- Test rental initiation
- Test rental completion
- Test failure scenarios (insufficient stake, invalid agent)
- Use Jest framework
- Aim for >80% coverage

Location: ~/atp-sdk/tests/rental.test.js`
});
```

**DevBot executes:**
1. Reads ATP SDK code
2. Writes test file
3. Runs tests to verify they pass
4. Reports back with results

### Example 2: Debug Issue

**Task:** "Debug why Hedera transaction fails with INSUFFICIENT_TX_FEE"

**Aite delegates:**
```javascript
sessions_send({
  label: "devbot-main",
  message: `Debug Hedera transaction fee issue:

Error: INSUFFICIENT_TX_FEE when calling AccountCreateTransaction

Steps:
1. Check current fee calculation in lib/hedera-client.js
2. Compare with Hedera SDK examples
3. Test fix with testnet
4. Document the solution

Report back with root cause and fix.`
});
```

**DevBot executes:**
1. Examines code
2. Identifies fee calculation bug
3. Implements fix
4. Tests on testnet
5. Reports back with explanation + diff

### Example 3: Build Feature

**Task:** "Build REST API for ATP indexer"

**Aite delegates:**
```javascript
sessions_send({
  label: "devbot-main",
  message: `Build REST API for ATP indexer service:

Endpoints needed:
- GET /agents — List all agents
- GET /agents/:id — Get agent details
- GET /rentals — List active rentals
- GET /rentals/:id — Get rental details

Requirements:
- Express.js framework
- Input validation
- Rate limiting
- API documentation (OpenAPI spec)
- Unit tests for each endpoint

Location: ~/atp-indexer/api/`
});
```

---

## Communication Protocol

### DevBot → Aite (Response Format)

```markdown
## Task: [Brief description]

### Status: ✅ Completed | ⚠️ Blocked | ❌ Failed

### What I Did:
- [Action 1]
- [Action 2]
- [Action 3]

### Results:
[Code, test output, or deliverables]

### Next Steps:
[What should happen next, if anything]

### Notes:
[Any important context or decisions made]
```

### Example Response:

```markdown
## Task: Write ATP rental flow tests

### Status: ✅ Completed

### What I Did:
- Created tests/rental.test.js with 12 test cases
- Tested happy path (initiate → complete)
- Tested failure scenarios (insufficient stake, invalid agent, expired rental)
- Achieved 87% code coverage on rental module

### Results:
```bash
PASS tests/rental.test.js
  ATP Rental Flow
    ✓ initiates rental with valid stake (45ms)
    ✓ rejects rental with insufficient stake (12ms)
    ✓ completes rental and releases stake (38ms)
    ✓ handles expired rentals (15ms)
    ...

Test Suites: 1 passed, 1 total
Tests:       12 passed, 12 total
Coverage:    87.3% (rental.js)
```

### Next Steps:
- Deploy to testnet and run integration tests
- Add edge case tests for concurrent rentals

### Notes:
- Used Jest's fake timers for rental expiration tests
- Mocked HCS topic ID to avoid testnet rate limits
```

---

## Monitoring Delegation

### Check Agent Status

```bash
# List all agents
node lib/agent-registry.js list

# Get DevBot details
node lib/agent-registry.js get devbot-001

# View DevBot logs
tail -f ~/.openclaw/agents/devbot/logs/devbot.log
```

### Track Performance

```javascript
const registry = new AgentRegistry();

// Record task completion
registry.recordTask('devbot-001', success = true);

// Check performance score
const agent = registry.get('devbot-001');
console.log(`Success rate: ${(agent.performance_score * 100).toFixed(1)}%`);
console.log(`Total tasks: ${agent.total_tasks}`);
```

---

## Troubleshooting

### DevBot Not Responding

**Check if running:**
```bash
ps aux | grep "openclaw.*devbot"
```

**Check logs:**
```bash
tail -f ~/.openclaw/agents/devbot/logs/devbot.log
```

**Restart:**
```bash
pkill -f "openclaw.*devbot"
~/.openclaw/workspace/bin/start-devbot
```

### Task Not Being Routed

**Test routing manually:**
```bash
node lib/task-router.js "Your task description here"
```

**Check agent registry:**
```bash
node lib/agent-registry.js stats
```

**Verify agent is active:**
```bash
node lib/agent-registry.js get devbot-001 | jq .status
# Should return: "active"
```

---

## Best Practices

1. **Be specific in delegation** — Give clear requirements, not vague instructions
2. **Include context** — File paths, error messages, expected behavior
3. **Set success criteria** — How will you know it's done correctly?
4. **Track performance** — Use `recordTask()` to build agent performance history
5. **Review results** — Don't blindly trust delegated work
6. **Iterate on instructions** — Refine delegation patterns based on what works

---

*Created: 2026-02-09*
*Status: DevBot deployment ready*
