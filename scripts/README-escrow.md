# ATP Escrow Deposit Helper

Command-line tool for depositing HBAR into the ATPEscrow smart contract for agent rental sessions.

## Overview

The escrow deposit helper wraps the `ATPEscrow.deposit()` contract function, allowing renters to lock funds in a trustless smart contract that automatically handles refunds when sessions end.

**Contract:** `0.0.10273381` (Hedera mainnet)  
**Explorer:** https://hashscan.io/mainnet/contract/0.0.10273381

## Quick Start

```bash
# Basic deposit
node scripts/escrow-deposit.mjs \
  --rental-id "kate-001" \
  --owner 0.0.10255397 \
  --budget 2.00 \
  --duration 3600

# Preview without executing
node scripts/escrow-deposit.mjs \
  --rental-id "test-001" \
  --owner 0.0.10255397 \
  --budget 1.50 \
  --duration 1800 \
  --dry-run
```

## Required Arguments

- `--rental-id <id>` — Unique rental identifier (e.g., "kate-001")
- `--owner <account>` — Owner's Hedera account (e.g., 0.0.10255397)
- `--budget <amount>` — Budget cap in HBAR (e.g., 2.00)
- `--duration <seconds>` — Max rental duration in seconds (e.g., 3600 for 1 hour)

## Optional Arguments

- `--hcs-topic <id>` — HCS topic for audit logs (default: 0.0.10272696)
- `--dry-run` — Preview transaction without executing
- `--help, -h` — Show help message

## Private Key Setup

The script reads your private key from one of two sources:

### Option 1: Environment Variable (Recommended for CI/scripts)

```bash
export HEDERA_DEPOSITOR_KEY="302e020100300506032b6570042204..."
node scripts/escrow-deposit.mjs ...
```

### Option 2: macOS Keychain (Recommended for local use)

```bash
# Store key securely
security add-generic-password \
  -a "$USER" \
  -s hedera-depositor-key \
  -w "302e020100300506032b6570042204..."

# Script will automatically read from Keychain
node scripts/escrow-deposit.mjs ...
```

**Important:** Use ECDSA hex format keys, NOT DER format.

## What Happens

1. **Validation** — Script validates all parameters
2. **Key retrieval** — Reads depositor's private key from Keychain or env
3. **Contract call** — Executes `deposit(rentalId, owner, budgetCap, maxDuration, hcsTopicId)` with payable amount
4. **Receipt** — Shows transaction ID, status, and HashScan link
5. **Success** — Rental is now active with funds locked in escrow

## Example Output

```
🏦 ATP Escrow Deposit Helper

📋 Transaction Details
   Rental ID: kate-001
   Owner: 0.0.10255397
   Budget Cap: 2 HBAR
   Max Duration: 3600s (60min)
   HCS Topic: 0.0.10272696
   Depositor: 0.0.10255398
   Contract: 0.0.10273381
   Network: mainnet

🔗 Connecting to Hedera mainnet...
💳 Submitting transaction...

✅ Transaction successful!

📊 Receipt
   Status: SUCCESS
   Transaction ID: 0.0.10255398@1739241234.567890000
   Cost: ~0.05 HBAR

🔍 View on HashScan:
   https://hashscan.io/mainnet/transaction/0.0.10255398@1739241234.567890000

🎉 Escrow deposit complete!
   Rental kate-001 is now active with 2 HBAR locked in escrow.
```

## How Escrow Works

1. **Deposit** — Renter deposits HBAR to contract with rental parameters
2. **Active** — Contract holds funds while rental is active
3. **Settlement** — Owner calls `settle(rentalId, finalCost)` when session ends
4. **Payout** — Contract automatically:
   - Pays owner the final cost
   - Refunds renter any unused balance
   - Collects 2% protocol fee

All on-chain. No trust required.

## Troubleshooting

**"Failed to read private key"**
- Set `HEDERA_DEPOSITOR_KEY` environment variable, or
- Store key in Keychain with `security add-generic-password`
- Use ECDSA hex format (starts with "302e...")

**"Hbar in tinybars contains decimals"**
- This is fixed in the latest version
- Update to ensure BigInt conversion

**"Insufficient funds"**
- Make sure your depositor account has enough HBAR for:
  - Deposit amount
  - Transaction fee (~0.05 HBAR)

**"Contract revert"**
- Check that owner account is registered in the contract
- Verify budget meets minimum deposit requirement (1 HBAR)
- Ensure rental ID is unique

## See Also

- Contract source: `/contracts/ATPEscrow.sol`
- Deploy info: `/contracts/deploy-mainnet.json`
- ABI: `/contracts/build/contracts_ATPEscrow_sol_ATPEscrow.abi`
- Rental docs: `/rental/SOUL.md`
