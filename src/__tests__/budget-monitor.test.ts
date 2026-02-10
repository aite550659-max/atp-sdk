/**
 * Budget Monitor Tests
 */

import { BudgetMonitor, createBudgetMonitor } from '../budget-monitor';
import { Rental } from '../types';

describe('BudgetMonitor', () => {
  describe('constructor validation', () => {
    it('should create monitor with valid parameters', () => {
      const monitor = new BudgetMonitor(100, 5, 0.8, 0.95);
      expect(monitor).toBeInstanceOf(BudgetMonitor);
    });

    it('should throw on negative bufferUsd', () => {
      expect(() => new BudgetMonitor(-1, 5, 0.8, 0.95)).toThrow('Invalid bufferUsd');
    });

    it('should throw on negative bufferHbar', () => {
      expect(() => new BudgetMonitor(100, -1, 0.8, 0.95)).toThrow('Invalid bufferHbar');
    });

    it('should throw on invalid warningThreshold', () => {
      expect(() => new BudgetMonitor(100, 5, -0.1, 0.95)).toThrow('Invalid warningThreshold');
      expect(() => new BudgetMonitor(100, 5, 1.5, 0.95)).toThrow('Invalid warningThreshold');
    });

    it('should throw on invalid criticalThreshold', () => {
      expect(() => new BudgetMonitor(100, 5, 0.8, -0.1)).toThrow('Invalid criticalThreshold');
      expect(() => new BudgetMonitor(100, 5, 0.8, 1.5)).toThrow('Invalid criticalThreshold');
    });

    it('should throw when warningThreshold >= criticalThreshold', () => {
      expect(() => new BudgetMonitor(100, 5, 0.95, 0.8)).toThrow('warningThreshold');
      expect(() => new BudgetMonitor(100, 5, 0.9, 0.9)).toThrow('warningThreshold');
    });

    it('should accept zero buffer', () => {
      const monitor = new BudgetMonitor(0, 0, 0.8, 0.95);
      expect(monitor).toBeInstanceOf(BudgetMonitor);
    });
  });

  describe('recordUsage', () => {
    it('should record usage correctly', () => {
      const monitor = new BudgetMonitor(100, 5, 0.8, 0.95);
      
      monitor.recordUsage(10, 500, 1);
      
      const summary = monitor.getUsageSummary();
      expect(summary.totalCostUsd).toBe(10);
      expect(summary.totalTokens).toBe(500);
      expect(summary.totalInstructions).toBe(1);
      expect(summary.events).toHaveLength(1);
    });

    it('should accumulate multiple usage events', () => {
      const monitor = new BudgetMonitor(100, 5, 0.8, 0.95);
      
      monitor.recordUsage(10, 500, 1);
      monitor.recordUsage(15, 750, 1);
      monitor.recordUsage(5, 250, 1);
      
      const summary = monitor.getUsageSummary();
      expect(summary.totalCostUsd).toBe(30);
      expect(summary.totalTokens).toBe(1500);
      expect(summary.totalInstructions).toBe(3);
      expect(summary.events).toHaveLength(3);
    });

    it('should throw on negative costUsd', () => {
      const monitor = new BudgetMonitor(100, 5, 0.8, 0.95);
      expect(() => monitor.recordUsage(-1, 0, 1)).toThrow('Invalid costUsd');
    });

    it('should throw on negative tokens', () => {
      const monitor = new BudgetMonitor(100, 5, 0.8, 0.95);
      expect(() => monitor.recordUsage(10, -1, 1)).toThrow('Invalid tokens');
    });

    it('should throw on non-integer tokens', () => {
      const monitor = new BudgetMonitor(100, 5, 0.8, 0.95);
      expect(() => monitor.recordUsage(10, 500.5, 1)).toThrow('Invalid tokens');
    });

    it('should throw on negative instructions', () => {
      const monitor = new BudgetMonitor(100, 5, 0.8, 0.95);
      expect(() => monitor.recordUsage(10, 500, -1)).toThrow('Invalid instructions');
    });

    it('should throw on non-integer instructions', () => {
      const monitor = new BudgetMonitor(100, 5, 0.8, 0.95);
      expect(() => monitor.recordUsage(10, 500, 1.5)).toThrow('Invalid instructions');
    });

    it('should accept zero-cost events', () => {
      const monitor = new BudgetMonitor(100, 5, 0.8, 0.95);
      monitor.recordUsage(0, 0, 0);
      
      const summary = monitor.getUsageSummary();
      expect(summary.totalCostUsd).toBe(0);
    });
  });

  describe('threshold transitions', () => {
    it('should transition ok → warning', () => {
      const monitor = new BudgetMonitor(100, 5, 0.8, 0.95);
      
      // Start at ok
      expect(monitor.getStatus().level).toBe('ok');
      
      // Use 75% (still ok)
      monitor.recordUsage(75, 1000, 1);
      expect(monitor.getStatus().level).toBe('ok');
      
      // Use 6% more (81% total - warning)
      monitor.recordUsage(6, 100, 1);
      expect(monitor.getStatus().level).toBe('warning');
    });

    it('should transition warning → critical', () => {
      const monitor = new BudgetMonitor(100, 5, 0.8, 0.95);
      
      // Jump to warning
      monitor.recordUsage(85, 1000, 1);
      expect(monitor.getStatus().level).toBe('warning');
      
      // Push to critical (96% total)
      monitor.recordUsage(11, 100, 1);
      expect(monitor.getStatus().level).toBe('critical');
    });

    it('should transition critical → exhausted', () => {
      const monitor = new BudgetMonitor(100, 5, 0.8, 0.95);
      
      // Jump to critical
      monitor.recordUsage(96, 1000, 1);
      expect(monitor.getStatus().level).toBe('critical');
      
      // Exhaust buffer (101% total)
      monitor.recordUsage(5, 100, 1);
      expect(monitor.getStatus().level).toBe('exhausted');
    });

    it('should handle exact threshold boundaries', () => {
      const monitor = new BudgetMonitor(100, 5, 0.8, 0.95);
      
      // Exactly 80% (warning starts)
      monitor.recordUsage(80, 1000, 1);
      expect(monitor.getStatus().level).toBe('warning');
      expect(monitor.getStatus().percentUsed).toBe(0.8);
      
      // Exactly 95% (critical starts)
      monitor.recordUsage(15, 200, 1);
      expect(monitor.getStatus().level).toBe('critical');
      expect(monitor.getStatus().percentUsed).toBe(0.95);
      
      // Exactly 100% (exhausted)
      monitor.recordUsage(5, 50, 1);
      expect(monitor.getStatus().level).toBe('exhausted');
      expect(monitor.getStatus().percentUsed).toBe(1.0);
    });

    it('should handle overspending (>100%)', () => {
      const monitor = new BudgetMonitor(100, 5, 0.8, 0.95);
      
      // Spend 150% of buffer
      monitor.recordUsage(150, 5000, 3);
      
      const status = monitor.getStatus();
      expect(status.level).toBe('exhausted');
      expect(status.usedUsd).toBe(150);
      expect(status.remainingUsd).toBe(0);
      expect(status.percentUsed).toBe(1.5);
    });
  });

  describe('shouldStop', () => {
    it('should return false when ok', () => {
      const monitor = new BudgetMonitor(100, 5, 0.8, 0.95);
      monitor.recordUsage(50, 1000, 1);
      
      expect(monitor.shouldStop()).toBe(false);
    });

    it('should return false when warning', () => {
      const monitor = new BudgetMonitor(100, 5, 0.8, 0.95);
      monitor.recordUsage(85, 1000, 1);
      
      expect(monitor.shouldStop()).toBe(false);
    });

    it('should return true when critical', () => {
      const monitor = new BudgetMonitor(100, 5, 0.8, 0.95);
      monitor.recordUsage(96, 1000, 1);
      
      expect(monitor.shouldStop()).toBe(true);
    });

    it('should return true when exhausted', () => {
      const monitor = new BudgetMonitor(100, 5, 0.8, 0.95);
      monitor.recordUsage(101, 1000, 1);
      
      expect(monitor.shouldStop()).toBe(true);
    });

    it('should return true at exact critical threshold', () => {
      const monitor = new BudgetMonitor(100, 5, 0.8, 0.95);
      monitor.recordUsage(95, 1000, 1);
      
      expect(monitor.shouldStop()).toBe(true);
      expect(monitor.getStatus().level).toBe('critical');
    });
  });

  describe('getStatus', () => {
    it('should calculate remaining USD correctly', () => {
      const monitor = new BudgetMonitor(100, 5, 0.8, 0.95);
      monitor.recordUsage(30, 1000, 1);
      
      const status = monitor.getStatus();
      expect(status.usedUsd).toBe(30);
      expect(status.remainingUsd).toBe(70);
      expect(status.percentUsed).toBe(0.3);
    });

    it('should never return negative remaining', () => {
      const monitor = new BudgetMonitor(100, 5, 0.8, 0.95);
      monitor.recordUsage(150, 5000, 3);
      
      const status = monitor.getStatus();
      expect(status.remainingUsd).toBe(0);
    });

    it('should handle fresh monitor', () => {
      const monitor = new BudgetMonitor(100, 5, 0.8, 0.95);
      
      const status = monitor.getStatus();
      expect(status.usedUsd).toBe(0);
      expect(status.remainingUsd).toBe(100);
      expect(status.percentUsed).toBe(0);
      expect(status.level).toBe('ok');
    });
  });

  describe('getUsageSummary', () => {
    it('should return complete summary', () => {
      const monitor = new BudgetMonitor(100, 5, 0.8, 0.95);
      
      monitor.recordUsage(10, 500, 1);
      monitor.recordUsage(20, 1000, 1);
      
      const summary = monitor.getUsageSummary();
      
      expect(summary.totalInstructions).toBe(2);
      expect(summary.totalTokens).toBe(1500);
      expect(summary.totalCostUsd).toBe(30);
      expect(summary.bufferUsd).toBe(100);
      expect(summary.remainingUsd).toBe(70);
      expect(summary.percentUsed).toBe(0.3);
      expect(summary.level).toBe('ok');
      expect(summary.events).toHaveLength(2);
    });

    it('should return copy of events (immutable)', () => {
      const monitor = new BudgetMonitor(100, 5, 0.8, 0.95);
      
      monitor.recordUsage(10, 500, 1);
      
      const summary1 = monitor.getUsageSummary();
      summary1.events.push({
        timestamp: new Date().toISOString(),
        costUsd: 999,
        tokens: 999,
        instructions: 999,
      });
      
      const summary2 = monitor.getUsageSummary();
      expect(summary2.events).toHaveLength(1);
      expect(summary2.totalCostUsd).toBe(10);
    });

    it('should include timestamps in events', () => {
      const monitor = new BudgetMonitor(100, 5, 0.8, 0.95);
      
      monitor.recordUsage(10, 500, 1);
      
      const summary = monitor.getUsageSummary();
      expect(summary.events[0].timestamp).toBeDefined();
      expect(new Date(summary.events[0].timestamp).getTime()).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle zero buffer', () => {
      const monitor = new BudgetMonitor(0, 0, 0.8, 0.95);
      
      expect(monitor.getStatus().level).toBe('ok');
      expect(monitor.getStatus().percentUsed).toBe(0);
      
      // Any usage exhausts zero buffer
      monitor.recordUsage(0.01, 1, 1);
      
      expect(monitor.getStatus().level).toBe('exhausted');
      expect(monitor.shouldStop()).toBe(true);
    });

    it('should handle very small buffer', () => {
      const monitor = new BudgetMonitor(0.01, 0.0005, 0.8, 0.95);
      
      monitor.recordUsage(0.008, 10, 1);
      expect(monitor.getStatus().level).toBe('warning');
      
      monitor.recordUsage(0.002, 5, 1);
      expect(monitor.getStatus().level).toBe('exhausted');
    });

    it('should handle very large buffer', () => {
      const monitor = new BudgetMonitor(1_000_000, 50_000, 0.8, 0.95);
      
      monitor.recordUsage(500_000, 1_000_000, 100);
      expect(monitor.getStatus().level).toBe('ok');
      
      monitor.recordUsage(300_000, 600_000, 60);
      expect(monitor.getStatus().level).toBe('warning');
      
      monitor.recordUsage(150_000, 300_000, 30);
      expect(monitor.getStatus().level).toBe('critical');
    });

    it('should handle custom thresholds', () => {
      // Aggressive thresholds (warn at 50%, critical at 75%)
      const monitor = new BudgetMonitor(100, 5, 0.5, 0.75);
      
      monitor.recordUsage(40, 1000, 1);
      expect(monitor.getStatus().level).toBe('ok');
      
      monitor.recordUsage(15, 500, 1);
      expect(monitor.getStatus().level).toBe('warning');
      
      monitor.recordUsage(21, 700, 1);
      expect(monitor.getStatus().level).toBe('critical');
      expect(monitor.shouldStop()).toBe(true);
    });

    it('should handle many small events', () => {
      const monitor = new BudgetMonitor(100, 5, 0.8, 0.95);
      
      // Record 1000 tiny events
      for (let i = 0; i < 1000; i++) {
        monitor.recordUsage(0.05, 10, 1);
      }
      
      const summary = monitor.getUsageSummary();
      expect(summary.totalCostUsd).toBeCloseTo(50, 2); // Allow floating point precision
      expect(summary.totalTokens).toBe(10_000);
      expect(summary.totalInstructions).toBe(1000);
      expect(summary.events).toHaveLength(1000);
      expect(summary.level).toBe('ok');
    });
  });

  describe('createBudgetMonitor factory', () => {
    const mockRental: Rental = {
      rentalId: 'rental_test_123',
      agentId: '0.0.12345',
      renter: '0.0.11111',
      owner: '0.0.22222',
      rentalType: 'session',
      stakeUsd: 50,
      stakeHbar: 2.5,
      usageBufferUsd: 100,
      usageBufferHbar: 5,
      escrowAccount: '0.0.99999',
      pricingSnapshot: {
        flashBaseFee: 0.07,
        standardBaseFee: 5.0,
        perInstruction: 0.05,
        perMinute: 0.01,
        llmMarkupBps: 150,
        toolMarkupBps: 150,
      },
      constraints: {
        toolsBlocked: [],
        memoryAccessLevel: 'sandboxed',
        topicsBlocked: [],
        maxPerInstructionCost: 100,
        maxDailyCost: 1000,
      },
      startedAt: new Date().toISOString(),
      status: 'active',
    };

    it('should create monitor from rental', () => {
      const monitor = createBudgetMonitor(mockRental);
      
      expect(monitor).toBeInstanceOf(BudgetMonitor);
      
      const summary = monitor.getUsageSummary();
      expect(summary.bufferUsd).toBe(100);
    });

    it('should use default thresholds', () => {
      const monitor = createBudgetMonitor(mockRental);
      
      // Test default warning threshold (0.8)
      monitor.recordUsage(79, 1000, 1);
      expect(monitor.getStatus().level).toBe('ok');
      
      monitor.recordUsage(2, 100, 1);
      expect(monitor.getStatus().level).toBe('warning');
      
      // Test default critical threshold (0.95)
      monitor.recordUsage(14, 500, 1);
      expect(monitor.getStatus().level).toBe('critical');
    });

    it('should accept custom thresholds', () => {
      const monitor = createBudgetMonitor(mockRental, 0.6, 0.9);
      
      monitor.recordUsage(55, 1000, 1);
      expect(monitor.getStatus().level).toBe('ok');
      
      monitor.recordUsage(10, 500, 1);
      expect(monitor.getStatus().level).toBe('warning');
      
      monitor.recordUsage(26, 1000, 1);
      expect(monitor.getStatus().level).toBe('critical');
    });
  });
});
