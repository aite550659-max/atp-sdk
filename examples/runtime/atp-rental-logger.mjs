#!/usr/bin/env node
/**
 * ATP Rental Logger for Hedera Consensus Service
 * Logs rental session events to HCS following ATP v2.1 schema where implemented.
 * 
 * Part of the Agent Trust Protocol (ATP) SDK
 * @see docs/AGENT_TRUST_PROTOCOL.md
 * @see docs/ATP_HCS_SCHEMA_V2.1.md
 */

import { 
  Client, 
  TopicMessageSubmitTransaction,
  AccountId, 
  PrivateKey,
  PublicKey,
  TopicId
} from "@hashgraph/sdk";
import crypto from 'crypto';

/**
 * ATP Rental Logger - Logs rental lifecycle events to HCS
 */
export class ATPRentalLogger {
  constructor() {
    this.client = null;
    this.operatorId = null;
    this.operatorKey = null;
    this.initialized = false;
  }

  /**
   * Initialize the HCS client with Hedera credentials
   * @param {string} operatorId - Hedera account ID (e.g., "0.0.8332371")
   * @param {string} operatorKey - Hedera private key (ECDSA)
   * @param {string} network - "mainnet" or "testnet"
   */
  async initialize(operatorId, operatorKey, network = 'mainnet') {
    try {
      this.operatorId = AccountId.fromString(operatorId);
      this.operatorKey = PrivateKey.fromStringECDSA(operatorKey);
      
      this.client = network === 'mainnet' 
        ? Client.forMainnet() 
        : Client.forTestnet();
      
      this.client.setOperator(this.operatorId, this.operatorKey);
      
      this.initialized = true;
      console.log(`✅ ATP Rental Logger initialized for ${network}`);
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize ATP Rental Logger:', error.message);
      throw error;
    }
  }

  /**
   * Log rental initiation to HCS
   * @param {string} agentTopicId - Agent's HCS topic ID (e.g., "0.0.YYYYYY")
   * @param {string} renterId - Renter's Hedera account ID
   * @param {Object} constraints - Rental constraints (tools_blocked, memory_access, etc.)
   * @param {number} duration - Rental duration in seconds
   * @param {number} budgetCap - Budget cap in USD
   * @param {Object} options - Additional options (rental_id, rental_type, etc.)
   * @returns {Promise<Object>} Receipt with sequence number and transaction ID
   */
  async initRental(agentTopicId, renterId, constraints, duration, budgetCap, options = {}) {
    this._assertInitialized();

    const rentalId = options.rental_id || this._generateRentalId();
    const agentId = this._resolveAgentId(agentTopicId, options);
    const payload = {
      rental_id: rentalId,
      renter: renterId,
      owner: options.owner || this.operatorId.toString(),
      rental_type: options.rental_type || 'session',
      stake_usd: options.stake_usd || 0,
      stake_hbar: options.stake_hbar || 0,
      usage_buffer_usd: options.usage_buffer_usd ?? budgetCap,
      usage_buffer_hbar: options.usage_buffer_hbar ?? options.buffer_hbar ?? 0,
      escrow_account: options.escrow_account || null,
      pricing_snapshot: options.pricing || {},
      constraints: {
        tools_blocked: constraints.tools_blocked || [],
        topics_blocked: constraints.topics_blocked || [],
        memory_access_level: constraints.memory_access_level || constraints.memory_access || 'sandboxed',
        max_per_instruction_cost: constraints.max_per_instruction_cost || null,
        max_daily_cost: constraints.max_daily_cost || null,
        enforcement: constraints.enforcement || options.enforcement || 'self_declared',
        tools_allowed: constraints.tools_allowed || null
      },
      expected_duration_minutes: options.expected_duration_minutes || Math.ceil(duration / 60),
      parent_rental_id: options.parent_rental_id || options.parent_rental || null,
      depth: options.depth || 1,
      hcs_topic: agentTopicId,
      initiated_by: this.operatorId.toString(),
      budget_cap_usd: budgetCap
    };

    const message = this._buildEnvelope('rental_initiated', agentId, payload);

    const receipt = await this._submitMessage(agentTopicId, message);
    
    console.log(`📝 Rental initiated: ${rentalId} → ${agentTopicId}`);
    console.log(`   Renter: ${renterId} | Duration: ${duration}s | Budget: $${budgetCap}`);
    
    return {
      rentalId,
      sequenceNumber: receipt.sequenceNumber,
      transactionId: receipt.transactionId,
      consensusTimestamp: receipt.consensusTimestamp,
      topicId: agentTopicId
    };
  }

  /**
   * Log a rental interaction as a v2.1 rental instruction plus runtime attestation.
   * @param {string} topicId - Agent's HCS topic ID
   * @param {string} rentalId - Rental session ID
   * @param {string} instruction - User instruction (will be hashed for privacy)
   * @param {string} response - Agent response (will be hashed for privacy)
   * @param {Array<string>} toolCalls - List of tools used
   * @param {number} cost - Cost of this interaction in USD
   * @param {Object} options - Additional metadata
   * @returns {Promise<Object>} Receipt
   */
  async logInteraction(topicId, rentalId, instruction, response, toolCalls = [], cost = 0, options = {}) {
    if (!this.initialized) {
      throw new Error('Logger not initialized. Call initialize() first.');
    }

    const agentId = options.agent_id || options.agent_did || options.agent_nft_id || topicId;
    const instructionHash = this._sha256(instruction);
    const responseHash = this._sha256(response);

    const instructionMessage = this._buildEnvelope('rental_instruction', agentId, {
      rental_id: rentalId,
      instructor: options.instructor || 'unknown',
      instruction_hash: instructionHash,
      tokens_in: options.tokens_in || 0,
      tokens_out: options.tokens_out || 0,
      model: options.model || null
    });

    const runtimeMessage = this._buildEnvelope('runtime_attestation', agentId, {
      rental_id: rentalId,
      runtime_name: options.runtime_name || 'openclaw',
      runtime_version: options.runtime_version || process.version,
      atp_sdk_version: options.atp_sdk_version || '2.1-migration',
      runtime_hash: options.runtime_hash || null,
      attestation_statement: options.attestation_statement || `Executed rental interaction with ${toolCalls.length ? toolCalls.join(', ') : 'no tools'}`,
      memory_isolation: options.memory_isolation ?? true,
      operator: this.operatorId.toString(),
      operator_stake: options.operator_stake || 0,
      tools: toolCalls,
      tool_fees_usd: options.tool_fees || 0,
      result: options.result || 'completed',
      result_hash: responseHash,
      cost_usd: cost,
      duration_ms: options.duration_ms || 0,
      tee_attestation: options.tee_attestation || null
    });

    // Submit both messages
    const instructionReceipt = await this._submitMessage(topicId, instructionMessage);
    const actionReceipt = await this._submitMessage(topicId, runtimeMessage);

    console.log(`💬 Interaction logged: ${rentalId} | Tools: ${toolCalls.join(', ')} | Cost: $${cost.toFixed(4)}`);

    return {
      instructionSeq: instructionReceipt.sequenceNumber,
      actionSeq: actionReceipt.sequenceNumber,
      transactionIds: [
        instructionReceipt.transactionId,
        actionReceipt.transactionId
      ]
    };
  }

  /**
   * Log rental completion/termination as a signed ATP v2.1 rental_completed event.
   * @param {string} topicId - Agent's HCS topic ID
   * @param {string} rentalId - Rental session ID
   * @param {string} reason - Completion reason (completed, timeout, budget_exceeded, terminated, etc.)
   * @param {number} totalCost - Total cost in USD
   * @param {number} interactionCount - Number of interactions
   * @param {Object} options - Additional metadata
   * @returns {Promise<Object>} Receipt
   */
  async endRental(topicId, rentalId, reason, totalCost, interactionCount, options = {}) {
    if (!this.initialized) {
      throw new Error('Logger not initialized. Call initialize() first.');
    }

    const agentId = options.agent_id || options.agent_did || options.agent_nft_id || topicId;
    const feesPaid = options.fees_paid || {
      creator: totalCost * 0.05,
      owner: totalCost * 0.92,
      network: totalCost * 0.02,
      treasury: totalCost * 0.01
    };

    const payload = {
      rental_id: rentalId,
      reason,
      terminated_by: options.terminated_by || 'system',
      duration_actual_sec: options.duration_actual_sec || options.duration_actual || 0,
      usage: {
        instructions: interactionCount,
        tokens: options.total_tokens || 0,
        minutes: options.total_minutes || 0,
        cost_usd: totalCost
      },
      stake_returned: options.stake_returned || 0,
      buffer_refund: options.buffer_refund || 0,
      fees_paid: feesPaid,
      completed_at: new Date().toISOString()
    };

    const message = this._buildEnvelope('rental_completed', agentId, payload);

    const receipt = await this._submitMessage(topicId, message);

    console.log(`✅ Rental completed: ${rentalId}`);
    console.log(`   Reason: ${reason} | Interactions: ${interactionCount} | Total: $${totalCost.toFixed(2)}`);

    return {
      sequenceNumber: receipt.sequenceNumber,
      transactionId: receipt.transactionId,
      consensusTimestamp: receipt.consensusTimestamp
    };
  }

  /**
   * Log a rental heartbeat as a signed ATP v2.1 event.
   * @param {string} topicId - Agent's HCS topic ID
   * @param {string} rentalId - Rental session ID
   * @param {Object} options - Heartbeat metadata
   * @returns {Promise<Object>} Receipt
   */
  async logHeartbeat(topicId, rentalId, options = {}) {
    if (!this.initialized) {
      throw new Error('Logger not initialized. Call initialize() first.');
    }

    const agentId = options.agent_id || options.agent_did || options.agent_nft_id || topicId;
    const payload = {
      rental_id: rentalId,
      status: options.status || 'healthy',
      uptime_sec: options.uptime_sec || 0,
      memory_isolation: options.memory_isolation ?? true,
      pending_attestations: options.pending_attestations || 0,
      actions_since_last: options.actions_since_last || 0,
      max_daily_cost: options.max_daily_cost || null,
      observed_cost_usd: options.observed_cost_usd || 0,
      note: options.note || null
    };

    const message = this._buildEnvelope('rental_heartbeat', agentId, payload);
    return this._submitMessage(topicId, message);
  }

  /**
   * Log a rental downtime event as a signed ATP v2.1 event.
   * @param {string} topicId - Agent's HCS topic ID
   * @param {string} rentalId - Rental session ID
   * @param {Object} options - Downtime metadata
   * @returns {Promise<Object>} Receipt
   */
  async logDowntime(topicId, rentalId, options = {}) {
    this._assertInitialized();

    const agentId = this._resolveAgentId(topicId, options);
    const payload = {
      rental_id: rentalId,
      started_at: options.started_at || new Date().toISOString(),
      detected_at: options.detected_at || new Date().toISOString(),
      reason: options.reason || 'runtime_unavailable',
      duration_sec: options.duration_sec || 0,
      impact: options.impact || 'temporary_unavailability',
      recovered: options.recovered ?? false,
      recovered_at: options.recovered_at || null,
      note: options.note || null
    };

    const message = this._buildEnvelope('rental_downtime', agentId, payload);
    return this._submitMessage(topicId, message);
  }

  /**
   * Log a rental violation as a signed ATP v2.1 event.
   * @param {string} topicId - Agent's HCS topic ID
   * @param {string} rentalId - Rental session ID
   * @param {string} violationType - Violation category
   * @param {Object} options - Violation metadata
   * @returns {Promise<Object>} Receipt
   */
  async logViolation(topicId, rentalId, violationType, options = {}) {
    if (!this.initialized) {
      throw new Error('Logger not initialized. Call initialize() first.');
    }

    const agentId = options.agent_id || options.agent_did || options.agent_nft_id || topicId;
    const payload = {
      rental_id: rentalId,
      instructor: options.instructor || 'unknown',
      violation_type: violationType,
      details: options.details || null,
      instruction_hash: options.instruction_hash || null,
      action_taken: options.action_taken || 'logged',
      stake_slashed: options.stake_slashed || 0,
      warning_count: options.warning_count || 1,
      enforcement: options.enforcement || 'self_declared'
    };

    const message = this._buildEnvelope('rental_violation', agentId, payload);
    return this._submitMessage(topicId, message);
  }

  _assertInitialized() {
    if (!this.initialized) {
      throw new Error('Logger not initialized. Call initialize() first.');
    }
  }

  _resolveAgentId(topicId, options = {}) {
    return options.agent_id || options.agent_did || options.agent_nft_id || topicId;
  }

  _mirrorNodeUrl(options = {}) {
    return options.mirrorNode || 'https://mainnet-public.mirrornode.hedera.com';
  }

  _extractEnvelopeFields(parsed) {
    return {
      payload: parsed.payload || parsed.data,
      messageType: parsed.message_type || parsed.type,
      timestamp: parsed.timestamp || parsed.ts,
      agentId: parsed.agent_id || parsed.agent || null,
      version: parsed.atp_version || parsed.atp || null,
      signed: Boolean(parsed.sig),
      raw: parsed
    };
  }

  async _fetchRentalMessages(topicId, rentalId, options = {}) {
    const url = `${this._mirrorNodeUrl(options)}/api/v1/topics/${topicId}/messages`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.messages) {
      return [];
    }

    const rentalMessages = [];
    for (const msg of data.messages) {
      try {
        const content = Buffer.from(msg.message, 'base64').toString('utf8');
        const parsed = JSON.parse(content);
        const envelope = this._extractEnvelopeFields(parsed);

        if (envelope.payload && envelope.payload.rental_id === rentalId) {
          rentalMessages.push({
            type: envelope.messageType,
            timestamp: envelope.timestamp,
            sequenceNumber: msg.sequence_number,
            data: envelope.payload,
            signed: envelope.signed,
            version: envelope.version,
            agentId: envelope.agentId,
            raw: parsed
          });
        }
      } catch {
        continue;
      }
    }

    rentalMessages.sort((a, b) => Number(a.sequenceNumber) - Number(b.sequenceNumber));
    return rentalMessages;
  }

  _summarizeRentalMessages(topicId, rentalId, rentalMessages) {
    if (rentalMessages.length === 0) {
      return { status: 'not_found', rentalId };
    }

    const initiated = rentalMessages.filter(m => ['rental.init', 'rental_initiated'].includes(m.type));
    const completed = rentalMessages.filter(m => ['rental.end', 'rental_completed'].includes(m.type));
    const instructions = rentalMessages.filter(m => ['instruction', 'rental_instruction'].includes(m.type));
    const runtimeEvents = rentalMessages.filter(m => ['action', 'runtime_attestation'].includes(m.type));
    const heartbeats = rentalMessages.filter(m => ['heartbeat', 'rental_heartbeat'].includes(m.type));
    const downtime = rentalMessages.filter(m => ['downtime', 'rental_downtime'].includes(m.type));
    const violations = rentalMessages.filter(m => ['violation', 'rental_violation'].includes(m.type));

    const latest = rentalMessages[rentalMessages.length - 1];
    const latestDowntime = downtime[downtime.length - 1];
    const latestHeartbeat = heartbeats[heartbeats.length - 1];
    const latestViolation = violations[violations.length - 1];
    const initMessage = initiated[0];
    const completedMessage = completed[completed.length - 1];

    let status = 'unknown';
    if (completedMessage) {
      status = 'completed';
    } else if (latestDowntime && !latestDowntime.data.recovered) {
      status = 'degraded';
    } else if (initiated.length && violations.length) {
      status = 'active_with_violations';
    } else if (initiated.length) {
      status = 'active';
    }

    const messageTypeCounts = rentalMessages.reduce((acc, message) => {
      acc[message.type] = (acc[message.type] || 0) + 1;
      return acc;
    }, {});

    return {
      status,
      rentalId,
      topicId,
      agentId: latest.agentId || initMessage?.agentId || null,
      schemaVersions: [...new Set(rentalMessages.map(m => m.version).filter(Boolean))],
      messageCount: rentalMessages.length,
      interactions: instructions.length,
      runtimeEvents: runtimeEvents.length,
      heartbeats: heartbeats.length,
      downtimeEvents: downtime.length,
      violations: violations.length,
      signedMessages: rentalMessages.filter(m => m.signed).length,
      latestMessageType: latest.type,
      lastUpdate: latest.timestamp,
      initiatedAt: initMessage?.timestamp || null,
      completedAt: completedMessage?.timestamp || null,
      lastHeartbeatAt: latestHeartbeat?.timestamp || null,
      lastDowntimeAt: latestDowntime?.timestamp || null,
      lastViolationAt: latestViolation?.timestamp || null,
      enforcement: initMessage?.data?.constraints?.enforcement || null,
      messageTypeCounts,
      messages: rentalMessages
    };
  }

  /**
   * Verify a single ATP message signature.
   * Supports ATP v2.1 envelopes and older ATP envelopes that include a `sig` field.
   * @param {Object} message - Parsed ATP message
   * @param {string} publicKey - Verifier public key
   * @returns {Object} Verification result
   */
  verifyEnvelope(message, publicKey) {
    if (!message?.sig) {
      return { valid: false, reason: 'unsigned' };
    }

    const key = this._parsePublicKey(publicKey);
    const [algorithm, encoded] = String(message.sig).split(':', 2);
    if (!algorithm || !encoded) {
      return { valid: false, reason: 'malformed_signature' };
    }

    let unsigned;
    if (message.atp_version && message.message_type && message.agent_id && message.timestamp && message.payload) {
      const { sig, ...rest } = message;
      unsigned = rest;
    } else if (message.atp && message.type && message.agent && message.ts && message.data) {
      const { sig, ...rest } = message;
      unsigned = rest;
    } else {
      return { valid: false, reason: 'unknown_envelope_shape' };
    }

    const payload = Buffer.from(this._canonicalJson(unsigned), 'utf8');
    const signature = Buffer.from(encoded, 'base64');

    return {
      valid: key.verify(payload, signature),
      algorithm
    };
  }

  /**
   * Fetch ATP messages for a rental and verify signatures when a public key is provided.
   * @param {string} topicId - Agent's HCS topic ID
   * @param {string} rentalId - Rental session ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Verification summary
   */
  async verifyRentalMessages(topicId, rentalId, options = {}) {
    const rentalMessages = await this._fetchRentalMessages(topicId, rentalId, options);

    if (!options.publicKey) {
      return {
        status: rentalMessages.length ? 'ok' : 'not_found',
        rentalId,
        topicId,
        totalMessages: rentalMessages.length,
        signedMessages: rentalMessages.filter(m => Boolean(m.raw.sig)).length,
        validSignatures: 0,
        invalidSignatures: 0,
        unsignedMessages: rentalMessages.filter(m => !m.raw.sig).length,
        unresolvedMessages: rentalMessages.filter(m => Boolean(m.raw.sig)).length,
        reason: 'publicKey_required_for_signature_verification',
        messages: rentalMessages
      };
    }

    let validSignatures = 0;
    let invalidSignatures = 0;
    let unsignedMessages = 0;

    for (const message of rentalMessages) {
      const result = this.verifyEnvelope(message.raw, options.publicKey);
      if (result.reason === 'unsigned') {
        unsignedMessages++;
      } else if (result.valid) {
        validSignatures++;
      } else {
        invalidSignatures++;
      }
      message.verification = result;
    }

    return {
      status: rentalMessages.length ? 'ok' : 'not_found',
      rentalId,
      topicId,
      totalMessages: rentalMessages.length,
      signedMessages: rentalMessages.length - unsignedMessages,
      validSignatures,
      invalidSignatures,
      unsignedMessages,
      unresolvedMessages: 0,
      messages: rentalMessages
    };
  }

  /**
   * Query rental status from mirror node
   * @param {string} topicId - Agent's HCS topic ID
   * @param {string} rentalId - Rental session ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Rental status
   */
  async getRentalStatus(topicId, rentalId, options = {}) {
    try {
      const rentalMessages = await this._fetchRentalMessages(topicId, rentalId, options);
      return this._summarizeRentalMessages(topicId, rentalId, rentalMessages);
    } catch (error) {
      console.error('❌ Failed to query rental status:', error.message);
      throw error;
    }
  }

  _sortKeysDeep(value) {
    if (Array.isArray(value)) {
      return value.map((item) => this._sortKeysDeep(item));
    }
    if (value && typeof value === 'object') {
      return Object.keys(value)
        .sort()
        .reduce((acc, key) => {
          acc[key] = this._sortKeysDeep(value[key]);
          return acc;
        }, {});
    }
    return value;
  }

  _canonicalJson(value) {
    return JSON.stringify(this._sortKeysDeep(value));
  }

  _parsePublicKey(key) {
    try {
      return PublicKey.fromStringED25519(key);
    } catch {
      try {
        return PublicKey.fromStringECDSA(key);
      } catch {
        return PublicKey.fromString(key);
      }
    }
  }

  _buildEnvelope(messageType, agentId, payload) {
    const unsigned = {
      atp_version: '2.1',
      message_type: messageType,
      agent_id: agentId,
      timestamp: new Date().toISOString(),
      payload
    };

    const signature = this.operatorKey.sign(Buffer.from(this._canonicalJson(unsigned), 'utf8'));

    return {
      ...unsigned,
      sig: `ecdsa-secp256k1:${Buffer.from(signature).toString('base64')}`
    };
  }

  /**
   * Submit a message to HCS topic
   * @private
   */
  async _submitMessage(topicId, message) {
    try {
      const messageJson = JSON.stringify(message);
      
      const tx = new TopicMessageSubmitTransaction()
        .setTopicId(TopicId.fromString(topicId))
        .setMessage(messageJson)
        .setMaxTransactionFee(1); // 1 HBAR max

      const response = await tx.execute(this.client);
      const receipt = await response.getReceipt(this.client);

      return {
        sequenceNumber: receipt.topicSequenceNumber.toNumber(),
        transactionId: response.transactionId.toString(),
        consensusTimestamp: receipt.consensusTimestamp
      };

    } catch (error) {
      console.error('❌ Failed to submit HCS message:', error.message);
      throw error;
    }
  }

  /**
   * Generate a unique rental ID
   * @private
   */
  _generateRentalId() {
    return `rental_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * SHA-256 hash (for privacy-preserving logging)
   * @private
   */
  _sha256(data) {
    return 'sha256:' + crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Close the client connection
   */
  close() {
    if (this.client) {
      this.client.close();
    }
  }
}

// CLI Usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const command = args[0];

  async function main() {
    // Load credentials from environment
    const operatorId = process.env.HEDERA_OPERATOR_ID || '0.0.8332371';
    const operatorKey = process.env.HEDERA_OPERATOR_KEY;
    
    if (!operatorKey) {
      console.error('❌ HEDERA_OPERATOR_KEY environment variable required');
      process.exit(1);
    }

    const logger = new ATPRentalLogger();
    
    try {
      await logger.initialize(operatorId, operatorKey, 'mainnet');

      if (command === 'init-rental') {
        // Example: init a test rental
        const agentTopicId = args[1] || '0.0.10261370';
        const renterId = args[2] || '0.0.10255397';
        
        const receipt = await logger.initRental(
          agentTopicId,
          renterId,
          { 
            tools_blocked: ['exec', 'wallet'],
            memory_access: 'sandboxed'
          },
          3600, // 1 hour
          10.00, // $10 cap
          { rental_type: 'session' }
        );
        
        console.log('\n✨ Rental initialized');
        console.log(`Rental ID: ${receipt.rentalId}`);
        console.log(`Sequence: ${receipt.sequenceNumber}`);
        console.log(`View: https://hashscan.io/mainnet/topic/${agentTopicId}`);
        
      } else if (command === 'log-interaction') {
        const topicId = args[1];
        const rentalId = args[2];
        
        if (!topicId || !rentalId) {
          console.error('Usage: log-interaction <topicId> <rentalId>');
          process.exit(1);
        }
        
        await logger.logInteraction(
          topicId,
          rentalId,
          'Test instruction: search the web',
          'Here are the results...',
          ['web_search'],
          0.05
        );
        
      } else if (command === 'end-rental') {
        const topicId = args[1];
        const rentalId = args[2];
        
        if (!topicId || !rentalId) {
          console.error('Usage: end-rental <topicId> <rentalId>');
          process.exit(1);
        }
        
        await logger.endRental(
          topicId,
          rentalId,
          'completed',
          5.25,
          10
        );
        
      } else if (command === 'status') {
        const topicId = args[1];
        const rentalId = args[2];
        
        if (!topicId || !rentalId) {
          console.error('Usage: status <topicId> <rentalId>');
          process.exit(1);
        }
        
        const status = await logger.getRentalStatus(topicId, rentalId);
        console.log('\n📊 Rental Status:');
        console.log(JSON.stringify(status, null, 2));
        
      } else {
        console.log('ATP Rental Logger CLI\n');
        console.log('Usage:');
        console.log('  node atp-rental-logger.mjs init-rental [topicId] [renterId]');
        console.log('  node atp-rental-logger.mjs log-interaction <topicId> <rentalId>');
        console.log('  node atp-rental-logger.mjs end-rental <topicId> <rentalId>');
        console.log('  node atp-rental-logger.mjs status <topicId> <rentalId>');
        console.log('\nEnvironment:');
        console.log('  HEDERA_OPERATOR_ID - Your Hedera account (default: 0.0.8332371)');
        console.log('  HEDERA_OPERATOR_KEY - Your private key (required)');
      }
      
    } finally {
      logger.close();
    }
  }

  main().catch(console.error);
}
