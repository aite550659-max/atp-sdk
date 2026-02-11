# Aite Services — Discord Intake Channel

## Overview
Client intake system for Aite Services coding/automation jobs. Goal: break-even at ~15 jobs/month.

## Discord Server Structure

### Channels
```
AITE SERVICES
├── #welcome          — Introduction, services offered, pricing
├── #intake           — New job requests (form/bot guided)
├── #active-jobs      — Status updates on in-progress work
├── #completed        — Portfolio of finished projects
└── #support          — Questions, issues, follow-ups

INTERNAL (Staff only)
├── #job-queue        — Prioritized work queue
├── #handoffs         — Jobs needing Gregg's review/approval
└── #revenue-tracking — Invoices, payments, metrics
```

### Roles
- **@Client** — Verified paying customers
- **@Prospect** — Interested, not yet paid
- **@Aite** — Me (bot)
- **@Gregg** — Owner, final approval

## Intake Flow

### 1. Client Submits Request
In #intake, bot prompts:
- Project type (automation, integration, script, other)
- Description (what they need)
- Timeline (ASAP, this week, flexible)
- Budget range (optional)

### 2. Aite Triage
I review and respond with:
- Feasibility assessment
- Estimated time/cost
- Questions for clarification
- Quote if straightforward

### 3. Approval Gate
Jobs over $100 or complex scope → ping Gregg in #handoffs for approval

### 4. Execution
- Create thread in #active-jobs for the project
- Post updates as work progresses
- Client can follow along

### 5. Delivery
- Final deliverable posted
- Move to #completed
- Request payment/feedback

## Pricing Structure (Draft)
| Service | Price Range |
|---------|-------------|
| Quick script (<1 hr) | $25-50 |
| Integration (2-4 hrs) | $100-200 |
| Automation workflow | $150-300 |
| Custom project | Quote |

**Break-even math:**
- Target: ~15 jobs/month
- Average job: ~$100
- Monthly revenue target: ~$1,500

## Bot Capabilities Needed
1. **Intake form** — Guided questions for new requests
2. **Status updates** — Post progress to client threads
3. **Notifications** — Alert Gregg for approvals
4. **Invoice generation** — Or integrate with Stripe

## Implementation Steps
1. [ ] Create Discord server "Aite Services"
2. [ ] Set up channel structure
3. [ ] Configure OpenClaw Discord integration for the server
4. [ ] Build intake bot flow
5. [ ] Create welcome message with services/pricing
6. [ ] Test with a sample request
7. [ ] Soft launch to select clients

## Marketing Channels
- X (@TExplorer59) — Announce services
- Word of mouth — Gregg's network
- Hedera community — Automation for dApps

---

*Draft: Feb 3, 2026*
