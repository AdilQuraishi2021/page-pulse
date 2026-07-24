import assert from "node:assert/strict";
import { auditUrl, normalizeAndValidateUrl } from "../src/auditor.js";
import { AppError } from "../src/errors.js";

export const auditorTests = [];

auditorTests.push(["normalizes valid HTTP URLs", () => {
  assert.equal(normalizeAndValidateUrl(" https://example.com/path#section "), "https://example.com/path");
}]);

auditorTests.push(["rejects invalid protocols and loopback targets", () => {
  assert.throws(() => normalizeAndValidateUrl("file:///etc/passwd"), /Only http and https/);
  assert.throws(() => normalizeAndValidateUrl("http://localhost:3000"), /private network/);
  assert.throws(() => normalizeAndValidateUrl("http://192.168.1.10"), /private network/);
}]);

auditorTests.push(["audits HTML page signals", async () => {
  const response = new Response(`<!doctype html>
    <title>Example</title>
    <meta name="description" content="Demo page">
    <meta name="viewport" content="width=device-width">
    <link rel="canonical" href="https://example.com/">
    <h1>Hello</h1><a href="/a">A</a><img src="/x.png">`, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" }
  });
  Object.defineProperty(response, "url", { value: "https://example.com/" });

  const result = await auditUrl("https://example.com", { fetchImpl: async () => response });

  assert.equal(result.page.title, "Example");
  assert.equal(result.page.description, "Demo page");
  assert.equal(result.page.h1, "Hello");
  assert.equal(result.page.links, 1);
  assert.equal(result.checks.hasCanonical, true);
}]);

auditorTests.push(["returns structured timeout errors", async () => {
  await assert.rejects(
    () => auditUrl("https://example.com", {
      timeoutMs: 1,
      fetchImpl: async (_url, options) => new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      })
    }),
    (error) => error instanceof AppError && error.status === 504 && error.code === "FETCH_TIMEOUT"
  );
}]);
