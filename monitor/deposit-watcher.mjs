#!/usr/bin/env node
/**
 * ATP Deposit Watcher
 * 
 * Monitors a Hedera account for incoming HBAR transfers with rental memos.
 * When a valid deposit is detected:
 *   1. Matches memo to a pending rental (rent-<username>)
 *   2. Converts HBAR amount to USD at current rate
 *   3. Activates the rental session
 *   4. Notifies the renter via Telegram
 * 
 * Uses Hedera Mirror Node REST API — no SDK needed, no keys needed.
 * 
 * Usage:
 *   node monitor/deposit-watcher.mjs                  # Run once (cron mode)
 *   node monitor/deposit-watcher.mjs --daemon          # Run continuously
 *   node monitor/deposit-watcher.mjs --port 3501       # Run with HTTP status endpoint
 * 
 * Env:
 *   DEPOSIT_ACCOUNT    — Account to watch (default: 0.0.10255397)
 *   TELEGRAM_BOT_TOKEN — For renter notifications
 *   MONITOR_URL        — ATP Monitor API (default: http://localhost:3500)
 */

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, 'deposit-state.json');
const MIRROR_API = 'https://mainnet.mirrornode.hedera.com/api/v1';

// ── Config ──────────────────────────────────────────────────────────────────

const DEPOSIT_ACCOUNT = process.env.DEPOSIT_ACCOUNT || '0.0.10255397';
// Use @ATPRentalBot for activation messages — separate from the owner bot
// so the gateway processes them as real incoming messages (not self-messages)
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const RENTAL_BOT_TOKEN = process.env.RENTAL_BOT_TOKEN || '8527162069:AAG5Fg4iM8XatgEBeWj6UkQ2i00PGOypMng';
const MONITOR_URL = process.env.MONITOR_URL || 'http://localhost:3500';
const DAEMON_MODE = process.argv.includes('--daemon');
const POLL_INTERVAL = 15_000; // 15 seconds
const MIN_DEPOSIT_USD = 1.00; // Minimum $1 deposit

// Full-capability rentals; initial model inherits current Aite runtime unless changed later
const MODEL_CHOICES = {
  haiku:  { name: 'Haiku' },
  sonnet: { name: 'Sonnet' },
  opus:   { name: 'Opus' },
};
const DEFAULT_MODEL = 'inherit_current';
const FULL_CAPABILITIES = ['web_search', 'web_fetch', 'image', 'exec', 'write'];

// ── State ───────────────────────────────────────────────────────────────────

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {
      lastTimestamp: '0',  // Hedera consensus timestamp (seconds.nanoseconds)
      processedTxIds: [],     // Last 100 processed transaction IDs
      pendingDeposits: {},    // memo → { renterName, telegramChatId, model, timestamp }
      activatedRentals: [],   // History of activated rentals
      stats: { totalDeposits: 0, totalUsd: 0 }
    };
  }
}

function saveState(state) {
  // Keep processedTxIds bounded
  if (state.processedTxIds.length > 200) {
    state.processedTxIds = state.processedTxIds.slice(-100);
  }
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ── HBAR/USD Exchange Rate ──────────────────────────────────────────────────

let cachedRate = null;
let rateTimestamp = 0;
const RATE_TTL = 300_000; // 5 minutes

async function getHbarUsdRate() {
  if (cachedRate && Date.now() - rateTimestamp < RATE_TTL) return cachedRate;

  try {
    // CoinGecko
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=hedera-hashgraph&vs_currencies=usd');
    const data = await res.json();
    cachedRate = data['hedera-hashgraph']?.usd || null;
    if (cachedRate) {
      rateTimestamp = Date.now();
      return cachedRate;
    }
  } catch {}

  try {
    // Fallback: Binance
    const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=HBARUSDT');
    const data = await res.json();
    cachedRate = parseFloat(data.price);
    rateTimestamp = Date.now();
    return cachedRate;
  } catch {}

  return 0.15; // Last resort fallback
}

function hbarToUsd(tinybars, rate) {
  const hbar = tinybars / 100_000_000;
  return hbar * rate;
}

function usdToHbar(usd, rate) {
  return usd / rate;
}

// ── Mirror Node Queries ─────────────────────────────────────────────────────

async function getRecentTransactions(afterTimestamp) {
  const params = [`account.id=${DEPOSIT_ACCOUNT}`, `order=asc`, `limit=25`];
  if (afterTimestamp && afterTimestamp !== '0') {
    params.push(`timestamp=gt:${afterTimestamp}`);
  }
  const url = `${MIRROR_API}/transactions?${params.join('&')}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return data.transactions || [];
  } catch (e) {
    console.error(`Mirror node error: ${e.message}`);
    return [];
  }
}

// ── Telegram ────────────────────────────────────────────────────────────────

async function sendTelegram(chatId, text) {
  if (!BOT_TOKEN || !chatId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      })
    });
    return (await res.json()).ok;
  } catch { return false; }
}

// ── Deposit Processing ──────────────────────────────────────────────────────

function parseMemo(memoBase64) {
  if (!memoBase64) return null;
  try {
    const decoded = Buffer.from(memoBase64, 'base64').toString('utf8');
    // Expected format: rent-<username> or legacy rent-<username>-<model>
    const match = decoded.match(/^rent-(\S+?)(?:-(\w+))?$/i);
    if (!match) return null;
    return {
      raw: decoded,
      username: match[1],
      model: match[2] ? match[2].toLowerCase() : DEFAULT_MODEL
    };
  } catch { return null; }
}

async function processTransaction(tx, state) {
  const txId = tx.transaction_id;
  
  // Skip already processed
  if (state.processedTxIds.includes(txId)) return null;
  // NOTE: txId added to processedTxIds only AFTER successful activation (in activateRental)

  // Must be a successful transaction
  if (tx.result !== 'SUCCESS') { state.processedTxIds.push(txId); return null; }

  // Find the credit transfer to our account
  const transfers = tx.transfers || [];
  const credit = transfers.find(t => t.account === DEPOSIT_ACCOUNT && t.amount > 0);
  if (!credit) { state.processedTxIds.push(txId); return null; }

  // Parse memo (optional — no-memo deposits are now accepted)
  const memo = parseMemo(tx.memo_base64);

  // Get sender
  const sender = transfers.find(t => t.amount < 0 && t.account !== DEPOSIT_ACCOUNT);
  if (!sender) return null;

  // Calculate USD value
  const rate = await getHbarUsdRate();
  const depositHbar = credit.amount / 100_000_000;
  const depositUsd = hbarToUsd(credit.amount, rate);
  const renterName = memo?.username || sender.account;
  const modelPreference = MODEL_CHOICES[memo?.model] ? memo.model : DEFAULT_MODEL;
  const modelInfo = MODEL_CHOICES[modelPreference] || { name: 'inherit current Aite model' };

  console.log(`  💰 Deposit detected!`);
  console.log(`     From: ${sender.account}`);
  console.log(`     Amount: ${depositHbar.toFixed(4)} HBAR ($${depositUsd.toFixed(2)})`);
  console.log(`     Memo: ${memo ? memo.raw : '(none — using sender account as ID)'}`);
  console.log(`     Renter: ${renterName}`);
  console.log(`     Initial model mode: ${modelInfo.name}`);
  console.log(`     Rate: $${rate}/HBAR`);

  // Validate minimum deposit
  if (depositUsd < MIN_DEPOSIT_USD) {
    console.log(`     ⚠️  Below minimum ($${MIN_DEPOSIT_USD}). Ignoring.`);
    state.processedTxIds.push(txId);
    return null;
  }

  // Deposit amount becomes the session budget cap
  const budgetCap = depositUsd;
  const durationMin = 60;

  const deposit = {
    txId,
    timestamp: tx.consensus_timestamp,
    sender: sender.account,
    renter: renterName,
    modelPreference,
    currentModel: modelPreference === 'inherit_current' ? 'inherit_current' : modelPreference,
    modelName: modelInfo.name,
    depositHbar,
    depositUsd: parseFloat(depositUsd.toFixed(4)),
    budgetCapUsd: parseFloat(budgetCap.toFixed(4)),
    durationMin,
    hbarUsdRate: rate,
    tools: FULL_CAPABILITIES,
    status: 'active',
    expiresAt: Date.now() + (durationMin * 60 * 1000),
    processedAt: new Date().toISOString()
  };

  state.stats.totalDeposits++;
  state.stats.totalUsd += deposit.depositUsd;

  return deposit;
}

// ── Rental Activation ───────────────────────────────────────────────────────

async function activateRental(deposit, state) {
  console.log(`  🚀 Activating rental for ${deposit.renter}...`);

  // Notify monitor to spin up container
  try {
    const res = await fetch(`${MONITOR_URL}/api/rentals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        renterId: deposit.sender,
        renterName: deposit.renter,
        budgetCap: deposit.budgetCapUsd,
        tier: 'full-capabilities',
        depositTx: deposit.txId,
        depositHbar: deposit.depositHbar,
        depositUsd: deposit.depositUsd,
        hbarRate: deposit.hbarUsdRate,
        tools: deposit.tools,
        modelPreference: deposit.modelPreference
      })
    });
    const data = await res.json();
    if (data.ok) {
      console.log(`     ✅ Container created: ${data.containerName}`);
      deposit.rentalId = data.rentalId;
      deposit.containerName = data.containerName;
    } else {
      console.log(`     ⚠️  Monitor error: ${data.error}`);
    }
  } catch (e) {
    console.log(`     ⚠️  Monitor unreachable: ${e.message}`);
    console.log(`     ℹ️  Manual activation required`);
  }

  // Activate rental agent via gateway WebSocket RPC
  // Connects to local gateway, authenticates, then runs an agent turn in the rental session
  const RENTAL_SESSION_KEY = process.env.RENTAL_SESSION_KEY || 'agent:atp-rental:telegram:group:-5273529238';
  const GATEWAY_PORT = process.env.OPENCLAW_GATEWAY_PORT || '18789';
  const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || 'e35d238c2262bfb2aeec929bc72b4b2b28255772af135e6d';
  const activationMsg = `🎉 NEW RENTAL ACTIVATED — User ${deposit.renter} has paid ${deposit.depositHbar.toFixed(2)} HBAR ($${deposit.depositUsd.toFixed(2)} USD). Full capabilities enabled. Initial model behavior: inherit Aite's current model at activation. Budget cap: $${deposit.budgetCapUsd.toFixed(2)}. The renter can change models during the session. Rental session is now ACTIVE. Greet the renter and let them know you're ready to help.`;
  try {
    const wsModule = await import('ws');
    const WebSocket = wsModule.WebSocket || wsModule.default;
    const { randomUUID } = await import('crypto');

    const result = await new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${GATEWAY_PORT}`);
      const timeout = setTimeout(() => { ws.close(); reject(new Error('Gateway timeout (60s)')); }, 60000);
      let connected = false;
      let agentRunId = null;

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());

        // Step 1: Respond to auth challenge
        if (msg.type === 'event' && msg.event === 'connect.challenge') {
          ws.send(JSON.stringify({
            type: 'req', id: randomUUID(), method: 'connect',
            params: {
              minProtocol: 3, maxProtocol: 3,
              client: { id: 'cli', version: '1.0', platform: 'darwin', mode: 'backend' },
              caps: [], auth: { token: GATEWAY_TOKEN }, role: 'operator', scopes: ['operator.admin']
            }
          }));
          return;
        }

        // Step 2: On connect ack, send agent run request
        if (msg.type === 'res' && msg.ok === true && !connected) {
          connected = true;
          ws.send(JSON.stringify({
            type: 'req', id: 'agent-req', method: 'agent',
            params: {
              message: activationMsg,
              sessionKey: RENTAL_SESSION_KEY,
              idempotencyKey: randomUUID(),
              deliver: true,
              channel: 'telegram',
              lane: 'nested'
            }
          }));
          return;
        }

        // Step 3: Agent run accepted, wait for completion
        if (msg.type === 'res' && msg.id === 'agent-req') {
          if (msg.ok) {
            agentRunId = msg.payload?.runId;
            ws.send(JSON.stringify({
              type: 'req', id: 'wait-req', method: 'agent.wait',
              params: { runId: agentRunId, timeoutMs: 45000 }
            }));
          } else {
            clearTimeout(timeout); ws.close();
            reject(new Error(msg.error?.message || 'agent request failed'));
          }
          return;
        }

        // Step 4: Agent completed
        if (msg.type === 'res' && msg.id === 'wait-req') {
          clearTimeout(timeout); ws.close();
          resolve(msg.payload);
          return;
        }
      });

      ws.on('error', (err) => { clearTimeout(timeout); reject(err); });
    });

    console.log(`     ✅ Activation delivered via gateway RPC (run: ${result?.runId || '?'})`);
  } catch (e) {
    console.log(`     ⚠️  Gateway RPC activation failed: ${e.message}`);
    // Fallback: send notification via Telegram (visible to renter, but agent won't auto-respond)
    const RENTAL_GROUP_ID = process.env.RENTAL_GROUP_ID || '-5273529238';
    const activationBot = RENTAL_BOT_TOKEN || BOT_TOKEN;
    if (activationBot) {
      try {
        await fetch(`https://api.telegram.org/bot${activationBot}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: RENTAL_GROUP_ID, text: `[SYSTEM] ${activationMsg}\n\n⚠️ Agent activation pending — owner notified.` })
        });
        console.log(`     📱 Fallback: Telegram notification sent`);
      } catch (e2) {
        console.log(`     ⚠️  All activation methods failed: ${e2.message}`);
      }
    }
  }

  // Mark as processed only after activation attempt (prevents lost deposits on restart)
  state.processedTxIds.push(deposit.txId);
  state.activatedRentals.push(deposit);
  saveState(state);

  // Start HCS sidecar loop to log interactions on-chain
  startSidecarLoop();

  return deposit;
}

// ── HCS Sidecar Integration ─────────────────────────────────────────────────

let sidecarInterval = null;
const SIDECAR_INTERVAL = 5 * 60 * 1000; // 5 minutes
const SIDECAR_SCRIPT = new URL('../scripts/rental-sidecar.mjs', import.meta.url).pathname;
const HEDERA_OPERATOR_ID = process.env.HEDERA_OPERATOR_ID || '0.0.10255397';

async function getHederaKey() {
  // Try macOS Keychain first (works in interactive sessions)
  try {
    const { execSync } = await import('child_process');
    const key = execSync("security find-generic-password -a 'atp-sidecar' -s 'hedera-operator-key' -w login.keychain 2>/dev/null", 
      { encoding: 'utf-8', timeout: 5000 }).trim();
    if (key) return key;
  } catch {}
  // Fall back to environment variable
  return process.env.HEDERA_OPERATOR_KEY || null;
}

async function runSidecar() {
  const key = await getHederaKey();
  if (!key) {
    console.log(`  📋 HCS sidecar skipped — no Keychain/env key available`);
    return;
  }
  try {
    const { execSync } = await import('child_process');
    console.log(`  📋 Running HCS sidecar...`);
    const output = execSync(`/opt/homebrew/bin/node ${SIDECAR_SCRIPT}`, {
      encoding: 'utf-8',
      timeout: 60000,
      cwd: '/Users/aite/.openclaw/workspace',
      env: { ...process.env, HEDERA_OPERATOR_KEY: key, HEDERA_OPERATOR_ID }
    });
    // Print last few lines of output
    const lines = output.trim().split('\n').filter(l => l.trim());
    const summary = lines.slice(-3).join('\n     ');
    if (summary) console.log(`     ${summary}`);
  } catch (e) {
    console.log(`  ⚠️  HCS sidecar error: ${e.message.split('\n')[0]}`);
  }
}

function startSidecarLoop() {
  if (sidecarInterval) return; // Already running
  console.log(`  📋 HCS sidecar loop started (every ${SIDECAR_INTERVAL / 60000}min)`);
  // Run immediately on activation
  runSidecar();
  // Then every 5 minutes
  sidecarInterval = setInterval(runSidecar, SIDECAR_INTERVAL);
}

function stopSidecarLoop() {
  if (sidecarInterval) {
    clearInterval(sidecarInterval);
    sidecarInterval = null;
    console.log(`  📋 HCS sidecar loop stopped`);
    // Run one final time to capture end-of-session
    runSidecar();
  }
}

// ── Main Poll Loop ──────────────────────────────────────────────────────────

async function poll() {
  const state = loadState();
  
  console.log(`[${new Date().toISOString()}] Polling ${DEPOSIT_ACCOUNT}...`);
  
  const transactions = await getRecentTransactions(state.lastTimestamp);
  
  if (transactions.length === 0) {
    console.log('  No new transactions');
    return;
  }

  console.log(`  Found ${transactions.length} new transaction(s)`);

  for (const tx of transactions) {
    const deposit = await processTransaction(tx, state);
    
    if (deposit) {
      await activateRental(deposit, state);
    }

    // Update timestamp watermark
    if (tx.consensus_timestamp > state.lastTimestamp) {
      state.lastTimestamp = tx.consensus_timestamp;
    }
  }

  saveState(state);
}

// ── Entry ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n💰 ATP Deposit Watcher');
  console.log(`   Account:  ${DEPOSIT_ACCOUNT}`);
  console.log(`   Monitor:  ${MONITOR_URL}`);
  console.log(`   Mode:     ${DAEMON_MODE ? 'daemon' : 'single poll'}`);
  console.log(`   Min:      $${MIN_DEPOSIT_USD}\n`);

  if (DAEMON_MODE) {
    // Initial poll
    await poll();

    // Continuous polling
    setInterval(poll, POLL_INTERVAL);

    // Optional HTTP status endpoint
    const statusPort = process.argv.find((_, i, a) => a[i - 1] === '--port');
    if (statusPort) {
      const port = parseInt(statusPort);
      const state = loadState();
      http.createServer((req, res) => {
        const s = loadState();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'watching',
          account: DEPOSIT_ACCOUNT,
          lastTimestamp: s.lastTimestamp,
          totalDeposits: s.stats.totalDeposits,
          totalUsd: s.stats.totalUsd,
          pendingCount: Object.keys(s.pendingDeposits).length,
          activatedCount: s.activatedRentals.length
        }, null, 2));
      }).listen(port, '127.0.0.1', () => {
        console.log(`   Status:   http://localhost:${port}\n`);
      });
    }

    console.log('   Watching for deposits... (Ctrl+C to stop)\n');
  } else {
    await poll();
  }
}

main().catch(e => {
  console.error(`Fatal: ${e.message}`);
  process.exit(1);
});
