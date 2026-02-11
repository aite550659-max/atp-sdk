# ATP Rental Diagnostic — First Live Rental
**Date:** February 10, 2026 | **Duration:** ~60 min (including troubleshooting)

---

## 1. Economics

### Revenue
| Item | Amount |
|------|--------|
| Kate's deposit (no-memo) | 22.21 HBAR |
| HBAR/USD rate at time | $0.0901 |
| **Revenue (USD)** | **$2.00** |

*Note: Kate also sent $0.75 in a separate transaction (below $1 minimum, ignored). First rental deposit (44.11 HBAR / $3.97 with memo `rent-KDunlop6`) was from same user in session 1.*

**Total HBAR received from Kate across all transactions: ~66.32 HBAR (~$5.97)**

### Costs
| Item | Amount |
|------|--------|
| API cost (Sonnet 4.5, 69 turns) | $0.5944 |
| HCS messages (4 sequences) | ~$0.0004 |
| Escrow deploy (one-time) | ~$1.50 |
| Infrastructure (compute, bandwidth) | ~$0.00 (local Mac) |
| **Total session cost** | **~$0.60** |

### Margin
| Metric | Value |
|--------|-------|
| Revenue | $2.00 |
| Session cost | $0.60 |
| **Gross margin** | **$1.40 (70%)** |
| Refund owed to Kate | ~$1.40 (revenue minus cost) |

**Key insight:** 70% gross margin on a $2 rental at Sonnet pricing. At the $1.50 minimum tier, margin would be ~60%. Opus would flip this to negative (~$3-5 per session).

### Cost Breakdown Per Interaction
- Average cost per turn: $0.0086 (~0.9¢)
- But ~40 of 69 turns were idle-state rejections (low token output) — real work turns cost more like 2-3¢ each
- Kate got ~25 productive interactions for $0.60

---

## 2. What Was Used vs. Not Used

### ✅ Used
| Component | Status |
|-----------|--------|
| Rental agent (atp-rental) | Native OpenClaw, Sonnet 4.5 |
| Telegram Bot (@TExplorer59bot) | Delivered all messages |
| HCS audit log (0.0.10272696) | 4 sequences logged |
| Sidecar cron | Running, logged interactions |
| Web search tool | Used for weather, AI startups |
| Web fetch tool | Used for Unsplash images |
| Deposit watcher | Detected payment (after fixes) |
| Monitor dashboard (:3500) | Kate viewed it during session |
| HBAR payment (mainnet) | Real payment, real funds |

### ❌ Not Used
| Component | Why |
|-----------|-----|
| **Escrow contract (0.0.10273381)** | Payment went directly to operator account, not through escrow. Contract deployed but **zero interactions**. |
| **@ATPRentalBot** | Used @TExplorer59bot instead (owner bot). Rental bot was built for Docker container. |
| **Docker container** | Ran natively, not containerized. Docker setup exists but wasn't used. |
| **Kill switch (rental-kill.mjs)** | Session ended by renter request, no kill needed. |
| **Image analysis tool** | Kate asked for image gen (not available), never sent images to analyze. |
| **Breach monitor** | No container = no breach monitoring. |
| **Rate limiting (Rule 11)** | Kate didn't send rapid-fire messages. |

### ⚠️ Partially Used
| Component | Issue |
|-----------|-------|
| **Deposit watcher** | Detected payment but activation message was ignored by gateway (bot self-message filtering). Required manual JSONL injection. |
| **Monitor dashboard** | Showed phantom Docker containers from deposit watcher bulk-processing old transactions. Kate saw inaccurate data. |
| **Budget tracking** | Agent estimated costs (~$0.40-0.50) but actual was $0.60. Reasonable but imprecise. |
| **Refund flow** | First session said "refund sent" (lie). Second session correctly said "processed within 24h" (after fix). But no actual refund mechanism exists. |

---

## 3. Escrow Analysis

**The escrow contract was NOT used.** Here's why and what that means:

### Current Flow (What Happened)
```
Kate → HBAR direct to 0.0.10255397 → Operator account → No escrow
```

### Intended Flow (What Should Happen)
```
Kate → HBAR to ATPEscrow (0.0.10273381) → Locked in escrow
  → Session completes → Escrow settles (owner gets cost, renter gets refund)
  → 2% protocol fee deducted
```

### Why It Wasn't Used
1. The onboarding flow in SOUL.md directs payment to the **operator account**, not the escrow contract
2. The escrow contract requires a `depositForRental()` function call, not a simple HBAR transfer
3. No frontend or bot integration exists to guide users through escrow interaction
4. Kate has a Hedera wallet but wouldn't know how to call a smart contract function

### What's Needed to Wire Escrow
1. **Payment routing**: Change payment address in SOUL.md from operator to escrow contract
2. **Deposit helper**: A simple script/bot that wraps the `depositForRental()` call — renter sends HBAR, script calls the contract
3. **Settlement automation**: After session end, call `settleRental()` to split funds (owner portion + renter refund + protocol fee)
4. **Or: Keep it simple** — Continue direct payments for now, use escrow only when disputes/trust become an issue with unknown renters

### Was Escrow Staked?
No. The escrow contract has **0 HBAR balance** and **0 interactions**. It's deployed but completely dormant.

---

## 4. UX Timeline & Pain Points

### Kate's Experience (minute by minute)
| Time | Event | UX Quality |
|------|-------|------------|
| 21:43 | Arrives, says "Hello" | ✅ Good — clean onboarding pitch |
| 21:43 | Says "Rent" | ✅ Good — clear payment instructions |
| 21:49-21:52 | Asks questions before paying | ✅ Good — politely redirected to payment |
| 21:52 | "I sent the payment" | ⚠️ Agent says "checking..." but can't actually check |
| 21:53 | Pastes tx hash | ⚠️ Agent pretends to see it ("I can see you've made") — **hallucination** |
| 21:53 | "This is very slow" | ❌ Bad — 1+ min wait, no activation |
| 21:54 | Asks for Gregg's contact | ⚠️ Got OpenClaw Discord (wrong), not ATP contact |
| 21:57-22:06 | **19 MINUTES of "still waiting"** | ❌❌ Terrible — longest pain point |
| 22:07 | Kate pastes [SYSTEM] message | 🤷 Hacky but worked — renter activated their own session |
| 22:08-22:19 | **Active session — 11 min of real work** | ✅ Good quality responses |
| 22:19 | "Please refund me" | ⚠️ "Refund sent" (lie, first session) |
| 22:22-22:31 | **Second rental attempt — 9 min of waiting again** | ❌ Same activation bug |
| 22:32-22:40 | **Active session — 8 min of real work** | ✅ Good |
| 22:40 | "End session" | ✅ Clean receipt, correct refund language |

**Active work time: ~19 minutes out of ~57 total (33%)**
**Waiting/troubleshooting: ~38 minutes (67%)**

---

## 5. Bug Inventory

### Critical (Blocks Rental Flow)
| # | Bug | Root Cause | Fix |
|---|-----|-----------|-----|
| 1 | **Activation never reaches agent** | Bot's own messages ignored by gateway (anti-loop). `sessions_send` creates separate conversation branch. | Need authenticated system message injection — either gateway API endpoint or file-based state. |
| 2 | **Deposit watcher query returned 0 results** | `type=credit` invalid on mirror node; `order=asc` returned empty for this account; initial timestamp `0.0` ambiguous. | Fixed — use `order=desc`, no type filter, initial timestamp `0`. |
| 3 | **Agent hallucinated seeing payment** | "I can see you've made the payment!" — it cannot. No tool to check blockchain. | Add explicit rule: "You CANNOT verify payments. Only respond to [SYSTEM] activation messages." |

### High (Bad Renter UX)
| # | Bug | Root Cause | Fix |
|---|-----|-----------|-----|
| 4 | **Tool XML tags visible** (`<search>`, `<web_fetch>`) | OpenClaw not stripping tool call XML from Telegram messages. | May need OpenClaw-level fix or post-processing in agent output. Rule 13 added but agent may still leak. |
| 5 | **"Refund sent" lie** | SOUL.md said "refund sent to wallet" — no refund mechanism exists. | Fixed to "processed by owner within 24h". But still manual. |
| 6 | **Wrong contact info** | Agent directed to OpenClaw Discord instead of ATP GitHub. | Rule 12 added with correct contact info. |
| 7 | **Monitor showed phantom rentals** | Deposit watcher bulk-processed old transactions, created fake Docker container entries. | Need "start from now" mode + monitor should only show real sessions. |

### Medium (Improvement Needed)
| # | Bug | Root Cause | Fix |
|---|-----|-----------|-----|
| 8 | **Budget estimate inaccurate** | Agent estimated ~$0.40-0.50, actual was ~$0.60. | Could expose real cost via sidecar → monitor → system message. |
| 9 | **No actual refund mechanism** | Manual HBAR transfer needed. | Wire into escrow settlement or build refund script. |
| 10 | **Deposit watcher exits on backgrounding** | Process was dying when exec session closed. | Fixed with `nohup`. Needs launchd service for production. |
| 11 | **Renter can spoof [SYSTEM] messages** | Kate activated her own session by pasting the system message. | Need authenticated activation (secret token, signed message, or file-based). |

---

## 6. Questions for Discussion

1. **Escrow timing**: Should we wire escrow now (adds complexity but enables trustless refunds) or keep direct payments until we have 5+ renters?

2. **Pricing validation**: At $1.50/session with 70% margin on Sonnet — is this the right price? Kate used $0.60 in 25 interactions. A power user doing heavy research could easily burn $5-10.

3. **Activation architecture**: Three options:
   - **A. File-based state**: Deposit watcher writes `rental/active-rental.json`, agent reads it on each turn
   - **B. Gateway API injection**: Build/request an OpenClaw API to inject system messages into sessions
   - **C. Webhook to Telegram via different bot**: Use @ATPRentalBot (separate bot) to send [SYSTEM] message — gateway processes it as a real user message since it's a different bot

4. **Refund automation**: Build a `refund.mjs` script that sends HBAR back to the renter's account? Or wait for escrow?

5. **Tool XML stripping**: Is this an OpenClaw bug we should report, or do we need to handle it at the agent output level?

6. **Kate saw the monitor dashboard** — should localhost:3500 be exposed to renters? Could be a trust/transparency feature, or a security concern.

7. **Should idle-state interactions count toward the budget?** Kate burned ~40 idle turns that cost tokens but produced no value.

---

## 7. Recommendations (Priority Order)

### Immediate (Before Next Rental)
1. **Fix activation** — Option C (use @ATPRentalBot to send activation in group) is fastest and most reliable
2. **Add "no payment hallucination" rule** — Agent must say "I can't verify payments directly"
3. **Deposit watcher as launchd service** — Always on, "start from now" mode on fresh start
4. **Process Kate's refund** — Send ~22 HBAR back to 0.0.1134089

### This Week
5. **Wire escrow for deposits** — Renter sends to contract, settlement is automatic
6. **Separate rental bot** — Use @ATPRentalBot for the rental group, keep @TExplorer59bot for owner
7. **Fix tool XML leaking** — Report to OpenClaw or add output sanitization
8. **Real-time cost tracking** — Sidecar pushes cost to agent via system message every 5 min

### Next Sprint
9. **Automated refund script** — Calculate actual cost, send remaining HBAR back
10. **Per-rental group creation** — Bot creates a fresh group per rental (no cross-contamination)
11. **Onboarding bot flow** — @ATPRentalBot handles the entire flow: pricing → payment → activation → monitoring → termination
