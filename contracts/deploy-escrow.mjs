#!/usr/bin/env node
/**
 * Deploy ATPEscrow to Hedera EVM (testnet or mainnet)
 *
 * Usage:
 *   NETWORK=testnet node contracts/deploy-escrow.mjs
 *   NETWORK=mainnet node contracts/deploy-escrow.mjs
 *
 * Requires: HEDERA_OPERATOR_ID, HEDERA_OPERATOR_KEY env vars
 * Requires: solc (npm install -g solc) or use pre-compiled ABI/bytecode
 */

import {
  Client,
  AccountId,
  PrivateKey,
  ContractCreateFlow,
  ContractFunctionParameters,
  ContractCallQuery,
  Hbar,
} from '@hashgraph/sdk';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ──────────────────────────────────────────────────────────────────

const NETWORK = process.env.NETWORK || 'testnet';
const OPERATOR_ID = process.env.HEDERA_OPERATOR_ID;
const OPERATOR_KEY = process.env.HEDERA_OPERATOR_KEY;
const PROTOCOL_FEE_BPS = 200;  // 2%
const MIN_DEPOSIT = 100_000_000;  // 1 HBAR in tinybars

if (!OPERATOR_ID || !OPERATOR_KEY) {
  console.error('Set HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY');
  process.exit(1);
}

// ── Compile Contract ────────────────────────────────────────────────────────

function compileContract() {
  const solFile = path.join(__dirname, 'ATPEscrow.sol');
  const outDir = path.join(__dirname, 'build');

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  console.log('Compiling ATPEscrow.sol...');
  try {
    execSync(
      `solcjs --bin --abi --optimize --output-dir ${outDir} ${solFile}`,
      { stdio: 'pipe' }
    );
  } catch (e) {
    // Try npx solc if solcjs not found
    execSync(
      `npx solc --bin --abi --optimize --output-dir ${outDir} ${solFile}`,
      { stdio: 'pipe' }
    );
  }

  // Find output files (solcjs names them with underscores)
  const files = fs.readdirSync(outDir);
  const binFile = files.find(f => f.endsWith('.bin'));
  const abiFile = files.find(f => f.endsWith('.abi'));

  if (!binFile || !abiFile) {
    throw new Error(`Compilation failed. Files in ${outDir}: ${files.join(', ')}`);
  }

  const bytecode = fs.readFileSync(path.join(outDir, binFile), 'utf8');
  const abi = JSON.parse(fs.readFileSync(path.join(outDir, abiFile), 'utf8'));

  console.log(`Compiled: bytecode=${bytecode.length} chars, ABI=${abi.length} functions`);
  return { bytecode, abi };
}

// ── Deploy ──────────────────────────────────────────────────────────────────

async function deploy() {
  console.log(`\n🔐 ATP Escrow Deployment — ${NETWORK.toUpperCase()}\n`);

  // Init client
  const client = NETWORK === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
  const operatorKey = PrivateKey.fromStringECDSA(OPERATOR_KEY);
  client.setOperator(AccountId.fromString(OPERATOR_ID), operatorKey);

  // Compile
  const { bytecode, abi } = compileContract();

  // Deploy via ContractCreateFlow (handles file upload + create)
  console.log('Deploying contract...');
  const tx = new ContractCreateFlow()
    .setBytecode(bytecode)
    .setGas(5_000_000)
    .setConstructorParameters(
      new ContractFunctionParameters()
        .addUint256(PROTOCOL_FEE_BPS)
        .addUint256(MIN_DEPOSIT)
    );

  const response = await tx.execute(client);
  const receipt = await response.getReceipt(client);
  const contractId = receipt.contractId;
  const contractEvmAddress = contractId.toSolidityAddress();

  console.log(`\n✅ ATPEscrow deployed!`);
  console.log(`   Contract ID:  ${contractId}`);
  console.log(`   EVM Address:  0x${contractEvmAddress}`);
  console.log(`   Network:      ${NETWORK}`);
  console.log(`   Protocol Fee: ${PROTOCOL_FEE_BPS / 100}%`);
  console.log(`   Min Deposit:  ${MIN_DEPOSIT / 100_000_000} HBAR`);
  console.log(`   Admin:        ${OPERATOR_ID}`);
  console.log(`   Explorer:     https://hashscan.io/${NETWORK}/contract/${contractId}\n`);

  // Register the operator as an owner
  console.log('Registering operator as agent owner...');
  const registerTx = new ContractCallQuery()
    // This would be a ContractExecuteTransaction in practice
    // Simplified here — full implementation would use ContractExecuteTransaction

  // Save deployment info
  const deployInfo = {
    network: NETWORK,
    contractId: contractId.toString(),
    evmAddress: `0x${contractEvmAddress}`,
    deployedAt: new Date().toISOString(),
    deployedBy: OPERATOR_ID,
    protocolFeeBps: PROTOCOL_FEE_BPS,
    minDeposit: MIN_DEPOSIT,
    minDepositHbar: MIN_DEPOSIT / 100_000_000,
    abi,
    explorer: `https://hashscan.io/${NETWORK}/contract/${contractId}`
  };

  const deployFile = path.join(__dirname, `deploy-${NETWORK}.json`);
  fs.writeFileSync(deployFile, JSON.stringify(deployInfo, null, 2));
  console.log(`Deployment info saved to ${deployFile}`);

  client.close();
}

deploy().catch(e => {
  console.error('Deployment failed:', e.message);
  process.exit(1);
});
