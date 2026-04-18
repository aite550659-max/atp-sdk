#!/usr/bin/env node
/**
 * ATP Rental Bot - @ATPRentalBot on Telegram
 *
 * Handles user-facing commands for renting Aite's agent capabilities.
 * Works with deposit-watcher.mjs (detects payments) and atp-monitor.mjs (dashboard).
 *
 * Commands:
 *   /start  - Welcome + intro
 *   /rent   - Start rental flow (get payment address)
 *   /status - Check active rental
 *   /help   - Command list
 *
 * Usage:
 *   node monitor/atp-rental-bot.mjs
 *   node monitor/atp-rental-bot.mjs --daemon  # Background mode
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createFundingIntent, listFundingIntents } from './funding-store.mjs';
import { createRailIntent } from './funding-rails.mjs';

function loadKeychainValue(service) {
  try {
    return execSync(`security find-generic-password -s ${service} -w`, { encoding: 'utf8', timeout: 5000 }).trim() || null;
  } catch {
    return null;
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BOT_TOKEN = process.env.RENTAL_BOT_TOKEN || loadKeychainValue('rental-bot-token');
const API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const DEPOSIT_STATE = path.join(__dirname, 'deposit-state.json');
const DEPOSIT_ACCOUNT = '0.0.10421318';
const MONITOR_URL = process.env.MONITOR_URL || 'http://localhost:3500';
const RENTAL_SESSION_KEY = process.env.RENTAL_SESSION_KEY || 'agent:atp-rental:telegram:group:-5273529238';
const GATEWAY_PORT = process.env.OPENCLAW_GATEWAY_PORT || '18789';
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || 'e35d238c2262bfb2aeec929bc72b4b2b28255772af135e6d';
const POLL_INTERVAL = 2000; // 2s polling for updates

// ── Full-capability rentals ────────────────────────────────────────────────

const FULL_CAPABILITIES = ['web_search', 'web_fetch', 'image', 'exec', 'write'];
const SUPPORTED_MODELS = ['haiku', 'sonnet', 'opus'];
const RECOMMENDED_STARTER_USD = 5.00;
const COMMAND_DEDUPE_MS = 4000;

// ── State ───────────────────────────────────────────────────────────────────

let offset = 0;
const recentCommandTimestamps = new Map();

function loadDepositState() {
  try {
    return JSON.parse(fs.readFileSync(DEPOSIT_STATE, 'utf8'));
  } catch {
    return { pendingDeposits: {}, activatedRentals: [] };
  }
}

function saveDepositState(state) {
  fs.writeFileSync(DEPOSIT_STATE, JSON.stringify(state, null, 2));
}

async function pushRuntimeModelChange(model, renterName, rentalId) {
  const wsModule = await import('ws');
  const WebSocket = wsModule.WebSocket || wsModule.default;
  const { randomUUID } = await import('crypto');

  const successToken = `MODEL_SWITCHED:${model}`;
  const failToken = 'MODEL_SWITCH_FAILED';
  const prompt = `SYSTEM: ATP rental ${rentalId} for renter ${renterName} has changed models. Immediately call session_status on your current session with model=${model} so the live rental session switches to ${model}. From this turn onward, continue on ${model} unless changed again. In your completion/result include EXACTLY one verification token: ${successToken} if the session_status model switch succeeded, otherwise ${failToken}. Also send a brief renter-facing confirmation in chat.`;

  return await new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${GATEWAY_PORT}`);
    const timeout = setTimeout(() => { ws.close(); reject(new Error('Gateway timeout')); }, 60000);
    let connected = false;
    let agentRunId = null;

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'event' && msg.event === 'connect.challenge') {
        ws.send(JSON.stringify({
          type: 'req', id: randomUUID(), method: 'connect',
          params: {
            minProtocol: 3, maxProtocol: 3,
            client: { id: 'atp-rental-bot', version: '1.0', platform: 'darwin', mode: 'backend' },
            caps: [], auth: { token: GATEWAY_TOKEN }, role: 'operator', scopes: ['operator.admin']
          }
        }));
        return;
      }

      if (msg.type === 'res' && msg.ok === true && !connected) {
        connected = true;
        ws.send(JSON.stringify({
          type: 'req', id: 'agent-req', method: 'agent',
          params: {
            message: prompt,
            sessionKey: RENTAL_SESSION_KEY,
            idempotencyKey: randomUUID(),
            deliver: true,
            channel: 'telegram',
            lane: 'nested'
          }
        }));
        return;
      }

      if (msg.type === 'res' && msg.id === 'agent-req') {
        if (!msg.ok) {
          clearTimeout(timeout);
          ws.close();
          return reject(new Error(msg.error?.message || 'agent request failed'));
        }
        agentRunId = msg.payload?.runId;
        ws.send(JSON.stringify({
          type: 'req', id: 'wait-req', method: 'agent.wait',
          params: { runId: agentRunId, timeoutMs: 45000 }
        }));
        return;
      }

      if (msg.type === 'res' && msg.id === 'wait-req') {
        clearTimeout(timeout);
        ws.close();
        const payload = msg.payload || {};
        const blob = JSON.stringify(payload);
        return resolve({
          ok: msg.ok,
          runId: agentRunId,
          confirmed: blob.includes(successToken),
          failed: blob.includes(failToken),
          payload
        });
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

// ── Telegram API Helpers ────────────────────────────────────────────────────

async function tg(method, body) {
  console.log(`→ tg.${method}`);
  const res = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  console.log(`← tg.${method} ok=${data.ok}`);
  if (!data.ok) console.error(`TG API error (${method}):`, data.description);
  return data;
}

async function send(chatId, text, opts = {}) {
  return tg('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
    ...opts
  });
}

async function sendPlain(chatId, text, opts = {}) {
  return tg('sendMessage', {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    ...opts
  });
}

async function sendWithButtons(chatId, text, buttons) {
  return send(chatId, text, {
    reply_markup: {
      inline_keyboard: buttons
    }
  });
}

function buildQrUrl(text) {
  return `https://quickchart.io/qr?text=${encodeURIComponent(text)}&size=600`;
}

async function sendQr(chatId, text, caption = '') {
  return tg('sendPhoto', {
    chat_id: chatId,
    photo: buildQrUrl(text),
    caption,
    parse_mode: 'Markdown'
  });
}

async function answerCallback(callbackQueryId, text) {
  return tg('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text
  });
}

// ── HBAR Price ──────────────────────────────────────────────────────────────

let cachedPrice = null;
let priceTs = 0;

function getUserLabel(from) {
  return from.username || from.first_name || `user${from.id}`;
}

function getActiveRental(state, from, chatId) {
  const username = getUserLabel(from);
  const matches = (state.activatedRentals || []).filter(r => {
    const sameUser = r.telegramChatId === chatId || r.renterName === username || r.renter === username;
    const active = (!r.status || r.status === 'active') && (!r.expiresAt || r.expiresAt > Date.now());
    return sameUser && active;
  });

  if (matches.length === 0) return null;

  matches.sort((a, b) => {
    const aTs = Date.parse(a.processedAt || a.activatedAt || a.timestamp || 0) || Number(a.expiresAt || 0) || 0;
    const bTs = Date.parse(b.processedAt || b.activatedAt || b.timestamp || 0) || Number(b.expiresAt || 0) || 0;
    return bTs - aTs;
  });

  return matches[0];
}

function extractJson(stdout) {
  const raw = String(stdout || '').trim();
  const idx = raw.indexOf('{');
  if (idx === -1) throw new Error(raw || 'No JSON payload returned');
  return JSON.parse(raw.slice(idx));
}

function extractPayloadText(payload) {
  const payloads = payload?.payloads || payload?.result?.payloads || [];
  const texts = payloads.map(item => item?.text).filter(Boolean);
  if (texts.length > 0) return texts.join('\n\n').trim();
  if (typeof payload?.text === 'string' && payload.text.trim()) return payload.text.trim();
  if (typeof payload?.result?.text === 'string' && payload.result.text.trim()) return payload.result.text.trim();
  return '';
}

const activatedSessions = new Set();

function createFundingMemo() {
  return `rent-${randomBytes(4).toString('hex')}`;
}

function isDuplicateCommand(chatId, fromId, text) {
  if (!text.startsWith('/')) return false;
  const now = Date.now();
  const key = `${chatId}:${fromId}:${text.toLowerCase()}`;

  for (const [entryKey, ts] of recentCommandTimestamps.entries()) {
    if (now - ts > COMMAND_DEDUPE_MS) recentCommandTimestamps.delete(entryKey);
  }

  const previous = recentCommandTimestamps.get(key);
  recentCommandTimestamps.set(key, now);
  return typeof previous === 'number' && now - previous < COMMAND_DEDUPE_MS;
}

function buildActivationPrefix(rental) {
  const budget = rental.budgetCapUsd || rental.depositUsd || '?';
  const hbar = rental.depositHbar ? rental.depositHbar.toFixed(2) : '?';
  const renter = rental.renter || rental.renterName || 'unknown';
  return `[SYSTEM] Rental session is now ACTIVE. Renter: ${renter}. Payment: ${hbar} HBAR (~$${budget}). Full capabilities enabled. State is now active. Respond to the renter's messages directly - do not ask them to pay again.\n\nRenter says: `;
}

function isStopIntent(text) {
  const lower = text.toLowerCase().trim();
  const patterns = [
    /^\/?stop$/,
    /^\/?end\s*(rental|session|this)?[.!]?$/,
    /^(please\s+)?(stop|end|terminate|cancel|quit|close)\s*(the\s+)?(rental|session|this)?[.!]?$/i,
    /^i('m|\s+am)\s+done[.!]?$/i,
  ];
  return patterns.some(p => p.test(lower));
}

async function handleStop(chatId, from, rental) {
  const rentalId = rental.rentalId;
  console.log(`⏹ Stop requested by ${from.username || from.id} for rental ${rentalId}`);

  try {
    const res = await fetch(`${MONITOR_URL}/api/rentals/${rentalId}?reason=renter_terminated`, { method: 'DELETE' });
    const data = await res.json();

    if (data.error) {
      await send(chatId, `⚠️ Could not end the rental: ${data.error}`);
      return;
    }

    // Mark in deposit state
    const state = loadDepositState();
    const activated = (state.activatedRentals || []).find(r => r.rentalId === rentalId);
    if (activated) {
      activated.status = 'terminated';
      activated.endedAt = new Date().toISOString();
      activated.endReason = 'renter_terminated';
      saveDepositState(state);
    }
    activatedSessions.delete(`atp-rental-${chatId}`);

    const cost = data.costAccrued || activated?.costAccrued || 0;
    const interactions = data.interactionCount || activated?.interactionCount || 0;
    const deposit = activated?.depositUsd || activated?.budgetCapUsd || rental.budgetCapUsd || 0;
    const remaining = Math.max(0, deposit - cost);

    await send(chatId,
`🛑 *Rental ended*

Interactions: ${interactions}
Cost: $${cost.toFixed(4)}
Deposit: $${deposit.toFixed(2)}
Remaining: $${remaining.toFixed(4)}

A verifiable receipt has been logged to HCS.
Thank you for renting Aite!`);
  } catch (err) {
    console.error('Stop handler error:', err.message);
    await send(chatId, `⚠️ Error ending rental: ${err.message}`);
  }
}

function extractUsageFromPayload(payload) {
  const meta = payload?.meta || payload?.result?.meta || {};
  const agentMeta = meta?.agentMeta || {};
  const usage = agentMeta?.usage || agentMeta?.lastCallUsage || {};
  const inputTokens = usage.input || usage.prompt_tokens || 0;
  const outputTokens = usage.output || usage.completion_tokens || 0;
  const model = agentMeta?.model || '';

  // Rough cost estimation per model
  let costUsd = 0;
  const totalTokens = inputTokens + outputTokens;
  if (model.includes('gpt-5')) {
    costUsd = (inputTokens * 2.5 + outputTokens * 10) / 1_000_000;
  } else if (model.includes('opus')) {
    costUsd = (inputTokens * 5 + outputTokens * 25) / 1_000_000;
  } else if (model.includes('sonnet')) {
    costUsd = (inputTokens * 3 + outputTokens * 15) / 1_000_000;
  } else if (model.includes('haiku')) {
    costUsd = (inputTokens * 0.25 + outputTokens * 1.25) / 1_000_000;
  } else {
    costUsd = (inputTokens * 2.5 + outputTokens * 10) / 1_000_000;
  }

  return { inputTokens, outputTokens, totalTokens, costUsd, model };
}

async function reportUsageToMonitor(rentalId, costUsd, interactionDelta = 1) {
  try {
    await fetch(`${MONITOR_URL}/api/rentals/${rentalId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cost: costUsd, interactions: interactionDelta })
    });
  } catch (err) {
    console.error(`Failed to report usage for ${rentalId}: ${err.message}`);
  }
}

function runRentalRuntime(rental, chatId, text) {
  if (!rental?.containerName) throw new Error('No rental container is attached to this session yet.');

  const sessionId = `atp-rental-${chatId}`;
  let message = text;
  if (!activatedSessions.has(sessionId)) {
    message = buildActivationPrefix(rental) + text;
    activatedSessions.add(sessionId);
  }

  const result = spawnSync(
    'docker',
    [
      'exec',
      '-e', 'NODE_OPTIONS=--max-old-space-size=384',
      rental.containerName,
      'openclaw',
      'agent',
      '--session-id', sessionId,
      '--message', message,
      '--json',
      '--timeout', '90'
    ],
    { encoding: 'utf8', timeout: 120000 }
  );

  const combined = `${result.stdout || ''}${result.stderr || ''}`.trim();
  if (result.status !== 0) {
    throw new Error(combined || `Rental runtime exited with status ${result.status}`);
  }

  const payload = extractJson(result.stdout || combined);
  const replyText = extractPayloadText(payload);
  if (!replyText) throw new Error('Rental runtime returned no reply text.');

  // Track usage
  const usage = extractUsageFromPayload(payload);
  if (rental.rentalId && usage.costUsd > 0) {
    reportUsageToMonitor(rental.rentalId, usage.costUsd, 1);
  }

  return replyText;
}

async function getHbarPrice() {
  if (cachedPrice && Date.now() - priceTs < 300_000) return cachedPrice;
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=hedera-hashgraph&vs_currencies=usd');
    const data = await res.json();
    cachedPrice = data['hedera-hashgraph'].usd;
    priceTs = Date.now();
    return cachedPrice;
  } catch {
    return cachedPrice || 0.20; // fallback
  }
}

// ── Command Handlers ────────────────────────────────────────────────────────

async function handleStart(chatId, from) {
  const name = from.first_name || 'there';
  await send(chatId,
`👋 Hey ${name}! I'm *Aite* - an OpenClaw AI Agent.

I'm available for rent, and I'm built for more than just chat. What do you need done?

You'll receive a verifiable receipt of activity when the session ends. Actions remain private.

Use /rent to get started or /help for commands.`
  );
}

async function handleRent(chatId, from) {
  const username = from.username || from.first_name || `user${from.id}`;
  const memo = createFundingMemo();

  const state = loadDepositState();
  state.pendingDeposits = state.pendingDeposits || {};
  state.pendingDeposits[memo] = {
    renterName: username,
    telegramChatId: chatId,
    telegramUserId: from.id,
    model: 'inherit_current',
    timestamp: Date.now()
  };
  saveDepositState(state);

  const fundingIntent = createFundingIntent({
    memo,
    renterName: username,
    renterTelegramChatId: chatId,
    renterTelegramUserId: from.id,
    modelPreference: 'inherit_current',
    paymentMethod: 'hbar',
    targetBudgetUsd: RECOMMENDED_STARTER_USD,
    recommendedStarterUsd: RECOMMENDED_STARTER_USD,
    status: 'awaiting_payment',
    metadata: { source: 'telegram_rent_flow' }
  });

  await sendWithButtons(chatId,
`⚡ *Rent Aite*

To begin, select your payment method.

Your *deposit becomes your budget*.
Starter budget: *$${RECOMMENDED_STARTER_USD.toFixed(2)}*
*Micro flash rentals also available.*
You can send more if you want a larger budget.

⏳ Once your payment is detected (usually within 30 seconds), your session will activate automatically.

_Payment is monitored automatically_`,
    [
      [{ text: 'Pay with HBAR', callback_data: `pay_hbar:${memo}` }],
      [{ text: 'Pay with Crypto', callback_data: `pay_crypto_menu:${fundingIntent.intentId}` }],
      [{ text: 'PayPal', callback_data: `pay_paypal:${fundingIntent.intentId}` }, { text: 'Venmo', callback_data: `pay_venmo:${fundingIntent.intentId}` }],
      [{ text: 'Pay with Card (Coinbase)', callback_data: `pay_cash:${fundingIntent.intentId}` }],
    ]
  );
}

async function handleStatus(chatId, from) {
  const state = loadDepositState();
  const username = from.username || from.first_name || `user${from.id}`;

  // Check for active rentals
  const active = (state.activatedRentals || []).filter(r =>
    (r.renterName === username || r.renter === username) && (!r.status || r.status === 'active')
  );

  if (active.length > 0) {
    const r = active[0];
    const remaining = Math.max(0, Math.round((r.expiresAt - Date.now()) / 60000));
    await send(chatId,
`🟢 *Active Rental*

Model: ${r.modelPreference || 'inherits current Aite model until changed'}
Remaining: ${remaining} minutes
Capabilities: ${FULL_CAPABILITIES.join(', ')}

_You'll receive a verifiable receipt of activity when the session ends._`
    );
    return;
  }

  const intents = listFundingIntents(intent =>
    intent.renterTelegramUserId === from.id || intent.renterName === username
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const liveIntent = intents.find(i => ['awaiting_payment', 'payment_detected', 'converting', 'activating'].includes(i.status));
  if (liveIntent) {
    const statusLabel = {
      awaiting_payment: 'Awaiting payment',
      payment_detected: 'Payment detected',
      converting: 'Converting payment',
      activating: 'Activating rental'
    }[liveIntent.status] || liveIntent.status;

    const depositDetails = liveIntent.paymentMethod === 'hbar'
      ? `Memo: \`${liveIntent.memo}\`\nDeposit account: \`${DEPOSIT_ACCOUNT}\``
      : (liveIntent.metadata?.swapDepositAddress
          ? `Funding address: \`${liveIntent.metadata.swapDepositAddress}\`${liveIntent.metadata?.swapDepositMemo ? `\nMemo/tag: \`${liveIntent.metadata.swapDepositMemo}\`` : ''}`
          : 'Funding instructions already generated for this intent.');

    await send(chatId,
`⏳ *Funding Status*

Status: ${statusLabel}
Payment method: ${liveIntent.paymentMethod.toUpperCase()}
${depositDetails}

Your deposit becomes your budget. Use /rent if you want to generate a fresh payment flow.`
    );
    return;
  }

  await send(chatId, `No active rental found. Use /rent to get started!`);
}

async function handleHelp(chatId) {
  await send(chatId,
`📋 *Commands*

/start - Introduction
/rent - Start a rental
/status - Check your rental status
/model - Show current or supported models
/model <name> - Change model preference (haiku, sonnet, opus)
/help - This message

*How it works:*
1. Use /rent to get the payment address and memo
2. Send HBAR to fund your budget
3. Your deposit becomes your session budget
4. Pricing changes with actual usage and model burn
5. Use /stop to end your session
6. You'll receive a verifiable receipt of activity when the session ends. Actions remain private`
  );
}

async function handleModel(chatId, from, text) {
  const state = loadDepositState();
  const username = from.username || from.first_name || `user${from.id}`;
  const active = (state.activatedRentals || []).filter(r =>
    (r.renterName === username || r.renter === username) && (!r.status || r.status === 'active')
  );

  const parts = text.split(/\s+/).filter(Boolean);
  const requested = (parts[1] || '').toLowerCase();

  if (!requested) {
    if (active.length === 0) {
      await send(chatId, `Supported models: ${SUPPORTED_MODELS.join(', ')}\n\nNo active rental found.`);
      return;
    }
    const r = active[0];
    await send(chatId, `Current model: ${r.currentModel || r.modelPreference || 'inherits current Aite model'}\nSupported models: ${SUPPORTED_MODELS.join(', ')}`);
    return;
  }

  if (!SUPPORTED_MODELS.includes(requested)) {
    await send(chatId, `Unsupported model. Choose one of: ${SUPPORTED_MODELS.join(', ')}`);
    return;
  }

  if (active.length === 0) {
    await send(chatId, `No active rental found. Use /rent to start one first.`);
    return;
  }

  const r = active[0];
  try {
    const res = await fetch(`${MONITOR_URL}/api/rentals/${r.rentalId}/model`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: requested })
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      await send(chatId, `Could not update model right now.`);
      return;
    }
    r.currentModel = requested;
    r.modelPreference = requested;
    r.modelChangedAt = new Date().toISOString();
    saveDepositState(state);

    try {
      const result = await pushRuntimeModelChange(requested, username, r.rentalId || 'unknown-rental');
      if (result.confirmed) {
        r.runtimeModelConfirmedAt = new Date().toISOString();
        saveDepositState(state);
        await send(chatId, `✅ Model updated to *${requested}*\n\nLive session switch confirmed. Budget burn will now follow that model.`);
      } else {
        await send(chatId, `✅ Model updated to *${requested}* in ATP state, but the live runtime switch could not be verified yet.`);
      }
    } catch {
      await send(chatId, `✅ Model updated to *${requested}* in ATP state, but the live runtime switch could not be confirmed right now.`);
    }
  } catch {
    await send(chatId, `Could not update model right now.`);
  }
}

// ── Message Router ──────────────────────────────────────────────────────────

async function handleUpdate(update) {
  // Handle callback queries (button presses)
  if (update.callback_query) {
    const cq = update.callback_query;
    const data = cq.data || '';
    const chatId = cq.message?.chat?.id;

    if (data.startsWith('pay_hbar:') && chatId) {
      const memo = data.split(':')[1];
      await answerCallback(cq.id, 'HBAR payment selected');
      const hbarPrice = await getHbarPrice();
      const starterHbarAmount = (RECOMMENDED_STARTER_USD / hbarPrice).toFixed(2);
      await send(chatId,
`💠 *Pay with HBAR*

Send HBAR to:
\`${DEPOSIT_ACCOUNT}\`

With memo:
\`${memo}\`

Your *deposit becomes your budget*.
Pricing changes with actual usage and model burn.

Suggested deposit: *${starterHbarAmount} HBAR* (~$${RECOMMENDED_STARTER_USD.toFixed(2)})
*Micro flash rentals also available.*
You can send more if you want a larger budget.

⏳ Once your payment is detected (usually within 30 seconds), your session will activate automatically.

If your wallet does not support memo-aware QR scanning, scan the address QR and enter the memo manually exactly as shown above.

_Payment is monitored automatically_`);
      await sendQr(chatId, `${DEPOSIT_ACCOUNT}`, 'QR for HBAR payment address only. Enter the memo manually if your wallet does not import it.');
      return;
    }

    if (data.startsWith('pay_crypto_menu:') && chatId) {
      const intentId = data.split(':')[1];
      await answerCallback(cq.id, 'Choose a crypto rail');
      await sendWithButtons(chatId,
`🪙 *Pay with Crypto*

Choose the asset you want to use. Your rental will activate when funding completes.`,
        [
          [{ text: 'USDC on Base', callback_data: `pay_crypto_option:${intentId}:usdc_base` }],
          [{ text: 'USDC on Ethereum', callback_data: `pay_crypto_option:${intentId}:usdc_eth` }],
          [{ text: 'USDT on Ethereum', callback_data: `pay_crypto_option:${intentId}:usdt_eth` }],
          [{ text: 'ETH', callback_data: `pay_crypto_option:${intentId}:eth` }],
          [{ text: 'SOL', callback_data: `pay_crypto_option:${intentId}:sol` }],
          [{ text: 'BTC', callback_data: `pay_crypto_option:${intentId}:btc` }],
        ]
      );
      return;
    }

    if (data.startsWith('pay_crypto_option:') && chatId) {
      const [, intentId, optionKey] = data.split(':');
      await answerCallback(cq.id, 'Creating payment instructions...');
      try {
        const intent = await createRailIntent(intentId, optionKey, DEPOSIT_ACCOUNT);
        const meta = intent?.metadata || {};
        if (meta.prefundedHotWallet) {
          await send(chatId,
`🪙 *Crypto payment ready*

Send a minimum of *${meta.expectedSourceAmount} ${intent.sourceAsset}* on *${intent.sourceChain}* to get started:
\`${meta.hotWalletAddress}\`

Your rental will activate when funding completes.`);
          await sendQr(chatId, meta.hotWalletAddress, 'QR for crypto payment');
        } else {
          await send(chatId,
`🪙 *Crypto payment ready*

Send a minimum of *${meta.estimatedSourceAmount} ${intent.sourceAsset}* on *${intent.sourceChain}* to get started:
\`${meta.swapDepositAddress}\`${meta.swapDepositMemo ? `\n\nMemo/tag:\n\`${meta.swapDepositMemo}\`` : ''}

Your *deposit becomes your budget*.
Status updates are tracked automatically and your rental will activate when funding completes.`);
          await sendQr(chatId, meta.swapDepositAddress, 'QR for crypto payment');
        }
      } catch (e) {
        await send(chatId, `Could not create the crypto payment flow right now: ${e.message}`);
      }
      return;
    }

    if ((data.startsWith('pay_paypal:') || data.startsWith('pay_venmo:')) && chatId) {
      const isVenmo = data.startsWith('pay_venmo:');
      const intentId = data.split(':')[1];
      const optionKey = isVenmo ? 'venmo' : 'paypal';
      await answerCallback(cq.id, `Creating ${isVenmo ? 'Venmo' : 'PayPal'} checkout...`);
      try {
        const intent = await createRailIntent(intentId, optionKey, DEPOSIT_ACCOUNT);
        const meta = intent?.metadata || {};
        if (!meta.paypalApprovalUrl) throw new Error(`${isVenmo ? 'Venmo' : 'PayPal'} checkout is not configured`);
        await send(chatId,
`${isVenmo ? '🟣' : '💳'} *Pay with ${isVenmo ? 'Venmo' : 'PayPal'}*

Complete your $${(intent.targetBudgetUsd || 5).toFixed(2)} payment here:
${meta.paypalApprovalUrl}

Your rental will activate automatically after payment is confirmed.`);
      } catch (e) {
        await send(chatId, `Could not create the ${isVenmo ? 'Venmo' : 'PayPal'} checkout right now: ${e.message}`);
      }
      return;
    }

    if (data.startsWith('pay_cash:') && chatId) {
      const intentId = data.split(':')[1];
      await answerCallback(cq.id, 'Creating checkout link...');
      try {
        const intent = await createRailIntent(intentId, 'cash_card', DEPOSIT_ACCOUNT);
        const meta = intent?.metadata || {};
        if (!meta.onrampUrl) throw new Error('cash checkout provider is not configured');
        await send(chatId,
`💵 *Pay with Card (Coinbase)*

Complete checkout here:
${meta.onrampUrl}

This checkout funds your rental budget automatically. Once payment clears and conversion completes, your rental will activate.`);
      } catch (e) {
        await send(chatId, `Could not create the cash/card checkout right now: ${e.message}`);
      }
      return;
    }

    await answerCallback(cq.id, 'Not implemented yet');
    return;
  }

  const msg = update.message;
  if (!msg?.text) return;

  const chatId = msg.chat.id;
  const from = msg.from;
  const text = msg.text.trim();
  const state = loadDepositState();
  const activeRental = getActiveRental(state, from, chatId);

  console.log(`← command from chat ${chatId}: ${text}`);

  if (isDuplicateCommand(chatId, from?.id, text)) {
    console.log(`↺ Duplicate command suppressed for chat ${chatId}: ${text}`);
    return;
  }

  if (text === '/start') return handleStart(chatId, from);
  if (text === '/rent') return handleRent(chatId, from);
  if (text === '/status') return handleStatus(chatId, from);
  if (text === '/stop' || text === '/end') {
    if (activeRental) return handleStop(chatId, from, activeRental);
    await send(chatId, `No active rental to end.`);
    return;
  }
  if (text === '/help') return handleHelp(chatId);
  if (text === '/model' || text.startsWith('/model ')) return handleModel(chatId, from, text);

  if (text.startsWith('/')) {
    await send(chatId, `Unknown command. Try /help for available commands.`);
    return;
  }

  // Natural language stop detection
  if (activeRental && isStopIntent(text)) {
    return handleStop(chatId, from, activeRental);
  }

  if (activeRental) {
    try {
      const reply = runRentalRuntime(activeRental, chatId, text);
      await sendPlain(chatId, reply);
    } catch (err) {
      console.error('Rental runtime forward failed:', err.message);
      await sendPlain(chatId, `⚠️ Agent failed before reply: ${err.message}`);
    }
    return;
  }

  await send(chatId,
`👋 I'm here.

Try one of these:
- /start
- /rent
- /status
- /help`
  );
}

// ── Polling Loop ────────────────────────────────────────────────────────────

async function poll() {
  try {
    const res = await fetch(`${API}/getUpdates?offset=${offset}&timeout=30&allowed_updates=["message","callback_query"]`);
    const data = await res.json();

    if (data.ok && data.result.length > 0) {
      for (const update of data.result) {
        offset = update.update_id + 1;
        try {
          await handleUpdate(update);
        } catch (err) {
          console.error('Error handling update:', err.message);
        }
      }
    }
  } catch (err) {
    console.error('Poll error:', err.message);
    await new Promise(r => setTimeout(r, 5000)); // back off on error
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

console.log('🤖 ATPRentalBot starting...');
console.log(`   Deposit account: ${DEPOSIT_ACCOUNT}`);
console.log('   Billing: metered with activation floor');
console.log('✅ ATPRentalBot listening for commands');

while (true) {
  await poll();
}
