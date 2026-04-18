# Smart Model Router

**Implemented:** February 5, 2026
**Location:** `lib/smart-router.js`
**Config:** `~/.openclaw/openclaw.json`

## Overview

Intelligent model routing system that optimizes for cost, speed, and quality by routing tasks to the most appropriate model based on task type and requirements.

## Philosophy

1. **Anthropic-first**: Use Max 20x budget for general tasks
2. **Specialty routing**: Route to consensus best-in-class for specific capabilities
3. **OpenRouter sparingly**: Lower subscription tier, use for specialties only

## Model Tiers

### Primary Stack (Anthropic - Max 20x Budget)

| Tier | Model | Cost/turn | Use Cases |
|------|-------|-----------|-----------|
| 1-2 | Haiku | $0.002 | Heartbeats, triage, classification, simple tasks |
| 3 | Sonnet | $0.022 | Coding, writing, analysis, vision |
| 4 | Opus | $0.109 | Conversation, strategy, complex reasoning |

### Specialty Models (OpenRouter - Use Sparingly)

| Model | Best For | When to Use |
|-------|----------|-------------|
| Gemini Flash | Web search, long context | Real-time info, >200k tokens |
| Gemini Pro | Video, image generation | Video understanding, Imagen |
| DeepSeek | Math, budget coding | Mathematical problems |
| DeepSeek-R1 | Hard math, reasoning chains | Competition math, explicit CoT |
| o1 | Science, formal reasoning | Scientific research |
| GPT-4o | OpenAI compatibility | When OpenAI API required |

## Routing Logic

```
Task → Check Specialty Requirements
         ↓
    [Specialty needed?] → Yes → Route to best-in-class
         ↓ No
    Check Auto-detect (web search, video, >200k context)
         ↓
    [Auto-detected?] → Yes → Route to specialty model
         ↓ No
    Standard Task Routing (Anthropic stack)
         ↓
    Apply Complexity Signals (+1 or +2 tiers)
         ↓
    Apply Task Max Tier Cap
         ↓
    Select Anthropic model at target tier
```

## Usage

### CLI

```bash
# Standard tasks (Anthropic-first)
node lib/smart-router.js heartbeat           # → haiku
node lib/smart-router.js code-complex        # → sonnet
node lib/smart-router.js conversation        # → opus

# Specialty routes
node lib/smart-router.js --specialty=web-search      # → gemini_flash
node lib/smart-router.js --specialty=math-hard       # → deepseek_r1
node lib/smart-router.js --specialty=video-analysis  # → gemini_pro

# Auto-detection
node lib/smart-router.js research --web-search       # → gemini_flash
node lib/smart-router.js long-document --context=500000  # → gemini_flash

# Analysis
node lib/smart-router.js --analyze strategy

# Generate config patch
node lib/smart-router.js --config
```

### Programmatic

```javascript
const router = require('./lib/smart-router');

// Basic routing
const { model } = router.route({ task: 'heartbeat' });

// With specialty
const { model } = router.route({ specialty: 'web-search' });

// With signals
const { model } = router.route({
  task: 'code-complex',
  signals: ['security-sensitive']
});

// Full analysis
const analysis = router.analyze({ task: 'strategy' });
```

## Configuration Applied

```json
{
  "agents": {
    "defaults": {
      "heartbeat": { "model": "anthropic/claude-haiku-4-5" },
      "subagents": { "model": "anthropic/claude-haiku-4-5" },
      "model": {
        "primary": "anthropic/claude-opus-4-5",
        "fallbacks": [
          "anthropic/claude-sonnet-4-5",
          "anthropic/claude-haiku-4-5",
          "openrouter/google/gemini-2.5-flash",
          "openrouter/deepseek/deepseek-chat"
        ]
      }
    }
  }
}
```

## Cost Comparison

Based on Jan 31 - Feb 5, 2026 usage:

| Metric | Before (91% Opus) | After (Smart Router) | Savings |
|--------|-------------------|----------------------|---------|
| 5-day spend | $563 | $173 | 69% |
| Daily average | $113 | $35 | $78/day |
| Monthly projected | $3,380 | $1,040 | $2,341/mo |

## Task Types

| Task | Default Model | Max Tier | Notes |
|------|---------------|----------|-------|
| heartbeat | haiku | 2 | Automated checks |
| file-check | haiku | 1 | Simple verification |
| classification | haiku | 1 | Categorization |
| summarize | haiku | 2 | Text summarization |
| code-simple | sonnet | 3 | Basic coding |
| code-complex | sonnet | 4 | Architecture, debugging |
| write-draft | sonnet | 3 | Content creation |
| conversation | opus | 4 | Direct human interaction |
| strategy | opus | 4 | Complex planning |
| web-search | gemini_flash | 3 | Real-time web access |
| video-analysis | gemini_pro | 3 | Video understanding |
| math-competition | deepseek_r1 | 4 | Hard math problems |

## Complexity Signals

Signals that upgrade the model tier:

**+1 Tier:**
- multiple-files
- external-api
- state-management

**+2 Tiers:**
- security-sensitive
- financial-transaction
- public-facing
- irreversible-action
- multi-system-coordination

## Maintenance

The router lives in the workspace (`lib/smart-router.js`) and survives OpenClaw updates. To update model costs or add new models, edit the `MODELS` object in the file.

---

*Last updated: February 5, 2026*
