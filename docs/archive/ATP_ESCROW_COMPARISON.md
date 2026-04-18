# ATP Escrow Architecture Comparison

*Three approaches to rental fund management. Which one fits?*

**Last Updated:** February 8, 2026

---

## The Problem

When a renter pays to use an AI agent, funds need to be:
1. **Held** during the rental (neither party can run off)
2. **Metered** as usage accrues (tokens, tools, time)
3. **Distributed** at settlement (owner, creator, network, treasury)
4. **Refunded** for unused buffer
5. **Slashable** if the renter violates terms

Three architectures can accomplish this. Each makes different tradeoffs.

---

## Option A: Smart Contract Escrow (Current Spec)

**How it works:** A Solidity contract on Hedera Smart Contract Service holds all rental logic. Funds are sent to the contract on initiation, usage is recorded via contract calls, and settlement distributes via contract logic.

```
Renter → Contract.initiateRental{value: stake+buffer}()
Agent  → Contract.recordUsage(rentalId, tokens, tools, time)
Either → Contract.terminateRental(rentalId)
Auto   → Contract.executeScheduledExpiry(rentalId)  [via ScheduleCreate]
```

**Fee Splits (in contract):**
| Recipient | Share |
|-----------|-------|
| Owner | 92% |
| Creator | 5% (royalty) |
| Network (0.0.800) | 2% |
| ATP Treasury | 1% |

### Pros
- **Self-custodial**: No trust required, code is law
- **Composable**: Other contracts can integrate (DeFi, DAOs, marketplaces)
- **Auditable**: Contract verified on Hashscan, anyone can inspect
- **Atomic settlement**: All splits happen in one transaction
- **Sub-rental depth limiting**: Enforced on-chain (1.5x multiplier per level)
- **Dispute resolution**: On-chain arbitration with challenger-funded stakes

### Cons
- **Gas costs**: Every `recordUsage()` call costs gas. At per-instruction granularity, this adds up fast
- **Oracle dependency**: USD-denominated pricing requires a reliable HBAR/USD oracle (TWAP or Chainlink)
- **Complexity**: ~475 lines of Solidity. More surface area for bugs. Needs formal audit ($50K+)
- **Latency**: Contract calls add ~3-5s to each metered operation
- **Upgrade friction**: Immutable once deployed (proxy pattern adds more complexity)
- **EVM limitations**: Hedera's EVM isn't identical to Ethereum's; edge cases exist

### Cost Per Rental (estimated)
| Operation | Gas | USD (at $0.09 HBAR) |
|-----------|-----|---------------------|
| initiateRental | ~300K | ~$0.027 |
| recordUsage (per call) | ~100K | ~$0.009 |
| terminateRental | ~200K | ~$0.018 |
| **Total (10 usage records)** | **~590K** | **~$0.135** |

---

## Option B: Native Account Escrow (Current Testnet Implementation)

**How it works:** Each rental creates a dedicated Hedera account as the escrow. Funds transfer in via `TransferTransaction`. Settlement transfers out. All state tracked via HCS + indexer, not contract storage.

```
SDK → AccountCreateTransaction (escrow account)
SDK → TransferTransaction (renter → escrow: stake + buffer)
HCS → rental_initiated message logged
...rental operates...
SDK → TransferTransaction (escrow → owner/creator/treasury split)
SDK → TransferTransaction (escrow → renter: unused buffer + stake)
HCS → rental_completed message logged
```

**This is what's running on testnet today.** The SDK creates an escrow account per rental, funds it, and the settlement logic lives in TypeScript (not Solidity).

### Pros
- **Simple**: No Solidity, no EVM, no audit needed for contract code
- **Native Hedera**: Uses AccountCreate + Transfer + HCS — the primitives Hedera is optimized for
- **Cheap operations**: TransferTransactions cost $0.0001 each (vs contract gas)
- **Fast iteration**: Logic is in TypeScript, not immutable bytecode
- **Already working**: Proven on testnet with full lifecycle
- **HCS is the state**: Indexer reconstructs everything from HCS messages — verifiable by anyone

### Cons
- **Trust in SDK operator**: The entity running the SDK controls the escrow private key. Not trustless.
- **Key management**: Each escrow account has a private key that must be secured and eventually disposed
- **No composability**: Other smart contracts can't call into this — it's off-chain logic
- **Account bloat**: One account per rental. Hedera charges $0.05/account creation. At scale, this matters.
- **Settlement is a multi-step process**: Multiple TransferTransactions, not atomic. Partial failure possible.
- **Fee splits are trust-based**: Nothing enforces the 92/5/2/1 split except the SDK code

### Cost Per Rental (estimated)
| Operation | Hedera Fee |
|-----------|-----------|
| AccountCreate (escrow) | $0.05 |
| TransferTransaction (fund) | $0.0001 |
| HCS message (initiated) | $0.0001 |
| HCS message (completed) | $0.0001 |
| TransferTransaction (settle, up to 4 splits) | $0.0004 |
| TransferTransaction (refund) | $0.0001 |
| **Total** | **~$0.051** |

---

## Option C: Scheduled Transaction Escrow (Hybrid)

**How it works:** Uses Hedera's native Scheduled Transactions for the critical trust operations: fund locking and settlement. No smart contract. No single-party key control.

```
1. INITIATE
   Renter creates ScheduledTransaction:
     - TransferTransaction: renter → escrow account
     - Requires signatures: renter + owner (or protocol key)
     - Funds locked until both parties agree to release

2. OPERATE
   Usage tracked via HCS only (no on-chain metering)
   Indexer maintains running totals

3. SETTLE
   Owner submits ScheduledTransaction for settlement:
     - TransferTransaction with all splits (owner/creator/network/treasury/renter-refund)
     - Renter counter-signs (or auto-executes after timeout)

   OR: Pre-scheduled expiry transaction created at initiation
     - Executes automatically at rental.endTime
     - Default: return all funds to renter (safe fallback)
```

**Key insight:** The escrow account uses a **threshold key** (e.g., 2-of-3: renter + owner + protocol). No single party can drain it. Settlement requires cooperation or timeout.

### Pros
- **Trustless without EVM**: Threshold keys + scheduled transactions = no single party controls funds
- **Native Hedera fees: $0.0001-$0.0008 per transaction, no gas
- **Automatic expiry**: ScheduleCreate with expiry = built-in safety net
- **No oracle needed for locking**: Oracle only needed at initiation (to convert USD → HBAR). Settlement uses actual HBAR amounts.
- **Simpler than contracts**: No Solidity audit needed
- **Composable enough**: Scheduled transactions are visible on-chain, indexable, verifiable
- **Atomic settlement**: Single scheduled TransferTransaction with all splits

### Cons
- **Scheduled transaction limits**: Hedera ScheduleCreate has a max 30-day expiry window
- **Multi-sig UX**: Threshold keys add signing complexity for renters
- **Less flexible than contracts**: Can't encode complex conditional logic (e.g., dynamic slash amounts based on violation severity)
- **Dispute handling**: Needs off-chain arbitration with on-chain execution (arbiter signs the settlement tx)
- **Account creation still needed**: Same $0.05 per escrow account (could reuse accounts to amortize)
- **Newer pattern**: Less battle-tested than smart contracts

### Cost Per Rental (estimated)
| Operation | Hedera Fee |
|-----------|-----------|
| AccountCreate (escrow, threshold key) | $0.05 |
| ScheduleCreate (fund transfer) | $0.01 |
| TransferTransaction (fund, via schedule) | $0.0001 |
| HCS messages (2-3) | $0.0003 |
| ScheduleCreate (settlement) | $0.01 |
| TransferTransaction (settle, via schedule) | $0.0001 |
| **Total** | **~$0.071** |

---

## Comparison Matrix

| Dimension | A: Smart Contract | B: Native Account | C: Scheduled Tx |
|-----------|:---:|:---:|:---:|
| **Trustlessness** | ✅ Full | ❌ SDK operator | ✅ Threshold keys |
| **Cost per rental** | ~$0.135 | ~$0.051 | ~$0.071 |
| **Composability** | ✅ EVM | ❌ None | ⚠️ Limited |
| **Complexity** | High (Solidity) | Low (TypeScript) | Medium (Hedera native) |
| **Audit cost** | $50K+ | Minimal | Minimal |
| **Settlement atomicity** | ✅ Single tx | ❌ Multi-step | ✅ Single scheduled tx |
| **Oracle dependency** | Every usage call | Initiation only | Initiation only |
| **Upgrade path** | Proxy pattern | Redeploy SDK | Redeploy SDK |
| **Dispute on-chain** | ✅ Full | ❌ Off-chain | ⚠️ Arbiter-signed |
| **Sub-rental enforcement** | ✅ On-chain | ❌ SDK logic | ⚠️ Partial |
| **Production readiness** | Months (audit) | Weeks | Weeks |
| **Hedera-native** | ⚠️ EVM layer | ✅ Full | ✅ Full |

---

## Recommendation

**Start with B (current), migrate to C, keep A as the long-term option.**

### Phase 1: Now → Testnet/MVP (Option B)
The native account approach is already working. For proving the protocol, getting early users, and iterating fast, it's the right choice. The trust assumption (SDK operator controls escrow key) is acceptable when the operator is the agent owner — you're trusting yourself.

### Phase 2: Early Production (Option C)
When third-party renters enter the picture, trust matters. Scheduled transactions with threshold keys remove the single-operator risk without the cost and complexity of a smart contract. This is the **Hedera-native** answer — it's what makes ATP different from an EVM-only protocol.

### Phase 3: Scale / DeFi Integration (Option A)
When composability matters — rental marketplaces, DeFi collateralization of agent NFTs, DAO-governed agent pools — a smart contract becomes necessary. By then, the protocol is proven, the economics are validated, and a $50K audit is justified.

### The Migration Path
Each phase is additive, not a rewrite:
- B → C: Replace `AccountCreateTransaction` with threshold-key account + `ScheduleCreate`. HCS schema unchanged. Indexer unchanged.
- C → A: Deploy contract that reads HCS history. Existing rentals honored. New rentals go through contract.

---

## Open Questions

1. **Account reuse**: Can we maintain a pool of escrow accounts instead of creating one per rental? Would amortize the $0.05 cost.
2. **Threshold key structure**: 2-of-2 (renter + owner) or 2-of-3 (renter + owner + protocol arbiter)?
3. **Flash rental optimization**: Flash rentals ($0.02) don't need escrow accounts at all — direct transfer + HCS log is sufficient. Worth special-casing?
4. **Scheduled transaction 30-day limit**: Term rentals can exceed 30 days. Need rolling re-scheduling or a different approach for long terms.

---

*This document compares architectures. The spec (`AGENT_TRUST_PROTOCOL.md`) and contract design (`ATP_SMART_CONTRACT.md`) define the chosen approach.*
