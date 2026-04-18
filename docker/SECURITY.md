# ATP Rental Container — Security Model

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Owner's Machine (Gregg's MacBook)                  │
│                                                     │
│  ┌──────────────┐    ┌──────────────────────────┐   │
│  │ Main Agent   │    │ Docker Container          │   │
│  │ (Aite/Opus)  │    │ ┌──────────────────────┐ │   │
│  │              │    │ │ Rental Agent (Sonnet) │ │   │
│  │ Full tools   │    │ │ web_search/fetch/image│ │   │
│  │ Full memory  │    │ └──────────────────────┘ │   │
│  │ Owner only   │    │ ┌──────────────────────┐ │   │
│  └──────────────┘    │ │ Breach Monitor       │ │   │
│         │            │ └──────────────────────┘ │   │
│         │            │ ┌──────────────────────┐ │   │
│         │            │ │ HCS Sidecar          │ │   │
│         │            │ └──────────────────────┘ │   │
│         │            └──────────────────────────┘   │
│         │                       │                   │
│         │              No filesystem access          │
│         │              No process access             │
│         │              No network to host agent      │
└─────────┼───────────────────────┼───────────────────┘
          │                       │
     Telegram DM            Telegram Group
     (Owner only)           (Renters)
```

## Isolation Layers

### Layer 0: Network
- Container uses Docker bridge network
- No access to host network (no `--network host`)
- Cannot reach owner's OpenClaw gateway (localhost:18789)
- Can only reach: Anthropic API, Telegram API, Brave API, Hedera API

### Layer 1: Process
- Separate OpenClaw process — different PID namespace
- Non-root user (`rental`) inside container
- `no-new-privileges` security option
- All capabilities dropped except NET_RAW (DNS)
- Read-only filesystem (tmpfs for /tmp and memory)

### Layer 2: Filesystem
- No volume mounts to host
- Cannot read owner's workspace, config, keys, or memory
- SOUL.md/AGENTS.md/config baked into image at build time
- File system changes are ephemeral (lost on restart)

### Layer 3: Application (OpenClaw)
- Tool whitelist: web_search, web_fetch, image only
- No exec, no read, no write, no shell
- No skills loaded
- No subagent spawning (maxConcurrent: 0)
- No native commands (off)

### Layer 4: Identity
- Separate Telegram bot token (different bot entirely)
- Separate API keys (can be rotated/revoked independently)
- No shared secrets with owner agent

## Breach Scenarios & Responses

### Scenario A: Prompt injection escapes SOUL.md/AGENTS.md constraints
**Impact:** Low — agent might say something it shouldn't, but still sandboxed
**Detection:** HCS audit trail shows unusual responses
**Response:** Review logs, update SOUL.md, rebuild image

### Scenario B: Agent gains shell access (OpenClaw vulnerability)
**Impact:** Medium — contained to Docker, read-only FS limits damage
**Detection:** Breach monitor flags unexpected processes
**Response:** Kill container immediately, alert owner, log to HCS

### Scenario C: Container escape (kernel exploit)
**Impact:** High — attacker on host machine
**Detection:** Host-level monitoring (outside container)
**Response:** Emergency shutdown, rotate ALL keys, forensic review
**Mitigation:** Keep Docker + kernel updated, use gVisor/Kata for extra isolation

### Scenario D: Renter spoofs being the owner
**Impact:** None with Docker — physically impossible
**Reason:** Owner uses a DIFFERENT Telegram bot. Renter's messages go to rental bot,
owner's messages go to owner bot. No routing confusion possible.

## Owner Authentication (Belt + Suspenders)

Even though Docker makes spoofing nearly impossible, we add defense in depth:

1. **Separate bots** — Owner and rental use different Telegram bots entirely.
   No routing path exists from rental bot to owner agent.

2. **Channel verification** — Owner agent only accepts messages from:
   - Telegram user ID 359827754 (Gregg)
   - Webchat (local only, behind gateway auth)
   - Discord (authenticated)

3. **Challenge phrase** — If the owner ever suspects impersonation:
   - Owner asks: "What's the passphrase?"
   - Agent checks against stored value (in owner's MEMORY.md, never in rental workspace)
   - Wrong answer = immediate session freeze

4. **Behavioral fingerprint** — The owner agent knows Gregg's communication patterns.
   Sudden style shifts trigger increased scrutiny (not auto-block, but higher alert).

## Setting Up the Challenge Phrase

Owner and agent establish a shared secret:
1. Owner tells agent the phrase in a private session
2. Agent stores it in MEMORY.md (never in rental workspace, never in version control)
3. If suspicious activity occurs, agent requests the phrase
4. Phrase should be rotated periodically

## Resource Limits

- CPU: 1 core max, 0.25 reserved
- Memory: 512MB max, 128MB reserved
- Temp storage: 100MB (/tmp) + 50MB (agent memory)
- No GPU access
- Budget cap enforced by sidecar (tracks cost via session API)

## Deployment Checklist

- [ ] Create SEPARATE Telegram bot for rental (via @BotFather)
- [ ] Generate separate Anthropic API key (or use same with budget alerts)
- [ ] Generate separate Brave API key
- [ ] Set up breach alert webhook (owner receives notifications)
- [ ] Establish challenge phrase with owner agent
- [ ] Test container locally before deploying to cloud
- [ ] Set up HCS sidecar with operator key
- [ ] Configure resource limits for your hosting environment
