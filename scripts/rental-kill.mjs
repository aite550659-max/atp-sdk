#!/usr/bin/env node
/**
 * ATP Rental Kill Switch - Owner termination tool
 * Logs a rental.end message to HCS and marks the session as terminated.
 * 
 * Usage: 
 *   HEDERA_OPERATOR_KEY=<key> node scripts/rental-kill.mjs [reason]
 *   Reasons: owner_terminated (default), budget_exceeded, timeout, abuse, error
 */
import { Client, TopicMessageSubmitTransaction, AccountId, PrivateKey, TopicId } from "@hashgraph/sdk";
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(WORKSPACE, 'rental/hcs-config.json');
const WATERMARK_PATH = path.join(WORKSPACE, 'rental/hcs-watermark.json');

const reason = process.argv[2] || 'owner_terminated';
const terminatedBy = reason === 'renter_terminated' ? 'renter' : 'owner';

// Load state
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const watermark = JSON.parse(fs.readFileSync(WATERMARK_PATH, 'utf8'));

if (!watermark.rental_id) {
  console.log('⚠️  No active rental to terminate.');
  process.exit(0);
}

const operatorKey = process.env.HEDERA_OPERATOR_KEY;
const operatorId = process.env.HEDERA_OPERATOR_ID || '0.0.10255397';

if (!operatorKey) {
  console.error('❌ HEDERA_OPERATOR_KEY required');
  process.exit(1);
}

// Build rental.end message
const rentalEnd = {
  atp: "1.0",
  type: "rental.end",
  ts: new Date().toISOString(),
  rental_id: watermark.rental_id,
  data: {
    reason,
    total_cost_usd: watermark.cumulative_cost || 0,
    interaction_count: watermark.interaction_count || 0,
    terminated_by: terminatedBy,
    duration_actual_sec: watermark.start_timestamp 
      ? Math.floor((Date.now() - watermark.start_timestamp) / 1000)
      : 0
  }
};

console.log('🛑 Terminating rental session...');
console.log(`   Rental ID: ${watermark.rental_id}`);
console.log(`   Reason: ${reason}`);
console.log(`   Total cost: $${(watermark.cumulative_cost || 0).toFixed(4)}`);
console.log(`   Interactions: ${watermark.interaction_count || 0}`);

// Submit to HCS
const privKey = PrivateKey.fromStringECDSA(operatorKey);
const client = Client.forMainnet();
client.setOperator(AccountId.fromString(operatorId), privKey);

const tx = new TopicMessageSubmitTransaction()
  .setTopicId(TopicId.fromString(config.hcs_topic_id))
  .setMessage(JSON.stringify(rentalEnd));

const response = await tx.execute(client);
const receipt = await response.getReceipt(client);

console.log(`\n✅ rental.end logged to HCS`);
console.log(`   Topic: ${config.hcs_topic_id}`);
console.log(`   Sequence: ${receipt.topicSequenceNumber.toString()}`);
console.log(`   View: https://hashscan.io/mainnet/topic/${config.hcs_topic_id}`);

// Reset watermark for next rental
const resetWatermark = {
  last_processed_line: 0,
  last_processed_timestamp: null,
  rental_id: null,
  cumulative_cost: 0,
  interaction_count: 0,
  last_terminated: {
    rental_id: watermark.rental_id,
    reason,
    terminated_at: new Date().toISOString(),
    total_cost: watermark.cumulative_cost || 0,
    interactions: watermark.interaction_count || 0
  }
};

fs.writeFileSync(WATERMARK_PATH, JSON.stringify(resetWatermark, null, 2));
console.log('\n📍 Watermark reset. Ready for next rental.');

client.close();
