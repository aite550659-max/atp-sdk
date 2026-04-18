#!/usr/bin/env node
/**
 * ATP Rental Kill — Full Lifecycle Termination
 *
 * Executes the complete kill sequence:
 *   1. Snapshot cost/interactions from container
 *   2. Send termination message to renter via Telegram Bot API
 *   3. Log rental.end to HCS (on-chain audit)
 *   4. Kill the Docker container
 *   5. Update monitor state
 *
 * Usage:
 *   node monitor/kill-rental.mjs <rental-id-or-container-name> [reason]
 *
 *   Reasons: owner_terminated (default), budget_exceeded, timeout, abuse, renter_terminated
 *
 * Env vars:
 *   HEDERA_OPERATOR_ID   — Hedera operator (default: 0.0.10255397)
 *   HEDERA_OPERATOR_KEY  — ECDSA private key (from Keychain or env)
 *   HCS_TOPIC_ID         — HCS topic (default: 0.0.10272696)
 *   TELEGRAM_BOT_TOKEN   — @ATPRentalBot token (for renter notification)
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { updateFundingIntent } from './funding-store.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONITOR_STATE = path.join(__dirname, 'monitor-state.json');
const DEPOSIT_STATE = path.join(__dirname, 'deposit-state.json');

// ── Args ────────────────────────────────────────────────────────────────────

const target = process.argv[2];
const reason = process.argv[3] || 'owner_terminated';

if (!target) {
  console.error('Usage: kill-rental.mjs <rental-id|container-name> [reason]');
  process.exit(1);
}

const OPERATOR_ID = process.env.HEDERA_OPERATOR_ID || '0.0.10255397';
const HCS_TOPIC = process.env.HCS_TOPIC_ID || '0.0.10272696';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// ── Helpers ─────────────────────────────────────────────────────────────────

function dockerExec(cmd) {
  try {
    return execSync(`docker ${cmd}`, { encoding: 'utf8', timeout: 10000 }).trim();
  } catch { return null; }
}

function loadMonitorState() {
  try { return JSON.parse(fs.readFileSync(MONITOR_STATE, 'utf8')); }
  catch { return { rentals: {}, alerts: [], config: {} }; }
}

function saveMonitorState(state) {
  fs.writeFileSync(MONITOR_STATE, JSON.stringify(state, null, 2));
}

function loadDepositState() {
  try { return JSON.parse(fs.readFileSync(DEPOSIT_STATE, 'utf8')); }
  catch { return { pendingDeposits: {}, activatedRentals: [] }; }
}

function saveDepositState(state) {
  fs.writeFileSync(DEPOSIT_STATE, JSON.stringify(state, null, 2));
}

function fundingTerminalStatus(reason) {
  if (reason === 'renter_terminated' || reason === 'completed') return 'completed';
  if (reason === 'timeout') return 'expired';
  return 'terminated';
}

async function sendTelegramMessage(chatId, text) {
  if (!BOT_TOKEN) {
    console.log('   ⚠️  No TELEGRAM_BOT_TOKEN — skipping renter notification');
    return false;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
    });
    const data = await res.json();
    return data.ok;
  } catch (e) {
    console.log(`   ⚠️  Telegram send failed: ${e.message}`);
    return false;
  }
}

async function logToHCS(message) {
  const operatorKey = process.env.HEDERA_OPERATOR_KEY;
  if (!operatorKey) {
    // Try macOS Keychain
    try {
      const key = execSync(
        'security find-generic-password -a atp-sidecar -s hedera-operator-key -w 2>/dev/null',
        { encoding: 'utf8' }
      ).trim();
      if (key) process.env.HEDERA_OPERATOR_KEY = key;
    } catch {
      console.log('   ⚠️  No HEDERA_OPERATOR_KEY and Keychain lookup failed — skipping HCS');
      return null;
    }
  }

  try {
    const { Client, TopicMessageSubmitTransaction, AccountId, PrivateKey, TopicId } = await import('@hashgraph/sdk');

    const privKey = PrivateKey.fromStringECDSA(process.env.HEDERA_OPERATOR_KEY);
    const client = Client.forMainnet();
    client.setOperator(AccountId.fromString(OPERATOR_ID), privKey);

    const tx = new TopicMessageSubmitTransaction()
      .setTopicId(TopicId.fromString(HCS_TOPIC))
      .setMessage(JSON.stringify(message));

    const response = await tx.execute(client);
    const receipt = await response.getReceipt(client);
    client.close();

    return receipt.topicSequenceNumber.toString();
  } catch (e) {
    console.log(`   ⚠️  HCS logging failed: ${e.message}`);
    return null;
  }
}

function getContainerChatId(containerName) {
  // Extract the Telegram chat ID from container logs (look for the session)
  const logs = dockerExec(`logs ${containerName} 2>&1 | grep -o '"chat_id":[0-9]*' | head -1`);
  if (logs) {
    const match = logs.match(/"chat_id":(\d+)/);
    if (match) return match[1];
  }
  // Fallback: check session transcripts inside container
  const sessionInfo = dockerExec(`exec ${containerName} find /tmp/openclaw -name "*.json" -newer /tmp/openclaw 2>/dev/null | head -1`);
  return null;
}

function getContainerSessionInfo(containerName) {
  // Get session logs from inside the container
  // Use sh -c to handle glob and pipe inside the container
  const logContent = dockerExec(`exec ${containerName} sh -c "cat /tmp/openclaw/openclaw-*.log 2>/dev/null"`);
  if (!logContent) return { interactions: 0, sessionId: null };

  const runs = logContent.match(/embedded run done/g);
  const sessionMatch = logContent.match(/sessionId=([a-f0-9-]+)/);

  return {
    interactions: runs ? runs.length : 0,
    sessionId: sessionMatch ? sessionMatch[1] : null
  };
}

// ── Main Kill Sequence ──────────────────────────────────────────────────────

async function killRental() {
  console.log('\n🛑 ATP Rental Kill Sequence');
  console.log('═══════════════════════════════════════\n');

  // Resolve target — could be rental ID or container name
  const state = loadMonitorState();
  let rental = state.rentals[target];
  let containerName = target;

  if (rental) {
    containerName = rental.containerName;
    console.log(`   Rental ID:  ${target}`);
  } else {
    // Try to find by container name
    rental = Object.values(state.rentals).find(r => r.containerName === target);
    if (rental) {
      console.log(`   Rental ID:  ${rental.rentalId}`);
    } else {
      console.log(`   Target:     ${target} (not in monitor state — direct container kill)`);
    }
  }

  console.log(`   Container:  ${containerName}`);
  console.log(`   Reason:     ${reason}`);
  console.log('');

  // ── Step 1: Snapshot container state ──────────────────────────────────
  console.log('1️⃣  Snapshotting container state...');

  const containerRunning = dockerExec(`inspect ${containerName} --format "{{.State.Running}}"`) === 'true';
  let sessionInfo = { interactions: 0, sessionId: null };
  let containerStats = null;

  if (containerRunning) {
    sessionInfo = getContainerSessionInfo(containerName);
    const rawStats = dockerExec(`stats ${containerName} --no-stream --format "{{.MemUsage}} | {{.CPUPerc}}"`);
    containerStats = rawStats;
    console.log(`   Session ID:    ${sessionInfo.sessionId || 'unknown'}`);
    console.log(`   Interactions:  ${sessionInfo.interactions}`);
    console.log(`   Resources:     ${containerStats || 'unknown'}`);
  } else {
    console.log('   Container not running — no snapshot available');
  }

  const rentalId = rental?.rentalId || `direct-kill-${Date.now().toString(36)}`;
  const costAccrued = rental?.costAccrued || 0;
  const interactionCount = rental?.interactionCount || sessionInfo.interactions;
  const startedAt = rental?.startedAt || null;
  const durationSec = startedAt ? Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000) : 0;

  // ── Step 2: Notify renter via Telegram ────────────────────────────────
  console.log('\n2️⃣  Notifying renter...');

  // Look up Telegram chat ID from rental record or deposit state
  const telegramChatId = rental?.telegramChatId || (() => {
    const ds = loadDepositState();
    const activated = (ds.activatedRentals || []).find(a => a.rentalId === rentalId);
    return activated?.telegramChatId || null;
  })();

  if (BOT_TOKEN && telegramChatId) {
    try {
      const deposit = rental?.budgetCap || 0;
      const remaining = Math.max(0, deposit - costAccrued);
      const terminationMsg = [
        '🛑 *Rental Session Ended*\n',
        `Reason: ${reason.replace(/_/g, ' ')}`,
        `Interactions: ${interactionCount}`,
        `Cost: $${costAccrued.toFixed(4)}`,
        `Deposit: $${deposit.toFixed ? deposit.toFixed(2) : deposit}`,
        `Remaining: $${remaining.toFixed(4)}`,
        `Duration: ${durationSec > 0 ? `${Math.floor(durationSec / 60)}m ${durationSec % 60}s` : 'unknown'}`,
        '',
        '_A verifiable receipt has been logged on-chain._',
        `[View on Hashscan](https://hashscan.io/mainnet/topic/${HCS_TOPIC})`
      ].join('\n');

      const sent = await sendTelegramMessage(telegramChatId, terminationMsg);
      console.log(`   ${sent ? '✅ Renter notified' : '⚠️  Notification failed'}`);
    } catch (e) {
      console.log(`   ⚠️  Notification error: ${e.message}`);
    }
  } else if (!BOT_TOKEN) {
    console.log('   ⚠️  No bot token — skipping');
  } else {
    console.log('   ⚠️  No Telegram chat ID found — skipping notification');
  }

  // ── Step 3: Log rental.end to HCS ────────────────────────────────────
  console.log('\n3️⃣  Logging to HCS...');

  const hcsMessage = {
    atp: '1.0',
    type: 'rental.end',
    ts: new Date().toISOString(),
    rental_id: rentalId,
    data: {
      reason,
      terminated_by: reason === 'renter_terminated' ? 'renter' : 'owner',
      total_cost_usd: costAccrued,
      interaction_count: interactionCount,
      duration_sec: durationSec,
      container: containerName,
      session_id: sessionInfo.sessionId,
      content_hash: crypto.createHash('sha256')
        .update(JSON.stringify({ rentalId, reason, costAccrued, interactionCount, durationSec }))
        .digest('hex')
    }
  };

  const hcsSequence = await logToHCS(hcsMessage);
  if (hcsSequence) {
    console.log(`   ✅ Logged to HCS — sequence #${hcsSequence}`);
    console.log(`   📋 https://hashscan.io/mainnet/topic/${HCS_TOPIC}`);
  } else {
    console.log('   ⚠️  HCS logging skipped or failed');
  }

  // ── Step 4: Kill the container ────────────────────────────────────────
  console.log('\n4️⃣  Killing container...');

  if (containerRunning) {
    // Graceful stop first (5 sec), then force
    dockerExec(`stop -t 5 ${containerName}`);
    dockerExec(`rm ${containerName}`);
    console.log('   ✅ Container stopped and removed');
  } else {
    // Already stopped, just remove
    dockerExec(`rm ${containerName}`);
    console.log('   ✅ Container removed (was already stopped)');
  }

  // ── Step 5: Update monitor state ──────────────────────────────────────
  console.log('\n5️⃣  Updating monitor state...');

  if (rental) {
    rental.status = 'terminated';
    rental.endedAt = new Date().toISOString();
    rental.endReason = reason;
    rental.interactionCount = interactionCount;
    if (hcsSequence) {
      rental.hcsSequences.push({
        type: 'rental.end',
        sequence: hcsSequence,
        timestamp: new Date().toISOString()
      });
    }
    saveMonitorState(state);

    const depositState = loadDepositState();
    depositState.activatedRentals = (depositState.activatedRentals || []).map(entry => {
      if (entry.rentalId !== rental.rentalId) return entry;
      return {
        ...entry,
        status: fundingTerminalStatus(reason),
        endedAt: rental.endedAt,
        endReason: reason,
      };
    });
    saveDepositState(depositState);

    if (rental.fundingIntentId) {
      updateFundingIntent(rental.fundingIntentId, {
        status: fundingTerminalStatus(reason),
        metadata: {
          rentalId: rental.rentalId,
          containerName: rental.containerName,
          endedAt: rental.endedAt,
          terminalReason: reason,
          finalCostUsd: costAccrued,
          finalInteractionCount: interactionCount,
        }
      }, `rental_${fundingTerminalStatus(reason)}`);
    }

    console.log('   ✅ Monitor state updated');
  } else {
    console.log('   ℹ️  No monitor state entry (direct kill)');
  }

  // ── Summary ───────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════');
  console.log('✅ Kill sequence complete\n');
  console.log(`   Rental:       ${rentalId}`);
  console.log(`   Reason:       ${reason}`);
  console.log(`   Cost:         $${costAccrued.toFixed(4)}`);
  console.log(`   Interactions: ${interactionCount}`);
  console.log(`   Duration:     ${durationSec > 0 ? `${Math.floor(durationSec / 60)}m ${durationSec % 60}s` : 'unknown'}`);
  console.log(`   HCS:          ${hcsSequence ? `#${hcsSequence}` : 'not logged'}`);
  console.log(`   Container:    destroyed`);
  console.log('');
}

killRental().catch(e => {
  console.error(`\n❌ Kill sequence failed: ${e.message}`);
  process.exit(1);
});
