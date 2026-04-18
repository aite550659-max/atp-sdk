#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import { PrivateKey } from '@hashgraph/sdk';
import { ATPRentalLogger } from './atp-rental-logger.mjs';

class MockATPRentalLogger extends ATPRentalLogger {
  constructor() {
    super();
    this.submitted = [];
  }

  async _submitMessage(topicId, message) {
    this.submitted.push({ topicId, message });
    return {
      topicId,
      sequenceNumber: this.submitted.length,
      consensusTimestamp: new Date().toISOString()
    };
  }
}

function makeLogger() {
  const logger = new MockATPRentalLogger();
  logger.operatorId = { toString: () => '0.0.12345' };
  logger.operatorKey = PrivateKey.generateECDSA();
  logger.network = 'testnet';
  logger.initialized = true;
  return logger;
}

test('initRental emits signed ATP v2.1 rental_initiated with self_declared enforcement', async () => {
  const logger = makeLogger();

  const receipt = await logger.initRental(
    '0.0.99999',
    '0.0.88888',
    {
      tools_blocked: ['exec'],
      memory_access: 'sandboxed'
    },
    300,
    2.5,
    {}
  );

  assert.equal(receipt.rentalId.startsWith('rental_'), true);
  assert.equal(logger.submitted.length, 1);

  const envelope = logger.submitted[0].message;
  assert.equal(envelope.atp_version, '2.1');
  assert.equal(envelope.message_type, 'rental_initiated');
  assert.equal(envelope.agent_id, '0.0.99999');
  assert.equal(envelope.payload.constraints.enforcement, 'self_declared');
  assert.ok(envelope.sig);

  const publicKey = logger.operatorKey.publicKey.toString();
  const verification = logger.verifyEnvelope(envelope, publicKey);
  assert.equal(verification.valid, true);
});

test('logInteraction emits rental_instruction and runtime_attestation', async () => {
  const logger = makeLogger();

  await logger.logInteraction(
    '0.0.99999',
    'rental_abc',
    'search for ATP news',
    'here are the results',
    ['web_search'],
    0.05,
    {
      instructor: '0.0.88888',
      tokens_in: 50,
      tokens_out: 100,
      model: 'sonnet',
      duration_ms: 1200
    }
  );

  assert.equal(logger.submitted.length, 2);

  const [instruction, runtime] = logger.submitted.map((x) => x.message);
  assert.equal(instruction.message_type, 'rental_instruction');
  assert.equal(runtime.message_type, 'runtime_attestation');
  assert.deepEqual(runtime.payload.tools, ['web_search']);
  assert.equal(runtime.payload.result, 'completed');
  assert.ok(instruction.sig);
  assert.ok(runtime.sig);
});

test('endRental emits signed rental_completed envelope', async () => {
  const logger = makeLogger();

  await logger.endRental(
    '0.0.99999',
    'rental_abc',
    'completed',
    0.25,
    3,
    {
      total_tokens: 700,
      total_minutes: 3
    }
  );

  assert.equal(logger.submitted.length, 1);
  const envelope = logger.submitted[0].message;
  assert.equal(envelope.message_type, 'rental_completed');
  assert.equal(envelope.payload.usage.instructions, 3);
  assert.equal(envelope.payload.usage.cost_usd, 0.25);
  assert.ok(envelope.sig);
});

test('verifyRentalMessages summarizes mixed signed and unsigned ATP logs', async () => {
  const logger = makeLogger();

  const signed = logger._buildEnvelope('rental_instruction', '0.0.99999', {
    rental_id: 'rental_mixed',
    instructor: '0.0.88888',
    instruction_hash: 'sha256:test',
    tokens_in: 1,
    tokens_out: 2,
    model: 'sonnet'
  });

  const unsigned = {
    atp: '1.0',
    type: 'instruction',
    ts: new Date().toISOString(),
    agent: '0.0.99999',
    data: {
      rental_id: 'rental_mixed',
      instructor: '0.0.88888',
      instruction_hash: 'sha256:old'
    }
  };

  const originalFetch = global.fetch;
  global.fetch = async () => ({
    async json() {
      return {
        messages: [
          { sequence_number: 1, message: Buffer.from(JSON.stringify(signed)).toString('base64') },
          { sequence_number: 2, message: Buffer.from(JSON.stringify(unsigned)).toString('base64') }
        ]
      };
    }
  });

  try {
    const result = await logger.verifyRentalMessages('0.0.99999', 'rental_mixed', {
      publicKey: logger.operatorKey.publicKey.toString(),
      mirrorNode: 'https://example.com'
    });

    assert.equal(result.status, 'ok');
    assert.equal(result.totalMessages, 2);
    assert.equal(result.signedMessages, 1);
    assert.equal(result.validSignatures, 1);
    assert.equal(result.unsignedMessages, 1);
    assert.equal(result.invalidSignatures, 0);
  } finally {
    global.fetch = originalFetch;
  }
});

test('getRentalStatus derives active_with_violations from mixed ATP messages', async () => {
  const logger = makeLogger();

  const initMessage = logger._buildEnvelope('rental_initiated', '0.0.99999', {
    rental_id: 'rental_state',
    renter: '0.0.88888',
    owner: '0.0.12345',
    rental_type: 'session',
    stake_usd: 0,
    stake_hbar: 0,
    usage_buffer_usd: 2,
    usage_buffer_hbar: 0,
    escrow_account: null,
    pricing_snapshot: {},
    constraints: { enforcement: 'self_declared' },
    expected_duration_minutes: 5,
    parent_rental_id: null,
    depth: 1,
    hcs_topic: '0.0.99999',
    initiated_by: '0.0.12345',
    budget_cap_usd: 2
  });

  const violationMessage = logger._buildEnvelope('rental_violation', '0.0.99999', {
    rental_id: 'rental_state',
    instructor: '0.0.88888',
    violation_type: 'tool_blocked',
    details: 'attempted exec',
    instruction_hash: 'sha256:violation',
    action_taken: 'logged',
    stake_slashed: 0,
    warning_count: 1,
    enforcement: 'self_declared'
  });

  const originalFetch = global.fetch;
  global.fetch = async () => ({
    async json() {
      return {
        messages: [
          { sequence_number: 1, message: Buffer.from(JSON.stringify(initMessage)).toString('base64') },
          { sequence_number: 2, message: Buffer.from(JSON.stringify(violationMessage)).toString('base64') }
        ]
      };
    }
  });

  try {
    const status = await logger.getRentalStatus('0.0.99999', 'rental_state', {
      mirrorNode: 'https://example.com'
    });

    assert.equal(status.status, 'active_with_violations');
    assert.equal(status.violations, 1);
    assert.equal(status.signedMessages, 2);
    assert.equal(status.enforcement, 'self_declared');
    assert.equal(status.latestMessageType, 'rental_violation');
  } finally {
    global.fetch = originalFetch;
  }
});
