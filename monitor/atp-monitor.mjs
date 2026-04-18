#!/usr/bin/env node
/**
 * ATP Multi-Tenant Monitor
 *
 * Lightweight owner dashboard for managing rental containers.
 * Tracks: active rentals, costs, HCS audit status, breach alerts.
 * Provides: web UI + REST API + CLI commands.
 *
 * Usage:
 *   node monitor/atp-monitor.mjs                    # Start web dashboard on :3500
 *   node monitor/atp-monitor.mjs --port 4000        # Custom port
 *   node monitor/atp-monitor.mjs status             # CLI: show all rentals
 *   node monitor/atp-monitor.mjs kill <rental-id>   # CLI: kill a rental
 */

import http from 'node:http';
import { execSync, exec } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { updateFundingIntent } from './funding-store.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadKeychainValue(service) {
  try {
    return execSync(`security find-generic-password -s ${service} -w`, { encoding: 'utf8', timeout: 5000 }).trim() || null;
  } catch {
    return null;
  }
}

const RENTAL_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || loadKeychainValue('rental-bot-token');
const STATE_FILE = path.join(__dirname, 'monitor-state.json');
const DEPOSIT_STATE_FILE = path.join(__dirname, 'deposit-state.json');
const LOCK_FILE = path.join(__dirname, 'atp-monitor.lock');
const MODEL_PREFERENCE_FILE = path.join(__dirname, '..', 'data', 'model_preference.json');
const PORT = parseInt(process.argv.find((_, i, a) => a[i - 1] === '--port') || '3500');
const RENTAL_MEMORY_LIMIT = process.env.ATP_RENTAL_MEMORY_LIMIT || '2g';
const RENTAL_CPU_LIMIT = process.env.ATP_RENTAL_CPU_LIMIT || '1.0';
const CONTAINER_READY_TIMEOUT_SECONDS = Number(process.env.ATP_CONTAINER_READY_TIMEOUT_SECONDS || 45);
const CONTAINER_MISSING_GRACE_MS = Number(process.env.ATP_CONTAINER_MISSING_GRACE_MS || 45_000);
let lastContainerReconcile = {
  ranAt: null,
  activeRentals: 0,
  runningContainers: 0,
  missingContainers: 0,
  orphanContainers: 0,
  repairedMappings: 0,
  terminatedRentals: 0,
  killedOrphans: 0,
};
let reconcileInFlight = false;
const missingContainerSince = new Map();

// ── State Management ────────────────────────────────────────────────────────

function loadState() {
  const defaults = {
    rentals: {},
    alerts: [],
    config: {
      maxConcurrentRentals: 5,
      defaultBudgetCap: 10.00,
      hcsTopicId: '0.0.10272696',
      alertWebhook: null,
      ownerTelegramId: '359827754'
    }
  };

  try {
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    return {
      rentals: raw?.rentals || {},
      alerts: Array.isArray(raw?.alerts) ? raw.alerts : [],
      config: {
        ...defaults.config,
        ...(raw?.config || {}),
        hcsTopicId: raw?.config?.hcsTopicId || raw?.config?.hcsTopic || defaults.config.hcsTopicId,
      }
    };
  } catch {
    return defaults;
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function loadDepositState() {
  try {
    return JSON.parse(fs.readFileSync(DEPOSIT_STATE_FILE, 'utf8'));
  } catch {
    return { pendingDeposits: {}, activatedRentals: [] };
  }
}

function saveDepositState(state) {
  fs.writeFileSync(DEPOSIT_STATE_FILE, JSON.stringify(state, null, 2));
}

function toExpiryTimestamp(value, durationMin = 60) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsedNumber = Number(value);
    if (Number.isFinite(parsedNumber) && parsedNumber > 0) return parsedNumber;
    const parsedDate = Date.parse(value);
    if (!Number.isNaN(parsedDate)) return parsedDate;
  }
  return Date.now() + (Number(durationMin || 60) * 60 * 1000);
}

function fundingTerminalStatus(reason, expiresAt = null) {
  if (reason === 'renter_terminated' || reason === 'completed') return 'completed';
  if (reason === 'timeout' || (expiresAt && expiresAt <= Date.now())) return 'expired';
  return 'terminated';
}

function syncDepositRentalState(rentalId, patch = {}) {
  if (!rentalId) return;
  const depositState = loadDepositState();
  let changed = false;
  depositState.activatedRentals = (depositState.activatedRentals || []).map(rental => {
    if (rental.rentalId !== rentalId) return rental;
    changed = true;
    return { ...rental, ...patch };
  });
  if (changed) saveDepositState(depositState);
}

function syncFundingIntentForRental(rental, reason = 'terminated') {
  const fundingIntentId = rental?.fundingIntentId || rental?.metadata?.fundingIntentId || null;
  if (!fundingIntentId) return;
  const status = fundingTerminalStatus(reason, rental?.expiresAt || null);
  updateFundingIntent(fundingIntentId, {
    status,
    metadata: {
      rentalId: rental.rentalId,
      containerName: rental.containerName,
      endedAt: rental.endedAt || new Date().toISOString(),
      terminalReason: reason,
      finalCostUsd: rental.costAccrued ?? 0,
      finalInteractionCount: rental.interactionCount ?? 0,
    }
  }, `rental_${status}`);
}

function processExists(pid) {
  if (!pid || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireLock() {
  try {
    fs.writeFileSync(LOCK_FILE, String(process.pid), { flag: 'wx' });
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
    const existingPid = Number(fs.readFileSync(LOCK_FILE, 'utf8').trim());
    if (processExists(existingPid)) {
      throw new Error(`ATP monitor already running (pid ${existingPid})`);
    }
    fs.unlinkSync(LOCK_FILE);
    fs.writeFileSync(LOCK_FILE, String(process.pid), { flag: 'wx' });
  }

  const release = () => {
    try {
      const current = fs.readFileSync(LOCK_FILE, 'utf8').trim();
      if (current === String(process.pid)) fs.unlinkSync(LOCK_FILE);
    } catch {}
  };

  process.on('exit', release);
  process.on('SIGINT', () => { release(); process.exit(130); });
  process.on('SIGTERM', () => { release(); process.exit(143); });
}

function getCurrentAiteModel() {
  try {
    const liveConfigPath = path.join(process.env.HOME || '', '.openclaw', 'openclaw.json');
    const liveConfig = JSON.parse(fs.readFileSync(liveConfigPath, 'utf8'));
    return liveConfig?.agents?.defaults?.model?.primary || process.env.OPENCLAW_DEFAULT_MODEL || 'openai/gpt-5.4';
  } catch {
    try {
      const raw = JSON.parse(fs.readFileSync(MODEL_PREFERENCE_FILE, 'utf8'));
      return raw.model || process.env.OPENCLAW_DEFAULT_MODEL || 'openai/gpt-5.4';
    } catch {
      return process.env.OPENCLAW_DEFAULT_MODEL || 'openai/gpt-5.4';
    }
  }
}

function normalizeRentalModel(model) {
  // Pass through the raw model string — rentals should use whatever Aite uses.
  // Only normalize known aliases; everything else passes through as-is.
  const raw = String(model || '').trim();
  if (!raw) return getCurrentAiteModel();
  const lower = raw.toLowerCase();
  if (['haiku', 'sonnet', 'opus'].includes(lower)) return lower;
  // Full provider/model strings pass through directly (e.g., openai/gpt-5.4)
  return raw;
}

// ── Docker Operations ───────────────────────────────────────────────────────

function dockerExec(cmd) {
  try {
    return execSync(`docker ${cmd}`, { encoding: 'utf8', timeout: 10000 }).trim();
  } catch (e) {
    return null;
  }
}

function getRunningContainers() {
  // Use JSON output to avoid Go template quoting issues with label keys containing dots
  const raw = dockerExec('ps --filter "label=atp.role=rental" --format "{{json .}}"');
  if (!raw) return [];
  return raw.split('\n').filter(Boolean).map(line => {
    try {
      const obj = JSON.parse(line);
      const labels = obj.Labels || '';
      const labelMap = {};
      for (const pair of labels.split(',')) {
        const eq = pair.indexOf('=');
        if (eq > 0) labelMap[pair.slice(0, eq)] = pair.slice(eq + 1);
      }
      return {
        id: obj.ID,
        name: obj.Names,
        status: obj.Status,
        createdAt: obj.CreatedAt,
        rentalId: labelMap['atp.rental-id'] || null,
        renterId: labelMap['atp.renter-id'] || null
      };
    } catch {
      return null;
    }
  }).filter(Boolean);
}

function getContainerStats(containerId) {
  const raw = dockerExec(`stats ${containerId} --no-stream --format "{{.MemUsage}}\\t{{.CPUPerc}}"`);
  if (!raw) return null;
  const [mem, cpu] = raw.split('\t');
  return { memory: mem, cpu };
}

function getContainerLogs(containerId, lines = 50) {
  return dockerExec(`logs ${containerId} --tail ${lines} 2>&1`);
}

function killContainer(containerId) {
  return dockerExec(`rm -f ${containerId}`);
}

// ── Rental Management ───────────────────────────────────────────────────────

function waitForContainerHealthy(containerName, timeoutSeconds = CONTAINER_READY_TIMEOUT_SECONDS) {
  const command = [
    'bash -lc',
    `'deadline=$((SECONDS + ${timeoutSeconds})); while [ $SECONDS -lt $deadline ]; do status=$(docker inspect --format "{{.State.Status}}" ${containerName} 2>/dev/null || echo missing); health=$(docker inspect --format "{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}" ${containerName} 2>/dev/null || echo missing); if [ "$status" = "running" ] && { [ "$health" = "healthy" ] || [ "$health" = "none" ]; }; then exit 0; fi; if [ "$status" = "exited" ] || [ "$status" = "dead" ] || [ "$status" = "missing" ]; then exit 2; fi; sleep 1; done; exit 1'`
  ].join(' ');

  try {
    execSync(command, { stdio: 'ignore' });
    return { ok: true };
  } catch {
    try {
      const details = execSync(`docker inspect --format "status={{.State.Status}} exit={{.State.ExitCode}} oom={{.State.OOMKilled}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}" ${containerName}`, { encoding: 'utf8', timeout: 5000 }).trim();
      return { ok: false, error: details || 'container readiness check failed' };
    } catch (inspectError) {
      return { ok: false, error: inspectError.message || 'container readiness check failed' };
    }
  }
}

function createRental(state, { renterId, renterName, budgetCap, modelPreference, fundingIntentId = null, fundingMemo = null, durationMin = 60, expiresAt = null, telegramChatId = null }) {
  const rentalId = `rental-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
  const containerName = `atp-${rentalId}`;
  const inheritedModel = getCurrentAiteModel();
  const effectiveModel = (modelPreference && modelPreference !== 'inherit_current')
    ? normalizeRentalModel(modelPreference)
    : inheritedModel;
  const effectiveDurationMin = Number(durationMin || 60);
  const effectiveExpiresAt = toExpiryTimestamp(expiresAt, effectiveDurationMin);

  // Check concurrent limit
  const activeCount = Object.values(state.rentals).filter(r => r.status === 'active').length;
  if (activeCount >= state.config.maxConcurrentRentals) {
    return { error: `Max concurrent rentals (${state.config.maxConcurrentRentals}) reached` };
  }

  // Spin up container
  const envFile = path.join(__dirname, '..', 'docker', '.env');
  try {
    const containerId = execSync([
      'docker run -d',
      `--name ${containerName}`,
      `--label atp.role=rental`,
      `--label atp.rental-id=${rentalId}`,
      `--label atp.renter-id=${renterId}`,
      `--env-file ${envFile}`,
      `-e ATP_RENTAL_ID=${rentalId}`,
      `-e ATP_RENTER_ID=${renterId}`,
      `-e ATP_BUDGET_CAP=${budgetCap || state.config.defaultBudgetCap}`,
      `-e ATP_MODEL_PREFERENCE=${effectiveModel}`,
      '--security-opt no-new-privileges:true',
      '--cap-drop ALL',
      '--cap-add NET_RAW',
      `--memory ${RENTAL_MEMORY_LIMIT}`,
      `--cpus ${RENTAL_CPU_LIMIT}`,
      '--restart unless-stopped',
      'atp-rental'
    ].join(' '), { encoding: 'utf8' }).trim();

    const readiness = waitForContainerHealthy(containerName);
    if (!readiness.ok) {
      try { killContainer(containerName); } catch {}
      return { error: `Container failed readiness check: ${readiness.error}` };
    }

    state.rentals[rentalId] = {
      rentalId,
      containerId: containerId.slice(0, 12),
      containerName,
      renterId,
      renterName: renterName || renterId,
      budgetCap: budgetCap || state.config.defaultBudgetCap,
      inheritedModel,
      currentModel: effectiveModel,
      modelPreference: modelPreference || 'inherit_current',
      fundingIntentId,
      fundingMemo,
      telegramChatId: telegramChatId || null,
      modelChangedAt: null,
      costAccrued: 0,
      interactionCount: 0,
      topupCount: 0,
      topupUsd: 0,
      topups: [],
      status: 'active',
      startedAt: new Date().toISOString(),
      durationMin: effectiveDurationMin,
      expiresAt: effectiveExpiresAt,
      endedAt: null,
      endReason: null,
      hcsSequences: [],
      alerts: []
    };
    saveState(state);
    return { ok: true, rentalId, containerName, containerId: containerId.slice(0, 12) };
  } catch (e) {
    return { error: `Failed to start container: ${e.message}` };
  }
}

function endRental(state, rentalId, reason = 'owner_terminated') {
  const rental = state.rentals[rentalId];
  if (!rental) return { error: 'Rental not found' };
  if (rental.status !== 'active') return { error: `Rental already ${rental.status}` };

  // Run full kill sequence (HCS + notification + container kill)
  const killScript = path.join(__dirname, 'kill-rental.mjs');
  try {
    const killEnv = { ...process.env, PATH: process.env.PATH };
    if (RENTAL_BOT_TOKEN) killEnv.TELEGRAM_BOT_TOKEN = RENTAL_BOT_TOKEN;
    const output = execSync(
      `node ${killScript} ${rentalId} ${reason}`,
      { encoding: 'utf8', timeout: 30000, env: killEnv }
    );
    console.log(output);
  } catch (e) {
    // Fallback: direct container kill if script fails
    console.error(`Kill script failed, falling back to direct kill: ${e.message}`);
    killContainer(rental.containerName);
  }

  rental.status = 'terminated';
  rental.endedAt = new Date().toISOString();
  rental.endReason = reason;
  saveState(state);

  syncDepositRentalState(rentalId, {
    status: fundingTerminalStatus(reason, rental.expiresAt),
    endedAt: rental.endedAt,
    endReason: reason,
  });
  syncFundingIntentForRental(rental, reason);

  return { ok: true, rentalId, reason };
}

function reapExpiredRentals() {
  const state = loadState();
  const now = Date.now();
  const expired = Object.values(state.rentals || {}).filter(rental =>
    rental.status === 'active' && rental.expiresAt && Number(rental.expiresAt) <= now
  );

  for (const rental of expired) {
    console.log(`⏰ Expiring rental ${rental.rentalId} (expired at ${new Date(Number(rental.expiresAt)).toISOString()})`);
    endRental(state, rental.rentalId, 'timeout');
  }
}

function reconcileContainerState() {
  if (reconcileInFlight) return;
  reconcileInFlight = true;

  try {
    const state = loadState();
    const runningContainers = getRunningContainers();
    const runningByName = new Map(runningContainers.map(container => [container.name, container]));
    const runningByRentalId = new Map();
    for (const container of runningContainers) {
      if (!container.rentalId) continue;
      if (!runningByRentalId.has(container.rentalId)) runningByRentalId.set(container.rentalId, []);
      runningByRentalId.get(container.rentalId).push(container);
    }
    const activeRentals = Object.values(state.rentals || {}).filter(rental => rental.status === 'active');
    if (runningContainers.length > 0 || activeRentals.length > 0) {
      console.log(`[reconcile] ${runningContainers.length} running containers, ${activeRentals.length} active rentals`);
      for (const c of runningContainers) console.log(`  container: ${c.name} rentalId=${c.rentalId}`);
      for (const r of activeRentals) console.log(`  rental: ${r.rentalId} container=${r.containerName}`);
    }
    const summary = {
      ranAt: new Date().toISOString(),
      activeRentals: activeRentals.length,
      runningContainers: runningContainers.length,
      missingContainers: 0,
      orphanContainers: 0,
      repairedMappings: 0,
      terminatedRentals: 0,
      killedOrphans: 0,
      splitBrainConflicts: 0,
      splitBrainResolved: 0,
      duplicateActiveMappings: 0,
      duplicateLabelContainers: 0,
      ambiguousTerminations: 0,
    };

    let stateChanged = false;
    const terminations = new Map();
    const processedDuplicateGroups = new Set();

    function scheduleTermination(rentalId, reason, alertType, message) {
      if (!rentalId || terminations.has(rentalId)) return;
      terminations.set(rentalId, { reason, alertType, message });
    }

    function createdAtMs(value) {
      const parsed = Date.parse(value || '');
      return Number.isNaN(parsed) ? 0 : parsed;
    }

    function chooseCanonicalContainer(rental, containers) {
      if (!containers || containers.length === 0) return null;
      const byStoredId = rental.containerId
        ? containers.find(container => container.id.startsWith(rental.containerId))
        : null;
      if (byStoredId) return byStoredId;

      const byStoredName = rental.containerName
        ? containers.find(container => container.name === rental.containerName)
        : null;
      if (byStoredName) return byStoredName;

      return [...containers].sort((a, b) => createdAtMs(b.createdAt) - createdAtMs(a.createdAt))[0];
    }

    function reconcileDuplicateActiveGroup(groupKey, rentals) {
      if (rentals.length < 2) return;
      const memberKey = rentals.map(rental => rental.rentalId).sort().join(',');
      if (processedDuplicateGroups.has(memberKey)) return;
      processedDuplicateGroups.add(memberKey);
      summary.duplicateActiveMappings++;

      const liveCandidates = [];
      const seen = new Set();
      for (const rental of rentals) {
        if (rental.containerName) {
          const byName = runningByName.get(rental.containerName);
          if (byName && !seen.has(byName.id)) {
            liveCandidates.push(byName);
            seen.add(byName.id);
          }
        }
        for (const container of (runningByRentalId.get(rental.rentalId) || [])) {
          if (!seen.has(container.id)) {
            liveCandidates.push(container);
            seen.add(container.id);
          }
        }
      }

      let winner = null;
      if (liveCandidates.length === 1 && liveCandidates[0].rentalId) {
        const labelMatches = rentals.filter(rental => rental.rentalId === liveCandidates[0].rentalId);
        if (labelMatches.length === 1) winner = labelMatches[0];
      }

      if (!winner) {
        summary.splitBrainConflicts++;
        summary.ambiguousTerminations += rentals.length;
        for (const rental of rentals) {
          scheduleTermination(
            rental.rentalId,
            'split_brain_ambiguous',
            'split_brain_ambiguous',
            `Active rentals share ${groupKey} with no single canonical winner; terminating ambiguous split-brain state.`
          );
        }
        return;
      }

      for (const rental of rentals) {
        if (rental.rentalId === winner.rentalId) continue;
        summary.splitBrainResolved++;
        scheduleTermination(
          rental.rentalId,
          'split_brain_duplicate',
          'split_brain_duplicate',
          `Rental ${rental.rentalId} duplicated ${groupKey}; keeping ${winner.rentalId} as canonical.`
        );
      }
    }

    const activeByContainerName = new Map();
    const activeByContainerId = new Map();
    for (const rental of activeRentals) {
      if (rental.containerName) {
        if (!activeByContainerName.has(rental.containerName)) activeByContainerName.set(rental.containerName, []);
        activeByContainerName.get(rental.containerName).push(rental);
      }
      if (rental.containerId) {
        if (!activeByContainerId.has(rental.containerId)) activeByContainerId.set(rental.containerId, []);
        activeByContainerId.get(rental.containerId).push(rental);
      }
    }

    for (const [containerName, rentals] of activeByContainerName.entries()) {
      reconcileDuplicateActiveGroup(`container name ${containerName}`, rentals);
    }

    for (const [containerId, rentals] of activeByContainerId.entries()) {
      reconcileDuplicateActiveGroup(`container id ${containerId}`, rentals);
    }

    for (const rental of activeRentals) {
      if (terminations.has(rental.rentalId)) continue;

      const byName = rental.containerName ? runningByName.get(rental.containerName) : null;
      const byRentalIdCandidates = runningByRentalId.get(rental.rentalId) || [];

      let canonicalByLabel = byRentalIdCandidates[0] || null;
      if (byName || canonicalByLabel) missingContainerSince.delete(rental.rentalId);
      if (byRentalIdCandidates.length > 1) {
        summary.splitBrainConflicts++;
        summary.duplicateLabelContainers += (byRentalIdCandidates.length - 1);
        canonicalByLabel = chooseCanonicalContainer(rental, byRentalIdCandidates);
        const staleContainers = byRentalIdCandidates.filter(container => container.id !== canonicalByLabel.id);

        rental.containerName = canonicalByLabel.name;
        rental.containerId = canonicalByLabel.id.slice(0, 12);
        stateChanged = true;
        summary.repairedMappings++;

        for (const staleContainer of staleContainers) {
          addAlert(state, rental.rentalId, 'split_brain_duplicate_container', `Multiple live containers claimed rental ${rental.rentalId}; keeping ${canonicalByLabel.name}, killing ${staleContainer.name}.`);
          killContainer(staleContainer.id);
          summary.killedOrphans++;
          summary.splitBrainResolved++;
        }
      }

      if (byName && canonicalByLabel && byName.id !== canonicalByLabel.id) {
        summary.splitBrainConflicts++;
        rental.containerName = canonicalByLabel.name;
        rental.containerId = canonicalByLabel.id.slice(0, 12);
        stateChanged = true;
        summary.repairedMappings++;
        summary.splitBrainResolved++;
        addAlert(state, rental.rentalId, 'split_brain_reconciled', `Rental ${rental.rentalId} had conflicting name and label matches; label-bound container ${canonicalByLabel.name} won.`);
        continue;
      }

      if (!byName && canonicalByLabel) {
        rental.containerName = canonicalByLabel.name;
        rental.containerId = canonicalByLabel.id.slice(0, 12);
        stateChanged = true;
        summary.repairedMappings++;
        addAlert(state, rental.rentalId, 'container_reconciled', `Rental ${rental.rentalId} container mapping repaired → ${canonicalByLabel.name}`);
        continue;
      }

      if (byName && byName.rentalId && byName.rentalId !== rental.rentalId && !canonicalByLabel) {
        summary.splitBrainConflicts++;
        scheduleTermination(
          rental.rentalId,
          'split_brain_container_claimed',
          'split_brain_container_claimed',
          `Rental ${rental.rentalId} pointed at container ${byName.name}, but that container is labeled for ${byName.rentalId}.`
        );
        continue;
      }

      if (!byName && !canonicalByLabel) {
        summary.missingContainers++;
        const now = Date.now();
        const missingSince = missingContainerSince.get(rental.rentalId) || now;
        missingContainerSince.set(rental.rentalId, missingSince);
        if (now - missingSince >= CONTAINER_MISSING_GRACE_MS) {
          scheduleTermination(
            rental.rentalId,
            'container_missing',
            'container_missing',
            `Rental ${rental.rentalId} had no live Docker container after ${Math.round(CONTAINER_MISSING_GRACE_MS / 1000)}s grace; terminating stale active state.`
          );
        }
        continue;
      }

      missingContainerSince.delete(rental.rentalId);
    }

    if (stateChanged) saveState(state);

    for (const [rentalId, action] of terminations.entries()) {
      summary.terminatedRentals++;
      addAlert(state, rentalId, action.alertType, action.message);
      endRental(state, rentalId, action.reason);
    }

    const refreshedState = loadState();
    const refreshedRunningContainers = getRunningContainers();
    const refreshedActiveRentals = Object.values(refreshedState.rentals || {}).filter(rental => rental.status === 'active');
    const activeRentalIds = new Set(refreshedActiveRentals.map(rental => rental.rentalId));
    const activeContainerNames = new Set(refreshedActiveRentals.map(rental => rental.containerName));
    for (const rentalId of [...missingContainerSince.keys()]) {
      if (!activeRentalIds.has(rentalId)) missingContainerSince.delete(rentalId);
    }

    for (const container of refreshedRunningContainers) {
      const matched = (container.rentalId && activeRentalIds.has(container.rentalId)) || activeContainerNames.has(container.name);
      if (matched) continue;

      summary.orphanContainers++;
      addAlert(state, container.rentalId || container.name, 'orphan_container', `Container ${container.name} was running without an active rental record; killing orphan.`);
      killContainer(container.id);
      summary.killedOrphans++;
    }

    lastContainerReconcile = summary;
  } finally {
    reconcileInFlight = false;
  }
}

function updateRentalCost(state, rentalId, cost, interactions) {
  const rental = state.rentals[rentalId];
  if (!rental) return;
  // Accumulate — bot sends per-interaction deltas
  rental.costAccrued = (rental.costAccrued || 0) + Number(cost || 0);
  rental.interactionCount = (rental.interactionCount || 0) + Number(interactions || 0);

  // Budget enforcement
  if (rental.costAccrued >= rental.budgetCap) {
    addAlert(state, rentalId, 'budget_exceeded', `Rental ${rentalId} exceeded budget cap ($${rental.costAccrued.toFixed(4)}/$${rental.budgetCap})`);
    endRental(state, rentalId, 'budget_exceeded');
  }
  saveState(state);
}

function topupRental(state, rentalId, amount, txId = null, source = null) {
  const rental = state.rentals[rentalId];
  if (!rental) return { error: 'Rental not found' };
  if (rental.status !== 'active') return { error: `Rental is ${rental.status}` };

  const topupAmount = Number(amount || 0);
  if (!(topupAmount > 0)) return { error: 'Invalid topup amount' };

  rental.budgetCap = Number((rental.budgetCap + topupAmount).toFixed(4));
  rental.topupCount = (rental.topupCount || 0) + 1;
  rental.topupUsd = Number(((rental.topupUsd || 0) + topupAmount).toFixed(4));
  rental.topups = rental.topups || [];
  rental.topups.push({
    at: new Date().toISOString(),
    amount: topupAmount,
    txId,
    source,
  });
  if (rental.topups.length > 25) rental.topups = rental.topups.slice(-25);
  saveState(state);

  return {
    ok: true,
    rentalId,
    budgetCap: rental.budgetCap,
    topupCount: rental.topupCount,
    topupUsd: rental.topupUsd,
  };
}

function updateRentalModel(state, rentalId, model) {
  const rental = state.rentals[rentalId];
  if (!rental) return { error: 'Rental not found' };
  if (rental.status !== 'active') return { error: `Rental is ${rental.status}` };
  rental.currentModel = model;
  rental.modelChangedAt = new Date().toISOString();
  saveState(state);
  return { ok: true, rentalId, model };
}

function addAlert(state, rentalId, type, message) {
  const alert = {
    id: `alert-${Date.now().toString(36)}`,
    rentalId,
    type,
    message,
    timestamp: new Date().toISOString(),
    acknowledged: false
  };
  state.alerts.push(alert);
  if (state.rentals[rentalId]) {
    state.rentals[rentalId].alerts.push(alert.id);
  }
  saveState(state);
  return alert;
}

// ── Aggregate Stats ─────────────────────────────────────────────────────────

function getDashboardStats(state) {
  const rentals = Object.values(state.rentals || {});
  const active = rentals.filter(r => r.status === 'active');
  const terminated = rentals.filter(r => r.status === 'terminated' || r.status === 'ended');
  const totalCost = rentals.reduce((sum, r) => sum + (r.costAccrued || 0), 0);
  const totalInteractions = rentals.reduce((sum, r) => sum + (r.interactionCount || 0), 0);
  const unackedAlerts = (state.alerts || []).filter(a => !a.acknowledged);

  return {
    active: active.length,
    terminated: terminated.length,
    total: rentals.length,
    totalCost: totalCost.toFixed(4),
    totalInteractions,
    unackedAlerts: unackedAlerts.length,
    maxConcurrent: state.config.maxConcurrentRentals,
    hcsTopicId: state.config.hcsTopicId
  };
}

// ── Web Dashboard ───────────────────────────────────────────────────────────

function renderDashboard(state) {
  const stats = getDashboardStats(state);
  const rentals = Object.values(state.rentals).sort((a, b) =>
    (a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1) ||
    new Date(b.startedAt) - new Date(a.startedAt)
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ATP Monitor — Agent Trust Protocol</title>
<meta http-equiv="refresh" content="30">
<style>
  :root { --bg: #0a0a0f; --card: #12121a; --border: #1e1e2e; --text: #e0e0e0; --dim: #888; --green: #4ade80; --red: #f87171; --yellow: #fbbf24; --blue: #60a5fa; --purple: #a78bfa; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'SF Mono', monospace; background: var(--bg); color: var(--text); padding: 20px; }
  h1 { font-size: 1.4em; margin-bottom: 4px; }
  .subtitle { color: var(--dim); font-size: 0.85em; margin-bottom: 24px; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 24px; }
  .stat { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 16px; }
  .stat-value { font-size: 1.8em; font-weight: bold; }
  .stat-label { color: var(--dim); font-size: 0.75em; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
  .stat-green .stat-value { color: var(--green); }
  .stat-red .stat-value { color: var(--red); }
  .stat-yellow .stat-value { color: var(--yellow); }
  .stat-blue .stat-value { color: var(--blue); }
  .stat-purple .stat-value { color: var(--purple); }
  .section-title { font-size: 1.1em; margin: 24px 0 12px; }
  table { width: 100%; border-collapse: collapse; background: var(--card); border-radius: 8px; overflow: hidden; }
  th, td { padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--border); font-size: 0.85em; }
  th { color: var(--dim); font-weight: 500; text-transform: uppercase; font-size: 0.7em; letter-spacing: 0.5px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; }
  .badge-active { background: rgba(74,222,128,0.15); color: var(--green); }
  .badge-terminated { background: rgba(248,113,113,0.15); color: var(--red); }
  .badge-breach { background: rgba(248,113,113,0.3); color: var(--red); }
  .badge-budget { background: rgba(251,191,36,0.15); color: var(--yellow); }
  .btn { padding: 4px 12px; border: 1px solid var(--border); border-radius: 4px; background: var(--card); color: var(--text); cursor: pointer; font-size: 0.8em; }
  .btn:hover { border-color: var(--red); color: var(--red); }
  .btn-create { border-color: var(--green); color: var(--green); margin-bottom: 16px; padding: 8px 20px; font-size: 0.9em; }
  .btn-create:hover { background: rgba(74,222,128,0.1); }
  .alerts { margin-top: 24px; }
  .alert-item { background: var(--card); border: 1px solid var(--border); border-left: 3px solid var(--red); border-radius: 4px; padding: 10px 14px; margin-bottom: 8px; font-size: 0.85em; }
  .alert-item.breach { border-left-color: var(--red); }
  .alert-item.budget { border-left-color: var(--yellow); }
  .alert-time { color: var(--dim); font-size: 0.75em; }
  .empty { color: var(--dim); padding: 40px; text-align: center; }
  .cost-bar { width: 100%; height: 4px; background: var(--border); border-radius: 2px; margin-top: 4px; }
  .cost-fill { height: 100%; border-radius: 2px; transition: width 0.3s; }
  a { color: var(--blue); text-decoration: none; }
  a:hover { text-decoration: underline; }
  .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
  .hcs-link { font-size: 0.8em; color: var(--purple); }
</style>
</head>
<body>

<div class="header">
  <div>
    <h1>🔐 ATP Monitor</h1>
    <div class="subtitle">Agent Trust Protocol — Multi-Tenant Dashboard</div>
  </div>
  <div>
    <a class="hcs-link" href="https://hashscan.io/mainnet/topic/${stats.hcsTopicId}" target="_blank">📋 HCS: ${stats.hcsTopicId}</a>
  </div>
</div>

<div class="stats">
  <div class="stat stat-green">
    <div class="stat-value">${stats.active}</div>
    <div class="stat-label">Active Rentals</div>
  </div>
  <div class="stat stat-blue">
    <div class="stat-value">${stats.total}</div>
    <div class="stat-label">Total Rentals</div>
  </div>
  <div class="stat stat-yellow">
    <div class="stat-value">$${stats.totalCost}</div>
    <div class="stat-label">Total Cost</div>
  </div>
  <div class="stat stat-purple">
    <div class="stat-value">${stats.totalInteractions}</div>
    <div class="stat-label">Interactions</div>
  </div>
  <div class="stat ${stats.unackedAlerts > 0 ? 'stat-red' : ''}">
    <div class="stat-value">${stats.unackedAlerts}</div>
    <div class="stat-label">Unacked Alerts</div>
  </div>
  <div class="stat">
    <div class="stat-value">${stats.active}/${stats.maxConcurrent}</div>
    <div class="stat-label">Capacity</div>
  </div>
</div>

<h2 class="section-title">Rentals</h2>
${rentals.length === 0 ? '<div class="empty">No rentals yet. Use the API to create one.</div>' : `
<table>
  <thead>
    <tr>
      <th>Rental ID</th>
      <th>Renter</th>
      <th>Status</th>
      <th>Cost</th>
      <th>Budget</th>
      <th>Interactions</th>
      <th>Started</th>
      <th>Duration</th>
      <th>Actions</th>
    </tr>
  </thead>
  <tbody>
    ${rentals.map(r => {
      const costPct = Math.min((r.costAccrued / r.budgetCap) * 100, 100);
      const costColor = costPct > 80 ? 'var(--red)' : costPct > 50 ? 'var(--yellow)' : 'var(--green)';
      const started = new Date(r.startedAt);
      const ended = r.endedAt ? new Date(r.endedAt) : new Date();
      const durationMs = ended - started;
      const durationMin = Math.floor(durationMs / 60000);
      const durationStr = durationMin < 60 ? `${durationMin}m` : `${Math.floor(durationMin/60)}h ${durationMin%60}m`;
      return `
    <tr>
      <td><code>${r.rentalId}</code></td>
      <td>${r.renterName}</td>
      <td><span class="badge badge-${r.status}">${r.status}</span>${r.endReason ? ` <span class="badge badge-${r.endReason === 'budget_exceeded' ? 'budget' : 'breach'}">${r.endReason}</span>` : ''}</td>
      <td>
        $${r.costAccrued.toFixed(4)}
        <div class="cost-bar"><div class="cost-fill" style="width:${costPct}%; background:${costColor}"></div></div>
      </td>
      <td>$${r.budgetCap.toFixed(2)}</td>
      <td>${r.interactionCount}</td>
      <td>${started.toLocaleString()}</td>
      <td>${durationStr}</td>
      <td>${r.status === 'active' ? `<button class="btn" onclick="killRental('${r.rentalId}')">Kill</button>` : '—'}</td>
    </tr>`;
    }).join('')}
  </tbody>
</table>`}

${state.alerts.length > 0 ? `
<h2 class="section-title">Alerts</h2>
<div class="alerts">
  ${state.alerts.slice(-20).reverse().map(a => `
  <div class="alert-item ${a.type}">
    <span class="badge badge-${a.type === 'security.breach' ? 'breach' : 'budget'}">${a.type}</span>
    ${a.message}
    <div class="alert-time">${new Date(a.timestamp).toLocaleString()} — Rental: ${a.rentalId}</div>
  </div>`).join('')}
</div>` : ''}

<script>
async function killRental(id) {
  if (!confirm('Kill rental ' + id + '?')) return;
  const res = await fetch('/api/rentals/' + id, { method: 'DELETE' });
  const data = await res.json();
  if (data.ok) location.reload();
  else alert('Error: ' + data.error);
}
</script>

<div style="margin-top:40px; color:var(--dim); font-size:0.7em; text-align:center;">
  ATP Monitor v1.0 — Auto-refreshes every 30s — <a href="/api/stats">API</a>
</div>

</body>
</html>`;
}

// ── HTTP Server ─────────────────────────────────────────────────────────────

function startServer() {
  let state = loadState();

  const server = http.createServer((req, res) => {
    // Reload state on each request (allows external updates)
    state = loadState();

    const url = new URL(req.url, `http://localhost:${PORT}`);
    const method = req.method;

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PUT');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (method === 'OPTIONS') { res.writeHead(204); return res.end(); }

    // Routes
    const sendJSON = (code, data) => {
      res.writeHead(code, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data, null, 2));
    };

    // Dashboard
    if (url.pathname === '/' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(renderDashboard(state));
    }

    // API: Stats
    if (url.pathname === '/api/stats' && method === 'GET') {
      return sendJSON(200, getDashboardStats(state));
    }

    // API: List rentals
    if (url.pathname === '/api/rentals' && method === 'GET') {
      const filter = url.searchParams.get('status');
      let rentals = Object.values(state.rentals);
      if (filter) rentals = rentals.filter(r => r.status === filter);
      return sendJSON(200, { rentals });
    }

    // API: Create rental
    if (url.pathname === '/api/rentals' && method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const params = JSON.parse(body);
          const result = createRental(state, params);
          return sendJSON(result.error ? 400 : 201, result);
        } catch (e) {
          return sendJSON(400, { error: 'Invalid JSON' });
        }
      });
      return;
    }

    // API: Get rental
    const rentalMatch = url.pathname.match(/^\/api\/rentals\/([^/]+)$/);
    if (rentalMatch && method === 'GET') {
      const rental = state.rentals[rentalMatch[1]];
      if (!rental) return sendJSON(404, { error: 'Not found' });

      // Enrich with live container stats if active
      let containerStats = null;
      if (rental.status === 'active') {
        containerStats = getContainerStats(rental.containerId);
      }
      return sendJSON(200, { ...rental, containerStats });
    }

    // API: Kill rental
    if (rentalMatch && method === 'DELETE') {
      const reason = url.searchParams.get('reason') || 'owner_terminated';
      const result = endRental(state, rentalMatch[1], reason);
      return sendJSON(result.error ? 400 : 200, result);
    }

    // API: Update rental cost (called by sidecar)
    if (rentalMatch && method === 'PUT') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const { cost, interactions } = JSON.parse(body);
          updateRentalCost(state, rentalMatch[1], cost, interactions);
          return sendJSON(200, { ok: true });
        } catch (e) {
          return sendJSON(400, { error: 'Invalid JSON' });
        }
      });
      return;
    }

    const topupMatch = url.pathname.match(/^\/api\/rentals\/([^/]+)\/topup$/);
    if (topupMatch && method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const { amount, txId, source } = JSON.parse(body);
          const result = topupRental(state, topupMatch[1], amount, txId, source);
          return sendJSON(result.error ? 400 : 200, result);
        } catch (e) {
          return sendJSON(400, { error: 'Invalid JSON' });
        }
      });
      return;
    }

    // API: Alerts
    if (url.pathname === '/api/alerts' && method === 'GET') {
      return sendJSON(200, { alerts: state.alerts.slice(-50).reverse() });
    }

    // API: Add alert (called by breach monitor webhook)
    if (url.pathname === '/api/alerts' && method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const { rentalId, type, message } = JSON.parse(body);
          const alert = addAlert(state, rentalId, type, message);
          return sendJSON(201, alert);
        } catch (e) {
          return sendJSON(400, { error: 'Invalid JSON' });
        }
      });
      return;
    }

    // API: Acknowledge alert
    const alertMatch = url.pathname.match(/^\/api\/alerts\/([^/]+)\/ack$/);
    if (alertMatch && method === 'POST') {
      const alert = state.alerts.find(a => a.id === alertMatch[1]);
      if (!alert) return sendJSON(404, { error: 'Alert not found' });
      alert.acknowledged = true;
      saveState(state);
      return sendJSON(200, { ok: true });
    }

    // API: Change rental model
    const modelMatch = url.pathname.match(/^\/api\/rentals\/([^/]+)\/model$/);
    if (modelMatch && method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const { model } = JSON.parse(body);
          if (!model) return sendJSON(400, { error: 'Missing model' });
          const result = updateRentalModel(state, modelMatch[1], model);
          return sendJSON(result.error ? 400 : 200, result);
        } catch (e) {
          return sendJSON(400, { error: 'Invalid JSON' });
        }
      });
      return;
    }

    // API: Container logs
    const logsMatch = url.pathname.match(/^\/api\/rentals\/([^/]+)\/logs$/);
    if (logsMatch && method === 'GET') {
      const rental = state.rentals[logsMatch[1]];
      if (!rental) return sendJSON(404, { error: 'Not found' });
      const lines = parseInt(url.searchParams.get('lines') || '50');
      const logs = getContainerLogs(rental.containerName, lines);
      return sendJSON(200, { logs });
    }

    // API: Health
    if (url.pathname === '/api/health') {
      return sendJSON(200, {
        status: 'ok',
        timestamp: new Date().toISOString(),
        containerReconcile: lastContainerReconcile,
      });
    }

    // API: Config
    if (url.pathname === '/api/config' && method === 'GET') {
      return sendJSON(200, state.config);
    }

    if (url.pathname === '/api/config' && method === 'PUT') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const updates = JSON.parse(body);
          Object.assign(state.config, updates);
          saveState(state);
          return sendJSON(200, { ok: true, config: state.config });
        } catch (e) {
          return sendJSON(400, { error: 'Invalid JSON' });
        }
      });
      return;
    }

    sendJSON(404, { error: 'Not found' });
  });

  server.listen(PORT, '127.0.0.1', () => {
    console.log(`\n🔐 ATP Monitor v1.0`);
    console.log(`   Dashboard: http://localhost:${PORT}`);
    console.log(`   API:       http://localhost:${PORT}/api/stats`);
    console.log(`   HCS Topic: ${state.config.hcsTopicId}\n`);
  });

  reapExpiredRentals();
  reconcileContainerState();
  setInterval(reapExpiredRentals, 15_000);
  setInterval(reconcileContainerState, 15_000);
}

// ── CLI Mode ────────────────────────────────────────────────────────────────

function runCLI() {
  const cmd = process.argv[2];
  const state = loadState();

  switch (cmd) {
    case 'status': {
      const stats = getDashboardStats(state);
      const rentals = Object.values(state.rentals);
      console.log('\n🔐 ATP Monitor Status\n');
      console.log(`  Active:       ${stats.active}/${stats.maxConcurrent}`);
      console.log(`  Total:        ${stats.total}`);
      console.log(`  Cost:         $${stats.totalCost}`);
      console.log(`  Interactions: ${stats.totalInteractions}`);
      console.log(`  Alerts:       ${stats.unackedAlerts} unacked\n`);

      if (rentals.length > 0) {
        console.log('  Rentals:');
        for (const r of rentals) {
          const icon = r.status === 'active' ? '🟢' : '🔴';
          console.log(`    ${icon} ${r.rentalId} — ${r.renterName} — $${r.costAccrued.toFixed(4)}/$${r.budgetCap} — ${r.interactionCount} msgs`);
        }
      }
      console.log('');
      break;
    }
    case 'kill': {
      const rentalId = process.argv[3];
      const reason = process.argv[4] || 'owner_terminated';
      if (!rentalId) { console.error('Usage: atp-monitor kill <rental-id> [reason]'); process.exit(1); }
      const result = endRental(state, rentalId, reason);
      if (result.error) { console.error(`Error: ${result.error}`); process.exit(1); }
      console.log(`✅ Rental ${rentalId} terminated (${reason})`);
      break;
    }
    case 'create': {
      const renterId = process.argv[3];
      const renterName = process.argv[4] || renterId;
      const budgetCap = parseFloat(process.argv[5]) || state.config.defaultBudgetCap;
      if (!renterId) { console.error('Usage: atp-monitor create <renter-id> [name] [budget]'); process.exit(1); }
      const result = createRental(state, { renterId, renterName, budgetCap });
      if (result.error) { console.error(`Error: ${result.error}`); process.exit(1); }
      console.log(`✅ Created rental ${result.rentalId} → container ${result.containerName}`);
      break;
    }
    case 'alerts': {
      const alerts = state.alerts.filter(a => !a.acknowledged);
      if (alerts.length === 0) { console.log('No unacknowledged alerts.'); break; }
      for (const a of alerts) {
        console.log(`  🚨 [${a.type}] ${a.message} (${a.timestamp})`);
      }
      break;
    }
    default:
      console.log('Usage: atp-monitor [status|kill|create|alerts] or run without args for web dashboard');
      break;
  }
}

// ── Entry ───────────────────────────────────────────────────────────────────

function preflight() {
  const fails = [];
  try { execSync('docker info', { stdio: 'ignore', timeout: 5000 }); } catch { fails.push('Docker'); }
  if (fails.length > 0) {
    console.error(`\n❌ Preflight failed: ${fails.join(', ')}`);
    console.error('Run: node scripts/atp-doctor.mjs for details\n');
    process.exit(1);
  }
}

const cliCommands = ['status', 'kill', 'create', 'alerts'];
if (cliCommands.includes(process.argv[2])) {
  runCLI();
} else {
  preflight();
  acquireLock();
  startServer();
}
