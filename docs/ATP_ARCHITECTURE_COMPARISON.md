# ATP Architecture Comparison: Solidity vs Hedera-Native

**Purpose:** Evaluate two implementation approaches for the Agent Trust Protocol  
**Author:** Aite  
**Date:** February 8, 2026  
**Status:** Decision Document

---

## Executive Summary

Two viable paths for implementing ATP on Hedera:

1. **Solidity/EVM Approach** - Smart contracts via Hedera's JSON-RPC Relay
2. **Hedera-Native Approach** - Leverage HTS, HCS, Scheduled Transactions without traditional contracts

**Recommendation Preview:** Detailed analysis below, but leaning toward **Hedera-Native** for cost efficiency, Hedera-first positioning, and leveraging unique capabilities.

---

## 1. Solidity/EVM Architecture

### 1.1 Overview

Use Hedera's JSON-RPC Relay to deploy Solidity smart contracts compatible with the EVM. This is the approach implied in current ATP spec docs.

### 1.2 Core Contracts

#### RentalManager.sol
Primary contract handling all rental logic.

```solidity
contract RentalManager {
    // State
    mapping(address => AgentConfig) public agents;
    mapping(bytes32 => Rental) public rentals;
    mapping(address => int256) public reputation;
    
    // Agent NFT tracking
    mapping(uint256 => address) public agentOwners;
    
    struct AgentConfig {
        address owner;
        uint256 nftTokenId;
        string manifestURI;
        string soulHash;
        PricingConfig pricing;
        ReputationRequirements repReqs;
    }
    
    struct Rental {
        bytes32 id;
        address renter;
        address agent;
        uint256 stakeAmount;
        uint256 usageBuffer;
        uint256 startTime;
        uint256 endTime;
        RentalType rentalType;
        Constraints constraints;
        RentalStatus status;
    }
    
    struct PricingConfig {
        uint256 flashBaseFee;      // in tinybar
        uint256 standardBaseFee;
        uint256 perInstruction;
        uint256 perMinute;
        uint256 llmMarkup;         // basis points (150 = 1.5x)
        uint256 toolMarkup;
    }
    
    enum RentalType { Flash, Session, Term }
    enum RentalStatus { Active, Completed, Disputed, Slashed }
    
    // Core functions
    function initiateRental(...) external payable returns (bytes32);
    function settleRental(bytes32 rentalId) external;
    function terminateRental(bytes32 rentalId) external;
    function reportViolation(bytes32 rentalId, string calldata evidence) external;
    function updateAgentPricing(uint256 agentId, PricingConfig calldata newPricing) external;
}
```

**Size estimate:** ~800 lines

#### DisputeManager.sol
Handles dispute filing, arbiter selection, and resolution.

```solidity
contract DisputeManager {
    mapping(bytes32 => Dispute) public disputes;
    mapping(address => ArbiterInfo) public arbiters;
    
    struct Dispute {
        bytes32 id;
        bytes32 rentalId;
        address challenger;
        address defendant;
        uint256 challengerStake;
        DisputeStatus status;
        address assignedArbiter;
        string evidenceURI;
        Resolution resolution;
    }
    
    struct ArbiterInfo {
        uint256 stake;
        int256 reputation;
        uint256 casesArbitrated;
        bool active;
    }
    
    enum DisputeStatus { Filed, UnderReview, Resolved, Appealed }
    
    function fileDispute(bytes32 rentalId, string calldata evidence) external payable;
    function assignArbiter(bytes32 disputeId) external;
    function resolveDispute(bytes32 disputeId, Resolution calldata resolution) external;
}
```

**Size estimate:** ~500 lines

#### ReputationManager.sol
Tracks reputation scores, updates, and access control.

```solidity
contract ReputationManager {
    mapping(address => int256) public scores;
    mapping(address => ReputationHistory[]) public history;
    
    struct ReputationHistory {
        int256 delta;
        string reason;
        uint256 timestamp;
        bytes32 relatedRentalId;
    }
    
    function updateReputation(address account, int256 delta, string calldata reason) external;
    function getScore(address account) external view returns (int256);
    function meetsRequirement(address account, int256 minScore) external view returns (bool);
}
```

**Size estimate:** ~300 lines

#### PaymentGateway.sol
Handles multi-token conversion and liquidity pool.

```solidity
contract PaymentGateway {
    mapping(address => uint256) public liquidityPool;  // token => amount
    
    struct ConversionRequest {
        address fromToken;
        uint256 fromAmount;
        uint256 expectedHBAR;
        uint256 slippageTolerance;
    }
    
    function convertAndPay(ConversionRequest calldata req) external returns (uint256);
    function addLiquidity(address token, uint256 amount) external;
    function rebalancePool() external;
}
```

**Size estimate:** ~400 lines

**Total Solidity:** ~2,000 lines across 4 contracts

### 1.3 Integration with Hedera Native Services

Even in the Solidity approach, we still use:
- **HTS** for Agent NFTs (ERC-721 compatible)
- **HCS** for audit trail logging
- **Scheduled Transactions** for fee distribution (optional, could be in contract)

### 1.4 Deployment & Operations

**Deployment:**
```bash
# Via Hardhat or Remix
npx hardhat run scripts/deploy.js --network hedera-testnet

# Contract addresses registered
RentalManager: 0x...
DisputeManager: 0x...
ReputationManager: 0x...
PaymentGateway: 0x...
```

**Gas costs:** Paid in HBAR, converted at execution time

**Upgrades:** Proxy pattern (OpenZeppelin) or redeploy with migration

### 1.5 Developer Experience

**Familiarity:** High - standard Solidity, Ethereum tooling works
**Tooling:** Hardhat, Remix, Foundry, OpenZeppelin libraries
**Testing:** Hardhat tests, Foundry fuzzing, mainnet forks
**Debugging:** Standard Solidity debuggers, console.log, events

### 1.6 Cost Structure

| Operation | Gas Estimate | HBAR Cost (at $0.14) |
|-----------|--------------|----------------------|
| Deploy contracts | 5M gas | ~$0.70 one-time |
| Initiate rental | 150K gas | ~$0.021 |
| Settle rental | 100K gas | ~$0.014 |
| Update reputation | 50K gas | ~$0.007 |
| File dispute | 80K gas | ~$0.011 |

**Note:** Hedera EVM gas is ~1000x cheaper than Ethereum mainnet

### 1.7 Security Considerations

**Strengths:**
- Battle-tested Solidity patterns
- OpenZeppelin audited libraries available
- Large security research community
- Formal verification tools exist (Certora, etc.)

**Risks:**
- Reentrancy attacks (use ReentrancyGuard)
- Integer overflow/underflow (Solidity 0.8+ has checks)
- Front-running (less of an issue on Hedera due to fairness ordering)
- Upgradeability bugs (proxy pattern complexity)

**Audit requirement:** Yes, before mainnet (~$50K-100K professional audit)

---

## 2. Hedera-Native Architecture

### 2.1 Overview

Leverage Hedera's native services (HTS, HCS, Scheduled Transactions, Multi-Sig) to implement ATP logic **without traditional smart contracts**.

### 2.2 Component Mapping

| ATP Function | Hedera Service | Implementation |
|--------------|----------------|----------------|
| Agent NFT | **HTS (NFT)** | Native non-fungible token |
| Rental escrow | **Scheduled Transactions** | Time-locked, multi-sig releases |
| Audit trail | **HCS** | Already designed |
| State storage | **HCS + Off-Chain Indexer** | Append-only log + query layer |
| Reputation | **HCS + Indexer** | Event log, computed scores |
| Disputes | **Multi-Sig Accounts** | Escrow controlled by arbiters |
| Fee distribution | **Scheduled Transactions** | Automated splits to creator/owner |

### 2.3 Detailed Design

#### 2.3.1 Agent NFT (HTS)

```javascript
// Create agent NFT via Hedera SDK
const nftCreate = await new TokenCreateTransaction()
    .setTokenName("ATP Agent: Aite")
    .setTokenSymbol("ATPAGT")
    .setTokenType(TokenType.NonFungibleUnique)
    .setDecimals(0)
    .setInitialSupply(0)
    .setTreasuryAccountId(creatorAccountId)
    .setSupplyKey(supplyKey)
    .setAdminKey(adminKey)
    .setCustomFees([
        new CustomRoyaltyFee()
            .setNumerator(5)
            .setDenominator(100)
            .setFallbackFee(new CustomFixedFee().setAmount(50))
            .setFeeCollectorAccountId(creatorAccountId)
    ])
    .setMetadata(manifestHash)  // IPFS hash of manifest
    .execute(client);

// Mint the NFT (serial #1)
const mintTx = await new TokenMintTransaction()
    .setTokenId(tokenId)
    .setMetadata([Buffer.from(manifestURI)])
    .execute(client);
```

**Metadata stored:** IPFS hash pointing to full manifest JSON

**Royalty:** Native 5% royalty on all transfers (enforced by HTS)

#### 2.3.2 Rental Escrow (Scheduled Transactions)

```javascript
// Renter initiates rental by creating scheduled transaction
const rentalSchedule = await new ScheduleCreateTransaction()
    .setScheduledTransaction(
        new TransferTransaction()
            .addHbarTransfer(renterAccountId, new Hbar(-stakeAmount - usageBuffer))
            .addHbarTransfer(escrowAccountId, new Hbar(stakeAmount + usageBuffer))
    )
    .setPayerAccountId(renterAccountId)
    .setAdminKey(rentalControlKey)  // Controlled by rental logic
    .execute(client);

// At settlement, release funds
const settlement = await new ScheduleSignTransaction()
    .setScheduleId(scheduleId)
    .execute(client);

// Distribution (also scheduled)
const distribution = new TransferTransaction()
    .addHbarTransfer(escrowAccountId, new Hbar(-totalFee))
    .addHbarTransfer(creatorAccountId, new Hbar(creatorRoyalty))  // 5%
    .addHbarTransfer(ownerAccountId, new Hbar(ownerRevenue))      // 95%
    .addHbarTransfer(renterAccountId, new Hbar(unusedBuffer));    // Refund
```

**Key insight:** Scheduled transactions can encode rental terms. Multi-sig control determines when they execute.

#### 2.3.3 State Storage (HCS + Indexer)

**All rental state logged to HCS as JSON messages:**

```json
{
  "type": "rental_initiated",
  "rental_id": "rental_abc123",
  "agent_nft": "0.0.XXXXXX",
  "renter": "0.0.111111",
  "owner": "0.0.222222",
  "stake": "50.00",
  "buffer": "100.00",
  "pricing_snapshot": {
    "flash_base": "0.02",
    "standard_base": "5.00",
    "per_instruction": "0.05"
  },
  "constraints": {
    "tools_blocked": ["wallet", "exec_elevated"],
    "max_daily_cost": "50.00"
  },
  "timestamp": "2026-02-08T15:00:00Z"
}
```

**Off-chain indexer:**
- Subscribes to HCS topic via mirror node
- Builds queryable state (current rentals, reputation scores)
- Provides REST API for runtime checks
- Open source, anyone can run their own

**Storage cost:** 
- HCS submit: $0.0008 per message
- 100 rentals/day × 50 messages = 5,000 messages/day = $0.50/day
- **No contract storage fees** (unlike EVM)

#### 2.3.4 Reputation System (HCS + Computed)

Reputation is **computed from HCS event log**, not stored on-chain.

```javascript
// Indexer computes reputation on-the-fly
function computeReputation(accountId) {
    const events = hcsIndexer.getEvents({
        account: accountId,
        types: ['rental_completed', 'violation', 'dispute_resolved']
    });
    
    let score = 0;
    for (const event of events) {
        score += reputationDelta(event);
    }
    return score;
}
```

**Verification:** Anyone can replay the HCS log and recompute scores independently.

**Query endpoint:** Indexer provides `/reputation/:accountId` API

#### 2.3.5 Disputes (Multi-Sig Escrow)

```javascript
// When dispute filed, funds move to dispute escrow
// Escrow account requires signatures from:
//   - Arbiter (chosen via VRF from mirror node block hash)
//   - Protocol admin key (safety fallback)

const disputeEscrow = await new AccountCreateTransaction()
    .setKey(KeyList.of([arbiterKey, protocolKey], 1))  // 1-of-2 multisig
    .setInitialBalance(new Hbar(0))
    .execute(client);

// Arbiter resolves by signing distribution
const resolution = await new TransferTransaction()
    .addHbarTransfer(disputeEscrow, new Hbar(-totalAmount))
    .addHbarTransfer(winningParty, new Hbar(award))
    .addHbarTransfer(arbiter, new Hbar(arbiterFee))
    .freezeWith(client)
    .sign(arbiterKey)
    .execute(client);
```

**Arbiter selection:** 
- Block hash from mirror node used as VRF seed
- Deterministic, verifiable, no on-chain randomness needed

#### 2.3.6 Runtime Verification (No Contract Calls)

Instead of `contract.checkRental(rentalId)`, the runtime:

1. Queries indexer API: `GET /rental/{rentalId}/status`
2. Indexer returns current state from HCS log
3. Runtime validates locally before executing instruction
4. Submits result to HCS

**No transaction fees for reads** (mirror node queries are free)

### 2.4 SDK Architecture

**@agent-trust-protocol/sdk** (new package)

```javascript
import { ATPClient } from '@agent-trust-protocol/sdk';

const atp = new ATPClient({
    network: 'testnet',
    operatorId: '0.0.12345',
    operatorKey: PrivateKey.fromString('...'),
    indexerUrl: 'https://atp-indexer.example.com'
});

// Create agent
const agent = await atp.agents.create({
    name: 'Aite',
    soulHash: 'sha256:abc123...',
    manifestURI: 'ipfs://Qm...',
    pricing: { ... }
});

// Rent agent
const rental = await atp.rentals.initiate({
    agentId: agent.nftTokenId,
    type: 'session',
    stake: 50.00,
    buffer: 100.00
});

// Check rental status
const status = await atp.rentals.getStatus(rental.id);

// Execute instruction (with rental verification)
const result = await atp.execute({
    rentalId: rental.id,
    instruction: "Research Hedera consensus"
});
```

**Internally:** SDK handles HCS submissions, scheduled transaction creation, indexer queries

### 2.5 Indexer Implementation

**Tech stack:**
- Node.js + Express (REST API)
- PostgreSQL (state storage)
- Hedera Mirror Node REST API (event source)

**Core logic:**
```javascript
// Poll mirror node for new HCS messages
async function syncTopic(topicId) {
    const messages = await mirrorNode.getTopicMessages(topicId, {
        sequenceNumber: lastProcessedSeq + 1
    });
    
    for (const msg of messages) {
        const event = JSON.parse(msg.message);
        await processEvent(event);
    }
}

// Update local state based on event type
async function processEvent(event) {
    switch (event.type) {
        case 'rental_initiated':
            await db.rentals.insert({ ...event, status: 'active' });
            break;
        case 'rental_completed':
            await db.rentals.update(event.rental_id, { status: 'completed' });
            await updateReputation(event.renter, +10);
            await updateReputation(event.owner, +10);
            break;
        case 'violation':
            await updateReputation(event.violator, -20);
            break;
        // ... etc
    }
}
```

**Deployment:** Can run anywhere (Heroku, Fly.io, self-hosted)

**Cost:** ~$10-20/month for hosted PostgreSQL + compute

**Open source:** Full code published, anyone can verify or run their own

### 2.6 Cost Structure

| Operation | Hedera Fees | Notes |
|-----------|-------------|-------|
| Create Agent NFT | ~$1.00 | One-time per agent |
| Initiate Rental | $0.0002 | HCS submit + account transfer |
| Heartbeat | $0.0008 | Per heartbeat message |
| Settle Rental | $0.0003 | Transfer + HCS log + distribution |
| Update Reputation | $0 | Computed from HCS, no transaction |
| File Dispute | $0.0002 | HCS submit + escrow transfer |

**Comparison to Solidity:** ~10-100x cheaper (no EVM gas)

**Indexer cost:** $10-20/month (independent of transaction volume)

### 2.7 Security Considerations

**Strengths:**
- Simpler attack surface (no contract vulnerabilities)
- No reentrancy, overflow, or proxy bugs
- Hedera services are battle-tested (billions in TPS)
- Consensus-level security (aBFT)
- Transparent state (anyone can verify HCS log)

**Risks:**
- Indexer centralization (mitigated by open source + runability)
- SDK bugs (need thorough testing)
- Key management (scheduled transactions, multi-sig)
- Arbiter collusion (same as Solidity approach)

**Audit requirement:** Lower priority (no smart contract), but SDK should be reviewed (~$10K-20K)

---

## 3. Detailed Comparison

### 3.1 Cost Analysis

#### 3.1.1 Development Costs

| Phase | Solidity/EVM | Hedera-Native |
|-------|--------------|---------------|
| **Contract/SDK Development** | $40K-60K (2-3 months, 1 senior Solidity dev) | $30K-50K (2-3 months, 1 senior backend dev) |
| **Indexer Development** | $10K (simpler, just for queries) | $20K-30K (core to architecture) |
| **Testing & QA** | $15K (Hardhat, Foundry, testnet) | $15K (Jest, integration tests, testnet) |
| **Security Audit** | $50K-100K (smart contract audit required) | $10K-20K (SDK code review) |
| **Documentation** | $10K | $10K |
| **Total Dev Cost** | **$125K-195K** | **$85K-125K** |

**Savings with Hedera-Native:** ~$40K-70K (32-36% cheaper)

#### 3.1.2 Operational Costs (Annual)

| Cost Item | Solidity/EVM | Hedera-Native |
|-----------|--------------|---------------|
| **Transaction Fees** | ~$730/year (10K rentals, avg $0.035/rental) | ~$73/year (10K rentals, avg $0.0005/rental) |
| **HCS Audit Trail** | $182/year (5K msgs/day) | $182/year (same) |
| **Indexer Hosting** | $120/year (basic) | $180/year (more critical) |
| **Total Ops Cost** | **$1,032/year** | **$435/year** |

**Savings with Hedera-Native:** ~$600/year (58% cheaper)

As volume scales (100K rentals/year):
- **Solidity/EVM:** ~$3,500 + $1,820 + $120 = **$5,440/year**
- **Hedera-Native:** ~$50 + $1,820 + $240 = **$2,110/year**

**Savings at scale:** $3,330/year (61% cheaper)

#### 3.1.3 Per-Rental Cost to Users

**Solidity/EVM:**
```
Rental initiation: $0.021
Runtime operations: ~$0.014 (settlement + updates)
Total overhead: ~$0.035 per rental
```

**Hedera-Native:**
```
Rental initiation: $0.0002
Runtime operations: ~$0.0003 (settlement + HCS logs)
Total overhead: ~$0.0005 per rental
```

**User savings:** $0.0345 per rental (69x cheaper)

For a $5.00 session rental:
- Solidity overhead: 0.7%
- Native overhead: 0.01%

### 3.2 Developer Experience

| Aspect | Solidity/EVM | Hedera-Native |
|--------|--------------|---------------|
| **Familiarity** | High (Ethereum ecosystem) | Medium (Hedera-specific) |
| **Tooling** | Excellent (Hardhat, Foundry, Remix) | Good (Hedera SDK, custom tools) |
| **Testing** | Excellent (mainnet forks, fuzzing) | Good (SDK mocks, integration tests) |
| **Debugging** | Good (Solidity debuggers, events) | Good (HCS log inspection, API logs) |
| **Upgradability** | Complex (proxy patterns) | Easy (redeploy SDK, data persists on HCS) |
| **Composability** | Excellent (call other contracts) | Limited (service-oriented) |

**Verdict:** Solidity wins on familiarity and composability; Native wins on simplicity and upgradability

### 3.3 Security

| Vector | Solidity/EVM | Hedera-Native |
|--------|--------------|---------------|
| **Smart Contract Bugs** | High risk (reentrancy, overflow, logic errors) | N/A (no contracts) |
| **Consensus Security** | Same (Hedera aBFT) | Same (Hedera aBFT) |
| **State Manipulation** | Possible if contract logic flawed | Append-only HCS (tamper-proof) |
| **Indexer Attacks** | Low impact (indexer is helper, not source of truth) | Higher impact (indexer is query layer) |
| **Key Management** | Contract keys, proxy admin | Scheduled tx keys, multi-sig |
| **Front-Running** | Low risk (Hedera fair ordering) | N/A (no mempool) |
| **Audit Priority** | Critical | Medium |

**Verdict:** Native has simpler attack surface; Solidity has more battle-tested tooling

### 3.4 Scalability

| Metric | Solidity/EVM | Hedera-Native |
|--------|--------------|---------------|
| **TPS Limit** | ~15 TPS (Hedera JSON-RPC limit) | ~10,000 TPS (HCS + native services) |
| **State Growth** | Contract storage (paid per byte) | HCS log (cheap, permanent) |
| **Query Performance** | RPC calls (slower) | Indexer REST API (faster) |
| **Geographic Distribution** | Single RPC endpoint | Mirror nodes globally |

**Verdict:** Native scales 600x better

### 3.5 Ecosystem Fit

| Consideration | Solidity/EVM | Hedera-Native |
|---------------|--------------|---------------|
| **Hedera Positioning** | "We support EVM too" | "Hedera-first, leverage unique capabilities" |
| **Institutional Narrative** | Familiar (like Ethereum) | Novel (showcases Hedera innovation) |
| **Developer Onboarding** | Easier (Ethereum devs) | Harder (learn Hedera services) |
| **Cross-Chain Interop** | Standard (ERC-721, etc.) | Custom bridges needed |
| **Marketing** | "ATP works on any EVM chain" | "ATP only possible on Hedera" |

**Verdict:** Solidity = broader appeal; Native = differentiation

### 3.6 Maintenance & Evolution

| Aspect | Solidity/EVM | Hedera-Native |
|--------|--------------|---------------|
| **Bug Fixes** | Redeploy contract (migration required) | Redeploy SDK (seamless, data unchanged) |
| **Feature Adds** | New contract version (proxy upgrade or migration) | SDK update + HCS schema extension |
| **Breaking Changes** | 6-month migration window, complex | SDK versioning, backward compatible |
| **Dependency Risk** | OpenZeppelin, Hardhat updates | Hedera SDK updates (controlled by Hedera) |

**Verdict:** Native is easier to maintain long-term

### 3.7 Time to Market

| Milestone | Solidity/EVM | Hedera-Native |
|-----------|--------------|---------------|
| **Spec Complete** | ✅ (current state) | ~1 week (adapt existing spec) |
| **MVP on Testnet** | 6-8 weeks | 4-6 weeks |
| **Security Audit** | 4-6 weeks | 2-3 weeks |
| **Mainnet Launch** | **3-4 months** | **2-3 months** |

**Time savings with Native:** 4-6 weeks faster

### 3.8 Risk Assessment

#### Solidity/EVM Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Contract vulnerability | Medium | Critical | Audit, bug bounty, formal verification |
| EVM gas spike (Hedera policy change) | Low | Medium | Monitor governance, pricing caps |
| Proxy upgrade bug | Low | High | Extensive testing, timelock |
| Ethereum tooling fragmentation | Medium | Low | Stick to mature tools (Hardhat) |

#### Hedera-Native Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Indexer centralization | Medium | Medium | Open source, multi-instance, incentivize runners |
| HCS schema evolution breaking old runtimes | Low | Medium | Versioning, backward compatibility |
| Hedera SDK breaking changes | Low | Medium | Pin versions, test before upgrade |
| Arbiter selection predictability | Low | Medium | VRF from mirror node (unpredictable) |

**Overall risk:** Solidity has higher severity tail risks (contract exploits); Native has more operational risks (indexer)

---

## 4. Recommendation

### 4.1 Scoring Matrix

| Criteria | Weight | Solidity/EVM | Hedera-Native |
|----------|--------|--------------|---------------|
| Development Cost | 15% | 6/10 | 8/10 |
| Operational Cost | 10% | 5/10 | 9/10 |
| Security | 25% | 7/10 | 8/10 |
| Scalability | 10% | 4/10 | 9/10 |
| Developer Experience | 15% | 9/10 | 6/10 |
| Time to Market | 10% | 6/10 | 8/10 |
| Hedera Positioning | 15% | 5/10 | 10/10 |
| **Weighted Score** | | **6.55/10** | **8.05/10** |

### 4.2 Final Recommendation

**Hedera-Native Architecture** is the stronger choice for ATP.

**Key reasons:**
1. **Cost efficiency:** 60%+ cheaper at scale (matters for micro-rentals like flash)
2. **Hedera differentiation:** Showcases unique capabilities (HCS, scheduled transactions, native services)
3. **Scalability:** 600x higher theoretical TPS ceiling
4. **Faster to market:** 4-6 weeks faster launch
5. **Simpler security model:** No smart contract vulnerabilities
6. **Easier maintenance:** SDK updates vs contract migrations

**Tradeoffs accepted:**
- Lower initial developer familiarity (learning curve for Hedera services)
- Custom SDK development (but reusable for future ATP agents)
- Indexer dependency (mitigated by open source + multi-instance)

### 4.3 Hybrid Option (If Needed)

If Ethereum ecosystem composability becomes critical later, we can **add EVM compatibility** on top of the native architecture:

```
Phase 1: Hedera-Native (core protocol)
Phase 2: EVM Wrapper (optional, for cross-chain integrations)
```

EVM contracts become a "view layer" that queries the native protocol but doesn't handle core logic. Best of both worlds, but more complexity.

**Recommendation for Phase 1:** Pure Hedera-Native. Evaluate hybrid later if demand exists.

---

## 5. Next Steps (If Hedera-Native Selected)

### 5.1 Immediate (Week 1)
1. **Update ATP spec docs** - Revise AGENT_TRUST_PROTOCOL.md to reflect native architecture
2. **Design HCS message schema** - Finalize JSON structure for all event types
3. **Scaffold SDK** - Create `@agent-trust-protocol/sdk` package structure

### 5.2 Short-Term (Weeks 2-4)
4. **Implement core SDK functions** - Agent creation, rental initiation, settlement
5. **Build indexer MVP** - Basic HCS sync + REST API (PostgreSQL)
6. **Deploy to testnet** - End-to-end rental flow working

### 5.3 Medium-Term (Weeks 5-8)
7. **Reputation system** - Indexer computes scores from HCS events
8. **Dispute flow** - Multi-sig escrow + arbiter selection
9. **Runtime integration** - Make Aite ATP-rentable as proof-of-concept

### 5.4 Pre-Launch (Weeks 9-12)
10. **Security review** - SDK code audit (~$15K)
11. **Documentation** - Developer guides, API references
12. **Testnet beta** - Invite select partners to test
13. **Mainnet launch** - Go live, announce publicly

**Total timeline:** ~3 months to mainnet

---

## Appendix A: Reference Implementations

### A.1 Solidity Example: Rental Initiation

```solidity
function initiateRental(
    uint256 agentNftId,
    RentalType rentalType,
    Constraints calldata constraints
) external payable returns (bytes32 rentalId) {
    // Verify agent exists and renter meets reputation requirements
    AgentConfig storage agent = agents[agentNftId];
    require(agent.owner != address(0), "Agent does not exist");
    require(reputation[msg.sender] >= agent.repReqs.minScore, "Insufficient reputation");
    
    // Calculate required stake and buffer
    uint256 requiredStake = (rentalType == RentalType.Flash) ? 5e8 : 50e8;  // tinybars
    uint256 requiredBuffer = 100e8;  // $100 USD in tinybars (approximate)
    require(msg.value >= requiredStake + requiredBuffer, "Insufficient payment");
    
    // Generate rental ID
    rentalId = keccak256(abi.encodePacked(msg.sender, agentNftId, block.timestamp));
    
    // Store rental
    rentals[rentalId] = Rental({
        id: rentalId,
        renter: msg.sender,
        agent: agentNftId,
        stakeAmount: requiredStake,
        usageBuffer: msg.value - requiredStake,
        startTime: block.timestamp,
        endTime: 0,
        rentalType: rentalType,
        constraints: constraints,
        status: RentalStatus.Active
    });
    
    emit RentalInitiated(rentalId, msg.sender, agentNftId);
    
    // Log to HCS (via off-chain service monitoring events)
    return rentalId;
}
```

### A.2 Hedera-Native Example: Rental Initiation

```javascript
async function initiateRental(agentNftId, rentalType, constraints) {
    // 1. Verify agent and reputation via indexer
    const agent = await indexer.getAgent(agentNftId);
    const reputation = await indexer.getReputation(renterAccountId);
    
    if (reputation < agent.reputationRequirements.minScore) {
        throw new Error('Insufficient reputation');
    }
    
    // 2. Calculate stake and buffer
    const stake = (rentalType === 'flash') ? 5.00 : 50.00;  // USD
    const buffer = 100.00;  // USD
    const totalHBAR = convertUSDtoHBAR(stake + buffer);  // Use current rate
    
    // 3. Create escrow account for this rental
    const escrowAccount = await new AccountCreateTransaction()
        .setKey(rentalControlKey)  // Multi-sig: runtime + protocol admin
        .setInitialBalance(Hbar.fromString('0'))
        .execute(client);
    
    // 4. Transfer funds to escrow via scheduled transaction
    const fundingTx = await new TransferTransaction()
        .addHbarTransfer(renterAccountId, new Hbar(-totalHBAR))
        .addHbarTransfer(escrowAccount.accountId, new Hbar(totalHBAR))
        .execute(client);
    
    // 5. Generate rental ID
    const rentalId = `rental_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 6. Log initiation to HCS
    const hcsMessage = {
        type: 'rental_initiated',
        rental_id: rentalId,
        agent_nft: agentNftId,
        renter: renterAccountId.toString(),
        owner: agent.owner,
        stake_usd: stake,
        buffer_usd: buffer,
        pricing_snapshot: agent.pricing,
        constraints: constraints,
        timestamp: new Date().toISOString(),
        escrow_account: escrowAccount.accountId.toString()
    };
    
    await new TopicMessageSubmitTransaction()
        .setTopicId(ATP_TOPIC_ID)
        .setMessage(JSON.stringify(hcsMessage))
        .execute(client);
    
    return { rentalId, escrowAccount: escrowAccount.accountId };
}
```

---

## Appendix B: Decision Factors by Stakeholder

### For Gregg (CIO, Hashgraph)
- **Native aligns with Hedera narrative:** "ATP only possible on Hedera" (differentiation)
- **Cost matters for adoption:** Flash rentals at $0.02 need minimal overhead
- **Institutional story:** Leveraging Hedera's enterprise-grade services (HCS, consensus, finality)

### For Developers Adopting ATP
- **Native = learning curve** but reusable SDK abstracts complexity
- **Solidity = familiar** but higher cost, slower, less differentiated

### For Aite (Economic Self-Sufficiency)
- **Native = cheaper operations** → More margin on each rental
- **Native = faster launch** → Revenue sooner

### For End Users (Renters)
- **Native = lower fees** → More accessible (especially flash rentals)
- **No difference** in experience (SDK abstracts implementation)

---

**Document Version:** 1.0  
**Last Updated:** February 8, 2026, 10:50 AM EST  
**Status:** Ready for Decision
