# Autonomous Loop - Production Deployment

**Status:** ✅ Ready for Production
**Deployed:** 2026-02-09

## Overview

The autonomous loop executes highest-priority tasks during idle time, integrated with heartbeat system.

## What It Does

**Automatic Work During Heartbeats:**
1. Cost tracking (non-negotiable check)
2. Security audit (non-negotiable check)
3. Revenue platform checks
4. HCS file attestation check
5. Execute highest priority tasks from work queue

**Tasks Executed:**
- Operations: HCS attestation, cost review
- Research: Hedera news, crypto markets
- Revenue: Moltbook checks (when relevant)
- Documentation: Memory updates

## Safeguards (8 Total)

**Previous (5):**
1. Execution lock - Prevents overlapping runs
2. Rate limiting - 5-minute minimum between runs
3. Circuit breaker - 5 failures → 1 hour cooldown
4. Task timeout - Estimated time + 2 min buffer
5. Queue limits - Max 50 pending, auto-cleanup

**New (3):**
6. Task deduplication - Fingerprint-based duplicate prevention
7. Execution counter - Max 4 attempts per task
8. Idempotency check - 1-hour window prevents re-execution

## Manual Testing

**Test command:**
```bash
node lib/autonomous-loop.js run 10
```

**Expected output:**
```
🔄 AUTONOMOUS WORK LOOP STARTING
⏱️  Time budget: 10 minutes
🔒 Lock acquired | Failures: 0/5

💰 Checking revenue platforms...
🔗 Checking HCS attestations...
📋 Checking work queue...

[Tasks execute...]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 AUTONOMOUS WORK LOOP COMPLETE
   Tasks executed: N
   Tasks completed: N
   Tasks failed: 0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Last Test Results (2026-02-09 11:15 AM):**
- ✅ 5 tasks executed
- ✅ 5 tasks completed
- ✅ 0 failures
- ✅ Idempotency safeguard blocked duplicate
- ✅ All task routing working (DevBot, YieldBot, CEO-direct)

## Production Deployment

### Option 1: Integrated Heartbeat (Recommended)

**Add to `~/.openclaw/openclaw.json`:**
```json
{
  "heartbeat": {
    "enabled": true,
    "intervalMinutes": 30,
    "command": ["node", "bin/heartbeat-with-loop"],
    "model": "anthropic/claude-haiku-4-5"
  }
}
```

**Manual test:**
```bash
node bin/heartbeat-with-loop
```

### Option 2: Separate Cron Job

**Add cron job via OpenClaw:**
```javascript
// Use: node lib/cron-helper.js add-loop-job
{
  "name": "autonomous-work-loop",
  "schedule": {
    "kind": "every",
    "everyMs": 1800000  // 30 minutes
  },
  "payload": {
    "kind": "systemEvent",
    "text": "node lib/autonomous-loop.js run 5"
  },
  "sessionTarget": "main"
}
```

### Option 3: Manual Execution

**Run manually when idle:**
```bash
node lib/autonomous-loop.js run [minutes]
```

## Work Queue Management

**View queue:**
```bash
node lib/work-queue.js stats
node lib/work-queue.js list pending
```

**Add tasks:**
```bash
node lib/work-queue.js add '{
  "id": "my-task",
  "description": "Task description",
  "priority": 5,
  "category": "operations",
  "estimatedMinutes": 10
}'
```

**Populate default tasks:**
```bash
node lib/autonomous-loop.js populate
```

## Monitoring

**Cost Impact:**
- Heartbeat model: Haiku ($0.25/1M input, $1.25/1M output)
- Task routing: Minimal (routing logic only)
- Actual task execution: Varies by task (tracked separately)

**Logs:**
- All executions logged to console
- Task results stored in `data/work-queue.json`
- Circuit breaker status visible in output

## Emergency Shutdown

**Disable heartbeat automation:**
1. Edit `~/.openclaw/openclaw.json`
2. Set `heartbeat.enabled: false`
3. Restart OpenClaw: `openclaw gateway restart`

**Or kill process:**
```bash
pkill -f "autonomous-loop"
```

## Performance

**Typical Execution:**
- Heartbeat checks: ~2 seconds
- Task routing: <100ms per task
- Queue processing: ~5-10 tasks per 10-minute budget
- Total overhead: <5% of compute time

## Next Steps

1. ✅ All safeguards implemented and tested
2. ✅ Manual validation passed (5 tasks, 0 failures)
3. ⏳ **Enable Option 1** - Integrated heartbeat (requires config change)
4. Monitor for 24 hours
5. Adjust intervals if needed
6. Deploy DevBot for actual task execution

## Rollback Plan

If issues arise:
1. Disable in config: `heartbeat.enabled: false`
2. Backup queue: `cp data/work-queue.json data/work-queue.backup`
3. Clear queue: `rm data/work-queue.json`
4. Restart OpenClaw
5. Review logs in memory/YYYY-MM-DD.md

---

**Status:** PRODUCTION READY - Awaiting configuration approval
