#!/usr/bin/env node
/**
 * ATP Rental Sidecar - Cron Logger
 *
 * Polls the ATP rental agent's session history and logs new interactions
 * to Hedera Consensus Service (HCS) following ATP v1.0 schema.
 *
 * Designed to run as a standalone cron job:
 *   (every 5 minutes) node /path/to/rental-sidecar.mjs
 *
 * Environment variables:
 *   HEDERA_OPERATOR_KEY - Required. ECDSA private key for HCS submission
 *   HEDERA_OPERATOR_ID  - Optional. Defaults to 0.0.10255397
 *   DRY_RUN            - Optional. Set to '1' to skip HCS submission (testing)
 *
 * Files:
 *   rental/hcs-config.json      - Configuration (topic ID, budget cap, etc.)
 *   rental/hcs-watermark.json   - Tracks processing position
 *   agents/atp-rental/sessions/ - Session transcript JSONL files
 *
 * @see docs/AGENT_TRUST_PROTOCOL.md
 * @see docs/ATP_HCS_SCHEMA.md
 */

import {
  Client,
  TopicMessageSubmitTransaction,
  AccountId,
  PrivateKey,
  TopicId
} from "@hashgraph/sdk";
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve paths
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(WORKSPACE, 'rental/hcs-config.json');
const WATERMARK_PATH = path.join(WORKSPACE, 'rental/hcs-watermark.json');
const SESSIONS_DIR = path.join(process.env.HOME, '.openclaw/agents/atp-rental/sessions');

/**
 * Main sidecar runner
 */
async function main() {
  console.log('🚀 ATP Rental Sidecar starting...');
  console.log(`   Workspace: ${WORKSPACE}`);
  console.log(`   Time: ${new Date().toISOString()}\n`);

  try {
    // 1. Load configuration
    const config = loadConfig();
    console.log(`✅ Config loaded: Topic ${config.hcs_topic_id}, Budget cap $${config.budget_cap_usd}`);

    // 2. Load watermark
    let watermark = loadWatermark();
    console.log(`📍 Watermark: Line ${watermark.last_processed_line}, Cost $${watermark.cumulative_cost.toFixed(4)}, Interactions: ${watermark.interaction_count}\n`);

    // 3. Check budget cap
    if (watermark.cumulative_cost >= config.budget_cap_usd) {
      console.warn(`⚠️  BUDGET CAP EXCEEDED: $${watermark.cumulative_cost.toFixed(2)} >= $${config.budget_cap_usd}`);
      console.warn('    No further interactions will be logged until budget is reset.\n');
      process.exit(0);
    }

    // 4. Get operator credentials
    const isDryRun = process.env.DRY_RUN === '1';
    const operatorId = process.env.HEDERA_OPERATOR_ID || config.hedera_operator_id || '0.0.10255397';
    const operatorKey = process.env.HEDERA_OPERATOR_KEY;

    if (!operatorKey && !isDryRun) {
      console.error('❌ HEDERA_OPERATOR_KEY environment variable is required');
      console.error('   Load from 1Password: export HEDERA_OPERATOR_KEY=$(op read "op://Personal/Hashpack Private Key/password")');
      console.error('   Or run in dry-run mode: DRY_RUN=1 node scripts/rental-sidecar.mjs');
      process.exit(1);
    }

    // 5. Initialize Hedera client
    let client = null;
    if (!isDryRun) {
      client = Client.forMainnet();
      client.setOperator(
        AccountId.fromString(operatorId),
        PrivateKey.fromStringECDSA(operatorKey)
      );
      console.log(`🔑 Hedera client initialized: ${operatorId}\n`);
    } else {
      console.log(`🧪 DRY RUN MODE - No HCS submissions will be made\n`);
    }

    // 6. Find session file (prefer watermark's pinned session, then latest)
    const sessionFile = watermark.session_file
      ? path.join(SESSIONS_DIR, watermark.session_file)
      : findLatestSessionFile();
    if (!sessionFile || !fs.existsSync(sessionFile)) {
      console.log('ℹ️  No session files found. Nothing to process.\n');
      if (client) client.close();
      process.exit(0);
    }
    console.log(`📄 Reading session: ${path.basename(sessionFile)}`);

    // 7. Parse new interactions
    const interactions = parseNewInteractions(sessionFile, watermark);
    if (interactions.length === 0) {
      console.log('✅ No new interactions to log. Up to date.\n');
      if (client) client.close();
      process.exit(0);
    }

    console.log(`💬 Found ${interactions.length} new interaction(s) to log\n`);

    // 8. Submit interactions to HCS
    let processedCount = 0;
    let totalCost = watermark.cumulative_cost;
    let interactionCount = watermark.interaction_count;

    for (const interaction of interactions) {
      // Check budget before submitting
      if (totalCost + interaction.cost >= config.budget_cap_usd) {
        console.warn(`⚠️  Budget cap would be exceeded. Stopping at interaction ${processedCount + 1}.`);
        console.warn(`   Current: $${totalCost.toFixed(4)} + $${interaction.cost.toFixed(4)} >= $${config.budget_cap_usd}`);
        break;
      }

      try {
        // Build ATP message
        const atpMessage = buildATPMessage(
          interaction,
          watermark.rental_id,
          totalCost + interaction.cost,
          config.hcs_topic_id
        );

        // Submit to HCS (or simulate in dry run)
        let receipt;
        if (!isDryRun) {
          receipt = await submitToHCS(
            client,
            config.hcs_topic_id,
            atpMessage
          );
        } else {
          receipt = { sequenceNumber: 'DRY_RUN', transactionId: 'DRY_RUN' };
          console.log(`   🧪 Would submit: ${JSON.stringify(atpMessage, null, 2)}`);
        }

        // Update running totals
        totalCost += interaction.cost;
        interactionCount += 1;
        processedCount += 1;

        console.log(`   ✓ Interaction ${processedCount}: Seq ${receipt.sequenceNumber} | Tools: ${interaction.tools.join(', ') || 'none'} | Cost: $${interaction.cost.toFixed(4)}`);

      } catch (error) {
        console.error(`   ✗ Failed to submit interaction ${processedCount + 1}:`, error.message);
        // Continue processing remaining interactions
      }
    }

    // 9. Update watermark
    if (processedCount > 0) {
      watermark.last_processed_line = interactions[processedCount - 1].lineNumber;
      watermark.last_processed_timestamp = interactions[processedCount - 1].timestamp;
      watermark.cumulative_cost = totalCost;
      watermark.interaction_count = interactionCount;

      if (!watermark.rental_id && interactions.length > 0) {
        // First interaction - set rental ID
        watermark.rental_id = interactions[0].rental_id || generateRentalId();
      }

      saveWatermark(watermark);
      console.log(`\n📍 Watermark updated: Line ${watermark.last_processed_line}, Cost $${watermark.cumulative_cost.toFixed(4)}`);
    }

    // 10. Post stats to monitor
    if (processedCount > 0 && watermark.rental_id) {
      await postToMonitor(watermark);
    }

    // 11. Cleanup
    if (client) {
      client.close();
    }
    console.log(`\n✅ Sidecar complete. Processed ${processedCount} interaction(s).${isDryRun ? ' (DRY RUN)' : ''}\n`);
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Sidecar failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

/**
 * Load HCS configuration
 */
function loadConfig() {
  try {
    const content = fs.readFileSync(CONFIG_PATH, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`❌ Failed to load config from ${CONFIG_PATH}:`, error.message);
    throw error;
  }
}

/**
 * Load processing watermark
 */
function loadWatermark() {
  try {
    const content = fs.readFileSync(WATERMARK_PATH, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // Watermark doesn't exist, create default
      const defaultWatermark = {
        last_processed_line: 0,
        last_processed_timestamp: null,
        rental_id: null,
        cumulative_cost: 0,
        interaction_count: 0
      };
      saveWatermark(defaultWatermark);
      return defaultWatermark;
    }
    console.error(`❌ Failed to load watermark from ${WATERMARK_PATH}:`, error.message);
    throw error;
  }
}

/**
 * Save watermark to disk
 */
function saveWatermark(watermark) {
  try {
    fs.writeFileSync(WATERMARK_PATH, JSON.stringify(watermark, null, 2), 'utf8');
  } catch (error) {
    console.error(`❌ Failed to save watermark to ${WATERMARK_PATH}:`, error.message);
    throw error;
  }
}

/**
 * Find the most recent session file
 * Returns the path to the newest .jsonl file (excluding sessions.json)
 */
function findLatestSessionFile() {
  try {
    if (!fs.existsSync(SESSIONS_DIR)) {
      console.warn(`⚠️  Sessions directory not found: ${SESSIONS_DIR}`);
      return null;
    }

    const files = fs.readdirSync(SESSIONS_DIR)
      .filter(f => f.endsWith('.jsonl') && f !== 'sessions.jsonl')
      .map(f => ({
        name: f,
        path: path.join(SESSIONS_DIR, f),
        mtime: fs.statSync(path.join(SESSIONS_DIR, f)).mtime
      }))
      .sort((a, b) => b.mtime - a.mtime); // Newest first

    return files.length > 0 ? files[0].path : null;

  } catch (error) {
    console.error('❌ Failed to find session files:', error.message);
    return null;
  }
}

/**
 * Parse new interactions from session file
 * Returns array of interaction objects with user/assistant message pairs
 */
function parseNewInteractions(sessionFile, watermark) {
  const interactions = [];
  let lineNumber = 0;
  let pendingUserMessage = null;

  try {
    const content = fs.readFileSync(sessionFile, 'utf8');
    const lines = content.split('\n');

    for (const line of lines) {
      lineNumber++;

      // Skip lines we've already processed
      if (lineNumber <= watermark.last_processed_line) {
        continue;
      }

      if (!line.trim()) {
        continue;
      }

      try {
        const entry = JSON.parse(line);

        // We're looking for message entries with role
        if (entry.type !== 'message' || !entry.message || !entry.message.role) {
          continue;
        }

        const message = entry.message;

        if (message.role === 'user') {
          // Store user message, wait for assistant response
          pendingUserMessage = {
            lineNumber,
            timestamp: entry.timestamp,
            content: extractTextContent(message.content),
            messageId: entry.id
          };

        } else if (message.role === 'assistant' && pendingUserMessage) {
          // We have a complete interaction pair
          const assistantContent = extractTextContent(message.content);
          const toolCalls = extractToolCalls(message.content);

          // Calculate cost from usage
          const cost = message.usage?.cost?.total || 0;

          interactions.push({
            lineNumber,
            timestamp: entry.timestamp,
            userPrompt: pendingUserMessage.content,
            agentResponse: assistantContent,
            tools: toolCalls,
            cost: cost,
            model: message.model || 'unknown',
            tokens_in: message.usage?.input || 0,
            tokens_out: message.usage?.output || 0,
            rental_id: extractRentalId(pendingUserMessage.content) || watermark.rental_id
          });

          // Clear pending message
          pendingUserMessage = null;
        }

      } catch (parseError) {
        // Skip malformed lines
        continue;
      }
    }

  } catch (error) {
    console.error(`❌ Failed to parse session file:`, error.message);
    throw error;
  }

  return interactions;
}

/**
 * Extract text content from message content array
 */
function extractTextContent(contentArray) {
  if (!Array.isArray(contentArray)) {
    return '';
  }

  return contentArray
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('\n')
    .trim();
}

/**
 * Extract tool calls from assistant message content
 */
function extractToolCalls(contentArray) {
  if (!Array.isArray(contentArray)) {
    return [];
  }

  const tools = contentArray
    .filter(block => block.type === 'tool_use')
    .map(block => block.name);

  return [...new Set(tools)]; // Deduplicate
}

/**
 * Extract rental ID from user message (if present in channel metadata)
 */
function extractRentalId(userContent) {
  // Rental ID might be embedded in Telegram channel metadata
  // For now, return null and let it be auto-generated
  return null;
}

/**
 * Generate a unique rental ID
 */
function generateRentalId() {
  return `rental_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Build ATP v1.0 schema message
 */
function buildATPMessage(interaction, rentalId, cumulativeCost, topicId) {
  // Hash the instruction and response for privacy
  const instructionHash = sha256(interaction.userPrompt);
  const responseHash = sha256(interaction.agentResponse);

  return {
    atp: "1.0",
    type: "instruction",
    ts: interaction.timestamp,
    rental_id: rentalId || generateRentalId(),
    data: {
      instruction_hash: instructionHash,
      response_hash: responseHash,
      tool_calls: interaction.tools,
      estimated_cost_usd: interaction.cost,
      cumulative_cost_usd: cumulativeCost,
      model: interaction.model,
      tokens_in: interaction.tokens_in,
      tokens_out: interaction.tokens_out
    }
  };
}

/**
 * SHA-256 hash (for privacy-preserving logging)
 */
function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Submit message to HCS topic
 */
async function submitToHCS(client, topicId, message) {
  try {
    const messageJson = JSON.stringify(message);

    const tx = new TopicMessageSubmitTransaction()
      .setTopicId(TopicId.fromString(topicId))
      .setMessage(messageJson)
      .setMaxTransactionFee(1); // 1 HBAR max

    const response = await tx.execute(client);
    const receipt = await response.getReceipt(client);

    return {
      sequenceNumber: receipt.topicSequenceNumber.toNumber(),
      transactionId: response.transactionId.toString(),
      consensusTimestamp: receipt.consensusTimestamp
    };

  } catch (error) {
    console.error('❌ HCS submission failed:', error.message);
    throw error;
  }
}

/**
 * Post accumulated stats to ATP Monitor API
 */
const MONITOR_URL = process.env.MONITOR_URL || 'http://localhost:3500';

async function postToMonitor(watermark) {
  try {
    const body = JSON.stringify({
      cost: watermark.cumulative_cost,
      interactions: watermark.interaction_count,
      lastUpdate: new Date().toISOString()
    });

    const res = await fetch(`${MONITOR_URL}/api/rentals/${watermark.rental_id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(5000)
    });

    if (res.ok) {
      console.log(`📡 Monitor updated: $${watermark.cumulative_cost.toFixed(4)}, ${watermark.interaction_count} interactions`);
    } else {
      console.warn(`⚠️  Monitor responded ${res.status} — stats not synced (non-fatal)`);
    }
  } catch (err) {
    // Non-fatal — monitor might not be running
    console.warn(`⚠️  Could not reach monitor at ${MONITOR_URL}: ${err.message}`);
  }
}

// Run main function
main().catch(error => {
  console.error('💥 Unhandled error:', error);
  process.exit(1);
});
