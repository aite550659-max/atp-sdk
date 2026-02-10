/**
 * Budget Monitor - Real-time usage tracking against rental buffer
 * 
 * Tracks cumulative usage (USD, tokens, instructions) and compares against
 * the rental's buffer to determine when to warn or stop accepting instructions.
 */

import { Rental } from './types';

export type BudgetLevel = 'ok' | 'warning' | 'critical' | 'exhausted';

export interface UsageEvent {
  timestamp: string;
  costUsd: number;
  tokens: number;
  instructions: number;
}

export interface BudgetStatus {
  usedUsd: number;
  remainingUsd: number;
  percentUsed: number;
  level: BudgetLevel;
}

export interface UsageSummary {
  totalInstructions: number;
  totalTokens: number;
  totalCostUsd: number;
  bufferUsd: number;
  remainingUsd: number;
  percentUsed: number;
  level: BudgetLevel;
  events: UsageEvent[];
}

export class BudgetMonitor {
  private usageEvents: UsageEvent[] = [];
  private totalInstructions = 0;
  private totalTokens = 0;
  private totalCostUsd = 0;

  constructor(
    private bufferUsd: number,
    private bufferHbar: number,
    private warningThreshold = 0.8,
    private criticalThreshold = 0.95,
  ) {
    if (bufferUsd < 0 || !isFinite(bufferUsd)) {
      throw new Error(`Invalid bufferUsd: must be non-negative, got ${bufferUsd}`);
    }
    if (bufferHbar < 0 || !isFinite(bufferHbar)) {
      throw new Error(`Invalid bufferHbar: must be non-negative, got ${bufferHbar}`);
    }
    if (warningThreshold < 0 || warningThreshold > 1) {
      throw new Error(`Invalid warningThreshold: must be 0-1, got ${warningThreshold}`);
    }
    if (criticalThreshold < 0 || criticalThreshold > 1) {
      throw new Error(`Invalid criticalThreshold: must be 0-1, got ${criticalThreshold}`);
    }
    if (warningThreshold >= criticalThreshold) {
      throw new Error(`warningThreshold (${warningThreshold}) must be < criticalThreshold (${criticalThreshold})`);
    }
  }

  /**
   * Record a usage event (instruction execution, LLM call, etc.)
   * 
   * @param costUsd - Cost of this event in USD
   * @param tokens - Number of LLM tokens consumed (0 if not an LLM call)
   * @param instructions - Number of instructions executed (typically 1 per event)
   */
  recordUsage(costUsd: number, tokens: number, instructions: number): void {
    if (costUsd < 0 || !isFinite(costUsd)) {
      throw new Error(`Invalid costUsd: must be non-negative, got ${costUsd}`);
    }
    if (tokens < 0 || !Number.isInteger(tokens)) {
      throw new Error(`Invalid tokens: must be non-negative integer, got ${tokens}`);
    }
    if (instructions < 0 || !Number.isInteger(instructions)) {
      throw new Error(`Invalid instructions: must be non-negative integer, got ${instructions}`);
    }

    this.usageEvents.push({
      timestamp: new Date().toISOString(),
      costUsd,
      tokens,
      instructions,
    });

    this.totalCostUsd += costUsd;
    this.totalTokens += tokens;
    this.totalInstructions += instructions;
  }

  /**
   * Get current budget status
   * 
   * @returns Status with used/remaining amounts, percent used, and level
   */
  getStatus(): BudgetStatus {
    const usedUsd = this.totalCostUsd;
    const remainingUsd = Math.max(0, this.bufferUsd - usedUsd);
    
    // Handle zero buffer: any usage exhausts it immediately
    let percentUsed: number;
    if (this.bufferUsd === 0) {
      percentUsed = usedUsd > 0 ? Infinity : 0;
    } else {
      percentUsed = usedUsd / this.bufferUsd;
    }

    let level: BudgetLevel;
    if (percentUsed >= 1.0) {
      level = 'exhausted';
    } else if (percentUsed >= this.criticalThreshold) {
      level = 'critical';
    } else if (percentUsed >= this.warningThreshold) {
      level = 'warning';
    } else {
      level = 'ok';
    }

    return {
      usedUsd,
      remainingUsd,
      percentUsed,
      level,
    };
  }

  /**
   * Check if the agent should stop accepting instructions
   * 
   * Returns true when usage >= criticalThreshold or buffer exhausted.
   * Agent runtime should check this before executing each instruction.
   * 
   * @returns true if agent should stop, false otherwise
   */
  shouldStop(): boolean {
    const status = this.getStatus();
    return status.level === 'critical' || status.level === 'exhausted';
  }

  /**
   * Get full usage summary for settlement
   * 
   * Returns detailed breakdown with all events for rental completion.
   * This data is used by RentalManager.complete() for final settlement.
   * 
   * @returns Complete usage summary with event log
   */
  getUsageSummary(): UsageSummary {
    const status = this.getStatus();

    return {
      totalInstructions: this.totalInstructions,
      totalTokens: this.totalTokens,
      totalCostUsd: this.totalCostUsd,
      bufferUsd: this.bufferUsd,
      remainingUsd: status.remainingUsd,
      percentUsed: status.percentUsed,
      level: status.level,
      events: [...this.usageEvents], // Return copy to prevent external mutation
    };
  }
}

/**
 * Factory function to create a BudgetMonitor from a Rental object
 * 
 * @param rental - The rental to monitor
 * @param warningThreshold - Optional warning threshold (default 0.8)
 * @param criticalThreshold - Optional critical threshold (default 0.95)
 * @returns BudgetMonitor instance configured for this rental
 */
export function createBudgetMonitor(
  rental: Rental,
  warningThreshold = 0.8,
  criticalThreshold = 0.95,
): BudgetMonitor {
  return new BudgetMonitor(
    rental.usageBufferUsd,
    rental.usageBufferHbar,
    warningThreshold,
    criticalThreshold,
  );
}
