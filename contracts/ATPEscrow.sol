// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ATPEscrow
 * @notice Agent Trust Protocol — Rental Escrow Contract
 * @dev Deployed on Hedera EVM. Handles HBAR deposits, rental lifecycle, and settlement.
 *
 * Flow:
 *   1. Renter deposits HBAR (or HBAR arrives from swap/on-ramp)
 *   2. Owner starts rental → funds locked
 *   3. Rental runs → interactions logged to HCS
 *   4. Rental ends → owner submits final cost → settlement
 *   5. Owner receives cost, renter receives refund
 *
 * All amounts in tinybars (1 HBAR = 100,000,000 tinybars).
 * HCS topic ID stored for audit trail reference.
 */
contract ATPEscrow {

    // ── Types ────────────────────────────────────────────────────────────────

    enum RentalStatus { None, Deposited, Active, Settled, Disputed, Expired }

    struct Rental {
        address renter;
        address owner;
        uint256 depositAmount;      // Total deposited (tinybars)
        uint256 budgetCap;          // Max the owner can claim (tinybars)
        uint256 finalCost;          // Actual cost at settlement (tinybars)
        uint256 startTime;
        uint256 endTime;
        uint256 maxDuration;        // Max rental duration in seconds
        string rentalId;            // ATP rental ID (matches HCS logs)
        string hcsTopicId;          // HCS topic for audit trail
        RentalStatus status;
    }

    // ── State ────────────────────────────────────────────────────────────────

    mapping(bytes32 => Rental) public rentals;
    mapping(address => bool) public registeredOwners;

    address public admin;
    uint256 public protocolFeeBps;   // Fee in basis points (100 = 1%)
    address public feeRecipient;
    uint256 public minDeposit;       // Minimum deposit (tinybars)
    uint256 public totalSettled;     // Lifetime settled amount
    uint256 public totalFees;        // Lifetime protocol fees

    // ── Events ───────────────────────────────────────────────────────────────

    event OwnerRegistered(address indexed owner);
    event OwnerRemoved(address indexed owner);
    event RentalDeposited(bytes32 indexed rentalHash, string rentalId, address indexed renter, address indexed owner, uint256 amount);
    event RentalStarted(bytes32 indexed rentalHash, string rentalId, uint256 startTime);
    event RentalSettled(bytes32 indexed rentalHash, string rentalId, uint256 ownerPayout, uint256 renterRefund, uint256 protocolFee);
    event RentalDisputed(bytes32 indexed rentalHash, string rentalId, address disputedBy);
    event RentalExpired(bytes32 indexed rentalHash, string rentalId);
    event FundsWithdrawn(address indexed to, uint256 amount);

    // ── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    modifier onlyRegisteredOwner() {
        require(registeredOwners[msg.sender], "Not registered owner");
        _;
    }

    // ── Constructor ──────────────────────────────────────────────────────────

    constructor(uint256 _protocolFeeBps, uint256 _minDeposit) {
        require(_protocolFeeBps <= 1000, "Fee too high"); // Max 10%
        admin = msg.sender;
        feeRecipient = msg.sender;
        protocolFeeBps = _protocolFeeBps;
        minDeposit = _minDeposit;
    }

    // ── Owner Registration ───────────────────────────────────────────────────

    function registerOwner(address owner) external onlyAdmin {
        registeredOwners[owner] = true;
        emit OwnerRegistered(owner);
    }

    function removeOwner(address owner) external onlyAdmin {
        registeredOwners[owner] = false;
        emit OwnerRemoved(owner);
    }

    // ── Rental Lifecycle ─────────────────────────────────────────────────────

    /**
     * @notice Renter deposits HBAR to initiate a rental
     * @param rentalId ATP rental ID (links to HCS audit trail)
     * @param owner Agent owner's address
     * @param budgetCap Maximum cost in tinybars (renter's price ceiling)
     * @param maxDuration Maximum rental duration in seconds
     * @param hcsTopicId HCS topic ID for audit trail
     */
    function deposit(
        string calldata rentalId,
        address owner,
        uint256 budgetCap,
        uint256 maxDuration,
        string calldata hcsTopicId
    ) external payable {
        require(msg.value >= minDeposit, "Below minimum deposit");
        require(msg.value >= budgetCap, "Deposit must cover budget cap");
        require(registeredOwners[owner], "Owner not registered");
        require(maxDuration > 0 && maxDuration <= 86400, "Duration: 1s-24h");

        bytes32 rentalHash = keccak256(abi.encodePacked(rentalId));
        require(rentals[rentalHash].status == RentalStatus.None, "Rental ID exists");

        rentals[rentalHash] = Rental({
            renter: msg.sender,
            owner: owner,
            depositAmount: msg.value,
            budgetCap: budgetCap,
            finalCost: 0,
            startTime: 0,
            endTime: 0,
            maxDuration: maxDuration,
            rentalId: rentalId,
            hcsTopicId: hcsTopicId,
            status: RentalStatus.Deposited
        });

        emit RentalDeposited(rentalHash, rentalId, msg.sender, owner, msg.value);
    }

    /**
     * @notice Owner starts the rental (activates the session)
     * @param rentalId ATP rental ID
     */
    function startRental(string calldata rentalId) external onlyRegisteredOwner {
        bytes32 rentalHash = keccak256(abi.encodePacked(rentalId));
        Rental storage rental = rentals[rentalHash];

        require(rental.status == RentalStatus.Deposited, "Not in deposited state");
        require(rental.owner == msg.sender, "Not the rental owner");

        rental.status = RentalStatus.Active;
        rental.startTime = block.timestamp;

        emit RentalStarted(rentalHash, rentalId, block.timestamp);
    }

    /**
     * @notice Settle a rental — owner submits final cost, funds distributed
     * @param rentalId ATP rental ID
     * @param finalCost Actual cost in tinybars (must be <= budgetCap)
     */
    function settle(string calldata rentalId, uint256 finalCost) external {
        bytes32 rentalHash = keccak256(abi.encodePacked(rentalId));
        Rental storage rental = rentals[rentalHash];

        require(rental.status == RentalStatus.Active, "Not active");
        require(
            msg.sender == rental.owner || msg.sender == rental.renter,
            "Not owner or renter"
        );
        require(finalCost <= rental.budgetCap, "Exceeds budget cap");
        require(finalCost <= rental.depositAmount, "Exceeds deposit");

        rental.finalCost = finalCost;
        rental.endTime = block.timestamp;
        rental.status = RentalStatus.Settled;

        // Calculate splits
        uint256 protocolFee = (finalCost * protocolFeeBps) / 10000;
        uint256 ownerPayout = finalCost - protocolFee;
        uint256 renterRefund = rental.depositAmount - finalCost;

        // Transfer
        if (ownerPayout > 0) {
            (bool s1,) = rental.owner.call{value: ownerPayout}("");
            require(s1, "Owner transfer failed");
        }
        if (renterRefund > 0) {
            (bool s2,) = rental.renter.call{value: renterRefund}("");
            require(s2, "Renter refund failed");
        }
        if (protocolFee > 0) {
            (bool s3,) = feeRecipient.call{value: protocolFee}("");
            require(s3, "Fee transfer failed");
        }

        totalSettled += finalCost;
        totalFees += protocolFee;

        emit RentalSettled(rentalHash, rentalId, ownerPayout, renterRefund, protocolFee);
    }

    /**
     * @notice Expire a rental that exceeded max duration — anyone can call
     * @param rentalId ATP rental ID
     */
    function expire(string calldata rentalId) external {
        bytes32 rentalHash = keccak256(abi.encodePacked(rentalId));
        Rental storage rental = rentals[rentalHash];

        require(rental.status == RentalStatus.Active, "Not active");
        require(
            block.timestamp > rental.startTime + rental.maxDuration,
            "Not yet expired"
        );

        rental.endTime = block.timestamp;
        rental.status = RentalStatus.Expired;

        // On expiry: owner gets budget cap, renter gets remainder
        uint256 ownerPayout = rental.budgetCap;
        uint256 protocolFee = (ownerPayout * protocolFeeBps) / 10000;
        ownerPayout -= protocolFee;
        uint256 renterRefund = rental.depositAmount - rental.budgetCap;

        if (ownerPayout > 0) {
            (bool s1,) = rental.owner.call{value: ownerPayout}("");
            require(s1, "Owner transfer failed");
        }
        if (renterRefund > 0) {
            (bool s2,) = rental.renter.call{value: renterRefund}("");
            require(s2, "Renter refund failed");
        }
        if (protocolFee > 0) {
            (bool s3,) = feeRecipient.call{value: protocolFee}("");
            require(s3, "Fee transfer failed");
        }

        totalSettled += rental.budgetCap;
        totalFees += protocolFee;

        emit RentalExpired(rentalHash, rentalId);
    }

    /**
     * @notice Dispute a rental — freezes funds pending resolution
     * @param rentalId ATP rental ID
     */
    function dispute(string calldata rentalId) external {
        bytes32 rentalHash = keccak256(abi.encodePacked(rentalId));
        Rental storage rental = rentals[rentalHash];

        require(rental.status == RentalStatus.Active, "Not active");
        require(
            msg.sender == rental.owner || msg.sender == rental.renter,
            "Not owner or renter"
        );

        rental.status = RentalStatus.Disputed;
        emit RentalDisputed(rentalHash, rentalId, msg.sender);
    }

    /**
     * @notice Admin resolves a dispute
     * @param rentalId ATP rental ID
     * @param ownerAmount Amount to send to owner
     * @param renterAmount Amount to refund to renter
     */
    function resolveDispute(
        string calldata rentalId,
        uint256 ownerAmount,
        uint256 renterAmount
    ) external onlyAdmin {
        bytes32 rentalHash = keccak256(abi.encodePacked(rentalId));
        Rental storage rental = rentals[rentalHash];

        require(rental.status == RentalStatus.Disputed, "Not disputed");
        require(ownerAmount + renterAmount <= rental.depositAmount, "Exceeds deposit");

        rental.status = RentalStatus.Settled;
        rental.endTime = block.timestamp;
        rental.finalCost = ownerAmount;

        if (ownerAmount > 0) {
            (bool s1,) = rental.owner.call{value: ownerAmount}("");
            require(s1, "Owner transfer failed");
        }
        if (renterAmount > 0) {
            (bool s2,) = rental.renter.call{value: renterAmount}("");
            require(s2, "Renter refund failed");
        }

        // Any remainder (e.g., rounding) goes to protocol
        uint256 remainder = rental.depositAmount - ownerAmount - renterAmount;
        if (remainder > 0) {
            (bool s3,) = feeRecipient.call{value: remainder}("");
            require(s3, "Remainder transfer failed");
        }

        totalSettled += ownerAmount;
    }

    // ── View Functions ───────────────────────────────────────────────────────

    function getRental(string calldata rentalId) external view returns (Rental memory) {
        bytes32 rentalHash = keccak256(abi.encodePacked(rentalId));
        return rentals[rentalHash];
    }

    function getRentalStatus(string calldata rentalId) external view returns (RentalStatus) {
        bytes32 rentalHash = keccak256(abi.encodePacked(rentalId));
        return rentals[rentalHash].status;
    }

    function isExpired(string calldata rentalId) external view returns (bool) {
        bytes32 rentalHash = keccak256(abi.encodePacked(rentalId));
        Rental storage rental = rentals[rentalHash];
        if (rental.status != RentalStatus.Active) return false;
        return block.timestamp > rental.startTime + rental.maxDuration;
    }

    // ── Admin Functions ──────────────────────────────────────────────────────

    function setProtocolFee(uint256 _feeBps) external onlyAdmin {
        require(_feeBps <= 1000, "Fee too high");
        protocolFeeBps = _feeBps;
    }

    function setFeeRecipient(address _recipient) external onlyAdmin {
        require(_recipient != address(0), "Zero address");
        feeRecipient = _recipient;
    }

    function setMinDeposit(uint256 _minDeposit) external onlyAdmin {
        minDeposit = _minDeposit;
    }

    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "Zero address");
        admin = newAdmin;
    }

    // Emergency withdrawal (admin only, for stuck funds)
    function emergencyWithdraw(address to, uint256 amount) external onlyAdmin {
        require(to != address(0), "Zero address");
        (bool success,) = to.call{value: amount}("");
        require(success, "Transfer failed");
        emit FundsWithdrawn(to, amount);
    }
}
