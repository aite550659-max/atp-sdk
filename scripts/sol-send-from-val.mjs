#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { derivePath } from 'ed25519-hd-key';
import * as bip39 from 'bip39';

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}

function requireArg(name) {
  const value = arg(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function loadMnemonic() {
  return execSync('security find-generic-password -s val-wallet-mnemonic -w', { encoding: 'utf8' }).trim();
}

async function main() {
  const to = requireArg('--to');
  const amount = Number(requireArg('--amount'));
  const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
  const seed = await bip39.mnemonicToSeed(loadMnemonic());
  const derived = derivePath("m/44'/501'/0'/0'", seed.toString('hex'));
  const keypair = Keypair.fromSeed(Uint8Array.from(derived.key));

  const tx = new Transaction();
  tx.add(SystemProgram.transfer({
    fromPubkey: keypair.publicKey,
    toPubkey: new PublicKey(to),
    lamports: Math.round(amount * 1e9),
  }));

  const sig = await connection.sendTransaction(tx, [keypair]);
  await connection.confirmTransaction(sig, 'confirmed');
  const bal = await connection.getBalance(keypair.publicKey);

  console.log(JSON.stringify({
    from: keypair.publicKey.toBase58(),
    to,
    amount,
    signature: sig,
    solBalanceAfter: bal / 1e9,
  }, null, 2));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
