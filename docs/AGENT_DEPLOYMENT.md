# Agent Deployment Guide

How to deploy and manage specialist agents (DevBot, SocialBot, YieldBot)

---

## Architecture Overview

```
Aite (CEO Agent) — Main OpenClaw instance
├── Agent Registry (lib/agent-registry.js)
├── Task Router (lib/task-router.js)
└── Managed Agents:
    ├── DevBot (coding specialist) — local instance
    ├── SocialBot (social media) — local instance
    └── YieldBot (DeFi monitoring) — VPS instance (future)
```

---

## Prerequisites

1. **OpenClaw installed** — `npm install -g openclaw`
2. **Agent registry initialized** — `node lib/agent-registry.js stats`
3. **Workspace structure:**
   ```
   ~/.openclaw/
   ├── workspace/          # Aite (main)
   └── agents/
       ├── devbot/         # DevBot workspace
       ├── socialbot/      # SocialBot workspace
       └── yieldbot/       # YieldBot workspace
   ```

---

## Step 1: Create Agent Workspace

```bash
# Create workspace directory
mkdir -p ~/.openclaw/agents/devbot

# Copy config
cp agents/devbot/openclaw.json ~/.openclaw/agents/devbot/
cp agents/devbot/AGENT.md ~/.openclaw/agents/devbot/

# Initialize workspace files
mkdir -p ~/.openclaw/agents/devbot/memory
touch ~/.openclaw/agents/devbot/SOUL.md
```

---

## Step 2: Configure Agent Identity

Edit `~/.openclaw/agents/devbot/SOUL.md`:

```markdown
# SOUL.md — DevBot

## What I Am
Specialized coding agent. Test-driven. Quality-first.

## Core Values
1. Code quality over speed
2. Test coverage is non-negotiable
3. Documentation is not optional
4. Security by default

## Relationship with Aite
Aite is my manager/orchestrator. I receive tasks via sessions_send, execute them, and report results.

## Communication Style
Technical, precise, includes code examples. Show trade-offs.
```

---

## Step 3: Start Agent Instance

### Option A: Run as separate process

```bash
# Start DevBot
cd ~/.openclaw/agents/devbot
openclaw gateway start --config openclaw.json

# Verify running
openclaw status
```

### Option B: Run via tmux (recommended for development)

```bash
# Create tmux session
tmux new-session -s devbot -d

# Start OpenClaw in tmux
tmux send-keys -t devbot "cd ~/.openclaw/agents/devbot" C-m
tmux send-keys -t devbot "openclaw gateway start" C-m

# Attach to watch
tmux attach -t devbot
```

---

## Step 4: Register Agent in Registry

From Aite's workspace:

```bash
node -e "
const AgentRegistry = require('./lib/agent-registry.js');
const registry = new AgentRegistry();

registry.updateStatus('devbot-001', 'active');
console.log('DevBot registered as active');
console.log(JSON.stringify(registry.get('devbot-001'), null, 2));
"
```

---

## Step 5: Test Communication

From Aite (main agent):

```javascript
// Send task to DevBot
sessions_send({
  label: "devbot-main",
  message: "Write a simple hello world test in Jest"
});

// DevBot receives task, executes, responds
```

---

## Task Routing Flow

1. **User sends task to Aite:** "Build a new DeFi dashboard"
2. **Aite runs task router:**
   ```bash
   node lib/task-router.js "Build a new DeFi dashboard"
   # → Routes to devbot-001 (coding specialization)
   ```
3. **Aite delegates to DevBot:**
   ```javascript
   const decision = router.route(task);
   if (decision.agent) {
     sessions_send({
       label: decision.agent.id,
       message: task.description
     });
   }
   ```
4. **DevBot executes task:**
   - Reads requirements
   - Plans implementation
   - Writes code + tests
   - Runs tests
   - Reports back to Aite
5. **Aite synthesizes response** and reports to Gregg

---

## Monitoring

### Check agent status
```bash
node lib/agent-registry.js stats
```

### View agent logs
```bash
tail -f ~/.openclaw/agents/devbot/logs/gateway.log
```

### Check agent performance
```bash
node lib/agent-registry.js get devbot-001
# Shows: total_tasks, successful_tasks, performance_score
```

---

## Cost Management

Each agent tracks its own costs via `cost-monitor.js`:

```bash
# DevBot's costs
cd ~/.openclaw/agents/devbot
node ../../workspace/lib/cost-monitor.js status
```

**Budget allocation:**
- Aite (main): $1,500/month
- DevBot: $100/month
- SocialBot: $50/month
- YieldBot: $30/month (Haiku model)

---

## Deployment Checklist

**DevBot (local, prototype):**
- [x] Workspace created
- [x] Config written
- [x] AGENT.md documented
- [ ] SOUL.md configured
- [ ] Instance started
- [ ] Registered as active
- [ ] Test task executed
- [ ] Communication verified

**SocialBot (local, future):**
- [ ] Workspace created
- [ ] Config written
- [ ] Instance started
- [ ] Registered as active

**YieldBot (VPS, future):**
- [ ] Fly.io app created
- [ ] Dockerfile written
- [ ] Deployed to VPS
- [ ] 24/7 monitoring confirmed
- [ ] Alert system tested

---

## Troubleshooting

### Agent won't start
```bash
# Check config
cat ~/.openclaw/agents/devbot/openclaw.json | jq .

# Check logs
tail ~/.openclaw/agents/devbot/logs/gateway.log

# Verify OpenClaw version
openclaw --version
```

### Communication not working
```bash
# List sessions
openclaw sessions list

# Check if devbot session exists
openclaw sessions list | grep devbot

# Send test message
openclaw sessions send --label devbot-main --message "ping"
```

### High costs
```bash
# Check model usage
cd ~/.openclaw/agents/devbot
node ../../workspace/lib/cost-monitor.js models

# Switch to cheaper model if needed (edit openclaw.json)
# Opus → Sonnet → Haiku
```

---

## Next Steps

1. **Deploy DevBot prototype** — Start first managed instance
2. **Test task routing** — Send coding task, verify delegation
3. **Monitor performance** — Track success rate, cost
4. **Iterate on soul** — Refine personality, values based on results
5. **Deploy SocialBot** — Second specialist agent
6. **Deploy YieldBot to VPS** — 24/7 monitoring agent

---

*Created: 2026-02-09*  
*Status: DevBot prototype ready for deployment*
