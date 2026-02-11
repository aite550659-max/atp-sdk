# INTEGRATIONS.md — Apps, Services & Live Dashboard Connections

> **Adding New Services:** When adding a new paid/quota service, also add it to 
> `projects/voice-agent/voice_server.py:get_service_credits()` so it appears 
> in the Usage & Costs dashboard. Include: service name, tier, used, limit, available, unit.

## Live Dashboard Integrations (Auto-Updating)

### ✅ Implemented & Working
| Integration | Source | Update Interval | Notes |
|------------|--------|-----------------|-------|
| **Weather** | wttr.in (free API) | 10 minutes | Westport, CT with emoji + temp |
| **Crypto Prices** | CoinGecko (free API) | 1 minute | BTC, ETH, HBAR with 24h change |
| **Date/Time** | JavaScript | 1 minute | Live EST time |
| **Session Status** | OpenClaw CLI | 30 seconds | Context %, model name |
| **Calendar** | gog CLI | 5 minutes | Today + upcoming 7 days |
| **Gateway Health** | OpenClaw API | 10 seconds | Online/offline status |

### 🔧 Voice Server Endpoints (port 18800)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/status` | GET | Voice agent running status |
| `/start` | POST | Start voice agent |
| `/stop` | POST | Stop voice agent |
| `/visual` | GET/POST | Visual content for dashboard |
| `/visual/clear` | POST | Clear visual content |
| `/calendar` | GET | Calendar events (gog CLI) |
| `/session` | GET | OpenClaw session status |
| `/health` | GET | Server health check |

---

## Current Service Integrations

### ✅ Active & Working
| Service | Tier | Cost | Notes |
|---------|------|------|-------|
| OpenClaw | Stable | — | Core runtime |
| Anthropic API | Pay-as-you-go | ~$0.015/1k tokens (Opus) | Primary model |
| OpenRouter | Credits | Pre-paid balance | Fallback models, GPT-4o-mini |
| ElevenLabs | Free tier | $0 | TTS for voice agent, limited chars/month |
| Google Workspace | Free | $0 | gog CLI — Gmail, Calendar, Drive |
| Telegram | Free | $0 | Primary chat channel |
| Discord | Free | $0 | Bot connected |
| Brave Search | API | — | Web search |
| wttr.in | Free | $0 | Weather data |
| CoinGecko | Free | $0 | Crypto prices |

### 🟡 Partial / Limited
| Service | Issue | Upgrade Path |
|---------|-------|--------------|
| X/Twitter | No API, browser relay only | Twitter API Basic ($100/mo) or keep relay |
| Whisper | Local (slow on CPU) | Deepgram API ($0.0043/min) for speed |
| ElevenLabs | Character limits | Pro tier ($22/mo) for more volume |
| 1Password | Not configured | Setup CLI integration |

### 🔴 Not Yet Integrated
| Service | Purpose | Cost | Auto-Implementable? |
|---------|---------|------|---------------------|
| Ledger | Hardware wallet signing | One-time hardware | ❌ Needs hardware |
| GitHub Copilot | Code assistance | $19/mo | ❌ Needs subscription |
| Notion | Knowledge base | Free tier | ✅ API available |
| Linear | Project management | Free tier | ✅ API available |
| Stripe | Payments (Aite Services) | 2.9% + $0.30/txn | ⚠️ Needs account setup |
| Cal.com | Scheduling | Free tier | ✅ API available |
| Todoist | Task management | Free tier | ✅ API available |
| IFTTT/Zapier | Automation | Free tier | ✅ Webhooks |

---

## Upgrade Candidates (ROI Analysis)

### High Priority
1. **ElevenLabs Pro ($22/mo)**
   - Current: ~10k chars/month free
   - Pro: 100k chars/month
   - ROI: Enables voice agent at scale, client demos

2. **Deepgram API (~$5-10/mo estimated)**
   - Current: Local Whisper (slow, CPU-bound)
   - Benefit: Real-time STT, better accuracy
   - ROI: Faster voice conversations

### Medium Priority
3. **1Password CLI Setup (already have account)**
   - Zero cost, already subscribed
   - Benefit: Secure credential management
   - ROI: Better security, easier secret rotation

4. **Notion Integration (free tier)**
   - Zero cost
   - Benefit: Knowledge base, documentation
   - ROI: Better organization

### Low Priority
5. **Twitter API Basic ($100/mo)**
   - High cost for limited benefit
   - Browser relay works for now
   - Revisit when X engagement justifies cost

---

## Auto-Implementation Checklist

### ✅ Done Today (Feb 3)
- [x] Live weather on dashboard (wttr.in)
- [x] Live crypto prices on dashboard (CoinGecko)
- [x] Live date/time on dashboard
- [x] Session status endpoint
- [x] Calendar endpoint
- [x] Avatar time-based rotation (cron)

### 🔜 Can Implement Now (Free)
- [ ] Email count/unread badge (gog gmail)
- [ ] Drive storage usage (gog drive)
- [ ] Recent activity from memory files
- [ ] HBAR balance from wallet (Hashpack API)

### ⏳ Needs Setup/Keys
- [ ] 1Password CLI (needs setup)
- [ ] Notion API (needs workspace + key)
- [ ] Todoist API (needs key)

---

*Last updated: Feb 3, 2026 5:30 PM*
