import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../src/server.js";

export const serverTests = [];

async function withServer(options, fn) {
  const server = createApp({
    logger: { info() {}, error() {} },
    ...options
  });
  server.listen(0);
  await once(server, "listening");
  const { port } = server.address();
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
    await once(server, "close");
  }
}

serverTests.push(["POST /api/audit returns a cache miss then hit", async () => {
  let fetches = 0;
  await withServer({
    config: { cacheTtlMs: 60_000, rateLimitMax: 10, rateLimitWindowMs: 60_000, maxConcurrentAudits: 5, requestTimeoutMs: 500, maxBodyBytes: 100_000 },
    fetchImpl: async () => {
      fetches += 1;
      return new Response("<title>Cached</title><h1>Same</h1>", {
        headers: { "content-type": "text/html" }
      });
    }
  }, async (baseUrl) => {
    const first = await postAudit(baseUrl, "https://example.com");
    const second = await postAudit(baseUrl, "https://example.com");

    assert.equal(first.status, 200);
    assert.equal(second.body.cache, "hit");
    assert.equal(fetches, 1);
  });
}]);

serverTests.push(["returns structured validation errors", async () => {
  await withServer({
    config: { cacheTtlMs: 0, rateLimitMax: 10, rateLimitWindowMs: 60_000, maxConcurrentAudits: 5, requestTimeoutMs: 500, maxBodyBytes: 100_000 }
  }, async (baseUrl) => {
    const result = await postAudit(baseUrl, "not-a-url");

    assert.equal(result.status, 400);
    assert.equal(result.body.ok, false);
    assert.equal(result.body.error.code, "INVALID_URL");
    assert.ok(result.body.requestId);
  });
}]);

serverTests.push(["enforces per-client rate limiting", async () => {
  await withServer({
    config: { cacheTtlMs: 0, rateLimitMax: 1, rateLimitWindowMs: 60_000, maxConcurrentAudits: 5, requestTimeoutMs: 500, maxBodyBytes: 100_000 },
    fetchImpl: async () => new Response("<title>One</title>", { headers: { "content-type": "text/html" } })
  }, async (baseUrl) => {
    await postAudit(baseUrl, "https://example.com/a", { "x-forwarded-for": "203.0.113.10" });
    const limited = await postAudit(baseUrl, "https://example.com/b", { "x-forwarded-for": "203.0.113.10" });

    assert.equal(limited.status, 429);
    assert.equal(limited.body.error.code, "RATE_LIMITED");
  });
}]);

serverTests.push(["enforces concurrency limits", async () => {
  let release;
  const blocker = new Promise((resolve) => { release = resolve; });

  await withServer({
    config: { cacheTtlMs: 0, rateLimitMax: 10, rateLimitWindowMs: 60_000, maxConcurrentAudits: 1, requestTimeoutMs: 1000, maxBodyBytes: 100_000 },
    fetchImpl: async () => {
      await blocker;
      return new Response("<title>Slow</title>", { headers: { "content-type": "text/html" } });
    }
  }, async (baseUrl) => {
    const first = postAudit(baseUrl, "https://example.com/a");
    await new Promise((resolve) => setTimeout(resolve, 30));
    const second = await postAudit(baseUrl, "https://example.com/b");
    release();
    await first;

    assert.equal(second.status, 503);
    assert.equal(second.body.error.code, "CONCURRENCY_LIMITED");
  });
}]);

async function postAudit(baseUrl, url, headers = {}) {
  const response = await fetch(`${baseUrl}/api/audit`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ url })
  });
  return { status: response.status, body: await response.json() };
}
