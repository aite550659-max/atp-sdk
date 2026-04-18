#!/usr/bin/env node
import { execSync } from 'node:child_process';
import * as bip39 from 'bip39';
import { BIP32Factory } from 'bip32';
import * as ecc from 'tiny-secp256k1';
import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';

bitcoin.initEccLib(ecc);
const bip32 = BIP32Factory(ecc);
const ECPair = ECPairFactory(ecc);
const network = bitcoin.networks.bitcoin;

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

function btcToSats(amount) {
  return Math.round(Number(amount) * 1e8);
}

async function fetchText(url, opts = {}) {
  const res = await fetch(url, opts);
  const text = await res.text();
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
  return text;
}

async function main() {
  const to = requireArg('--to');
  const amount = requireArg('--amount');
  const feeSats = Number(arg('--fee-sats') || 400);
  const sendValue = btcToSats(amount);

  const seed = bip39.mnemonicToSeedSync(loadMnemonic());
  const root = bip32.fromSeed(seed, network);
  const child = root.derivePath("m/84'/0'/0'/0/0");
  if (!child.privateKey) throw new Error('Missing derived BTC private key');

  const keyPair = ECPair.fromPrivateKey(Buffer.from(child.privateKey));
  const source = bitcoin.payments.p2wpkh({ pubkey: Buffer.from(child.publicKey), network });
  const sourceAddress = source.address;
  if (!sourceAddress || !source.output) throw new Error('Could not derive BTC source address');

  const utxos = JSON.parse(await fetchText(`https://blockstream.info/api/address/${sourceAddress}/utxo`));
  if (!Array.isArray(utxos) || utxos.length === 0) throw new Error('No BTC UTXOs found');

  let total = 0;
  const selected = [];
  for (const utxo of utxos) {
    selected.push(utxo);
    total += utxo.value;
    if (total >= sendValue + feeSats) break;
  }
  if (total < sendValue + feeSats) {
    throw new Error(`Insufficient BTC. Need ${sendValue + feeSats} sats, have ${total} sats`);
  }

  const change = total - sendValue - feeSats;
  const psbt = new bitcoin.Psbt({ network });
  for (const utxo of selected) {
    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: source.output,
        value: BigInt(utxo.value),
      },
    });
  }
  psbt.addOutput({ address: to, value: BigInt(sendValue) });
  if (change >= 546) {
    psbt.addOutput({ address: sourceAddress, value: BigInt(change) });
  }

  for (let i = 0; i < selected.length; i++) {
    psbt.signInput(i, keyPair);
  }
  psbt.finalizeAllInputs();
  const txHex = psbt.extractTransaction().toHex();
  const txid = (await fetchText('https://blockstream.info/api/tx', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: txHex,
  })).trim();

  console.log(JSON.stringify({
    from: sourceAddress,
    to,
    amount,
    sendValue,
    feeSats,
    change,
    inputs: selected.map(({ txid, vout, value }) => ({ txid, vout, value })),
    txid,
  }, null, 2));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
