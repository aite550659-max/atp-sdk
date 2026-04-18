#!/usr/bin/env node
/**
 * Test autonomous loop safeguards
 */

const AutonomousLoop = require('../lib/autonomous-loop.js');
const WorkQueue = require('../lib/work-queue.js');

async function testExecutionLock() {
  console.log('\n═══ TEST 1: Execution Lock ═══\n');

  const loop = new AutonomousLoop();

  // Start first execution (in background)
  const promise1 = loop.executeIdleWork(1);

  // Try to start second execution immediately
  const result2 = await loop.executeIdleWork(1);

  if (result2.skipped && result2.reason === 'already_running') {
    console.log('✅ PASS: Second execution blocked while first running\n');
  } else {
    console.log('❌ FAIL: Second execution was not blocked\n');
  }

  // Wait for first to complete
  await promise1;
}

async function testRateLimiting() {
  console.log('\n═══ TEST 2: Rate Limiting ═══\n');

  const loop = new AutonomousLoop();

  // First execution
  await loop.executeIdleWork(0.1); // 6 seconds

  // Immediate second execution
  const result = await loop.executeIdleWork(0.1);

  if (result.skipped && result.reason === 'rate_limited') {
    console.log('✅ PASS: Rate limiting enforced (5 min minimum)\n');
  } else {
    console.log('❌ FAIL: Rate limiting not working\n');
  }
}

async function testCircuitBreaker() {
  console.log('\n═══ TEST 3: Circuit Breaker ═══\n');

  const loop = new AutonomousLoop();

  // Force 5 failures
  loop.failureCount = 5;

  const result = await loop.executeIdleWork(1);

  if (result.blocked && result.reason === 'circuit_breaker') {
    console.log('✅ PASS: Circuit breaker opened after 5 failures\n');
  } else {
    console.log('❌ FAIL: Circuit breaker not working\n');
  }
}

async function testQueueLimit() {
  console.log('\n═══ TEST 4: Queue Size Limit ═══\n');

  const queue = new WorkQueue();

  // Add tasks up to limit
  try {
    for (let i = 0; i < 51; i++) {
      queue.add({
        id: `test-task-${i}`,
        description: `Test task ${i}`,
        priority: 5,
        category: 'test'
      });
    }
    console.log('❌ FAIL: Queue accepted more than max (50) tasks\n');
  } catch (error) {
    if (error.message.includes('Queue full')) {
      console.log('✅ PASS: Queue rejected task at limit (50)\n');
    } else {
      console.log(`❌ FAIL: Wrong error: ${error.message}\n`);
    }
  }

  // Cleanup
  queue.queue.tasks = [];
  queue.save();
}

async function testTaskTimeout() {
  console.log('\n═══ TEST 5: Task Timeout ═══\n');

  const loop = new AutonomousLoop();

  // Create task with very short timeout
  const task = {
    id: 'timeout-test',
    description: 'Should timeout',
    priority: 5,
    category: 'test',
    estimatedMinutes: 0.01 // 0.6 seconds (+ 2 min buffer = 2.6 min timeout)
  };

  // Mock execution that takes too long
  loop.actuallyExecuteTask = async () => {
    await new Promise(resolve => setTimeout(resolve, 200000)); // 200 seconds
  };

  try {
    await loop.executeTask(task);
    console.log('❌ FAIL: Task did not timeout\n');
  } catch (error) {
    if (error.message.includes('timeout')) {
      console.log('✅ PASS: Task timeout enforced\n');
    } else {
      console.log(`❌ FAIL: Wrong error: ${error.message}\n`);
    }
  }
}

async function testLockRelease() {
  console.log('\n═══ TEST 6: Lock Release on Error ═══\n');

  const loop = new AutonomousLoop();

  // Force an error during execution
  loop.checkRevenue = async () => {
    throw new Error('Simulated error');
  };

  try {
    await loop.executeIdleWork(0.1);
  } catch (error) {
    // Expected to throw
  }

  // Check if lock was released
  if (!loop.isRunning) {
    console.log('✅ PASS: Lock released even after error\n');
  } else {
    console.log('❌ FAIL: Lock not released after error\n');
  }
}

// Run all tests
(async () => {
  console.log('\n🧪 AUTONOMOUS LOOP SAFEGUARD TESTS\n');
  console.log('Testing safety mechanisms...\n');

  try {
    await testExecutionLock();
    await testRateLimiting();
    await testCircuitBreaker();
    await testQueueLimit();
    await testTaskTimeout();
    await testLockRelease();

    console.log('\n═══════════════════════════════════');
    console.log('✅ ALL SAFEGUARD TESTS COMPLETE');
    console.log('═══════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ TEST SUITE FAILED:', error.message, '\n');
    process.exit(1);
  }
})();
