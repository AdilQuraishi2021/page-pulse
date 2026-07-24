import { auditUrl, normalizeAndValidateUrl } from "../src/auditor.js";
import { TtlCache } from "../src/cache.js";
import { loadConfig } from "../src/config.js";
import { AppError, errorResponse } from "../src/errors.js";
import { createLogger } from "../src/logger.js";
import { FixedWindowRateLimiter } from "../src/rateLimiter.js";

const config = loadConfig();
const cache = new TtlCache(config.cacheTtlMs);
const limiter = new FixedWindowRateLimiter({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax
});
const logger = createLogger();
let activeAudits = 0;

export default async function handler(req, res) {
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  const startedAt = Date.now();
  res.setHeader("x-request-id", requestId);

  try {
    if (!["GET", "POST"].includes(req.method)) {
      throw new AppError(405, "METHOD_NOT_ALLOWED", "Use GET or POST for audits.");
    }

    const rate = limiter.check(clientId(req));
    res.setHeader("ratelimit-limit", String(config.rateLimitMax));
    res.setHeader("ratelimit-remaining", String(rate.remaining));
    res.setHeader("ratelimit-reset", String(Math.ceil(rate.resetAt / 1000)));

    if (!rate.allowed) {
      throw new AppError(429, "RATE_LIMITED", "Too many requests from this client.", {
        retryAfterSeconds: Math.ceil((rate.resetAt - Date.now()) / 1000)
      });
    }

    if (activeAudits >= config.maxConcurrentAudits) {
      throw new AppError(503, "CONCURRENCY_LIMITED", "The audit worker pool is full. Try again shortly.");
    }

    const inputUrl = req.method === "GET" ? req.query.url : bodyUrl(req.body);
    const normalizedUrl = normalizeAndValidateUrl(inputUrl);
    const cached = cache.get(normalizedUrl);
    if (cached) {
      logger.info({ requestId, method: req.method, path: req.url, status: 200, durationMs: Date.now() - startedAt, cache: "hit" });
      return json(res, 200, { ok: true, requestId, cache: "hit", audit: cached });
    }

    activeAudits += 1;
    try {
      const audit = await auditUrl(normalizedUrl, {
        timeoutMs: config.requestTimeoutMs,
        maxBodyBytes: config.maxBodyBytes
      });
      cache.set(normalizedUrl, audit);
      logger.info({ requestId, method: req.method, path: req.url, status: 200, durationMs: Date.now() - startedAt, cache: "miss" });
      return json(res, 200, { ok: true, requestId, cache: "miss", audit });
    } finally {
      activeAudits -= 1;
    }
  } catch (error) {
    const rendered = errorResponse(error, requestId);
    logger.error({ requestId, method: req.method, path: req.url, status: rendered.status, durationMs: Date.now() - startedAt, error: rendered.body.error });
    return json(res, rendered.status, rendered.body);
  }
}

function bodyUrl(body) {
  if (typeof body === "string") {
    try {
      return JSON.parse(body).url;
    } catch {
      throw new AppError(400, "INVALID_JSON", "Request body must be valid JSON.");
    }
  }
  return body?.url;
}

function clientId(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}

function json(res, status, payload) {
  res.status(status).json(payload);
}
