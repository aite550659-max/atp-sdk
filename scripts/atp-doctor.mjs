#!/usr/bin/env node
/**
 * ATP Doctor — preflight dependency checker
 *
 * Validates that all required and optional dependencies are present
 * before starting ATP services. Designed to give clear, actionable
 * feedback to third-party installers.
 *
 * Usage:
 *   node scripts/atp-doctor.mjs          # Full check
 *   node scripts/atp-doctor.mjs --json   # Machine-readable output
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE = path.resolve(__dirname, '..');
const JSON_MODE = process.argv.includes('--json');

const results = [];

function check(name, level, fn) {
  try {
    const result = fn();
    results.push({ name, level, ok: true, detail: result || 'OK' });
  } catch (e) {
    results.push({ name, level, ok: false, detail: e.message || String(e) });
  }
}

function cmd(command, opts = {}) {
  return execSync(command, { encoding: 'utf8', timeout: 10000, stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim();
}

function fileExists(p) {
  return fs.existsSync(p);
}

// ── Hard Dependencies ───────────────────────────────────────────────────────

check('Node.js >= 18', 'required', () => {
  const ver = cmd('node --version');
  const major = parseInt(ver.replace('v', ''));
  if (major < 18) throw new Error(`Node.js ${ver} is too old. Need >= 18.`);
  return ver;
});

check('Docker daemon', 'required', () => {
  try {
    const info = cmd('docker info --format "{{.ServerVersion}}"');
    return `Docker ${info}`;
  } catch {
    throw new Error('Docker is not running. Install Docker Desktop or start the daemon.');
  }
});

check('Docker image: atp-rental', 'required', () => {
  try {
    const id = cmd('docker images -q atp-rental');
    if (!id) throw new Error('missing');
    return `image ${id.slice(0, 12)}`;
  } catch {
    throw new Error('Docker image "atp-rental" not found. Build it with: cd docker && docker build -t atp-rental .');
  }
});

check('@hashgraph/sdk', 'required', () => {
  const sdkPath = path.join(WORKSPACE, 'node_modules', '@hashgraph', 'sdk');
  if (!fileExists(sdkPath)) throw new Error('Not installed. Run: npm install @hashgraph/sdk');
  const pkg = JSON.parse(fs.readFileSync(path.join(sdkPath, 'package.json'), 'utf8'));
  return `v${pkg.version}`;
});

check('Hedera operator key (Keychain)', 'required', () => {
  try {
    const key = cmd('security find-generic-password -s hedera-operator-key -w');
    if (!key || key.length < 30) throw new Error('key too short');
    return `${key.length} chars`;
  } catch {
    throw new Error('Hedera operator key not in macOS Keychain. Add with: security add-generic-password -s hedera-operator-key -a operator -w "<your-key>"');
  }
});

check('ATP Docker env file', 'required', () => {
  const envPath = path.join(WORKSPACE, 'docker', '.env');
  if (!fileExists(envPath)) throw new Error(`Missing ${envPath}. Copy from docker/.env.example and fill in values.`);
  return envPath;
});

check('Monitor state file', 'required', () => {
  const statePath = path.join(WORKSPACE, 'monitor', 'monitor-state.json');
  if (!fileExists(statePath)) throw new Error('Missing. Will be auto-created on first monitor start.');
  return 'exists';
});

// ── Soft Dependencies ───────────────────────────────────────────────────────

check('ChangeNOW API key (Keychain)', 'optional', () => {
  try {
    const key = cmd('security find-generic-password -s changenow-api-key -w');
    if (!key || key.length < 10) throw new Error('key too short');
    return `${key.length} chars (crypto rails enabled)`;
  } catch {
    throw new Error('Not found. Crypto payment rails (ETH/SOL/BTC/USDC/USDT) will be unavailable. Add with: security add-generic-password -s changenow-api-key -a changenow -w "<your-key>"');
  }
});

check('VAL wallet mnemonic (Keychain)', 'optional', () => {
  try {
    const mn = cmd('security find-generic-password -s val-wallet-mnemonic -w');
    if (!mn || mn.split(' ').length < 12) throw new Error('invalid mnemonic');
    return `${mn.split(' ').length} words`;
  } catch {
    throw new Error('Not found. Multi-chain wallet sends unavailable. Generate with: node lib/val-wallets.mjs generate');
  }
});

check('Coinbase CDP config', 'optional', () => {
  const cdpPath = path.join(WORKSPACE, 'coinbase-cdp.json');
  if (!fileExists(cdpPath)) throw new Error('Not found. Cash/card checkout onramp URL will be null.');
  try {
    const raw = JSON.parse(fs.readFileSync(cdpPath, 'utf8'));
    if (!raw.projectId) throw new Error('projectId missing');
    return `projectId=${raw.projectId.slice(0, 8)}...`;
  } catch (e) {
    throw new Error(`Invalid: ${e.message}`);
  }
});

check('Telegram rental bot token', 'optional', () => {
  const token = process.env.RENTAL_BOT_TOKEN;
  if (token) return `env var set (${token.length} chars)`;
  try {
    const kc = cmd('security find-generic-password -s rental-bot-token -w');
    if (kc && kc.length > 20) return `Keychain (${kc.length} chars)`;
  } catch {}
  throw new Error('No RENTAL_BOT_TOKEN env var or Keychain entry. Add with: security add-generic-password -s rental-bot-token -a atp -w "<token>"');
});

check('VAL relay (localhost:3141)', 'optional', () => {
  try {
    const res = cmd('curl -sS --connect-timeout 3 http://localhost:3141/v1/swap/estimate?from=eth');
    JSON.parse(res);
    return 'responding';
  } catch {
    throw new Error('VAL relay not running on :3141. Non-HBAR crypto rails will fail. Start with: node packages/val-relay/src/server.mjs');
  }
});

check('ATP monitor (localhost:3500)', 'optional', () => {
  try {
    const res = cmd('curl -sS --connect-timeout 3 http://localhost:3500/api/stats');
    const data = JSON.parse(res);
    return `active=${data.active} total=${data.total}`;
  } catch {
    throw new Error('ATP monitor not running on :3500. Start with: node monitor/atp-monitor.mjs');
  }
});

check('BTC libraries (bitcoinjs-lib)', 'optional', () => {
  const btcPath = path.join(WORKSPACE, 'node_modules', 'bitcoinjs-lib');
  if (!fileExists(btcPath)) throw new Error('Not installed. BTC rail test helper unavailable. Install with: npm install bitcoinjs-lib tiny-secp256k1 ecpair bip32');
  return 'installed';
});

check('PayPal credentials (Keychain)', 'optional', () => {
  try {
    const id = cmd('security find-generic-password -s paypal-client-id -w');
    const secret = cmd('security find-generic-password -s paypal-client-secret -w');
    if (!id || !secret) throw new Error('missing');
    const mode = process.env.PAYPAL_MODE || 'sandbox';
    return `${mode} mode, client_id ${id.length} chars`;
  } catch {
    throw new Error('Not found. PayPal/Venmo payment rail unavailable. Add with: security add-generic-password -s paypal-client-id -a atp -w "<client-id>" && security add-generic-password -s paypal-client-secret -a atp -w "<client-secret>"');
  }
});

check('viem (EVM library)', 'optional', () => {
  const viemPath = path.join(WORKSPACE, 'node_modules', 'viem');
  if (!fileExists(viemPath)) throw new Error('Not installed. EVM sends unavailable. Install with: npm install viem');
  const pkg = JSON.parse(fs.readFileSync(path.join(viemPath, 'package.json'), 'utf8'));
  return `v${pkg.version}`;
});

// ── Platform ────────────────────────────────────────────────────────────────

check('Platform', 'info', () => {
  const platform = process.platform;
  const arch = process.arch;
  if (platform !== 'darwin') {
    throw new Error(`${platform}/${arch} — macOS Keychain calls will fail. Cross-platform key storage not yet implemented.`);
  }
  return `${platform}/${arch}`;
});

// ── Output ──────────────────────────────────────────────────────────────────

if (JSON_MODE) {
  const required = results.filter(r => r.level === 'required');
  const optional = results.filter(r => r.level === 'optional');
  const info = results.filter(r => r.level === 'info');
  const allRequiredOk = required.every(r => r.ok);
  console.log(JSON.stringify({ allRequiredOk, required, optional, info }, null, 2));
  process.exit(allRequiredOk ? 0 : 1);
}

console.log('\n🩺 ATP Doctor — Preflight Check\n');

const groups = [
  { title: '🔴 Required', items: results.filter(r => r.level === 'required') },
  { title: '🟡 Optional', items: results.filter(r => r.level === 'optional') },
  { title: 'ℹ️  Info', items: results.filter(r => r.level === 'info') },
];

for (const group of groups) {
  console.log(`${group.title}:`);
  for (const r of group.items) {
    const icon = r.ok ? '✅' : '❌';
    console.log(`  ${icon} ${r.name}: ${r.detail}`);
  }
  console.log();
}

const requiredFails = results.filter(r => r.level === 'required' && !r.ok);
const optionalFails = results.filter(r => r.level === 'optional' && !r.ok);

if (requiredFails.length === 0 && optionalFails.length === 0) {
  console.log('🟢 All checks passed. ATP is ready to run.\n');
} else if (requiredFails.length === 0) {
  console.log(`🟡 ATP can run, but ${optionalFails.length} optional feature(s) are unavailable.\n`);
} else {
  console.log(`🔴 ${requiredFails.length} required dependency/ies missing. ATP will not start correctly.\n`);
}

process.exit(requiredFails.length > 0 ? 1 : 0);
