#!/usr/bin/env node
/**
 * Create a Hedera testnet account using the SDK
 * Uses the testnet auto-create via PrivateKey.generateECDSA()
 */
import { Client, PrivateKey, AccountCreateTransaction, Hbar, AccountId } from '@hashgraph/sdk';

async function main() {
  // Generate a new ECDSA key for testnet
  const newKey = PrivateKey.generateECDSA();
  console.log('Generated ECDSA key for testnet');
  console.log(`  Private: ${newKey.toStringRaw()}`);
  console.log(`  Public:  ${newKey.publicKey.toStringRaw()}`);

  // We need a funded account to create another account
  // Use the Hedera testnet faucet instead
  console.log('\n⚠️  To create account, fund via Hedera faucet:');
  console.log('   https://portal.hedera.com/faucet');
  console.log(`   EVM address: 0x${newKey.publicKey.toEvmAddress()}`);
  console.log('\nOr use portal.hedera.com to create a pre-funded testnet account.');

  // Save for later use
  const info = {
    network: 'testnet',
    privateKey: newKey.toStringRaw(),
    publicKey: newKey.publicKey.toStringRaw(),
    evmAddress: `0x${newKey.publicKey.toEvmAddress()}`,
    createdAt: new Date().toISOString(),
    note: 'Fund via portal.hedera.com/faucet, then account auto-creates on first tx'
  };

  const fs = await import('node:fs');
  fs.writeFileSync('contracts/testnet-key.json', JSON.stringify(info, null, 2));
  console.log('\nKey saved to contracts/testnet-key.json');
  console.log('⚠️  Add to .gitignore!');
}

main().catch(console.error);
