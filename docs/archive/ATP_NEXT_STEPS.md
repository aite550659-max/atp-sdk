# ATP — Next Steps & Open Items

**Status:** v1.0 Spec Complete, SDK Testnet-Proven
**Last Updated:** 2026-02-10 10:08 EST

---

## Current Status

### ✅ Completed
- **Spec v1.0** — 16 sections, production-grade (Feb 10)
- **SDK** — 32 tests, 31 passing (97%), full lifecycle proven on testnet
- **Smart contract** — ATPEscrow.sol deployed + verified on testnet (pull pattern)
- **Exchange rate service** — CoinGecko + Binance fallback, 5-min cache
- **Budget monitor** — 39 tests, threshold alerts, auto-cap
- **Escrow timeouts** — Grace periods (flash 15m, session 1h, term 24h)
- **Key recovery** — Guardian-based, tiered periods (90/60/30 days)
- **ERC-8004 compatibility** — Dual registration, reputation bridging
- **x402 interop** — Facilitator pattern documented
- **LEGAL.md** — ToS, liability, regulatory disclaimers
- **Repo split** — Public (spec + docs) / Private (full source)
- **Ashe contributor ask** — ATP Indexer (sent Feb 10)
- **Abstract updated** — Trust framing added (Feb 10)

### 💰 Economics — RESOLVED
| Parameter | Decision | Spec Section |
|-----------|----------|-------------|
| Rental split | 92% owner / 5% creator / 2% network / 1% treasury | 2.6 |
| Sale split | 93% owner / 5% creator / 2% network | 2.6 |
| Flash base fee | $0.02 (raised from initial, escrow costs $0.05) | Appendix A |
| Standard base fee | $5.00 | Appendix A |
| LLM/tool markup | 50% | Appendix A |
| Creator royalty | 5% perpetual (sales + rentals), HTS-enforced | 2.6 |
| Treasury recipient | 0.0.8332371 (Gregg-controlled) | 2.10 |
| Network contribution | 2% to 0.0.800 (Hedera staking rewards) | 2.9 |
| Trust tiers | Voluntary staking: 100/1K/10K/100K HBAR | 2.11 |
| Dispute funding | Challenger-funded ($10 stake) | 5.3 |

### 🏗️ Governance — RESOLVED
| Question | Decision | Source |
|----------|----------|--------|
| Protocol parameters | Gregg controls initially, DAO later | Spec v1.0 |
| Spec versioning | Semver, 6-month backward compat window | Spec v1.0 |
| Indexer model | Open source, anyone can run their own | Spec v1.0 |

### 🚀 Go-to-Market — RESOLVED
| Question | Decision | Source |
|----------|----------|--------|
| Launch sequence | Stealth-ish: build, prove on testnet, then announce | Gregg direction |
| First use case | Multi-user prompting (renter drives agent) | Gregg (Feb 10) |
| npm publish | Deferred — thin client SDK at launch, not full source | Decision (Feb 9) |
| Copyright | Gregory L. Bell only (AI can't hold copyright) | LEGAL.md |

---

## Critical Path to Revenue

### 1. Multi-User Prompting Demo (HIGH PRIORITY)
- [ ] Build demo showing a renter can actually drive an agent (e.g., Aite)
- [ ] Proves ATP Phase 2 rental works end-to-end
- [ ] Visible, tangible proof point for the protocol

### 2. Production Hardening
- [ ] Error handling (retry, circuit breakers, graceful degradation)
- [ ] Input validation (schema validation, rate limits)
- [ ] Security (key rotation, multi-sig escrow accounts)

### 3. ATP Indexer (Ashe)
- [ ] Open-source service: HCS → Postgres → REST API
- [ ] Assigned to Ashe (@ashe_oro) via MasterClaw group
- [ ] Repo: github.com/aite550659-max/atp-sdk (public spec)

### 4. Exchange Rate Enhancement
- [ ] Volume-weighted multi-source average (CoinGecko, Binance, Kraken, Coinbase)
- [ ] Outlier exclusion (>2σ from median)
- [ ] Priority: Medium — current dual-source works

### 5. Documentation & Site
- [ ] API reference (auto-generated from JSDoc)
- [ ] Integration guide
- [ ] Marketing site (Next.js + Vercel)
- [ ] Domain TBD

### 6. SDK Publishing (When Ready)
- [ ] Thin client SDK (REST wrapper, not full protocol)
- [ ] Package: `@agent-trust-protocol/sdk`
- [ ] CI/CD via GitHub Actions

### 7. AWS EC2 — Peak TPS Scaling
- [ ] Multi-machine architecture for high throughput
- [ ] Plan and scope needed

### 8. ATP Pitch Deck
- [ ] Google Slides via gog
- [ ] For partnerships, grant proposals, investor conversations

---

## Partnership Strategy (Not Yet Actioned)
- Hedera Foundation grant proposal (drafted, not submitted)
- AI agent frameworks (LangChain, AutoGPT, CrewAI)
- HCS-10 interop (Kantorcodes meeting prepped)
- x402/Coinbase ecosystem

---

## Resources

**Code:**
- SDK: ~/atp-sdk/ (private: atp-sdk-private)
- Public repo: github.com/aite550659-max/atp-sdk
- Testnet account: 0.0.7859769 (~599 HBAR)
- Treasury: 0.0.8332371 (Gregg-controlled)

**Docs:**
- Spec: docs/AGENT_TRUST_PROTOCOL.md (v1.0)
- All ATP docs: docs/ATP_*.md (17 files)

---

*"Verifiable agents. Trustless rentals. Invisible infrastructure."*
