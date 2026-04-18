#!/usr/bin/env node

/**
 * escrow-deposit.mjs - Escrow deposit helper for ATP rentals
 *
 * Deposits HBAR into the ATPEscrow contract for a rental session.
 *
 * Usage:
 *   node scripts/escrow-deposit.mjs \
 *     --rental-id "kate-001" \
 *     --owner 0.0.10255397 \
 *     --budget 2.00 \
 *     --duration 3600 \
 *     [--dry-run] \
 *     [--hcs-topic 0.0.10272696]
 */

import {
  Client,
  ContractExecuteTransaction,
  PrivateKey,
  Hbar,
  ContractFunctionParameters,
  AccountId
} from '@hashgraph/sdk';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Contract details
const ESCROW_CONTRACT_ID = '0.0.10273381';
const MAINNET_NETWORK = 'mainnet';
const DEFAULT_HCS_TOPIC = '0.0.10272696';

// Parse command line arguments
function parseArgs() {
  const args = {
    rentalId: null,
    owner: null,
    budget: null,
    duration: null,
    hcsTopic: DEFAULT_HCS_TOPIC,
    dryRun: false,
  };

  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    const next = process.argv[i + 1];

    switch (arg) {
      case '--rental-id':
        args.rentalId = next;
        i++;
        break;
      case '--owner':
        args.owner = next;
        i++;
        break;
      case '--budget':
        args.budget = parseFloat(next);
        i++;
        break;
      case '--duration':
        args.duration = parseInt(next);
        i++;
        break;
      case '--hcs-topic':
        args.hcsTopic = next;
        i++;
        break;
      case '--dry-run':
        args.dryRun = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
    }
  }

  return args;
}

function printHelp() {
  console.log(`
ATP Escrow Deposit Helper

Usage:
  node scripts/escrow-deposit.mjs [options]

Required:
  --rental-id <id>      Unique rental identifier (e.g., "kate-001")
  --owner <account>     Owner's Hedera account (e.g., 0.0.10255397)
  --budget <amount>     Budget cap in HBAR (e.g., 2.00)
  --duration <seconds>  Max rental duration in seconds (e.g., 3600)

Optional:
  --hcs-topic <id>      HCS topic for logs (default: ${DEFAULT_HCS_TOPIC})
  --dry-run             Preview transaction without executing
  --help, -h            Show this help message

Environment:
  HEDERA_DEPOSITOR_KEY  Private key (hex ECDSA format)
                        Falls back to macOS Keychain: hedera-depositor-key

Examples:
  # Basic deposit
  node scripts/escrow-deposit.mjs \\
    --rental-id "kate-001" \\
    --owner 0.0.10255397 \\
    --budget 2.00 \\
    --duration 3600

  # Dry run
  node scripts/escrow-deposit.mjs \\
    --rental-id "test-001" \\
    --owner 0.0.10255397 \\
    --budget 1.50 \\
    --duration 1800 \\
    --dry-run
`);
}

function validateArgs(args) {
  const errors = [];

  if (!args.rentalId) errors.push('--rental-id is required');
  if (!args.owner) errors.push('--owner is required');
  if (!args.budget || args.budget <= 0) errors.push('--budget must be > 0');
  if (!args.duration || args.duration <= 0) errors.push('--duration must be > 0');

  if (errors.length > 0) {
    console.error('❌ Validation errors:');
    errors.forEach(err => console.error(`   ${err}`));
    console.error('\nRun with --help for usage information.');
    process.exit(1);
  }
}

// Read private key from Keychain or environment
function getPrivateKey() {
  // Try environment variable first
  if (process.env.HEDERA_DEPOSITOR_KEY) {
    console.log('📝 Using key from HEDERA_DEPOSITOR_KEY environment variable');
    return PrivateKey.fromStringECDSA(process.env.HEDERA_DEPOSITOR_KEY);
  }

  // Fall back to macOS Keychain
  try {
    console.log('🔐 Reading key from macOS Keychain (hedera-depositor-key)...');
    const keyHex = execSync(
      'security find-generic-password -a "$USER" -s hedera-depositor-key -w',
      { encoding: 'utf8' }
    ).trim();

    return PrivateKey.fromStringECDSA(keyHex);
  } catch (error) {
    console.error('❌ Failed to read private key from Keychain or environment');
    console.error('   Set HEDERA_DEPOSITOR_KEY or store key in Keychain:');
    console.error('   security add-generic-password -a "$USER" -s hedera-depositor-key -w <your-key>');
    process.exit(1);
  }
}

// Load contract ABI
function loadABI() {
  const abiPath = join(__dirname, '..', 'contracts', 'build', 'contracts_ATPEscrow_sol_ATPEscrow.abi');
  try {
    return JSON.parse(readFileSync(abiPath, 'utf8'));
  } catch (error) {
    console.error('❌ Failed to load contract ABI from:', abiPath);
    console.error(error.message);
    process.exit(1);
  }
}

// Convert owner account to EVM address
function accountIdToEvmAddress(accountId) {
  const parts = accountId.split('.');
  if (parts.length !== 3) {
    throw new Error(`Invalid account ID format: ${accountId}`);
  }

  const accountNum = parseInt(parts[2]);
  // Hedera account to EVM address: 0x + 20 bytes (pad account number)
  const hex = accountNum.toString(16).padStart(40, '0');
  return `0x${hex}`;
}

async function main() {
  console.log('🏦 ATP Escrow Deposit Helper\n');

  const args = parseArgs();
  validateArgs(args);

  // Skip key retrieval in dry-run mode
  let privateKey = null;
  let accountId = null;

  if (!args.dryRun) {
    privateKey = getPrivateKey();
    accountId = privateKey.publicKey.toAccountId(0, 0);
  }

  console.log('📋 Transaction Details');
  console.log('   Rental ID:', args.rentalId);
  console.log('   Owner:', args.owner);
  console.log('   Budget Cap:', `${args.budget} HBAR`);
  console.log('   Max Duration:', `${args.duration}s (${Math.floor(args.duration / 60)}min)`);
  console.log('   HCS Topic:', args.hcsTopic);
  if (accountId) {
    console.log('   Depositor:', accountId.toString());
  }
  console.log('   Contract:', ESCROW_CONTRACT_ID);
  console.log('   Network:', MAINNET_NETWORK);
  console.log('');

  if (args.dryRun) {
    console.log('🔍 DRY RUN MODE - No transaction will be submitted\n');

    // Calculate values for display
    // 1 HBAR = 100,000,000 tinybars
    const budgetTinybars = BigInt(Math.floor(args.budget * 100_000_000));
    const ownerEvmAddress = accountIdToEvmAddress(args.owner);

    // Show function signature
    console.log('Contract call:');
    console.log('   Function: deposit(string,address,uint256,uint256,string)');
    console.log('   Parameters:');
    console.log(`     rentalId: "${args.rentalId}"`);
    console.log(`     owner: ${ownerEvmAddress}`);
    console.log(`     budgetCap: ${budgetTinybars.toString()} (tinybars)`);
    console.log(`     maxDuration: ${args.duration} (seconds)`);
    console.log(`     hcsTopicId: "${args.hcsTopic}"`);
    console.log(`   Payable amount: ${args.budget} HBAR`);
    console.log('');
    console.log('✅ Dry run complete. Run without --dry-run to execute.');
    return;
  }

  // Create Hedera client
  console.log('🔗 Connecting to Hedera mainnet...');
  const client = Client.forMainnet();
  client.setOperator(accountId, privateKey);

  try {
    // Convert budget to HBAR and tinybars
    // 1 HBAR = 100,000,000 tinybars
    const budgetHbar = new Hbar(args.budget);
    const budgetTinybars = BigInt(Math.floor(args.budget * 100_000_000));

    // Convert owner to EVM address
    const ownerEvmAddress = accountIdToEvmAddress(args.owner);

    // Build contract function parameters
    const functionParams = new ContractFunctionParameters()
      .addString(args.rentalId)           // rentalId
      .addAddress(ownerEvmAddress)         // owner
      .addUint256(budgetTinybars)          // budgetCap
      .addUint256(args.duration)           // maxDuration
      .addString(args.hcsTopic);           // hcsTopicId

    console.log('💳 Submitting transaction...');

    // Execute contract transaction
    const transaction = new ContractExecuteTransaction()
      .setContractId(ESCROW_CONTRACT_ID)
      .setGas(500000)  // Increase gas for complex contract calls
      .setPayableAmount(budgetHbar)
      .setFunction('deposit', functionParams);

    const txResponse = await transaction.execute(client);
    const receipt = await txResponse.getReceipt(client);

    console.log('');
    console.log('✅ Transaction successful!');
    console.log('');
    console.log('📊 Receipt');
    console.log('   Status:', receipt.status.toString());
    console.log('   Transaction ID:', txResponse.transactionId.toString());
    console.log('   Cost:', `~${(await txResponse.getRecord(client)).transactionFee.toString()} HBAR`);
    console.log('');
    console.log('🔍 View on HashScan:');
    console.log(`   https://hashscan.io/mainnet/transaction/${txResponse.transactionId.toString()}`);
    console.log('');
    console.log('🎉 Escrow deposit complete!');
    console.log(`   Rental ${args.rentalId} is now active with ${args.budget} HBAR locked in escrow.`);

  } catch (error) {
    console.error('');
    console.error('❌ Transaction failed:');
    console.error('   ', error.message);

    if (error.status) {
      console.error('   Status:', error.status.toString());
    }

    process.exit(1);
  } finally {
    client.close();
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
