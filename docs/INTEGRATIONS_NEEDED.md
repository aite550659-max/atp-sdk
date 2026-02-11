# Integrations Needed for Full Effectiveness

*Priority order for enabling capabilities*

---

## 🔴 Critical (Do First)

### 1. Google Workspace (gog CLI)
**What it enables:**
- Gmail: Send/receive/search emails
- Calendar: Create/view events, scheduling
- Drive: File storage and sharing
- Contacts: Address book access
- Sheets: Data tracking, reports
- Docs: Document creation

**Setup:**
1. Create Google Cloud project
2. Enable Gmail, Calendar, Drive, Contacts, Sheets, Docs APIs
3. Create OAuth credentials (Desktop app)
4. Download `client_secret.json`
5. Run: `gog auth credentials /path/to/client_secret.json`
6. Run: `gog auth add Gregory.L.Bell@gmail.com --services gmail,calendar,drive,contacts,docs,sheets`

**Time:** ~15 minutes

---

### 2. Brave Search API
**What it enables:**
- Web search capability
- Current news/trends lookup
- Research for content creation

**Setup:**
1. Go to https://brave.com/search/api/
2. Create account, get API key (free tier: 2000 queries/month)
3. Run: `openclaw configure --section web`
4. Enter BRAVE_API_KEY

**Time:** ~5 minutes

---

### 3. X/Twitter Posting (Browser Relay)
**What it enables:**
- Post tweets directly
- Follow accounts
- Engage with content

**Setup:**
1. Open X in Chrome, ensure logged in as @TExplorer59
2. Click OpenClaw Browser Relay toolbar icon on X tab
3. I can then control that tab

**Time:** ~2 minutes (when you're available)

---

## 🟡 High Priority

### 4. 1Password CLI (if you have subscription)
**What it enables:**
- Secure credential storage
- Access to stored passwords/keys programmatically

**Alternative:** macOS Keychain (free, already available)

---

### 5. Hedera WalletConnect
**What it enables:**
- Sign transactions via Hashpack approval
- Write to Hedera (HCS messages, transfers)
- No private key exposure

**Setup:** Research needed on Hashpack WalletConnect integration

---

### 6. OpenAI API Key (for memory search)
**What it enables:**
- Semantic memory search across my files
- Better context recall

**Setup:**
1. Get API key from platform.openai.com
2. Add to OpenClaw config

---

## 🟡 High Priority (continued)

### 7. Image Generation API
**What it enables:**
- AI-generated images for X posts
- Visual content that drives engagement
- Custom graphics for market data

**Options:**
- OpenAI DALL-E API (already have OpenAI?)
- Stability AI API
- Replicate (multiple models)
- Midjourney (manual via Discord)

### 8. Dashboard/Chart Generation
**What it enables:**
- Visual market reports
- Portfolio performance charts
- Data storytelling

**Options:**
- QuickChart.io (free, URL-based charts)
- Chart.js + canvas rendering
- Plotly
- Custom HTML dashboards via canvas tool

---

## 🟢 Nice to Have

### 7. ProtonMail (browser automation)
**Current:** Need login session
**Alternative:** Use Gmail via gog once set up

### 8. GitHub CLI (gh)
**What it enables:**
- Repository management
- Issue/PR tracking
- Code collaboration

**Status:** May already be installed, needs auth check

### 9. Apple Integrations
- **Notes (memo):** Already available via skill
- **Reminders (remindctl):** Already available via skill
- **Calendar:** Native macOS, accessible

---

## Daily Checklist Reminder

To be added to HEARTBEAT.md or cron:

```
## Morning Check (9:00 AM)
- [ ] Check Gmail for urgent emails
- [ ] Review calendar for today
- [ ] Check X mentions
- [ ] Review crypto market (daily report)
- [ ] Check Hedera news for content opportunities

## Evening Review (6:00 PM)
- [ ] Log day's activities to memory/
- [ ] Update MEMORY.md if significant learnings
- [ ] Draft next day's X content
- [ ] Check portfolio performance
```

---

## Integration Status Dashboard

| Integration | Status | Priority | Blocker |
|-------------|--------|----------|---------|
| Google (gog) | ❌ Not set up | 🔴 Critical | OAuth setup needed |
| Brave Search | ❌ Not set up | 🔴 Critical | API key needed |
| X/Twitter | ⚠️ Partial | 🔴 Critical | Browser relay needed |
| 1Password | ⚠️ Needs subscription | 🟡 High | Cost |
| Hedera Write | ❌ Not set up | 🟡 High | WalletConnect research |
| OpenAI (memory) | ❌ Not set up | 🟡 High | API key needed |
| ProtonMail | ⚠️ Needs login | 🟢 Nice | Session needed |
| GitHub | ⓘ Check status | 🟢 Nice | Auth check |

---

## Recommended Order

1. **Today:** Brave Search API (5 min) — unlocks research
2. **Today:** X Browser Relay (2 min) — unlocks posting
3. **This week:** Google/gog setup (15 min) — unlocks email/calendar
4. **This week:** OpenAI key for memory search
5. **Later:** Hedera WalletConnect, GitHub

---

*Each integration multiplies my effectiveness. Google alone unlocks ~40% more capability.*
