export function intFromEnv(env, name, fallback, min = 0) {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < min) return fallback;
  return parsed;
}

export function loadConfig(env = process.env) {
  return {
    port: Number.parseInt(env.PORT || "3000", 10),
    requestTimeoutMs: intFromEnv(env, "REQUEST_TIMEOUT_MS", 5000, 100),
    cacheTtlMs: intFromEnv(env, "CACHE_TTL_MS", 300000, 0),
    rateLimitWindowMs: intFromEnv(env, "RATE_LIMIT_WINDOW_MS", 60000, 1000),
    rateLimitMax: intFromEnv(env, "RATE_LIMIT_MAX", 30, 1),
    maxConcurrentAudits: intFromEnv(env, "MAX_CONCURRENT_AUDITS", 25, 1),
    maxBodyBytes: intFromEnv(env, "MAX_BODY_BYTES", 1000000, 1024)
  };
}
