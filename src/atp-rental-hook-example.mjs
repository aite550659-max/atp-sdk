#!/usr/bin/env node
/**
 * ATP Rental Hook - Example Integration
 *
 * This is a reference implementation showing how to wire the ATP rental logger
 * to an OpenClaw message flow for the ATP rental demo.
 *
 * This would be called by OpenClaw when a message arrives in the ATP rental group.
 */

import { ATPRentalLogger } from './atp-rental-logger.mjs';

/**
 * ATP Rental Session Manager
 * Manages active rental sessions and coordinates HCS logging
 */
export class ATPRentalSessionManager {
  constructor() {
    this.logger = new ATPRentalLogger();
    this.activeRentals = new Map(); // userId -> rental session
    this.initialized = false;
  }

  /**
   * Initialize the manager
   */
  async initialize() {
    if (this.initialized) return;

    const operatorId = process.env.HEDERA_OPERATOR_ID || '0.0.8332371';
    const operatorKey = process.env.HEDERA_OPERATOR_KEY;

    if (!operatorKey) {
      throw new Error('HEDERA_OPERATOR_KEY environment variable required');
    }

    await this.logger.initialize(operatorId, operatorKey, 'mainnet');
    this.initialized = true;

    console.log('✅ ATP Rental Session Manager initialized');
  }

  /**
   * Start a new rental session
   * @param {string} userId - User identifier (Telegram ID, etc.)
   * @param {Object} options - Rental options
   */
  async startRental(userId, options = {}) {
    if (this.activeRentals.has(userId)) {
      console.warn(`⚠️  User ${userId} already has an active rental`);
      return this.activeRentals.get(userId);
    }

    const agentTopicId = options.agentTopicId || '0.0.10261370'; // Aite's topic
    const renterId = options.renterId || this._mapUserToHedera(userId);

    // Default constraints for demo
    const constraints = {
      tools_blocked: ['exec', 'wallet', 'message', 'browser', 'edit', 'write'],
      tools_allowed: ['web_search', 'web_fetch', 'read', 'image'],
      memory_access: 'sandboxed',
      topics_blocked: [],
      max_per_instruction_cost: 1.00,
      max_daily_cost: options.budgetCap || 10.00
    };

    const receipt = await this.logger.initRental(
      agentTopicId,
      renterId,
      constraints,
      options.duration || 3600,  // 1 hour default
      options.budgetCap || 10.00,
      {
        rental_type: options.rentalType || 'session',
        agent_nft_id: null // Aite not yet monetized
      }
    );

    const session = {
      rentalId: receipt.rentalId,
      userId,
      agentTopicId,
      renterId,
      startTime: Date.now(),
      interactions: 0,
      totalCost: 0,
      budgetCap: options.budgetCap || 10.00,
      constraints
    };

    this.activeRentals.set(userId, session);

    console.log(`✨ Rental started for user ${userId}`);
    console.log(`   Rental ID: ${receipt.rentalId}`);
    console.log(`   View: https://hashscan.io/mainnet/topic/${agentTopicId}`);

    return session;
  }

  /**
   * Log an interaction within a rental session
   * @param {string} userId - User identifier
   * @param {string} instruction - User's instruction
   * @param {string} response - Agent's response
   * @param {Object} metadata - Interaction metadata
   */
  async logInteraction(userId, instruction, response, metadata = {}) {
    const session = this.activeRentals.get(userId);

    if (!session) {
      throw new Error(`No active rental for user ${userId}`);
    }

    const toolCalls = metadata.toolCalls || [];
    const cost = metadata.cost || this._estimateCost(metadata);

    await this.logger.logInteraction(
      session.agentTopicId,
      session.rentalId,
      instruction,
      response,
      toolCalls,
      cost,
      {
        instructor: session.renterId,
        tokens_in: metadata.tokensIn || 0,
        tokens_out: metadata.tokensOut || 0,
        model: metadata.model || 'sonnet',
        tool_fees: metadata.toolFees || 0,
        duration_ms: metadata.durationMs || 0
      }
    );

    session.interactions++;
    session.totalCost += cost;

    console.log(`💬 Interaction logged: ${session.rentalId} | Cost: $${cost.toFixed(4)} | Total: $${session.totalCost.toFixed(2)}`);

    // Check budget cap
    if (session.totalCost >= session.budgetCap) {
      console.warn(`⚠️  Budget cap reached for ${userId} - ending rental`);
      await this.endRental(userId, 'budget_exceeded');
    }

    return { cost, totalCost: session.totalCost, interactions: session.interactions };
  }

  /**
   * End a rental session
   * @param {string} userId - User identifier
   * @param {string} reason - Termination reason
   */
  async endRental(userId, reason = 'completed') {
    const session = this.activeRentals.get(userId);

    if (!session) {
      console.warn(`⚠️  No active rental for user ${userId}`);
      return null;
    }

    const durationActual = Math.floor((Date.now() - session.startTime) / 1000);

    await this.logger.endRental(
      session.agentTopicId,
      session.rentalId,
      reason,
      session.totalCost,
      session.interactions,
      {
        terminated_by: reason === 'terminated' ? 'owner' : 'system',
        duration_actual: durationActual,
        total_tokens: 0, // Would need to track
        total_minutes: Math.floor(durationActual / 60)
      }
    );

    this.activeRentals.delete(userId);

    console.log(`✅ Rental ended: ${session.rentalId}`);
    console.log(`   Reason: ${reason} | Interactions: ${session.interactions} | Total: $${session.totalCost.toFixed(2)}`);

    return {
      rentalId: session.rentalId,
      duration: durationActual,
      interactions: session.interactions,
      totalCost: session.totalCost,
      reason
    };
  }

  /**
   * Get status of a rental
   */
  async getRentalStatus(userId) {
    const session = this.activeRentals.get(userId);

    if (!session) {
      return { status: 'not_found' };
    }

    const hcsStatus = await this.logger.getRentalStatus(
      session.agentTopicId,
      session.rentalId
    );

    return {
      ...hcsStatus,
      localSession: {
        startTime: session.startTime,
        interactions: session.interactions,
        totalCost: session.totalCost,
        budgetRemaining: session.budgetCap - session.totalCost
      }
    };
  }

  /**
   * Get all active rentals
   */
  getActiveRentals() {
    return Array.from(this.activeRentals.entries()).map(([userId, session]) => ({
      userId,
      rentalId: session.rentalId,
      startTime: session.startTime,
      interactions: session.interactions,
      totalCost: session.totalCost,
      budgetRemaining: session.budgetCap - session.totalCost
    }));
  }

  /**
   * Map user ID to Hedera account
   * @private
   */
  _mapUserToHedera(userId) {
    // For demo purposes, map all renters to a test account
    // Production would need proper user->account mapping
    return '0.0.10255397';
  }

  /**
   * Estimate cost based on metadata
   * @private
   */
  _estimateCost(metadata) {
    // Simple cost estimation
    const tokenCost = ((metadata.tokensIn || 0) + (metadata.tokensOut || 0)) * 0.000005;
    const toolCost = (metadata.toolCalls?.length || 0) * 0.01;
    return tokenCost + toolCost;
  }

  /**
   * Clean up
   */
  close() {
    this.logger.close();
  }
}

/**
 * Example: OpenClaw message handler
 * This would be called by OpenClaw when a message arrives
 */
export async function handleRentalMessage(message, context) {
  // Singleton manager
  if (!globalThis.atpManager) {
    globalThis.atpManager = new ATPRentalSessionManager();
    await globalThis.atpManager.initialize();
  }

  const manager = globalThis.atpManager;
  const userId = message.from;

  try {
    // Start rental if not exists
    if (!manager.activeRentals.has(userId)) {
      await manager.startRental(userId, {
        budgetCap: 10.00,
        duration: 3600
      });
    }

    // Process the message through the agent
    const startTime = Date.now();
    const response = await context.processMessage(message.text);
    const durationMs = Date.now() - startTime;

    // Extract metadata from context
    const metadata = {
      toolCalls: context.toolCalls?.map(t => t.name) || [],
      tokensIn: context.usage?.promptTokens || 0,
      tokensOut: context.usage?.completionTokens || 0,
      model: context.model || 'sonnet',
      durationMs
    };

    // Log the interaction
    await manager.logInteraction(userId, message.text, response, metadata);

    return response;

  } catch (error) {
    console.error('❌ Error in rental message handler:', error);

    // End rental on error
    await manager.endRental(userId, 'error');

    throw error;
  }
}

/**
 * Example: Cleanup handler (called on session end)
 */
export async function handleRentalEnd(userId, reason = 'completed') {
  if (globalThis.atpManager) {
    await globalThis.atpManager.endRental(userId, reason);
  }
}

// CLI for testing
if (import.meta.url === `file://${process.argv[1]}`) {
  const manager = new ATPRentalSessionManager();

  try {
    await manager.initialize();

    // Simulate a rental session
    console.log('\n🧪 Testing ATP Rental Session...\n');

    const testUserId = 'test_user_123';

    // Start rental
    await manager.startRental(testUserId, {
      budgetCap: 5.00,
      duration: 300  // 5 minutes
    });

    // Simulate some interactions
    for (let i = 0; i < 3; i++) {
      await manager.logInteraction(
        testUserId,
        `Test instruction ${i + 1}`,
        `Test response ${i + 1}`,
        {
          toolCalls: ['web_search'],
          tokensIn: 50,
          tokensOut: 200,
          durationMs: 2000
        }
      );

      // Wait a bit between interactions
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Check status
    const status = await manager.getRentalStatus(testUserId);
    console.log('\n📊 Rental Status:');
    console.log(JSON.stringify(status.localSession, null, 2));

    // End rental
    await manager.endRental(testUserId, 'completed');

    console.log('\n✅ Test completed successfully');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
  } finally {
    manager.close();
  }
}
