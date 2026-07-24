import net from "node:net";
import { AppError } from "./errors.js";

const PRIVATE_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

export function normalizeAndValidateUrl(input) {
  if (typeof input !== "string" || input.trim() === "") {
    throw new AppError(400, "INVALID_URL", "A non-empty url string is required.");
  }

  let url;
  try {
    url = new URL(input.trim());
  } catch {
    throw new AppError(400, "INVALID_URL", "The url must be an absolute HTTP or HTTPS URL.");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new AppError(400, "INVALID_URL", "Only http and https URLs can be audited.");
  }

  if (PRIVATE_HOSTS.has(url.hostname) || isPrivateIpLiteral(url.hostname)) {
    throw new AppError(400, "INVALID_URL", "Localhost, loopback, and private network targets are not allowed.");
  }

  url.hash = "";
  return url.toString();
}

function isPrivateIpLiteral(hostname) {
  const host = hostname.replace(/^\[|\]$/g, "");
  const version = net.isIP(host);
  if (version === 0) return false;

  if (version === 4) {
    const parts = host.split(".").map((part) => Number.parseInt(part, 10));
    const [a, b] = parts;
    return (
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      a === 0
    );
  }

  const normalized = host.toLowerCase();
  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  );
}

export async function auditUrl(url, { fetchImpl = fetch, timeoutMs = 5000, maxBodyBytes = 1000000 } = {}) {
  const normalizedUrl = normalizeAndValidateUrl(url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = performance.now();

  try {
    const response = await fetchImpl(normalizedUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "PagePulse/1.0 (+https://digitalheroesco.com)"
      }
    });

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      throw new AppError(415, "UNSUPPORTED_CONTENT_TYPE", "Only HTML pages can be audited.", { contentType });
    }

    const html = await readLimitedText(response, maxBodyBytes);
    const responseTimeMs = Math.round(performance.now() - startedAt);

    return {
      url: normalizedUrl,
      finalUrl: response.url || normalizedUrl,
      fetchedAt: new Date().toISOString(),
      status: response.status,
      ok: response.ok,
      responseTimeMs,
      contentType,
      page: extractPageSignals(html),
      checks: buildChecks(response, html)
    };
  } catch (error) {
    if (error.name === "AbortError") {
      throw new AppError(504, "FETCH_TIMEOUT", "The target URL did not respond before the timeout.", { timeoutMs });
    }
    if (error instanceof AppError) throw error;
    throw new AppError(502, "FETCH_FAILED", "The target URL could not be fetched.", { cause: error.message });
  } finally {
    clearTimeout(timeout);
  }
}

async function readLimitedText(response, maxBodyBytes) {
  const reader = response.body?.getReader();
  if (!reader) return response.text();

  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBodyBytes) {
      throw new AppError(413, "TARGET_TOO_LARGE", "The target response body is larger than the configured audit limit.", { maxBodyBytes });
    }
    chunks.push(value);
  }

  return new TextDecoder().decode(concatUint8(chunks, total));
}

function concatUint8(chunks, total) {
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}

function extractPageSignals(html) {
  return {
    title: firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i),
    description: metaContent(html, "description"),
    h1: firstMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i),
    canonical: linkHref(html, "canonical"),
    viewport: metaContent(html, "viewport"),
    robots: metaContent(html, "robots"),
    links: countMatches(html, /<a\b/gi),
    images: countMatches(html, /<img\b/gi)
  };
}

function buildChecks(response, html) {
  const signals = extractPageSignals(html);
  return {
    reachable: response.ok,
    hasTitle: Boolean(signals.title),
    hasMetaDescription: Boolean(signals.description),
    hasH1: Boolean(signals.h1),
    hasCanonical: Boolean(signals.canonical),
    hasViewport: Boolean(signals.viewport),
    statusIsSuccess: response.status >= 200 && response.status < 400
  };
}

function firstMatch(html, pattern) {
  const match = html.match(pattern);
  return match ? cleanText(match[1]) : null;
}

function metaContent(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<meta\\b(?=[^>]*(?:name|property)=["']${escaped}["'])[^>]*content=["']([^"']*)["'][^>]*>`, "i");
  const match = html.match(pattern);
  return match ? cleanText(match[1]) : null;
}

function linkHref(html, rel) {
  const escaped = rel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<link\\b(?=[^>]*rel=["'][^"']*${escaped}[^"']*["'])[^>]*href=["']([^"']*)["'][^>]*>`, "i");
  const match = html.match(pattern);
  return match ? cleanText(match[1]) : null;
}

function countMatches(html, pattern) {
  return Array.from(html.matchAll(pattern)).length;
}

function cleanText(value) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}
