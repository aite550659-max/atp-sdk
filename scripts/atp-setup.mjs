#!/usr/bin/env node
/**
 * ATP Setup — local bootstrap for a fresh ATP runtime checkout
 *
 * Creates the minimal local files/directories ATP expects, then runs
 * ATP Doctor and prints the remaining required / optional gaps.
 *
 * Usage:
 *   node scripts/atp-setup.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE = path.resolve(__dirname, '..');

const actions = [];

function ensureDir(dirPath) {
  if (fs.existsSync(dirPath)) return;
  fs.mkdirSync(dirPath, { recursive: true });
  actions.push(`created directory ${path.relative(WORKSPACE, dirPath)}`);
}

function ensureJsonFile(filePath, defaultValue) {
  if (fs.existsSync(filePath)) return;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
  actions.push(`initialized ${path.relative(WORKSPACE, filePath)}`);
}

function ensureFileFromTemplate(targetPath, templatePath) {
  if (fs.existsSync(targetPath) || !fs.existsSync(templatePath)) return;
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(templatePath, targetPath);
  actions.push(`copied ${path.relative(WORKSPACE, templatePath)} → ${path.relative(WORKSPACE, targetPath)}`);
}

function runDoctorJson() {
  const doctorPath = path.join(WORKSPACE, 'scripts', 'atp-doctor.mjs');
  const result = spawnSync(process.execPath, [doctorPath, '--json'], {
    cwd: WORKSPACE,
    encoding: 'utf8',
  });

  const output = (result.stdout || result.stderr || '').trim();
  if (!output) {
    throw new Error('ATP Doctor produced no output.');
  }

  try {
    return { exitCode: result.status ?? 1, report: JSON.parse(output) };
  } catch (e) {
    throw new Error(`ATP Doctor returned invalid JSON: ${e.message}\n${output}`);
  }
}

ensureDir(path.join(WORKSPACE, 'logs'));
ensureDir(path.join(WORKSPACE, 'monitor'));

ensureFileFromTemplate(
  path.join(WORKSPACE, 'docker', '.env'),
  path.join(WORKSPACE, 'docker', '.env.example')
);

ensureJsonFile(path.join(WORKSPACE, 'monitor', 'monitor-state.json'), {
  rentals: {},
  alerts: [],
  config: {
    maxConcurrentRentals: 5,
    defaultBudgetCap: 10.0,
    hcsTopicId: '0.0.10272696',
    alertWebhook: null,
    ownerTelegramId: '359827754',
  },
});

ensureJsonFile(path.join(WORKSPACE, 'monitor', 'deposit-state.json'), {
  lastTimestamp: '0',
  processedTxIds: [],
  pendingDeposits: {},
  activatedRentals: [],
  stats: { totalDeposits: 0, totalUsd: 0 },
});

ensureJsonFile(path.join(WORKSPACE, 'monitor', 'funding-state.json'), {
  intents: {},
  byMemo: {},
  stats: { totalIntents: 0, totalActivated: 0 },
  updatedAt: new Date().toISOString(),
});

console.log('\n🛠️  ATP Setup — Local Bootstrap\n');
if (actions.length === 0) {
  console.log('No local bootstrap changes were needed.');
} else {
  console.log('Applied:');
  for (const action of actions) console.log(`  ✅ ${action}`);
}

console.log();

const { report } = runDoctorJson();
const requiredFails = (report.required || []).filter(item => !item.ok);
const optionalFails = (report.optional || []).filter(item => !item.ok);

if (requiredFails.length === 0) {
  console.log('✅ Required ATP runtime dependencies are satisfied.');
} else {
  console.log(`❌ ${requiredFails.length} required dependency/ies still missing:`);
  for (const item of requiredFails) {
    console.log(`  - ${item.name}: ${item.detail}`);
  }
}

if (optionalFails.length > 0) {
  console.log(`\n⚠️  ${optionalFails.length} optional feature(s) still unavailable:`);
  for (const item of optionalFails) {
    console.log(`  - ${item.name}: ${item.detail}`);
  }
}

console.log('\nNext commands:');
console.log('  npm run atp:doctor');
console.log('  npm run atp:monitor');
console.log('  npm run atp:watcher');
console.log('  node scripts/rental-test.mjs');
console.log();

if (requiredFails.length > 0) {
  process.exit(1);
}
