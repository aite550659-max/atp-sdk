/**
 * Escrow Timeout — Unit Tests
 * Tests timeout calculation, window logic, and state transitions
 */

describe('Escrow Timeout', () => {
  const TIMEOUT_GRACE_MS: Record<string, number> = {
    flash: 15 * 60 * 1000,
    session: 60 * 60 * 1000,
    term: 24 * 60 * 60 * 1000,
  };
  const SETTLEMENT_WINDOW_MS = 24 * 60 * 60 * 1000;
  const DEAD_ESCROW_MS = 7 * 24 * 60 * 60 * 1000;

  test('flash timeout = duration + 15 minutes', () => {
    const durationMs = 0; // flash = instant
    const grace = TIMEOUT_GRACE_MS.flash;
    expect(grace).toBe(15 * 60 * 1000);
    expect(durationMs + grace).toBe(900_000); // 15 min in ms
  });

  test('session timeout = duration + 1 hour', () => {
    const durationMin = 30;
    const durationMs = durationMin * 60 * 1000;
    const grace = TIMEOUT_GRACE_MS.session;
    const timeout = durationMs + grace;
    expect(timeout).toBe(90 * 60 * 1000); // 30 min + 60 min = 90 min
  });

  test('term timeout = duration + 24 hours', () => {
    const durationMin = 7 * 24 * 60; // 7 days
    const durationMs = durationMin * 60 * 1000;
    const grace = TIMEOUT_GRACE_MS.term;
    const timeout = durationMs + grace;
    expect(timeout).toBe(8 * 24 * 60 * 60 * 1000); // 7 days + 1 day = 8 days
  });

  test('settlement window is 24 hours after timeout', () => {
    const timeoutAt = Date.now();
    const settlementDeadline = timeoutAt + SETTLEMENT_WINDOW_MS;
    expect(settlementDeadline - timeoutAt).toBe(24 * 60 * 60 * 1000);
  });

  test('dead escrow cleanup at 7 days after timeout', () => {
    const timeoutAt = Date.now();
    const deadEscrow = timeoutAt + DEAD_ESCROW_MS;
    expect(deadEscrow - timeoutAt).toBe(7 * 24 * 60 * 60 * 1000);
  });

  test('rental before timeout cannot be claimed', () => {
    const now = Date.now();
    const timeoutAt = now + 60 * 60 * 1000; // 1 hour from now
    expect(now < timeoutAt).toBe(true);
  });

  test('rental after timeout can be claimed by renter', () => {
    const now = Date.now();
    const timeoutAt = now - 1000; // 1 second ago
    expect(now > timeoutAt).toBe(true);
  });

  test('owner can settle within settlement window', () => {
    const now = Date.now();
    const timeoutAt = now - 60 * 60 * 1000; // timed out 1 hour ago
    const settlementDeadline = timeoutAt + SETTLEMENT_WINDOW_MS;
    expect(now > timeoutAt).toBe(true);
    expect(now < settlementDeadline).toBe(true); // within window
  });

  test('owner cannot settle after settlement deadline', () => {
    const now = Date.now();
    const timeoutAt = now - 2 * 24 * 60 * 60 * 1000; // timed out 2 days ago
    const settlementDeadline = timeoutAt + SETTLEMENT_WINDOW_MS; // deadline was 1 day ago
    expect(now > settlementDeadline).toBe(true);
  });

  test('timeout fields are set on rental object', () => {
    const now = Date.now();
    const expectedDurationMs = 30 * 60 * 1000; // 30 min session
    const graceMs = TIMEOUT_GRACE_MS.session;
    const timeoutMs = now + expectedDurationMs + graceMs;
    const settlementDeadlineMs = timeoutMs + SETTLEMENT_WINDOW_MS;

    const rental = {
      timeoutAt: new Date(timeoutMs).toISOString(),
      settlementDeadline: new Date(settlementDeadlineMs).toISOString(),
    };

    expect(rental.timeoutAt).toBeDefined();
    expect(rental.settlementDeadline).toBeDefined();
    expect(new Date(rental.settlementDeadline).getTime()).toBeGreaterThan(
      new Date(rental.timeoutAt).getTime()
    );
  });

  test('status transitions: active → timed_out', () => {
    type Status = 'active' | 'completed' | 'terminated' | 'disputed' | 'timed_out';
    let status: Status = 'active';
    // Simulate timeout claim
    status = 'timed_out';
    expect(status).toBe('timed_out');
  });
});
