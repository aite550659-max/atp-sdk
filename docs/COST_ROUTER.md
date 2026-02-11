# Cost Router Architecture

## Purpose
Automatically route AI requests to the most cost-effective service based on:
- Task complexity
- Current credit balances
- Rate limits
- Quality requirements

## Service Tiers

### Tier 1: Premium (Complex reasoning, critical tasks)
| Service | Model | Cost | Use When |
|---------|-------|------|----------|
| Anthropic | Claude Opus | $15/$75 per 1M in/out | Complex reasoning, long context |
| Anthropic | Claude Sonnet | $3/$15 per 1M in/out | Balanced tasks |

### Tier 2: Standard (General tasks)
| Service | Model | Cost | Use When |
|---------|-------|------|----------|
| OpenRouter | GPT-4o-mini | ~$0.15/$0.60 per 1M | Quick responses, voice chat |
| OpenRouter | Llama 3.1 | ~$0.05/$0.20 per 1M | Simple queries |
| Venice.ai | Various | TBD | Privacy-needed, uncensored |

### Tier 3: Free/Local (Cost savings)
| Service | Model | Cost | Use When |
|---------|-------|------|----------|
| Whisper | Local tiny | $0 | All STT |
| macOS TTS | Samantha | $0 | When ElevenLabs exhausted |
| Gemini | Flash | Free tier | Image generation (50/day) |

## Routing Rules

### Priority: FREE → CHEAP → PREMIUM

**Always try free/cheap first, escalate only when needed.**

### By Task Type
```
STT (Speech-to-Text):
  1. Whisper local (FREE) ✅ Always use

TTS (Text-to-Speech):
  1. macOS Samantha (FREE) ← Default now
  2. ElevenLabs (when credits available)

Image Generation:
  1. Gemini Flash (FREE, 50/day)
  2. Midjourney (subscription, unlimited)

LLM - Simple Tasks (Q&A, voice chat, summaries):
  1. GPT-4o-mini via OpenRouter (~$0.15/1M) ← Preferred
  2. Llama 3.1 70B (~$0.05/1M)
  3. Claude Haiku (~$0.25/1M)

LLM - Medium Tasks (code, analysis):
  1. Claude Sonnet ($3/$15 per 1M) ← Cron default
  2. GPT-4o via OpenRouter

LLM - Complex Tasks (deep reasoning, architecture):
  1. Claude Opus ($15/$75 per 1M) ← Only when needed
```

### By Budget State
```
IF anthropic_daily_spend > $50:
  → Route non-critical to OpenRouter
  
IF elevenlabs_chars < 1000:
  → Switch to macOS TTS
  
IF openrouter_balance < $10:
  → Alert user, consider recharge
```

### By Time of Day
```
Peak hours (9am-6pm): Use faster models
Off-peak: Can use slower/cheaper models
Cron jobs: Always use Sonnet (80% cheaper)
```

## Current Service Costs (as of Feb 3, 2026)

| Service | Period | Spent | Notes |
|---------|--------|-------|-------|
| Anthropic API | Jan 31 - Feb 3 | $409.35 | ~$46/charge, 2x/day = $93/day |
| OpenRouter | Feb | $0.72 | $104.78 remaining |
| ElevenLabs | Feb | 9,999 chars | Exhausted, using macOS FREE |
| Midjourney | Yearly | $102.10 | Pro plan, unlimited relaxed |
| Gemini | Feb | Free | 50 req/day limit |
| Whisper | — | Free | Local, unlimited |
| macOS TTS | — | Free | Local, unlimited |

**Total tracked: ~$750 (Jan 31 - Feb 3)**

## Implementation

### Phase 1: Manual Override (Current)
- Switch models via /model command
- Cron jobs already on Sonnet

### Phase 2: Automatic Routing (To Build)
- Add cost tracking to each request
- Implement routing logic in OpenClaw config
- Dashboard shows routing decisions

### Phase 3: Smart Optimization
- ML-based routing decisions
- Learn which tasks need premium models
- Auto-adjust based on budget targets

## Budget Targets
- **Conservative**: $800/mo ($26/day)
- **Growth**: $1,500/mo ($50/day)
- **Current trajectory**: ~$100/day (needs optimization)

## Action Items
- [ ] Confirm Midjourney subscription amount
- [ ] Implement auto-fallback in voice chat ✅ (done for TTS)
- [ ] Add spend alerts when daily threshold exceeded
- [ ] Route heartbeat/cron to Sonnet ✅ (done)
- [ ] Consider Venice.ai for backup LLM
