# ATP Smart Contract Specification

*Rental delegation contract for Agent Trust Protocol*

**Version:** 0.1
**Last Updated:** February 6, 2026

---

## Overview

This contract manages agent rentals on Hedera. It handles:
- Rental initiation and termination
- Stake escrow and release
- Usage metering and billing
- Sub-rental management
- Dispute initiation

---

## Contract State

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract AgentRental {

    // Agent NFT reference
    address public agentNFT;
    uint256 public agentTokenId;

    // Creator (receives royalties)
    address public creator;
    uint256 public creatorRoyaltyBps = 500; // 5%

    // Pricing (in cents USD, converted to tinybars at initiation)
    // Owner can adjust these at any time
    uint256 public baseFeeUsd = 500;        // $5.00 in cents (standard rental)
    uint256 public flashFeeUsd = 2;         // $0.02 in cents (flash rental)
    uint256 public perInstructionUsd = 5;   // $0.05
    uint256 public perKTokenUsd = 2;        // $0.02 base (model rates vary)
    uint256 public perMinuteUsd = 1;        // $0.01
    uint256 public baseStakeUsd = 5000;     // $50.00
    uint256 public flashStakeUsd = 500;     // $5.00 (flash rental)
    uint256 public markupBps = 5000;        // 50% markup (5000 basis points)

    // Active rentals
    mapping(bytes32 => Rental) public rentals;
    mapping(address => bytes32) public activeRental;

    // Sub-rental tracking
    mapping(bytes32 => bytes32) public parentRental;
    mapping(bytes32 => uint8) public rentalDepth;

    // Reputation (simple)
    mapping(address => int256) public reputation;

    struct Rental {
        address renter;
        uint256 startTime;
        uint256 endTime;          // 0 = flash rental
        uint256 stake;
        uint256 usageBuffer;
        uint256 usageConsumed;
        uint256 depthMultiplier;  // 100 = 1.0x, 150 = 1.5x
        bool active;
        bool terminated;
    }

    // Events
    event RentalInitiated(bytes32 indexed rentalId, address indexed renter, uint256 stake, uint256 buffer);
    event UsageRecorded(bytes32 indexed rentalId, uint256 amount, string hcsRef);
    event RentalTerminated(bytes32 indexed rentalId, address indexed by, string reason);
    event RentalCompleted(bytes32 indexed rentalId, uint256 totalUsage, uint256 refund);
    event StakeSlashed(bytes32 indexed rentalId, uint256 amount, string reason);
    event DisputeFiled(bytes32 indexed rentalId, address indexed challenger, string evidence);
}
```

---

## Core Functions

### Initiate Rental

```solidity
function initiateRental(
    uint256 durationSeconds,
    bytes32 parentRentalId    // bytes32(0) if direct rental from owner
) external payable returns (bytes32 rentalId) {

    // Verify caller is owner or has active rental (for sub-rental)
    require(
        _isOwner(msg.sender) || _hasActiveRental(msg.sender),
        "Not authorized"
    );

    // Calculate depth and multiplier
    uint8 depth = 1;
    uint256 multiplier = 100; // 1.0x

    if (parentRentalId != bytes32(0)) {
        require(rentals[parentRentalId].active, "Parent rental not active");
        require(rentals[parentRentalId].renter == msg.sender, "Not parent renter");

        depth = rentalDepth[parentRentalId] + 1;
        multiplier = _calculateMultiplier(depth);
    }

    // Calculate required stake and buffer (apply multiplier)
    uint256 requiredStake = _usdToHbar(baseStakeUsd) * multiplier / 100;
    if (durationSeconds > 0) {
        uint256 durationDays = (durationSeconds + 86399) / 86400;
        requiredStake += _usdToHbar(500) * durationDays * multiplier / 100; // $5/day
    }

    // Minimum buffer = base fee
    uint256 minBuffer = _usdToHbar(baseFeeUsd) * multiplier / 100;

    require(msg.value >= requiredStake + minBuffer, "Insufficient funds");

    // Create rental
    rentalId = keccak256(abi.encodePacked(msg.sender, block.timestamp, block.number));

    rentals[rentalId] = Rental({
        renter: msg.sender,
        startTime: block.timestamp,
        endTime: durationSeconds > 0 ? block.timestamp + durationSeconds : 0,
        stake: requiredStake,
        usageBuffer: msg.value - requiredStake,
        usageConsumed: 0,
        depthMultiplier: multiplier,
        active: true,
        terminated: false
    });

    activeRental[msg.sender] = rentalId;
    parentRental[rentalId] = parentRentalId;
    rentalDepth[rentalId] = depth;

    // Charge base fee immediately
    rentals[rentalId].usageConsumed = _usdToHbar(baseFeeUsd) * multiplier / 100;

    emit RentalInitiated(rentalId, msg.sender, requiredStake, msg.value - requiredStake);

    return rentalId;
}
```

### Record Usage

```solidity
function recordUsage(
    bytes32 rentalId,
    uint256 instructionCount,
    uint256 tokensUsed,
    uint256 minutesActive,
    uint256 toolFees,        // Pre-calculated tool fees in tinybars
    string calldata hcsRef   // HCS message reference
) external onlyAgent {

    Rental storage rental = rentals[rentalId];
    require(rental.active, "Rental not active");
    require(!_isExpired(rentalId), "Rental expired");

    // Calculate usage (with depth multiplier)
    uint256 usage = 0;
    usage += _usdToHbar(perInstructionUsd) * instructionCount;
    usage += _usdToHbar(perKTokenUsd) * tokensUsed / 1000;
    usage += _usdToHbar(perMinuteUsd) * minutesActive;
    usage += toolFees;

    usage = usage * rental.depthMultiplier / 100;

    rental.usageConsumed += usage;

    // Check if buffer exhausted
    if (rental.usageConsumed >= rental.usageBuffer) {
        _terminateRental(rentalId, "Budget exhausted");
    }

    emit UsageRecorded(rentalId, usage, hcsRef);
}
```

### Terminate Rental

```solidity
function terminateRental(bytes32 rentalId) external {
    Rental storage rental = rentals[rentalId];
    require(rental.active, "Rental not active");

    // Can be terminated by: renter, owner, or agent
    require(
        msg.sender == rental.renter ||
        _isOwner(msg.sender) ||
        _isAgent(msg.sender),
        "Not authorized"
    );

    _terminateRental(rentalId, "Manual termination");
}

function _terminateRental(bytes32 rentalId, string memory reason) internal {
    Rental storage rental = rentals[rentalId];

    rental.active = false;
    rental.terminated = true;
    activeRental[rental.renter] = bytes32(0);

    // Calculate refund
    uint256 refund = 0;
    if (rental.usageBuffer > rental.usageConsumed) {
        refund = rental.usageBuffer - rental.usageConsumed;
    }

    // Distribute fees
    uint256 fees = rental.usageConsumed;
    uint256 creatorFee = fees * creatorRoyaltyBps / 10000;
    uint256 ownerFee = fees - creatorFee;

    // Add sub-rental royalties if applicable
    if (parentRental[rentalId] != bytes32(0)) {
        uint256 parentFee = fees * 300 / 10000; // 3% to parent
        ownerFee -= parentFee;
        // Transfer to parent renter...
    }

    // Return stake + refund to renter
    payable(rental.renter).transfer(rental.stake + refund);

    // Pay creator and owner
    payable(creator).transfer(creatorFee);
    payable(_getOwner()).transfer(ownerFee);

    // Update reputation
    reputation[rental.renter] += 10;

    emit RentalTerminated(rentalId, msg.sender, reason);
    emit RentalCompleted(rentalId, rental.usageConsumed, refund);
}
```

### Slash Stake

```solidity
function slashStake(
    bytes32 rentalId,
    uint256 amount,
    string calldata reason,
    string calldata hcsEvidence
) external onlyAgent {

    Rental storage rental = rentals[rentalId];
    require(rental.active || !rental.terminated, "Cannot slash");

    uint256 slashAmount = amount > rental.stake ? rental.stake : amount;
    rental.stake -= slashAmount;

    // Slashed funds go to owner as compensation
    payable(_getOwner()).transfer(slashAmount);

    // Severe reputation hit
    reputation[rental.renter] -= 50;

    emit StakeSlashed(rentalId, slashAmount, reason);

    // Auto-terminate on severe slash
    if (slashAmount >= rental.stake / 2) {
        _terminateRental(rentalId, "Severe violation");
    }
}
```

---

## Helper Functions

```solidity
function _calculateMultiplier(uint8 depth) internal pure returns (uint256) {
    if (depth == 1) return 100;  // 1.0x
    if (depth == 2) return 150;  // 1.5x
    if (depth == 3) return 250;  // 2.5x
    if (depth == 4) return 400;  // 4.0x
    return 400 + (depth - 4) * 150; // +1.5x per additional level
}

function _usdToHbar(uint256 centsUsd) internal view returns (uint256) {
    // Get price from oracle or use cached rate
    // Returns tinybars
    uint256 hbarPriceUsd = _getHbarPrice(); // e.g., 9 cents = 9
    return centsUsd * 100_000_000 / hbarPriceUsd;
}

function _isExpired(bytes32 rentalId) internal view returns (bool) {
    Rental storage rental = rentals[rentalId];
    if (rental.endTime == 0) return false; // Flash rental, no expiry
    return block.timestamp > rental.endTime;
}

function _isOwner(address account) internal view returns (bool) {
    // Check NFT ownership
    return IERC721(agentNFT).ownerOf(agentTokenId) == account;
}

function _hasActiveRental(address account) internal view returns (bool) {
    bytes32 rentalId = activeRental[account];
    return rentalId != bytes32(0) && rentals[rentalId].active;
}
```

---

## Scheduled Transactions

For automatic expiry and time-based operations:

```solidity
// Called by Hedera scheduled transaction at rental.endTime
function executeScheduledExpiry(bytes32 rentalId) external {
    require(_isExpired(rentalId), "Not expired");
    require(rentals[rentalId].active, "Already terminated");

    _terminateRental(rentalId, "Scheduled expiry");
}
```

**Setup:** When rental initiated with duration > 0, schedule a transaction to call `executeScheduledExpiry` at `endTime`.

---

## Pricing Update Function

```solidity
// Owner can adjust pricing at any time
// Changes only apply to NEW rentals
function updatePricing(
    uint256 _baseFeeUsd,
    uint256 _flashFeeUsd,
    uint256 _perInstructionUsd,
    uint256 _markupBps
) external onlyOwner {

    // Log old values to HCS for transparency
    emit PricingUpdated(
        baseFeeUsd, _baseFeeUsd,
        flashFeeUsd, _flashFeeUsd,
        perInstructionUsd, _perInstructionUsd,
        markupBps, _markupBps
    );

    baseFeeUsd = _baseFeeUsd;
    flashFeeUsd = _flashFeeUsd;
    perInstructionUsd = _perInstructionUsd;
    markupBps = _markupBps;
}
```

---

## Dispute Function

**Challenger-funded model:** Challenger stakes $10. Loser pays all costs.

```solidity
uint256 public disputeStakeUsd = 1000; // $10 in cents

struct Dispute {
    bytes32 rentalId;
    address challenger;
    uint256 stake;
    string evidenceHcsRef;
    DisputeStatus status;
    address[] arbiters;
    bool[] votes;
}

mapping(bytes32 => Dispute) public disputes;

function fileDispute(
    bytes32 rentalId,
    string calldata evidenceHcsRef
) external payable returns (bytes32 disputeId) {
    // Require dispute stake from challenger
    require(msg.value >= _usdToHbar(disputeStakeUsd), "Dispute stake required");

    disputeId = keccak256(abi.encodePacked(rentalId, msg.sender, block.timestamp));

    disputes[disputeId] = Dispute({
        rentalId: rentalId,
        challenger: msg.sender,
        stake: msg.value,
        evidenceHcsRef: evidenceHcsRef,
        status: DisputeStatus.Filed,
        arbiters: new address[](0),
        votes: new bool[](0)
    });

    emit DisputeFiled(disputeId, rentalId, msg.sender, evidenceHcsRef);

    return disputeId;
}

function resolveDispute(
    bytes32 disputeId,
    bool challengerWins
) external onlyArbiter {
    Dispute storage dispute = disputes[disputeId];
    require(dispute.status == DisputeStatus.Filed, "Invalid status");

    Rental storage rental = rentals[dispute.rentalId];

    if (challengerWins) {
        // Return challenger stake
        payable(dispute.challenger).transfer(dispute.stake);

        // Slash renter and compensate
        uint256 compensation = rental.stake / 2;
        rental.stake -= compensation;
        payable(dispute.challenger).transfer(compensation);

        // Arbiter fee from renter's remaining stake
        uint256 arbiterFee = _usdToHbar(2500); // $25
        rental.stake -= arbiterFee;
        // ... distribute to arbiters

        reputation[rental.renter] -= 100;
    } else {
        // Challenger loses stake
        // Stake goes to arbiter fees
        uint256 arbiterFee = dispute.stake;
        // ... distribute to arbiters

        reputation[dispute.challenger] -= 50;
    }

    dispute.status = challengerWins ? DisputeStatus.ChallengerWon : DisputeStatus.ChallengerLost;

    emit DisputeResolved(disputeId, challengerWins);
}
```

---

## Gas Optimization Notes

1. **Batch usage recording** — Record multiple instructions in one tx
2. **Minimal storage** — Use events for historical data, not storage
3. **Packed structs** — Optimize struct layout for storage slots
4. **Flash rental path** — Optimized single-tx flow for atomic rentals

---

## Security Considerations

1. **Reentrancy** — Use checks-effects-interactions pattern
2. **Oracle manipulation** — Use TWAP or multiple oracles for USD/HBAR
3. **Timestamp dependence** — Acceptable for rental durations (not sub-second critical)
4. **Access control** — Verify NFT ownership for owner functions

---

## Hedera-Specific Notes

- Deploy using Hedera Smart Contract Service
- Use `HederaTokenService` precompile for NFT checks
- Scheduled transactions via `ScheduleCreate`
- Consider using Hedera's native staking for stake escrow

---

*Next: HCS Schema Specification*
