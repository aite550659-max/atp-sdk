#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { Client, PrivateKey, AccountId, TransferTransaction, Hbar } from '@hashgraph/sdk';

const CHANGENOW_API = 'https://api.changenow.io/v1';
const OPERATOR_ID = process.env.HEDERA_OPERATOR_ID || '0.0.10255397';
const API_KEY = process.env.CHANGENOW_API_KEY || loadChangeNowKey();

const TO_TICKER = {
  eth: 'eth',
  sol: 'sol',
  btc: 'btc',
  'usdc-eth': 'usdc',
  'usdt-eth': 'usdterc20',
  'usdc-base': 'usdcbase',
  usdc: 'usdc',
  usdt: 'usdterc20',
};

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}

function requireArg(name) {
  const value = arg(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function loadChangeNowKey() {
  try {
    return execSync('security find-generic-password -s changenow-api-key -w', { encoding: 'utf8' }).trim();
  } catch {
    throw new Error('ChangeNOW API key not found in Keychain');
  }
}

function loadHederaKey() {
  try {
    return execSync('security find-generic-password -s hedera-operator-key -w', { encoding: 'utf8' }).trim();
  } catch {
    throw new Error('Hedera operator key not found in Keychain');
  }
}

async function getJson(url) {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.message || data.error || `HTTP ${res.status}`);
  return data;
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.message || data.error || `HTTP ${res.status}`);
  return data;
}

async function estimateRequiredHbar(toTicker, targetAmount) {
  const pair = `hbar_${toTicker}`;
  const min = await getJson(`${CHANGENOW_API}/min-amount/${pair}`);
  let lo = Number(min.minAmount);
  let hi = lo;

  for (let i = 0; i < 24; i++) {
    const est = await getJson(`${CHANGENOW_API}/exchange-amount/${hi}/${pair}`);
    if (Number(est.estimatedAmount || 0) >= targetAmount) break;
    hi *= 1.5;
  }

  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const est = await getJson(`${CHANGENOW_API}/exchange-amount/${mid}/${pair}`);
    const out = Number(est.estimatedAmount || 0);
    if (out >= targetAmount) hi = mid;
    else lo = mid;
  }

  const buffered = Number((hi * 1.01).toFixed(8));
  const finalEst = await getJson(`${CHANGENOW_API}/exchange-amount/${buffered}/${pair}`);
  return {
    pair,
    inputHbar: buffered,
    estimatedOutput: Number(finalEst.estimatedAmount || 0),
  };
}

async function createSwap(toTicker, inputHbar, address, extraId) {
  return await postJson(`${CHANGENOW_API}/transactions/${API_KEY}`, {
    from: 'hbar',
    to: toTicker,
    amount: inputHbar,
    address,
    ...(extraId ? { extraId } : {}),
    flow: 'standard',
  });
}

async function sendHbar(payinAddress, payinExtraId, amountHbar) {
  const client = Client.forMainnet();
  client.setOperator(AccountId.fromString(OPERATOR_ID), PrivateKey.fromStringECDSA(loadHederaKey()));

  const tx = await new TransferTransaction()
    .setTransactionMemo(payinExtraId || '')
    .addHbarTransfer(AccountId.fromString(OPERATOR_ID), Hbar.fromString(`-${amountHbar}`))
    .addHbarTransfer(AccountId.fromString(payinAddress), Hbar.fromString(String(amountHbar)))
    .execute(client);

  const receipt = await tx.getReceipt(client);
  client.close();
  return {
    transactionId: tx.transactionId?.toString() || null,
    status: receipt.status.toString(),
  };
}

async function main() {
  const to = requireArg('--to');
  const targetAmount = Number(requireArg('--target-amount'));
  const address = requireArg('--address');
  const extraId = arg('--extra-id');
  const toTicker = TO_TICKER[to] || to;

  const estimate = await estimateRequiredHbar(toTicker, targetAmount);
  const swap = await createSwap(toTicker, estimate.inputHbar, address, extraId);
  const funding = await sendHbar(swap.payinAddress, swap.payinExtraId || null, estimate.inputHbar);

  console.log(JSON.stringify({
    requested: { to, toTicker, targetAmount, address, extraId: extraId || null },
    estimate,
    swapId: swap.id,
    payinAddress: swap.payinAddress,
    payinExtraId: swap.payinExtraId || null,
    payoutAddress: swap.payoutAddress,
    payoutExtraId: swap.payoutExtraId || null,
    funding,
  }, null, 2));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
