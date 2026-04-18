#!/usr/bin/env node
/**
 * ATP Rental Logger - Quick Test Script
 *
 * Tests the ATP rental logger on testnet (or mainnet) to verify
 * that HCS messages are being submitted correctly.
 */

import { ATPRentalLogger } from './atp-rental-logger.mjs';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m'
};

function log(emoji, message, color = colors.reset) {
  console.log(`${color}${emoji} ${message}${colors.reset}`);
}

async function runTest() {
  const operatorId = process.env.HEDERA_OPERATOR_ID || '0.0.8332371';
  const operatorKey = process.env.HEDERA_OPERATOR_KEY;
  const network = process.env.ATP_NETWORK || 'mainnet';

  if (!operatorKey) {
    log('❌', 'HEDERA_OPERATOR_KEY environment variable required', colors.red);
    console.log('\nSet it with:');
    console.log('  export HEDERA_OPERATOR_KEY="your_private_key_here"');
    process.exit(1);
  }

  log('🧪', `Testing ATP Rental Logger on ${network}`, colors.blue);
  console.log();

  const logger = new ATPRentalLogger();

  try {
    // Step 1: Initialize
    log('1️⃣ ', 'Initializing logger...', colors.yellow);
    await logger.initialize(operatorId, operatorKey, network);
    log('✅', 'Logger initialized', colors.green);
    console.log();

    // Step 2: Init rental
    log('2️⃣ ', 'Logging rental initiation...', colors.yellow);
    const agentTopicId = '0.0.10261370'; // Aite's topic
    const renterId = '0.0.10255397';     // Test renter

    const initReceipt = await logger.initRental(
      agentTopicId,
      renterId,
      {
        tools_blocked: ['exec', 'wallet', 'message'],
        tools_allowed: ['web_search', 'web_fetch', 'read'],
        memory_access: 'sandboxed'
      },
      300,  // 5 minutes
      2.00, // $2 cap
      { rental_type: 'session' }
    );

    log('✅', `Rental initialized: ${initReceipt.rentalId}`, colors.green);
    log('📝', `Sequence: ${initReceipt.sequenceNumber}`, colors.blue);
    log('🔗', `View: https://hashscan.io/${network}/topic/${agentTopicId}`, colors.blue);
    console.log();

    // Step 3: Log interactions
    log('3️⃣ ', 'Logging test interactions...', colors.yellow);

    for (let i = 1; i <= 3; i++) {
      const interactionReceipt = await logger.logInteraction(
        agentTopicId,
        initReceipt.rentalId,
        `Test instruction ${i}: search for AI news`,
        `Here are the results for query ${i}...`,
        ['web_search'],
        0.05,
        {
          instructor: renterId,
          tokens_in: 50,
          tokens_out: 200,
          model: 'sonnet',
          duration_ms: 2000
        }
      );

      log('✅', `Interaction ${i} logged (seq: ${interactionReceipt.instructionSeq}, ${interactionReceipt.actionSeq})`, colors.green);

      // Small delay between interactions
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    console.log();

    // Step 4: Query status
    log('4️⃣ ', 'Querying rental status...', colors.yellow);

    // Give mirror node a moment to catch up
    await new Promise(resolve => setTimeout(resolve, 3000));

    const status = await logger.getRentalStatus(agentTopicId, initReceipt.rentalId);

    if (status.status !== 'not_found') {
      log('✅', `Status: ${status.status}`, colors.green);
      log('📊', `Messages: ${status.messageCount} | Interactions: ${status.interactions}`, colors.blue);
    } else {
      log('⚠️ ', 'Status not yet available on mirror node (may take a few seconds)', colors.yellow);
    }
    console.log();

    // Step 5: End rental
    log('5️⃣ ', 'Ending rental...', colors.yellow);

    const endReceipt = await logger.endRental(
      agentTopicId,
      initReceipt.rentalId,
      'completed',
      0.25,  // $0.25 total cost
      3,     // 3 interactions
      {
        terminated_by: 'system',
        duration_actual: 180,
        total_tokens: 750,
        total_minutes: 3
      }
    );

    log('✅', `Rental ended (seq: ${endReceipt.sequenceNumber})`, colors.green);
    console.log();

    // Summary
    log('🎉', 'All tests passed!', colors.green);
    console.log();
    console.log('Summary:');
    console.log(`  Rental ID: ${initReceipt.rentalId}`);
    console.log(`  Topic: ${agentTopicId}`);
    console.log(`  Messages logged: 7 (1 init + 3×2 interactions + 1 end)`);
    console.log(`  View: https://hashscan.io/${network}/topic/${agentTopicId}`);
    console.log();
    console.log('Next steps:');
    console.log('  1. Visit HashScan to verify messages');
    console.log('  2. Wire to OpenClaw rental flow');
    console.log('  3. Test with real Telegram group');
    console.log();

  } catch (error) {
    log('❌', `Test failed: ${error.message}`, colors.red);
    console.error(error);
    process.exit(1);
  } finally {
    logger.close();
  }
}

// Run the test
runTest().catch(console.error);
