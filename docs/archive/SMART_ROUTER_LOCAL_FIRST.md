# Smart Router: Local-First Execution

**Updated:** 2026-02-22
**Location:** `lib/smart-router.js`

## Overview

Smart router now prioritizes **local execution** (shell scripts) over LLM calls whenever possible, with automatic fallback to LLM when local execution fails or isn't applicable.

## Philosophy

**LOCAL FIRST → LLM FALLBACK**
- Try shell script first (cost: $0, latency: <1s)
- If script succeeds → return result, no LLM call
- If script fails → route to appropriate LLM for interpretation

## Local-Capable Tasks

| Task | Local Script | Fallback Model | Cost Savings |
|------|--------------|----------------|--------------|
| **heartbeat** | `bin/local-heartbeat-check` | haiku | $0.002/check |
| **file-check** | `bin/file-check` | haiku | $0.002/check |
| **service-status** | `bin/service-status-check` | haiku | $0.002/check |
| **security-audit** | `lib/security-check.sh` | haiku | $0.002/check |
| **cost-check** | `lib/cost-monitor.js` | haiku | $0.002/check |
| **total-recall-health** | `bin/verify-total-recall` | haiku | $0.002/check |
| **hcs-status** | `bin/hcs-status-check` | haiku | $0.002/check |
| **cron-status** | `bin/cron-status-check` | haiku | $0.002/check |

**Estimated savings:** ~$0.048/day (24 hourly heartbeats) = **$1.44/month**

## How It Works

```
User/System requests task
         ↓
Smart Router checks LOCAL_TASKS
         ↓
   [Is task local-capable?] → No → Route to LLM (existing logic)
         ↓ Yes
   Try local execution (shell script)
         ↓
   [Script succeeded?] → Yes → Return result (cost: $0)
         ↓ No
   Route to fallback model (LLM interprets failure)
```

## Usage

### Programmatic
```javascript
const router = require('./lib/smart-router');

// Try heartbeat - will use local if possible
const result = router.route({ task: 'heartbeat' });

if (result.execution === 'local') {
  console.log('Local execution succeeded:', result.output);
} else {
  console.log('LLM fallback:', result.model);
}
```

### CLI
```bash
# Route heartbeat (will try local first)
node lib/smart-router.js heartbeat

# Force LLM (override local)
node lib/smart-router.js heartbeat --override=opus

# Check what's local-capable
node lib/smart-router.js --list-local
```

## Local Execution Requirements

For a task to execute locally:
1. Task listed in `LOCAL_TASKS` registry
2. Script exists at specified path
3. Script is executable (`chmod +x`)
4. Script exits 0 on success, non-zero on failure
5. Script completes within 30 seconds

## When Local Execution Fails

**Automatic fallback to LLM when:**
- Script doesn't exist
- Script execution errors
- Script times out (>30s)
- Script exits non-zero (detected issues)

**Example:** Heartbeat check finds issues → Script exits 1 → Router uses Haiku to interpret and respond

## Cost Comparison

### Before (All LLM)
```
24 hourly heartbeats/day × $0.002 = $0.048/day
Monthly: $1.44
```

### After (Local-First)
```
24 hourly checks/day × $0 = $0/day
Monthly: $0

(LLM only when issues detected)
```

**Annual savings:** ~$17.28 from heartbeats alone

## Adding New Local Tasks

1. **Create shell script:**
```bash
#!/bin/bash
# bin/my-check

# Do checks
if [ check_passes ]; then
  echo "✅ Check passed"
  exit 0
else
  echo "❌ Check failed"
  exit 1
fi
```

2. **Register in smart router:**
```javascript
LOCAL_TASKS['my-check'] = {
  script: 'bin/my-check',
  fallbackModel: 'haiku',
  description: 'Check something without LLM'
};
```

3. **Test:**
```bash
node lib/smart-router.js my-check
```

## Script Standards

**All local scripts must:**
- Exit 0 on success (HEARTBEAT_OK)
- Exit non-zero on failure/issues
- Print concise output (not verbose logs)
- Complete within 30 seconds
- Handle missing env vars gracefully
- Be idempotent (safe to run repeatedly)

**Example template:**
```bash
#!/bin/bash
set -euo pipefail

WORKSPACE="${OPENCLAW_WORKSPACE:-$HOME/.openclaw/workspace}"

# Do check
if [ -f "$WORKSPACE/some-file" ]; then
  echo "✅ Check passed"
  exit 0
else
  echo "❌ Check failed: file missing"
  exit 1
fi
```

## Monitoring

**Check local execution success rate:**
```bash
# See which tasks went local vs LLM
grep "local-first" ~/.openclaw/logs/*.log
```

**Cost tracking:**
```bash
# Compare before/after
node lib/cost-monitor.js models
```

## Fallback Behavior

**Override local execution:**
```javascript
// Force LLM even if local-capable
router.route({
  task: 'heartbeat',
  override: 'opus'  // Skip local, go straight to Opus
});
```

**Specialty routing bypasses local:**
```javascript
// Specialty tasks skip local checks
router.route({
  task: 'heartbeat',
  specialty: 'web-search'  // Will use gemini_flash
});
```

## Limitations

**Local execution NOT suitable for:**
- Tasks requiring reasoning (analysis, strategy)
- Tasks needing LLM capabilities (writing, coding)
- Tasks with complex decision trees
- Tasks requiring conversation history
- Tasks needing external APIs (web search, etc.)

**Local execution IDEAL for:**
- Health checks (heartbeat, service status)
- File validation (exists, recent, size)
- System status (cron jobs, processes, disk)
- Simple pass/fail checks
- Threshold monitoring (cost, memory, etc.)

## Configuration

**Environment variables:**
```bash
export OPENCLAW_WORKSPACE=/path/to/workspace
export LOCAL_EXECUTION_TIMEOUT=30  # seconds
export LOCAL_EXECUTION_ENABLED=true  # or false to disable
```

**Per-task configuration:**
```javascript
LOCAL_TASKS['heartbeat'].enabled = false;  // Disable local for this task
```

## Troubleshooting

**"script not found"**
→ Create script at path specified in LOCAL_TASKS

**"permission denied"**
→ `chmod +x ~/.openclaw/workspace/bin/script-name`

**"timeout"**
→ Script took >30s, optimize or increase timeout

**Falls back to LLM every time:**
→ Check script exits 0 on success: `bash script.sh && echo "OK"`

---

## Summary

**Before:** All heartbeats = $0.002 × 24/day = $1.44/month
**After:** Local heartbeats = $0/month (LLM only when issues detected)

**Applies to:** heartbeat, file-check, service-status, security-audit, cost-check, total-recall-health, hcs-status, cron-status

**Next:** Add more local-capable tasks as identified.

---

*Last updated: 2026-02-22*
