#!/usr/bin/env node
/**
 * Test Suite for New Safeguards
 * Tests safeguards 1, 2, and 3:
 * 1. Task Deduplication (fingerprint-based)
 * 2. Execution Counter (max 4 attempts)
 * 3. Idempotency Check (1-hour window)
 */

const WorkQueue = require('../lib/work-queue.js');
const AutonomousLoop = require('../lib/autonomous-loop.js');
const fs = require('fs');
const path = require('path');

// Backup and restore queue file
const QUEUE_PATH = path.join(process.env.HOME, '.openclaw/workspace/data/work-queue.json');
const BACKUP_PATH = QUEUE_PATH + '.test-backup';

function backupQueue() {
  if (fs.existsSync(QUEUE_PATH)) {
    fs.copyFileSync(QUEUE_PATH, BACKUP_PATH);
    console.log('✅ Queue backed up');
  }
}

function restoreQueue() {
  if (fs.existsSync(BACKUP_PATH)) {
    fs.copyFileSync(BACKUP_PATH, QUEUE_PATH);
    fs.unlinkSync(BACKUP_PATH);
    console.log('✅ Queue restored');
  }
}

function cleanupQueue() {
  if (fs.existsSync(QUEUE_PATH)) {
    fs.unlinkSync(QUEUE_PATH);
    console.log('✅ Queue cleaned');
  }
}

// Test utilities
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('🧪 TESTING NEW SAFEGUARDS (1, 2, 3)\n');
  console.log('═══════════════════════════════════════\n');

  try {
    backupQueue();
    cleanupQueue();

    // TEST 1: Task Deduplication (Safeguard 1)
    console.log('TEST 1: Task Deduplication (Fingerprint-based)');
    console.log('───────────────────────────────────────');
    {
      const queue = new WorkQueue();

      const task1 = {
        id: 'test-dup-1',
        description: 'Check email inbox',
        priority: 5,
        category: 'communication',
        tags: ['email']
      };

      const task2 = {
        id: 'test-dup-2',
        description: 'Check email inbox', // Same description
        priority: 6, // Different priority
        category: 'communication',
        tags: ['email']
      };

      const result1 = queue.add(task1);
      console.log(`   Added task 1: ${result1.id}`);

      const result2 = queue.add(task2);
      console.log(`   Attempted task 2: ${result2.id}`);

      if (result1.id === result2.id) {
        console.log('   ✅ PASS: Duplicate blocked, returned existing task\n');
      } else {
        console.log('   ❌ FAIL: Duplicate was not blocked\n');
      }
    }

    // TEST 2: Execution Counter (Safeguard 2)
    console.log('TEST 2: Execution Counter (Max 4 Attempts)');
    console.log('───────────────────────────────────────');
    {
      cleanupQueue();
      const queue = new WorkQueue();

      const task = {
        id: 'test-attempts',
        description: 'Task that will fail',
        priority: 5,
        category: 'test',
        estimatedMinutes: 1
      };

      queue.add(task);
      console.log(`   Added task: ${task.id}`);

      // Simulate 4 failed attempts
      for (let i = 1; i <= 4; i++) {
        queue.updateStatus(task.id, 'in-progress');
        console.log(`   Attempt ${i}: in-progress`);

        queue.updateStatus(task.id, 'failed', 'Simulated failure');
        console.log(`   Attempt ${i}: failed`);

        const taskData = queue.queue.tasks.find(t => t.id === task.id);
        if (i < 4 && taskData) {
          console.log(`   → Task status: ${taskData.status} (attempts: ${taskData.attempts})`);
        } else if (i === 4) {
          if (!taskData) {
            console.log(`   → Task moved to completed (permanently failed)`);
          }
        }
      }

      // Try to get the task - should be gone or marked failed
      const nextTask = queue.getNext();
      if (nextTask?.id !== task.id) {
        console.log('   ✅ PASS: Task blocked after 4 attempts\n');
      } else {
        console.log('   ❌ FAIL: Task still available after 4 attempts\n');
      }
    }

    // TEST 3: Idempotency Check (Safeguard 3)
    console.log('TEST 3: Idempotency Check (1-hour window)');
    console.log('───────────────────────────────────────');
    {
      cleanupQueue();
      const queue = new WorkQueue();

      const task = {
        id: 'test-idempotency',
        description: 'Recent task check',
        priority: 5,
        category: 'test'
      };

      // Add and complete the task
      queue.add(task);
      console.log(`   Added task: ${task.id}`);

      queue.updateStatus(task.id, 'in-progress');
      queue.updateStatus(task.id, 'completed', 'Success');
      console.log(`   Completed task: ${task.id}`);

      // Try to add the same task again (should be blocked)
      const task2 = {
        id: 'test-idempotency-2',
        description: 'Recent task check', // Same description
        priority: 5,
        category: 'test'
      };

      const result = queue.add(task2);
      console.log(`   Attempted to add duplicate: ${task2.id}`);
      console.log(`   Result ID: ${result.id}`);

      if (result.id === task.id) {
        console.log('   ✅ PASS: Idempotency check blocked recent duplicate\n');
      } else {
        console.log('   ❌ FAIL: Idempotency check did not block\n');
      }
    }

    // TEST 4: Combined Safeguards
    console.log('TEST 4: Combined Safeguards Integration');
    console.log('───────────────────────────────────────');
    {
      cleanupQueue();
      const queue = new WorkQueue();

      // Add multiple tasks
      const tasks = [
        {
          id: 'task-a',
          description: 'Task A',
          priority: 10,
          category: 'test',
          estimatedMinutes: 2
        },
        {
          id: 'task-b',
          description: 'Task B',
          priority: 8,
          category: 'test',
          estimatedMinutes: 2
        },
        {
          id: 'task-c',
          description: 'Task A', // Duplicate of task-a
          priority: 7,
          category: 'test',
          estimatedMinutes: 2
        }
      ];

      const results = tasks.map(t => queue.add(t));
      console.log(`   Added ${results.length} tasks`);

      const stats = queue.stats();
      console.log(`   Queue stats: ${stats.pending} pending, ${stats.completed} completed`);

      if (stats.pending === 2) { // task-a and task-b only (task-c blocked)
        console.log('   ✅ PASS: Deduplication working in multi-task scenario\n');
      } else {
        console.log(`   ❌ FAIL: Expected 2 pending, got ${stats.pending}\n`);
      }
    }

    // TEST 5: Fingerprint Generation Consistency
    console.log('TEST 5: Fingerprint Generation Consistency');
    console.log('───────────────────────────────────────');
    {
      const queue = new WorkQueue();

      const task1 = {
        description: '  Check EMAIL inbox  ', // Extra spaces, different case
        category: 'communication',
        tags: ['urgent', 'email']
      };

      const task2 = {
        description: 'check email inbox',
        category: 'communication',
        tags: ['email', 'urgent'] // Different order
      };

      const fp1 = queue.generateFingerprint(task1);
      const fp2 = queue.generateFingerprint(task2);

      console.log(`   Fingerprint 1: ${fp1}`);
      console.log(`   Fingerprint 2: ${fp2}`);

      if (fp1 === fp2) {
        console.log('   ✅ PASS: Fingerprints normalized correctly\n');
      } else {
        console.log('   ❌ FAIL: Fingerprints should match\n');
      }
    }

    // TEST 6: Autonomous Loop Integration
    console.log('TEST 6: Autonomous Loop Integration');
    console.log('───────────────────────────────────────');
    {
      cleanupQueue();
      const loop = new AutonomousLoop();

      // Add a simple task
      loop.queue.add({
        id: 'test-loop-task',
        description: 'Simple test task',
        priority: 5,
        category: 'test',
        estimatedMinutes: 1
      });

      console.log('   Added task to queue');
      console.log('   Running autonomous loop (1 minute)...');

      // Override actuallyExecuteTask to return immediately
      loop.actuallyExecuteTask = async (task) => {
        return {
          summary: 'Test execution',
          executedAt: new Date().toISOString()
        };
      };

      const results = await loop.executeIdleWork(1);

      console.log(`   Tasks executed: ${results.tasksExecuted}`);
      console.log(`   Tasks completed: ${results.tasksCompleted}`);
      console.log(`   Tasks failed: ${results.tasksFailed}`);

      if (results.tasksCompleted === 1) {
        console.log('   ✅ PASS: Loop executed task successfully\n');
      } else {
        console.log('   ❌ FAIL: Loop did not execute task\n');
      }
    }

    console.log('═══════════════════════════════════════');
    console.log('🎉 ALL TESTS COMPLETE\n');

  } catch (error) {
    console.error('❌ TEST SUITE ERROR:', error.message);
    console.error(error.stack);
  } finally {
    restoreQueue();
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
