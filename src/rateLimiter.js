export class FixedWindowRateLimiter {
  constructor({ windowMs, max }) {
    this.windowMs = windowMs;
    this.max = max;
    this.clients = new Map();
  }

  check(clientId, now = Date.now()) {
    const current = this.clients.get(clientId);
    if (!current || current.resetAt <= now) {
      const resetAt = now + this.windowMs;
      this.clients.set(clientId, { count: 1, resetAt });
      return { allowed: true, remaining: this.max - 1, resetAt };
    }

    if (current.count >= this.max) {
      return { allowed: false, remaining: 0, resetAt: current.resetAt };
    }

    current.count += 1;
    return { allowed: true, remaining: this.max - current.count, resetAt: current.resetAt };
  }
}
