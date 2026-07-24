export class TtlCache {
  constructor(ttlMs) {
    this.ttlMs = ttlMs;
    this.entries = new Map();
  }

  get(key, now = Date.now()) {
    if (this.ttlMs <= 0) return undefined;
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key, value, now = Date.now()) {
    if (this.ttlMs <= 0) return;
    this.entries.set(key, {
      value,
      expiresAt: now + this.ttlMs
    });
  }

  clearExpired(now = Date.now()) {
    for (const [key, entry] of this.entries.entries()) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }
  }
}
