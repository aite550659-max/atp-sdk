import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_PATH = path.join(__dirname, 'funding-state.json');

function defaultState() {
  return {
    intents: {},
    byMemo: {},
    stats: { totalIntents: 0, totalActivated: 0 },
    updatedAt: new Date().toISOString()
  };
}

export function loadFundingState() {
  try {
    const data = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    return {
      intents: data.intents || {},
      byMemo: data.byMemo || {},
      stats: data.stats || { totalIntents: 0, totalActivated: 0 },
      updatedAt: data.updatedAt || new Date().toISOString()
    };
  } catch {
    return defaultState();
  }
}

export function saveFundingState(state) {
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(STORE_PATH, JSON.stringify(state, null, 2));
}

export function createFundingIntent(input) {
  const state = loadFundingState();
  const intentId = input.intentId || `fi_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const intent = {
    intentId,
    memo: input.memo,
    renterName: input.renterName,
    renterTelegramUserId: input.renterTelegramUserId ?? null,
    renterTelegramChatId: input.renterTelegramChatId ?? null,
    modelPreference: input.modelPreference || 'inherit_current',
    paymentMethod: input.paymentMethod || 'hbar',
    sourceChain: input.sourceChain || null,
    sourceAsset: input.sourceAsset || null,
    targetBudgetUsd: input.targetBudgetUsd ?? null,
    recommendedStarterUsd: input.recommendedStarterUsd ?? null,
    status: input.status || 'awaiting_payment',
    createdAt: new Date().toISOString(),
    expiresAt: input.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    metadata: input.metadata || {},
    history: [
      { at: new Date().toISOString(), status: input.status || 'awaiting_payment', note: 'intent_created' }
    ]
  };

  state.intents[intentId] = intent;
  if (intent.memo) state.byMemo[intent.memo] = intentId;
  state.stats.totalIntents = (state.stats.totalIntents || 0) + 1;
  saveFundingState(state);
  return intent;
}

export function getFundingIntent(intentId) {
  const state = loadFundingState();
  return state.intents[intentId] || null;
}

export function getFundingIntentByMemo(memo) {
  const state = loadFundingState();
  const intentId = state.byMemo[memo];
  return intentId ? state.intents[intentId] || null : null;
}

export function updateFundingIntent(intentId, patch = {}, note = '') {
  const state = loadFundingState();
  const intent = state.intents[intentId];
  if (!intent) return null;
  Object.assign(intent, patch);
  if (patch.memo && patch.memo !== intent.memo) state.byMemo[patch.memo] = intentId;
  if (patch.status) {
    intent.history = intent.history || [];
    intent.history.push({ at: new Date().toISOString(), status: patch.status, note: note || patch.status });
    if (patch.status === 'active') {
      state.stats.totalActivated = (state.stats.totalActivated || 0) + 1;
    }
  }
  saveFundingState(state);
  return intent;
}
