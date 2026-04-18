#!/usr/bin/env node
/**
 * ATP v1.0 Reputation API
 *
 * Reads HCS topic 0.0.10272696, parses ATP messages, computes reputation.
 *
 * Usage:
 *   node reputation-api.mjs                              # Start API server on :3501
 *   node reputation-api.mjs --query agent 0.0.10255397   # CLI query
 *   node reputation-api.mjs --query renter 0.0.12345678
 *   node reputation-api.mjs --query summary
 */

import http from 'node:http';
import { URL } from 'node:url';

const HCS_TOPIC = '0.0.10272696';
const MIRROR_API = 'https://mainnet.mirrornode.hedera.com/api/v1';
const REFRESH_INTERVAL_MS = 60_000;
const PORT = 3501;

// ============================================================================
// DATA STORE
// ============================================================================

let cachedData = {
  messages: [],
  rentals: new Map(),
  lastFetch: null,
  error: null
};

// ============================================================================
// HCS DATA FETCHING
// ============================================================================

async function fetchAllMessages() {
  const messages = [];
  let nextLink = `${MIRROR_API}/topics/${HCS_TOPIC}/messages?limit=100&order=asc`;

  while (nextLink) {
    try {
      const res = await fetch(nextLink);
      if (!res.ok) {
        throw new Error(`Mirror node returned ${res.status}: ${await res.text()}`);
      }

      const json = await res.json();
      messages.push(...json.messages);

      // Check for pagination
      nextLink = json.links?.next
        ? `${MIRROR_API}${json.links.next}`
        : null;
    } catch (err) {
      console.error(`[ERROR] Failed to fetch messages: ${err.message}`);
      throw err;
    }
  }

  return messages;
}

function parseMessage(msg) {
  try {
    // Decode base64 message content
    const decoded = Buffer.from(msg.message, 'base64').toString('utf-8');
    const parsed = JSON.parse(decoded);

    return {
      ...parsed,
      consensus_timestamp: msg.consensus_timestamp,
      sequence_number: msg.sequence_number,
      payer_account_id: msg.payer_account_id
    };
  } catch (err) {
    console.warn(`[WARN] Failed to parse message ${msg.sequence_number}: ${err.message}`);
    return null;
  }
}

// ============================================================================
// REPUTATION COMPUTATION
// ============================================================================

function computeReputation(messages) {
  const rentals = new Map();

  // Aggregate messages by rental_id
  for (const msg of messages) {
    const parsed = parseMessage(msg);
    if (!parsed || !parsed.rental_id) continue;

    const rentalId = parsed.rental_id;
    const payerId = parsed.payer_account_id;

    if (!rentals.has(rentalId)) {
      rentals.set(rentalId, {
        rental_id: rentalId,
        instructions: [],
        end: null,
        refunds: [],
        agent_id: null,
        renter_id: null,
        payers: new Set()
      });
    }

    const rental = rentals.get(rentalId);
    rental.payers.add(payerId);

    switch (parsed.type) {
      case 'instruction':
        rental.instructions.push({
          timestamp: parsed.consensus_timestamp,
          payer: payerId,
          estimated_cost_usd: parsed.data?.estimated_cost_usd,
          cumulative_cost_usd: parsed.data?.cumulative_cost_usd,
          model: parsed.data?.model,
          tokens_in: parsed.data?.tokens_in,
          tokens_out: parsed.data?.tokens_out,
          tool_calls: parsed.data?.tool_calls
        });
        // Instruction messages are typically paid by the agent
        if (!rental.agent_id) {
          rental.agent_id = payerId;
        }
        break;

      case 'rental.end':
        rental.end = {
          timestamp: parsed.consensus_timestamp,
          payer: payerId,
          reason: parsed.data?.reason,
          terminated_by: parsed.data?.terminated_by,
          total_cost_usd: parsed.data?.total_cost_usd,
          interaction_count: parsed.data?.interaction_count,
          duration_sec: parsed.data?.duration_sec
        };
        break;

      case 'rental.refund':
        rental.refunds.push({
          timestamp: parsed.consensus_timestamp,
          payer: payerId,
          amount_hbar: parsed.data?.amount_hbar,
          amount_usd: parsed.data?.amount_usd,
          refund_to: parsed.data?.refund_to
        });
        break;
    }
  }

  // Second pass: infer renter from payers that aren't the agent
  for (const rental of rentals.values()) {
    const payers = Array.from(rental.payers);
    if (payers.length === 1) {
      // Only one payer = likely agent-only or test rental
      if (!rental.agent_id) rental.agent_id = payers[0];
    } else if (payers.length === 2) {
      // Two payers = agent and renter
      rental.renter_id = payers.find(p => p !== rental.agent_id);
    } else if (payers.length > 2) {
      // Multiple payers - use heuristic or mark as multi-party
      rental.renter_id = payers.find(p => p !== rental.agent_id) || null;
    }
  }

  return rentals;
}

function computeAgentReputation(accountId, rentals) {
  const agentRentals = Array.from(rentals.values())
    .filter(r => r.agent_id === accountId);

  if (agentRentals.length === 0) {
    return {
      account_id: accountId,
      total_rentals: 0,
      total_revenue_usd: 0,
      avg_session_duration_sec: 0,
      completion_rate: 0,
      avg_cost_per_interaction_usd: 0,
      rentals: []
    };
  }

  let totalRevenue = 0;
  let totalDuration = 0;
  let totalInteractions = 0;
  let completedCount = 0;
  let killedCount = 0;

  for (const rental of agentRentals) {
    if (rental.end) {
      totalRevenue += rental.end.total_cost_usd || 0;
      totalDuration += rental.end.duration_sec || 0;
      totalInteractions += rental.end.interaction_count || 0;

      if (rental.end.reason === 'completed' || rental.end.terminated_by === 'renter') {
        completedCount++;
      } else if (rental.end.terminated_by === 'agent') {
        killedCount++;
      }
    }
  }

  const completionRate = agentRentals.length > 0
    ? completedCount / agentRentals.length
    : 0;

  const avgDuration = agentRentals.length > 0
    ? totalDuration / agentRentals.length
    : 0;

  const avgCostPerInteraction = totalInteractions > 0
    ? totalRevenue / totalInteractions
    : 0;

  return {
    account_id: accountId,
    total_rentals: agentRentals.length,
    total_revenue_usd: parseFloat(totalRevenue.toFixed(4)),
    avg_session_duration_sec: parseFloat(avgDuration.toFixed(2)),
    completion_rate: parseFloat(completionRate.toFixed(4)),
    avg_cost_per_interaction_usd: parseFloat(avgCostPerInteraction.toFixed(4)),
    completed: completedCount,
    killed: killedCount,
    rentals: agentRentals.map(r => ({
      rental_id: r.rental_id,
      renter_id: r.renter_id,
      payers: Array.from(r.payers),
      instruction_count: r.instructions.length,
      end: r.end,
      refunds: r.refunds
    }))
  };
}

function computeRenterReputation(accountId, rentals) {
  const renterRentals = Array.from(rentals.values())
    .filter(r => r.renter_id === accountId);

  if (renterRentals.length === 0) {
    return {
      account_id: accountId,
      total_rentals: 0,
      total_spend_usd: 0,
      dispute_rate: 0,
      avg_session_length_sec: 0,
      rentals: []
    };
  }

  let totalSpend = 0;
  let totalDuration = 0;
  let disputeCount = 0;

  for (const rental of renterRentals) {
    if (rental.end) {
      totalSpend += rental.end.total_cost_usd || 0;
      totalDuration += rental.end.duration_sec || 0;
    }

    // Dispute = refund issued
    if (rental.refunds.length > 0) {
      disputeCount++;
    }
  }

  const disputeRate = renterRentals.length > 0
    ? disputeCount / renterRentals.length
    : 0;

  const avgSessionLength = renterRentals.length > 0
    ? totalDuration / renterRentals.length
    : 0;

  return {
    account_id: accountId,
    total_rentals: renterRentals.length,
    total_spend_usd: parseFloat(totalSpend.toFixed(4)),
    dispute_rate: parseFloat(disputeRate.toFixed(4)),
    avg_session_length_sec: parseFloat(avgSessionLength.toFixed(2)),
    disputes: disputeCount,
    rentals: renterRentals.map(r => ({
      rental_id: r.rental_id,
      agent_id: r.agent_id,
      payers: Array.from(r.payers),
      instruction_count: r.instructions.length,
      end: r.end,
      refunds: r.refunds
    }))
  };
}

function computeSummary(rentals) {
  const allRentals = Array.from(rentals.values());

  let totalRentals = allRentals.length;
  let totalRevenue = 0;
  let totalInteractions = 0;
  let totalRefunds = 0;
  let uniqueAgents = new Set();
  let uniqueRenters = new Set();

  for (const rental of allRentals) {
    if (rental.agent_id) uniqueAgents.add(rental.agent_id);
    if (rental.renter_id) uniqueRenters.add(rental.renter_id);

    if (rental.end) {
      totalRevenue += rental.end.total_cost_usd || 0;
      totalInteractions += rental.end.interaction_count || 0;
    }

    for (const refund of rental.refunds) {
      totalRefunds += refund.amount_usd || 0;
    }
  }

  return {
    total_rentals: totalRentals,
    unique_agents: uniqueAgents.size,
    unique_renters: uniqueRenters.size,
    total_revenue_usd: parseFloat(totalRevenue.toFixed(4)),
    total_refunds_usd: parseFloat(totalRefunds.toFixed(4)),
    total_interactions: totalInteractions,
    avg_cost_per_interaction_usd: totalInteractions > 0
      ? parseFloat((totalRevenue / totalInteractions).toFixed(4))
      : 0
  };
}

// ============================================================================
// CACHE REFRESH
// ============================================================================

async function refreshCache() {
  try {
    console.log(`[INFO] Fetching HCS messages from topic ${HCS_TOPIC}...`);
    const messages = await fetchAllMessages();
    console.log(`[INFO] Fetched ${messages.length} messages`);

    const rentals = computeReputation(messages);
    console.log(`[INFO] Computed reputation for ${rentals.size} rentals`);

    cachedData = {
      messages,
      rentals,
      lastFetch: new Date().toISOString(),
      error: null
    };
  } catch (err) {
    console.error(`[ERROR] Cache refresh failed: ${err.message}`);
    cachedData.error = err.message;
  }
}

function startAutoRefresh() {
  refreshCache(); // Initial fetch
  setInterval(refreshCache, REFRESH_INTERVAL_MS);
}

// ============================================================================
// HTTP SERVER
// ============================================================================

function handleRequest(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    if (url.pathname === '/api/reputation/agent' || url.pathname.startsWith('/api/reputation/agent/')) {
      const accountId = url.pathname.split('/').pop();
      if (!accountId || accountId === 'agent') {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Missing account ID' }));
        return;
      }

      const reputation = computeAgentReputation(accountId, cachedData.rentals);
      res.writeHead(200);
      res.end(JSON.stringify(reputation, null, 2));

    } else if (url.pathname === '/api/reputation/renter' || url.pathname.startsWith('/api/reputation/renter/')) {
      const accountId = url.pathname.split('/').pop();
      if (!accountId || accountId === 'renter') {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Missing account ID' }));
        return;
      }

      const reputation = computeRenterReputation(accountId, cachedData.rentals);
      res.writeHead(200);
      res.end(JSON.stringify(reputation, null, 2));

    } else if (url.pathname === '/api/reputation/summary') {
      const summary = computeSummary(cachedData.rentals);
      res.writeHead(200);
      res.end(JSON.stringify({
        ...summary,
        last_update: cachedData.lastFetch,
        error: cachedData.error
      }, null, 2));

    } else if (url.pathname === '/api/rentals') {
      const rentals = Array.from(cachedData.rentals.values()).map(r => ({
        ...r,
        payers: Array.from(r.payers)
      }));
      res.writeHead(200);
      res.end(JSON.stringify({
        count: rentals.length,
        rentals
      }, null, 2));

    } else if (url.pathname === '/health' || url.pathname === '/') {
      res.writeHead(200);
      res.end(JSON.stringify({
        status: 'ok',
        topic: HCS_TOPIC,
        last_update: cachedData.lastFetch,
        total_messages: cachedData.messages.length,
        total_rentals: cachedData.rentals.size,
        error: cachedData.error
      }, null, 2));

    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  } catch (err) {
    console.error(`[ERROR] Request handler error: ${err.message}`);
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
}

function startServer() {
  const server = http.createServer(handleRequest);

  server.listen(PORT, () => {
    console.log(`[INFO] ATP Reputation API listening on http://localhost:${PORT}`);
    console.log(`[INFO] Endpoints:`);
    console.log(`  GET /api/reputation/agent/:accountId`);
    console.log(`  GET /api/reputation/renter/:accountId`);
    console.log(`  GET /api/reputation/summary`);
    console.log(`  GET /api/rentals`);
    console.log(`  GET /health`);
  });

  startAutoRefresh();
}

// ============================================================================
// CLI MODE
// ============================================================================

async function cliQuery(type, accountId) {
  console.log(`[INFO] Fetching data...`);
  await refreshCache();

  if (cachedData.error) {
    console.error(`[ERROR] ${cachedData.error}`);
    process.exit(1);
  }

  let result;

  switch (type) {
    case 'agent':
      if (!accountId) {
        console.error('[ERROR] Missing account ID for agent query');
        process.exit(1);
      }
      result = computeAgentReputation(accountId, cachedData.rentals);
      break;

    case 'renter':
      if (!accountId) {
        console.error('[ERROR] Missing account ID for renter query');
        process.exit(1);
      }
      result = computeRenterReputation(accountId, cachedData.rentals);
      break;

    case 'summary':
      result = computeSummary(cachedData.rentals);
      result.last_update = cachedData.lastFetch;
      break;

    default:
      console.error(`[ERROR] Unknown query type: ${type}`);
      console.error('Valid types: agent, renter, summary');
      process.exit(1);
  }

  console.log('\n' + JSON.stringify(result, null, 2));
}

// ============================================================================
// MAIN
// ============================================================================

const args = process.argv.slice(2);

if (args.includes('--query')) {
  const queryIndex = args.indexOf('--query');
  const type = args[queryIndex + 1];
  const accountId = args[queryIndex + 2];

  cliQuery(type, accountId).catch(err => {
    console.error(`[ERROR] ${err.message}`);
    process.exit(1);
  });
} else {
  startServer();
}
