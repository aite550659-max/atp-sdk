#!/usr/bin/env node
import { execFileSync, execSync } from 'node:child_process';
import { createFundingIntent, getFundingIntent } from '../monitor/funding-store.mjs';
import { createRailIntent } from '../monitor/funding-rails.mjs';

const DEPOSIT_ACCOUNT = process.env.ATP_HBAR_HOT_WALLET || '0.0.10421318';
const CHAT_ID = Number(process.env.ATP_TEST_CHAT_ID || '359827754');
const EVM_ADDRESS = '0x0868eC02bb536c24694123ec1c2066Af6Ba6D620';
const SOL_ADDRESS = 'BLDC7RUqCXW2SHggGdhidhYkjbsdzhxJg1vtVyuQgdpk';
const BTC_ADDRESS = 'bc1q9g3gjcpnqp33ddum3z4dq7q2w6ptd89sjnkypv';
const MONITOR_URL = process.env.MONITOR_URL || 'http://localhost:3500';

const RAIL_CONFIG = {
  eth: { intermediate: 'eth', walletAddress: EVM_ADDRESS, send: { script: 'evm-send-from-val.mjs', asset: 'eth', bump: 0.0000057 } },
  sol: { intermediate: 'sol', walletAddress: SOL_ADDRESS, send: { script: 'sol-send-from-val.mjs', bump: 0.00012 } },
  usdc_eth: { intermediate: 'usdc-eth', walletAddress: EVM_ADDRESS, send: { script: 'evm-send-from-val.mjs', asset: 'usdc-eth', bump: 0.01 } },
  usdt_eth: { intermediate: 'usdt-eth', walletAddress: EVM_ADDRESS, send: { script: 'evm-send-from-val.mjs', asset: 'usdt-eth', bump: 0.01 } },
  btc: { intermediate: 'btc', walletAddress: BTC_ADDRESS, send: { script: 'btc-send-from-val.mjs', bump: 0.0000018 } },
  cash_card: { intermediate: 'usdc-base', walletAddress: EVM_ADDRESS, send: { script: 'evm-send-from-val.mjs', asset: 'usdc-base', bump: 0.01 } },
};

function arg(name, fallback = null) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

function requireArg(name) {
  const value = arg(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function runNode(script, args) {
  const out = execFileSync('node', [script, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(out);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getJson(url, opts) {
  const res = await fetch(url, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function loadChangeNowKey() {
  return execSync('security find-generic-password -s changenow-api-key -w', { encoding: 'utf8' }).trim();
}

async function waitForChangeNowSwap(swapId, maxMinutes = 20) {
  const key = loadChangeNowKey();
  const deadline = Date.now() + maxMinutes * 60_000;
  let last = null;
  while (Date.now() < deadline) {
    last = await getJson(`https://api.changenow.io/v1/transactions/${swapId}/${key}`);
    if (['finished', 'failed', 'refunded', 'expired'].includes(last.status)) return last;
    await sleep(10_000);
  }
  throw new Error(`Timed out waiting for ChangeNOW swap ${swapId}, last status=${last?.status}`);
}

async function waitForIntent(intentId, maxMinutes = 20) {
  const deadline = Date.now() + maxMinutes * 60_000;
  let last = getFundingIntent(intentId);
  while (Date.now() < deadline) {
    last = getFundingIntent(intentId);
    if (['active', 'activation_failed', 'failed'].includes(last?.status)) return last;
    await sleep(5_000);
  }
  throw new Error(`Timed out waiting for intent ${intentId}, last status=${last?.status}`);
}

async function cleanupRental(rentalId) {
  if (!rentalId) return null;
  return await getJson(`${MONITOR_URL}/api/rentals/${rentalId}?reason=rail_test_cleanup`, { method: 'DELETE' });
}

function computeSendAmount(railIntent, config) {
  const expected = Number(railIntent.metadata?.estimatedSourceAmount || 0);
  return Number((expected + (config.send.bump || 0)).toFixed(8));
}

async function main() {
  const rail = requireArg('--rail');
  const budget = Number(arg('--budget', '2'));
  const cleanup = process.argv.includes('--cleanup');
  const config = RAIL_CONFIG[rail];
  if (!config) throw new Error(`Unsupported rail ${rail}`);

  const intent = createFundingIntent({
    memo: `rent-railflow-${rail}-${Date.now().toString().slice(-6)}`,
    renterName: `railflow_${rail}`,
    renterTelegramUserId: CHAT_ID,
    renterTelegramChatId: CHAT_ID,
    modelPreference: 'inherit_current',
    targetBudgetUsd: budget,
    recommendedStarterUsd: budget,
    metadata: { source: `workflow_${rail}` },
  });

  const railIntent = await createRailIntent(intent.intentId, rail, DEPOSIT_ACCOUNT);
  const forward = runNode('scripts/changenow-hbar-to-rail.mjs', [
    '--to', config.intermediate,
    '--target-amount', String(railIntent.metadata.estimatedSourceAmount),
    '--address', config.walletAddress,
  ]);

  const forwardDone = await waitForChangeNowSwap(forward.swapId);
  if (forwardDone.status !== 'finished') throw new Error(`Forward swap ${forward.swapId} ended with ${forwardDone.status}`);

  const sendAmount = computeSendAmount(railIntent, config);
  const sendArgs = config.send.script === 'sol-send-from-val.mjs'
    ? ['scripts/sol-send-from-val.mjs', '--to', railIntent.metadata.swapDepositAddress, '--amount', String(sendAmount)]
    : config.send.script === 'btc-send-from-val.mjs'
      ? ['scripts/btc-send-from-val.mjs', '--to', railIntent.metadata.swapDepositAddress, '--amount', String(sendAmount)]
      : ['scripts/evm-send-from-val.mjs', '--asset', config.send.asset, '--to', railIntent.metadata.swapDepositAddress, '--amount', String(sendAmount)];

  const sent = runNode(sendArgs[0], sendArgs.slice(1));
  const finalIntent = await waitForIntent(intent.intentId);
  const cleanupResult = cleanup ? await cleanupRental(finalIntent.metadata?.rentalId) : null;

  console.log(JSON.stringify({
    rail,
    budget,
    intentId: intent.intentId,
    memo: finalIntent.memo,
    forward,
    forwardDone: { status: forwardDone.status, amountReceive: forwardDone.amountReceive || null },
    sent,
    final: {
      status: finalIntent.status,
      rentalId: finalIntent.metadata?.rentalId || null,
      depositTxId: finalIntent.metadata?.depositTxId || null,
      depositUsd: finalIntent.metadata?.depositUsd || null,
      depositHbar: finalIntent.metadata?.depositHbar || null,
      activationSource: finalIntent.metadata?.activationSource || (String(finalIntent.metadata?.depositTxId || '').startsWith('swap:') ? 'synthetic_swap_finished' : 'direct_hbar_payout'),
      history: finalIntent.history?.slice(-6) || [],
    },
    cleanup: cleanupResult,
  }, null, 2));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
