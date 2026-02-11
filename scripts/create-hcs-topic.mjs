#!/usr/bin/env node
/**
 * Create HCS Topic for ATP Rental Logging
 * Run with: op run -- node scripts/create-hcs-topic.mjs
 * Expects HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY env vars
 */
import { Client, TopicCreateTransaction, AccountId, PrivateKey } from "@hashgraph/sdk";

const operatorId = process.env.HEDERA_OPERATOR_ID || '0.0.8332371';
const operatorKey = process.env.HEDERA_OPERATOR_KEY;

if (!operatorKey) {
  console.error('❌ HEDERA_OPERATOR_KEY not set');
  process.exit(1);
}

const privKey = PrivateKey.fromStringECDSA(operatorKey);

const client = Client.forMainnet();
client.setOperator(AccountId.fromString(operatorId), privKey);

console.log(`Creating HCS topic on mainnet with operator ${operatorId}...`);

const tx = new TopicCreateTransaction()
  .setTopicMemo("ATP Rental Audit Log — Agent Trust Protocol v1.0")
  .setAdminKey(privKey.publicKey)
  .setSubmitKey(privKey.publicKey);

const response = await tx.execute(client);
const receipt = await response.getReceipt(client);
const topicId = receipt.topicId.toString();

console.log(`✅ Topic created: ${topicId}`);
console.log(`   View: https://hashscan.io/mainnet/topic/${topicId}`);
console.log(`   Memo: ATP Rental Audit Log — Agent Trust Protocol v1.0`);

client.close();
