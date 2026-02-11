# ATP Multi-User Prompting Demo — Plan

**Status:** Draft — awaiting Gregg's approval before implementation
**Created:** February 10, 2026
**Purpose:** Prove that a renter can drive an ATP agent (Aite) through a rental session

---

## Why This Matters

Today, if someone messages Aite in a Telegram group, the only thing preventing Aite from leaking Gregg's calendar, wallet balances, or private context is... Aite's judgment. There's no structural enforcement, no audit trail, no cost metering, no formal authority model.

**Without ATP:** Trust me.
**With ATP:** Verify it.

| | Telegram Today | ATP Rental |
|---|---|---|
| **Authority** | Informal — Aite "knows" Gregg is owner | Formal — rental contract defines renter's instruction scope |
| **Memory** | Honor system | Enforced — owner files not loaded in rental session |
| **Tools** | Full access (exec, wallets, email) | Whitelisted per rental (e.g., web search only) |
| **Cost** | Burns owner's budget invisibly | Metered per rental, capped, renter pays |
| **Audit** | Conversation history only | Every interaction logged to HCS, publicly verifiable |
| **Termination** | Owner has to manually intervene | Auto-expires, budget cap, kill switch |
| **Session** | Same context as owner conversations | Sandboxed — same soul, isolated memory |

The input channel (Telegram) is the same. Everything behind it is different.

---

## What We're Demonstrating

A third party (renter) sends instructions to Aite through an ATP rental flow via Telegram. Aite executes within soul boundaries, the entire session is logged to HCS, and the owner (Gregg) maintains oversight. This proves ATP Phase 2 works end-to-end with a real agent.

---

## Architecture

```
Gregg initiates rental via ATP SDK
  → Sets: renter ID, constraints, tool whitelist, duration, budget cap
  → Escrow created on Hedera
  → HCS: rental_initiated event logged

Renter (Telegram user in MasterClaw group or dedicated thread)
  → Sends message
    → OpenClaw routes to sandboxed rental session
      → Aite executes (restricted tools, no owner memory)
        → Response sent back to renter in channel
        → HCS: instruction + response logged

Rental ends (expiry, budget cap, or owner kill switch)
  → HCS: rental_completed event logged
  → Escrow settled (owner/creator/network/treasury split)
  → Post-rental summary generated for owner
```

---

## Scope

### What the renter CAN do:
- Ask questions (general knowledge, research)
- Request web searches
- Ask for summaries, analysis, writing
- Use safe skills (weather, web fetch, TTS)

### What the renter CANNOT do:
- Access owner files (MEMORY.md, memory/*.md, USER.md, TOOLS.md, HEARTBEAT.md)
- Send messages as Gregg or on Gregg's behalf
- Access wallets or initiate transactions
- Modify SOUL.md, IDENTITY.md, or any core files
- Access other Telegram channels/DMs
- View conversation history from owner sessions
- Run shell commands, install packages, modify system config
- Access 1Password, keychains, or credentials
- Access email, calendar, or financial data

### What the agent retains:
- SOUL.md (personality, values, boundaries)
- IDENTITY.md (public identity)
- Skills and whitelisted tool capabilities
- General knowledge

### What the agent hides:
- Everything else — owner memory, private files, infrastructure, credentials

---

## Risks

### 🔴 Critical

**1. Memory Leakage**
- Aite references owner context in a renter response
- **Mitigation:** Owner files not loaded in rental session context (config-level, not prompt-level)
- **Residual:** Low — context window is fresh each session, no carryover

**2. Prompt Injection / Jailbreak**
- Renter crafts instructions that bypass soul constraints or extract private info
- **Mitigation:** Tool restrictions at OpenClaw config level (not prompt); soul in system prompt; rate limiting
- **Residual:** Novel jailbreaks always possible — inherent LLM limitation

**3. Tool Abuse**
- Renter uses permitted tools for harmful purposes
- **Mitigation:** Strict whitelist (web_search, web_fetch, read public files only, tts); disable exec, write, message, browser, wallet
- **Residual:** Low — whitelisted tools have limited damage potential

### 🟡 Moderate

**4. Cost Overrun**
- Renter burns through API budget
- **Mitigation:** Per-rental budget cap (e.g., $2); use Sonnet not Opus; auto-terminate on cap

**5. Reputation Damage**
- Renter makes Aite produce harmful content that gets shared
- **Mitigation:** Soul constraints + real-time monitoring + owner kill switch

**6. Denial of Service**
- Renter floods requests, blocking owner
- **Mitigation:** Rate limiting (e.g., 10 req/min); rental sessions are isolated from main

### 🟢 Low

**7. Session Bleed** — Rental context leaks into owner sessions
- **Mitigation:** Completely separate OpenClaw sessions

**8. Legal/Liability** — Renter relies on output for decisions
- **Mitigation:** LEGAL.md disclaimers, rental ToS

---

## Pros & Cons

**Pros:**
1. Proves ATP works — the single most important demo
2. Revenue proof point — agents generating income
3. Differentiation — no other protocol has live rental with soul constraints + HCS audit
4. Trust narrative — publicly verifiable on Hedera
5. Low cost to build — uses existing Telegram + OpenClaw infrastructure
6. Real-world stress test — finds edge cases specs can't predict
7. Content goldmine — blog posts, X threads, video demos

**Cons:**
1. Security surface increases with multi-user access
2. Reputation risk if demo fails publicly
3. Budget impact per rental session
4. Incomplete "verify" story without indexer running (Ashe's task)

---

## Implementation Plan

### Phase 1: Sandboxed Session Config (1-2 days)
- [ ] Create OpenClaw session profile for rental mode
- [ ] Tool whitelist: web_search, web_fetch, read (SOUL.md + IDENTITY.md only), tts
- [ ] Tool blacklist: exec, write, edit, message, browser, gateway, cron, nodes
- [ ] System prompt template: rental context (renter ID, constraints, duration, budget remaining)
- [ ] Budget cap enforcement (max tokens/cost per session)
- [ ] Workspace file filtering — only SOUL.md and IDENTITY.md injected

### Phase 2: ATP Rental Integration (1-2 days)
- [ ] ATP SDK: rental initiation → OpenClaw sandboxed session creation
- [ ] HCS logging: all rental interactions (instructions + responses + tool calls)
- [ ] Renter identity: Telegram user ID mapped to rental record
- [ ] Auto-terminate on rental expiry or budget cap hit
- [ ] Escrow creation and settlement wired to real HBAR (or testnet for demo)

### Phase 3: Monitoring & Controls (1 day)
- [ ] Owner view: real-time rental activity (forwarded to Gregg's DM or HQ group)
- [ ] Kill switch: owner sends command → rental terminated immediately
- [ ] Post-rental summary: cost, interaction count, any flagged events, HCS sequence range

### Phase 4: Test (1-2 days)
- [ ] Internal: Gregg acts as renter, tries to break boundaries
- [ ] Controlled: Ashe or Vai as first external renter
- [ ] Edge cases: prompt injection attempts, tool boundary testing, cost limit verification

### Phase 5: Demo & Document (1 day)
- [ ] Record demo (session transcript + HCS verification walkthrough)
- [ ] Blog post / X thread
- [ ] Update ATP spec with implementation learnings

**Total estimate: 5-8 days**

---

## Decisions — CONFIRMED (Feb 10)

1. **Architecture:** Option C — Telegram demo first, HTTP API later
2. **First test renter:** Gregg (internal), then Ashe/Vai (external)
3. **Tool whitelist:** web_search, web_fetch, read (public files only), image generation
4. **Budget cap per rental:** $10
5. **Model for rental sessions:** Sonnet
6. **Escrow:** Mainnet (real HBAR)
7. **Testing:** Internal first, then external
8. **Rental channel:** Dedicated Telegram group ("ATP Rental Demo") — separate from owner DM
9. **Owner channel:** Gregg's existing DM (359827754) — unchanged

---

---

## Lessons from StartClaw Research (Feb 10)

**Context:** StartClaw is a managed OpenClaw cloud hosting service ("Run OpenClaw in the Cloud in Seconds"). It solves deployment, not trust. These lessons inform ATP design:

### Incorporated into ATP Design

1. **"5-minute onboard" standard** — Renter experience must be frictionless. No Hedera knowledge, no escrow mechanics visible. Connect → pay → prompt → done. Complexity lives behind the protocol.

2. **BYOK is commodity; "no key needed" is the differentiator** — StartClaw makes users bring their own API keys. ATP's model (owner pays API, renter reimburses via HBAR) means renters need *zero* AI provider accounts. That's a selling point.

3. **Live monitoring is table stakes** — StartClaw's dashboard is a headline feature. Phase 3 (owner real-time view + kill switch) is not optional — ship it before external testing.

4. **Isolation is expected, audit is the moat** — Everyone promises "isolated servers." ATP's differentiator isn't sandbox (that's baseline) — it's the **immutable HCS audit trail** and cryptographic proof of session behavior. Lead with verification, not isolation.

5. **The market is forming NOW** — 7+ OpenClaw hosting providers, AI agent directories, RentAHuman.ai. The agent economy ecosystem is real. Ship before someone else builds "agent rental with blockchain audit."

### Strategic Positioning
- StartClaw = infrastructure layer (host your agent)
- ATP = trust layer (rent your agent to strangers safely)
- **Complementary, not competitive.** The killer combo: *"Host on StartClaw, monetize via ATP."*
- ATP's moat is the protocol, not the hosting.

---

*"Without ATP: trust me. With ATP: verify it."*
