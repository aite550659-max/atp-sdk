#!/usr/bin/env node
/**
 * ATP Rental Status - Owner monitoring tool
 * Reports current rental session status, cost, and activity.
 * 
 * Usage: node scripts/rental-status.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(WORKSPACE, 'rental/hcs-config.json');
const WATERMARK_PATH = path.join(WORKSPACE, 'rental/hcs-watermark.json');
const SESSIONS_DIR = path.join(process.env.HOME, '.openclaw/agents/atp-rental/sessions');

// Load config
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const watermark = JSON.parse(fs.readFileSync(WATERMARK_PATH, 'utf8'));

// Find latest session
const sessionFiles = fs.readdirSync(SESSIONS_DIR)
  .filter(f => f.endsWith('.jsonl') && f !== 'sessions.json')
  .map(f => ({ name: f, mtime: fs.statSync(path.join(SESSIONS_DIR, f)).mtimeMs }))
  .sort((a, b) => b.mtime - a.mtime);

const latestSession = sessionFiles[0];
let interactionCount = 0;
let lastActivity = null;
let sessionActive = false;

if (latestSession) {
  const lines = fs.readFileSync(path.join(SESSIONS_DIR, latestSession.name), 'utf8')
    .split('\n').filter(Boolean);
  
  let lastTimestamp = null;
  for (const line of lines) {
    try {
      const d = JSON.parse(line);
      if (d.type === 'message' && d.message?.role === 'user') interactionCount++;
      if (d.timestamp) lastTimestamp = d.timestamp;
    } catch {}
  }
  
  lastActivity = lastTimestamp;
  const minutesAgo = lastTimestamp ? (Date.now() - new Date(lastTimestamp).getTime()) / 60000 : Infinity;
  sessionActive = minutesAgo < 30; // Consider active if activity within 30 min
}

const budgetUsed = watermark.cumulative_cost || 0;
const budgetCap = config.budget_cap_usd || 10;
const budgetRemaining = budgetCap - budgetUsed;
const budgetPct = ((budgetUsed / budgetCap) * 100).toFixed(1);

const status = {
  active: sessionActive,
  session: latestSession?.name || 'none',
  interactions: watermark.interaction_count || 0,
  totalInteractionsInSession: interactionCount,
  cost: {
    used: `$${budgetUsed.toFixed(4)}`,
    remaining: `$${budgetRemaining.toFixed(4)}`,
    cap: `$${budgetCap.toFixed(2)}`,
    percentage: `${budgetPct}%`
  },
  lastActivity: lastActivity || 'never',
  hcsTopic: config.hcs_topic_id,
  rentalId: watermark.rental_id || 'none',
  hashscan: `https://hashscan.io/mainnet/topic/${config.hcs_topic_id}`
};

console.log(JSON.stringify(status, null, 2));
