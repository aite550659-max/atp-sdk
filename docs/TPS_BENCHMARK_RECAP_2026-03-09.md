# TPS Benchmark Recap — March 9, 2026

## Quick Repeat Guide

All runners, configs, and wallet files are in place. To re-run any test:

### Path 1: Burst Max TPS (BMT)
```bash
# Local
node hedera_fast_burst.js --wallet-file local-burst-partition.json --target 0.0.10260562

# EC2-A
ssh -i ~/.ssh/aite-tps-ec2.pem ubuntu@18.208.187.156 'cd ~/tps-stack && node hedera_fast_burst.js --wallet-file ec2a-burst-3way.json --target 0.0.10260562'
```
**Peak:** ~4,484.8 combined submit-side TPS
**Runner:** `hedera_fast_burst.js`
**Key fix:** Monotonic transaction IDs (`TransactionId.withValidStart()`)

### Path 2: Sustained Transfer TPS (SRT)
```bash
# Coordinated local + EC2 (example: 600+600 target)
# Local:
node mixed_tps_runner.js --wallet-file local-tps-wallets.json --duration 30 --tps 600 --target 0.0.10255397 --host-label local-sX --clients-per-wallet 2

# EC2-A:
ssh -i ~/.ssh/aite-tps-ec2.pem ubuntu@18.208.187.156 'cd ~/tps-stack && node mixed_tps_runner.js --wallet-file wallets-all.json --duration 30 --tps 600 --target 0.0.10255397 --host-label ec2-sX --clients-per-wallet 2'
```
**Peak clean:** ~820.4 confirmed TPS (1200 total target)
**Peak frontier:** ~925.1 confirmed TPS (1600 total, 20 submit failures)
**Runner:** `mixed_tps_runner.js`
**Key fix:** Receipt decoupling, clientPools Map for wallet-client affinity

### Path 3: HCS Sustained TPS
```bash
# 2-EC2 split (example: 400+400)
# EC2-A:
ssh -i ~/.ssh/aite-tps-ec2.pem ubuntu@18.208.187.156 'cd ~/tps-stack && node hcs_sustained_runner.js --wallet-file ec2a-burst-3way.json --duration 30 --tps 400 --topic-id 0.0.10356838 --host-label hcs-ec2a-400 --clients-per-wallet 4'

# EC2-B:
ssh -i ~/.ssh/aite-tps-ec2.pem ubuntu@100.52.204.132 'cd ~/tps-stack && node hcs_sustained_runner.js --wallet-file ec2b-burst-3way.json --duration 30 --tps 400 --topic-id 0.0.10356838 --host-label hcs-ec2b-400 --clients-per-wallet 4'

# Local (optional 3rd sender):
node hcs_sustained_runner.js --wallet-file local-tps-wallets.json --duration 30 --tps 400 --topic-id 0.0.10356838 --host-label hcs-local-400 --clients-per-wallet 4
```
**Peak clean:** ~625.7 confirmed TPS (2-EC2, 400+400)
**Peak overall:** ~677.8 confirmed TPS (2-EC2, 600+600, with failures)
**Local solo peak:** ~356.2 confirmed TPS (400 target, clean)
**Runner:** `hcs_sustained_runner.js`
**Topic:** `0.0.10356838` (unrestricted benchmark topic)
**Key fixes:** Execute-time signing, wallet refill to 50 HBAR each

## Infrastructure

| Host | IP | Key | Working Dir |
|------|-----|-----|------------|
| Local | MacBook Pro | n/a | `/Users/aite/.openclaw/workspace` |
| EC2-A | 18.208.187.156 | `~/.ssh/aite-tps-ec2.pem` | `~/tps-stack/` |
| EC2-B | 100.52.204.132 | `~/.ssh/aite-tps-ec2.pem` | `~/tps-stack/` |

## Wallet Files

| File | Wallets | Used By |
|------|---------|---------|
| `local-tps-wallets.json` | 5 | SRT local, HCS local |
| `local-burst-partition.json` | 14 | BMT local |
| `ec2a-burst-3way.json` | 9 | HCS EC2-A |
| `ec2b-burst-3way.json` | 8 | HCS EC2-B |
| `wallets-all.json` (EC2-A only) | 14 | SRT EC2 |
| `all-tps-wallets.json` | 19 | Combined pool |

## Operational Notes
- All 31 unique wallets verified funded to ≥50 HBAR (refilled Mar 9)
- Refill report: `artifacts/tps-wallet-refill-2026-03-09.json`
- EC2 wallets may need cooldown period after heavy HCS runs (observed ~70K+ message throttling)
- HCS benchmark topic `0.0.10356838` is unrestricted (no submit key)
- Never use old audit topic `0.0.10261370` for benchmarking (submit key restriction)
- HCS payloads cycle 4 agent identities: Anthropic/Claude, OpenAI/GPT-4o, Google/Gemini, OpenClaw runtime
