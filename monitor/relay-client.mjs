/**
 * VAL Relay Client — shared HTTP helpers for ChangeNOW swap operations.
 * Used by deposit-watcher.mjs and funding-rails.mjs.
 */

const RELAY_URL = process.env.VAL_RELAY_URL || 'http://localhost:3141';

export function getRelayUrl() {
  return RELAY_URL;
}

export async function swapEstimate(from, amount) {
  const url = new URL(`${RELAY_URL}/v1/swap/estimate`);
  url.searchParams.set('from', from);
  if (amount) url.searchParams.set('amount', String(amount));
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || `Estimate failed for ${from}`);
  return data;
}

export async function swapCreate(from, amount, accountId, payoutMemo) {
  const res = await fetch(`${RELAY_URL}/v1/swap/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, amount, accountId, payoutMemo }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || 'Swap creation failed');
  return data;
}

export async function swapStatus(swapId) {
  const url = new URL(`${RELAY_URL}/v1/swap/status`);
  url.searchParams.set('id', swapId);
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || `swap status failed for ${swapId}`);
  return data;
}
