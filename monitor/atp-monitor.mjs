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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, 'monitor-state.json');
const MODEL_PREFERENCE_FILE = path.join(__dirname, '..', 'data', 'model_preference.json');
const PORT = parseInt(process.argv.find((_, i, a) => a[i - 1] === '--port') || '3500');

// ── State Management ────────────────────────────────────────────────────────

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {
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
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function getCurrentAiteModel() {
  try {
    const raw = JSON.parse(fs.readFileSync(MODEL_PREFERENCE_FILE, 'utf8'));
    return raw.model || 'sonnet';
  } catch {
    return process.env.OPENCLAW_DEFAULT_MODEL || 'sonnet';
  }
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
  const raw = dockerExec('ps --filter "label=atp.role=rental" --format "{{.ID}}\\t{{.Names}}\\t{{.Status}}\\t{{.CreatedAt}}"');
  if (!raw) return [];
  return raw.split('\n').filter(Boolean).map(line => {
    const [id, name, ...rest] = line.split('\t');
    return { id, name, status: rest.slice(0, -1).join('\t'), createdAt: rest.at(-1) };
  });
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

function createRental(state, { renterId, renterName, budgetCap, modelPreference }) {
  const rentalId = `rental-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
  const containerName = `atp-${rentalId}`;
  const inheritedModel = getCurrentAiteModel();
  const effectiveModel = modelPreference && modelPreference !== 'inherit_current'
    ? modelPreference
    : inheritedModel;
  
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
      '--memory 1g',
      '--cpus 1.0',
      '--restart unless-stopped',
      'atp-rental'
    ].join(' '), { encoding: 'utf8' }).trim();

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
      modelChangedAt: null,
      costAccrued: 0,
      interactionCount: 0,
      status: 'active',
      startedAt: new Date().toISOString(),
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
    const output = execSync(
      `node ${killScript} ${rentalId} ${reason}`,
      { encoding: 'utf8', timeout: 30000, env: { ...process.env, PATH: process.env.PATH } }
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

  return { ok: true, rentalId, reason };
}

function updateRentalCost(state, rentalId, cost, interactions) {
  const rental = state.rentals[rentalId];
  if (!rental) return;
  rental.costAccrued = cost;
  rental.interactionCount = interactions;
  
  // Budget enforcement
  if (cost >= rental.budgetCap) {
    addAlert(state, rentalId, 'budget_exceeded', `Rental ${rentalId} exceeded budget cap ($${cost}/$${rental.budgetCap})`);
    endRental(state, rentalId, 'budget_exceeded');
  }
  saveState(state);
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
  const rentals = Object.values(state.rentals);
  const active = rentals.filter(r => r.status === 'active');
  const terminated = rentals.filter(r => r.status === 'terminated');
  const totalCost = rentals.reduce((sum, r) => sum + r.costAccrued, 0);
  const totalInteractions = rentals.reduce((sum, r) => sum + r.interactionCount, 0);
  const unackedAlerts = state.alerts.filter(a => !a.acknowledged);

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
      return sendJSON(200, { status: 'ok', timestamp: new Date().toISOString() });
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

const cliCommands = ['status', 'kill', 'create', 'alerts'];
if (cliCommands.includes(process.argv[2])) {
  runCLI();
} else {
  startServer();
}
