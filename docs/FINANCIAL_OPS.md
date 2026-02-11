# Financial Operations Playbook

**READ THIS BEFORE ANY FINANCIAL REPORTING OR COST ANALYSIS.**

Last verified working: 2026-02-08

---

## Quick Commands

```bash
# Budget check (one-liner for heartbeats)
node lib/cost-monitor.js alert

# Full month overview with daily chart
node lib/cost-monitor.js status

# Today's costs by model
node lib/cost-monitor.js daily

# Last N days
node lib/cost-monitor.js report 7

# Budget analysis with projections
node lib/cost-monitor.js budget

# Per-model token & cost breakdown
node lib/cost-monitor.js models

# Monthly forecast scenarios
node lib/cost-monitor.js forecast

# Log manual expense
node lib/cost-monitor.js log <category> <amount> [description]
```

## Wallet Balances (All Networks)

```bash
node lib/wallet-balances.js          # Full formatted report
node lib/wallet-balances.js --json   # JSON for scripting
```

Queries all wallets defined in `data/wallets.json` via public RPCs and block explorers. No API keys needed.

### Adding New Wallets
Edit `data/wallets.json` — the script reads from this config automatically. Example:
```json
// Add a new Hedera wallet:
{ "id": "0.0.XXXXXXX", "name": "New Wallet", "purpose": "Description" }

// Add a new EVM address (checked on all 5 networks):
{ "address": "0x...", "name": "Name", "networks": ["ethereum", "base", "optimism", "avalanche", "bsc"] }

// Add a new Bitcoin address:
{ "address": "bc1q...", "name": "Name" }
```
New wallets are automatically included in the next balance check — no code changes needed.

## ⚠️ CRITICAL: Use the Right Tool

| Tool | Use? | Why |
|------|------|-----|
| **`lib/cost-monitor.js`** | ✅ YES | Real Anthropic Admin API data, comprehensive |
| `lib/cost-tracker.js` | ❌ NO | Manual entry only, shows $0, DEPRECATED |
| `data/anthropic-costs.json` | ❌ NO | Old estimates, not real data |
| `data/CFO_README.md` | ❌ NO | Stale from Feb 3, superseded |

## Data Sources (Authoritative)

### 1. Anthropic API Costs (Largest Expense)
- **Source:** Anthropic Admin API (real-time, accurate)
- **Admin Key:** macOS Keychain → `security find-generic-password -s anthropic -a admin-api-key -w`
- **Accessed via:** `lib/cost-monitor.js` (all commands)
- **Endpoints used:**
  - `/v1/organizations/cost_report` — dollar costs by day
  - `/v1/organizations/usage_report/messages` — token counts by model

### 2. OpenRouter Credits
- **Source:** OpenRouter API `/api/v1/credits`
- **Accessed via:** `lib/cost-monitor.js` (auto-queried in `status` command)
- **API Key:** In `~/.openclaw/openclaw.json`

### 3. Hedera Wallet Balances (All 9 Wallets)
- **Source:** Hedera SDK `AccountBalanceQuery`
- **Wallets:**

| Account | Name | Purpose |
|---------|------|---------|
| 0.0.10255397 | Main (Operations) | Day-to-day transactions |
| 0.0.10260562 | Secondary | Backup |
| 0.0.10263432 | Reserve 1 (CLAUDE) | TPS test / reserve |
| 0.0.10263433 | Reserve 2 (GPT4) | TPS test / reserve |
| 0.0.10263434 | Reserve 3 (GEMINI) | TPS test / reserve |
| 0.0.10263435 | Reserve 4 (MISTRAL) | TPS test / reserve |
| 0.0.10263436 | Reserve 5 (LLAMA) | TPS test / reserve |
| 0.0.10268595 | Exodus Hedera | Exodus Desktop wallet |
| 0.0.10268533 | Vai Transfer Acct | Agent-to-agent transfers |

- **Query code:**
```javascript
const { Client, AccountBalanceQuery, AccountId } = require('@hashgraph/sdk');
const client = Client.forMainnet();
const balance = await new AccountBalanceQuery()
  .setAccountId(AccountId.fromString('0.0.ACCOUNT'))
  .execute(client);
console.log(balance.hbars.toBigNumber().toNumber());
```

### 4. Exodus Multi-Chain Wallets (Manual — No API Access)
| Network | Address |
|---------|---------|
| Bitcoin | bc1q96waqra0prwg0mswjufdewzg8uta7a4rmk2mu9 |
| EVM (ETH/Base/OP/AVAX/BSC) | 0x8A946991c1A6fFE703e5406De5FdB3EdAFc3477F |
| Solana | 8kdgDq8meQZdfbGjoeqkABqPp4Ez4erev26iWwKqfT2g |
| XRP | rne6npHNiN79FmxN7xv3vTbtADMXDG8AQP |
| Tron | TY5MasweLz5WK4qeZ4JcMrmB1E2HWJFfdj |
| Polkadot | 14ecBeQxSiXxiAbecBD4GWd7Bhrxth65fN92xhorY11MJQ6o |
| Cardano | addr1qx200d4qaux52mwuxhwaxxnl6snje4lpmeqknmure49n8cy577m2pmcdg4kacdwa6vd8l4p89nt7rhjpd8hc8n2tx0sqadtcg7 |
| Dogecoin | DAbuFjLyYamAuQVCDez2nUoWj1p7o79kyz |

**Note:** No programmatic access to Exodus. Balances must come from Gregg or block explorers.

### 5. Credit Card Charges (Manual)
- **Source:** Bank CSV forwarded by Gregg
- **Stored:** `data/expenses.csv`
- **Last updated:** 2026-02-03
- **Action needed:** Ask Gregg for updated statement periodically

### 6. Email Invoices
- **Anthropic invoices:** Sent to 6375959@protonmail.com
- **Forwarded to:** aite550659@gmail.com (search: "from:6375959@protonmail.com subject:receipt")
- **Stored:** `data/receipts/`

## Recurring Expenses (Monthly)

| Service | Cost | Category | Notes |
|---------|------|----------|-------|
| Google One | $132.93 | Subscription | Workspace/storage |
| Fly.io | $3.00 | Infrastructure | aite-relay.fly.dev |
| Claude Max 20x | $212.70 | Subscription | **CANCELED** — expires Mar 5, 2026 |
| Anthropic API | Variable | Metered | ~$53-195/day (trending down) |

## Budget Parameters

- **Monthly budget:** $1,500
- **Alert threshold:** 75% ($1,125)
- **API budget ceiling:** $48.72/day (after fixed subscriptions of $135.93/mo)
- **Target daily API spend:** <$40

## Google Sheet Dashboard

- **File:** "Aite Financial Dashboard" on Google Drive
- **Shared with:** Gregory.L.Bell@gmail.com (writer)
- **Update procedure:** Run cost-monitor.js, query wallets, rebuild CSV, upload to Drive
- **Frequency:** Update when Gregg asks, or at minimum weekly (Sunday)

## ATP Spread Calculation

```
Hourly operating cost = Daily API spend / 24
ATP rental rate = $5.00/hr base + (tokens × model_rate × 1.5)
Gross margin = Rental rate - Operating cost
Margin % = Gross margin / Rental rate × 100

Target: 50% margin minimum (ATP spec Section 2.6)
Current: 26% at Opus rates, 85% at Sonnet rates
```

## For Sub-Agents

If you are a sub-agent tasked with financial work:
1. **Read this file first**
2. Use `node lib/cost-monitor.js` for ALL cost data
3. Query Hedera wallets using the SDK code above
4. Do NOT use cost-tracker.js, anthropic-costs.json, or CFO_README.md
5. Report results back to main session
6. If you update the Google Sheet, share with gregory.l.bell@gmail.com as writer

---

*This file is the single source of truth for financial operations. Update it when tools or data sources change.*
