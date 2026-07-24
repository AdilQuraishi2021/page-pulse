import http from "node:http";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { auditUrl, normalizeAndValidateUrl } from "./auditor.js";
import { TtlCache } from "./cache.js";
import { AppError, errorResponse } from "./errors.js";
import { loadConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { FixedWindowRateLimiter } from "./rateLimiter.js";

export function createApp(options = {}) {
  const config = { ...loadConfig(), ...options.config };
  const cache = options.cache || new TtlCache(config.cacheTtlMs);
  const limiter = options.limiter || new FixedWindowRateLimiter({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMax
  });
  const logger = options.logger || createLogger();
  const fetchImpl = options.fetchImpl || fetch;
  let activeAudits = 0;

  return http.createServer(async (req, res) => {
    const requestId = req.headers["x-request-id"] || randomUUID();
    const startedAt = Date.now();
    res.setHeader("x-request-id", requestId);

    try {
      const clientId = getClientId(req);
      const rate = limiter.check(clientId);
      setRateHeaders(res, rate, config.rateLimitMax);
      if (!rate.allowed) {
        throw new AppError(429, "RATE_LIMITED", "Too many requests from this client.", {
          retryAfterSeconds: Math.ceil((rate.resetAt - Date.now()) / 1000)
        });
      }

      if (req.method === "GET" && req.url === "/") {
        return sendHtml(res, 200, homepage());
      }

      if (req.method === "GET" && req.url === "/health") {
        return sendJson(res, 200, { ok: true, service: "page-pulse", requestId });
      }

      if (req.method === "POST" && req.url === "/api/audit") {
        const body = await readJson(req, config.maxBodyBytes);
        return await handleAudit(body.url, { requestId, res });
      }

      if (req.method === "GET" && req.url?.startsWith("/api/audit?")) {
        const url = new URL(req.url, "http://localhost");
        return await handleAudit(url.searchParams.get("url"), { requestId, res });
      }

      throw new AppError(404, "NOT_FOUND", "Route not found.");
    } catch (error) {
      const rendered = errorResponse(error, requestId);
      logger.error({
        requestId,
        method: req.method,
        path: req.url,
        status: rendered.status,
        durationMs: Date.now() - startedAt,
        error: rendered.body.error
      });
      return sendJson(res, rendered.status, rendered.body);
    }

    async function handleAudit(inputUrl, { requestId, res }) {
      if (activeAudits >= config.maxConcurrentAudits) {
        throw new AppError(503, "CONCURRENCY_LIMITED", "The audit worker pool is full. Try again shortly.");
      }

      const normalizedUrl = normalizeAndValidateUrl(inputUrl);
      const cached = cache.get(normalizedUrl);
      if (cached) {
        logger.info({
          requestId,
          method: req.method,
          path: req.url,
          status: 200,
          durationMs: Date.now() - startedAt,
          cache: "hit"
        });
        return sendJson(res, 200, { ok: true, requestId, cache: "hit", audit: cached });
      }

      activeAudits += 1;
      try {
        const audit = await auditUrl(normalizedUrl, {
          fetchImpl,
          timeoutMs: config.requestTimeoutMs,
          maxBodyBytes: config.maxBodyBytes
        });
        cache.set(normalizedUrl, audit);
        logger.info({
          requestId,
          method: req.method,
          path: req.url,
          status: 200,
          durationMs: Date.now() - startedAt,
          cache: "miss"
        });
        return sendJson(res, 200, { ok: true, requestId, cache: "miss", audit });
      } finally {
        activeAudits -= 1;
      }
    }
  });
}

function getClientId(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

function setRateHeaders(res, rate, limit) {
  res.setHeader("ratelimit-limit", String(limit));
  res.setHeader("ratelimit-remaining", String(rate.remaining));
  res.setHeader("ratelimit-reset", String(Math.ceil(rate.resetAt / 1000)));
}

async function readJson(req, maxBytes) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) {
      throw new AppError(413, "REQUEST_TOO_LARGE", "Request body is too large.");
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw new AppError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendHtml(res, status, html) {
  res.writeHead(status, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
}

function homepage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Page Pulse</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; min-height: 100vh; background: #f7f8fb; color: #172033; display: flex; flex-direction: column; }
    main { width: min(920px, calc(100% - 32px)); margin: 0 auto; padding: 56px 0 36px; flex: 1; }
    h1 { font-size: clamp(2rem, 6vw, 4.2rem); line-height: 1; margin: 0 0 16px; letter-spacing: 0; }
    p { max-width: 680px; color: #566071; font-size: 1.05rem; line-height: 1.6; }
    form { display: grid; grid-template-columns: 1fr auto; gap: 10px; margin: 28px 0; }
    input, button { border-radius: 8px; border: 1px solid #c8cfda; font: inherit; padding: 13px 14px; }
    button { background: #1f6feb; color: white; border-color: #1f6feb; cursor: pointer; font-weight: 700; }
    pre { white-space: pre-wrap; background: #111827; color: #e5e7eb; border-radius: 8px; padding: 18px; overflow: auto; min-height: 180px; }
    footer { border-top: 1px solid #d9dee8; padding: 18px; text-align: center; color: #566071; }
    footer a { color: #1f6feb; font-weight: 700; }
    @media (max-width: 640px) { form { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <h1>Page Pulse</h1>
    <p>Production-grade URL auditing API with validation, timeouts, caching, per-client rate limiting, request IDs, and structured JSON errors.</p>
    <form id="audit-form">
      <input id="url" name="url" type="url" required placeholder="https://example.com">
      <button type="submit">Audit</button>
    </form>
    <pre id="output">Enter a URL to run an audit.</pre>
  </main>
  <footer><a href="https://digitalheroesco.com" rel="noopener">Built for Digital Heroes Training Task</a></footer>
  <script>
    const form = document.querySelector("#audit-form");
    const output = document.querySelector("#output");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      output.textContent = "Auditing...";
      const response = await fetch("/api/audit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: form.url.value })
      });
      output.textContent = JSON.stringify(await response.json(), null, 2);
    });
  </script>
</body>
</html>`;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = loadConfig();
  createApp({ config }).listen(config.port, () => {
    console.log(`Page Pulse listening on http://localhost:${config.port}`);
  });
}
