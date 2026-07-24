# Page Pulse

Production-grade URL audit service built for the Digital Heroes SDE qualification task.

## Run

```bash
npm test
npm start
```

The service starts on `http://localhost:3000` by default.

## Deploy

The app is deployment-ready as a single Node process:

```bash
docker build -t page-pulse .
docker run -p 3000:3000 --env-file .env.example page-pulse
```

For hosted platforms such as Render, Railway, Fly.io, or Azure App Service, use:

- Build command: none required
- Start command: `npm start`
- Health check: `/health`

The repo also includes Vercel-compatible serverless routes in `api/` and a static homepage in `public/`.

Live Task B architecture page: `/architecture.html`

## Configuration

| Variable | Default | Description |
| --- | ---: | --- |
| `PORT` | `3000` | HTTP port |
| `REQUEST_TIMEOUT_MS` | `5000` | Outbound fetch timeout |
| `CACHE_TTL_MS` | `300000` | Cache window for repeat URL audits |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Per-client rate-limit window |
| `RATE_LIMIT_MAX` | `30` | Requests allowed per client per window |
| `MAX_CONCURRENT_AUDITS` | `25` | Maximum active audits before 503 backpressure |
| `MAX_BODY_BYTES` | `1000000` | Maximum target HTML body size |

## API Contract

### `GET /health`

Returns service health.

```json
{
  "ok": true,
  "service": "page-pulse",
  "requestId": "generated-or-forwarded-id"
}
```

### `POST /api/audit`

Request:

```json
{
  "url": "https://example.com"
}
```

Success response:

```json
{
  "ok": true,
  "requestId": "3fd4cdd1-4c66-4cdb-b6d1-57e96a09d60b",
  "cache": "miss",
  "audit": {
    "url": "https://example.com/",
    "finalUrl": "https://example.com/",
    "fetchedAt": "2026-07-24T12:00:00.000Z",
    "status": 200,
    "ok": true,
    "responseTimeMs": 142,
    "contentType": "text/html; charset=utf-8",
    "page": {
      "title": "Example Domain",
      "description": null,
      "h1": "Example Domain",
      "canonical": null,
      "viewport": "width=device-width, initial-scale=1",
      "robots": null,
      "links": 1,
      "images": 0
    },
    "checks": {
      "reachable": true,
      "hasTitle": true,
      "hasMetaDescription": false,
      "hasH1": true,
      "hasCanonical": false,
      "hasViewport": true,
      "statusIsSuccess": true
    }
  }
}
```

`GET /api/audit?url=https://example.com` is also supported.

### Error Shape

All errors are structured and include the request ID:

```json
{
  "ok": false,
  "requestId": "3fd4cdd1-4c66-4cdb-b6d1-57e96a09d60b",
  "error": {
    "code": "INVALID_URL",
    "message": "The url must be an absolute HTTP or HTTPS URL."
  }
}
```

Common error codes: `INVALID_URL`, `INVALID_JSON`, `REQUEST_TOO_LARGE`, `TARGET_TOO_LARGE`, `UNSUPPORTED_CONTENT_TYPE`, `FETCH_TIMEOUT`, `FETCH_FAILED`, `RATE_LIMITED`, `CONCURRENCY_LIMITED`, `NOT_FOUND`.

## Production Features

- Input validation for absolute HTTP/HTTPS URLs.
- Fetch timeout via `AbortController`.
- Configurable in-memory TTL cache.
- Per-client fixed-window rate limiting using `x-forwarded-for` or socket IP.
- Concurrency backpressure with structured `503` responses.
- Structured JSON logs with request IDs.
- Node test suite and GitHub Actions CI.

## Repository Structure

```text
src/
  auditor.js      URL validation, fetch timeout handling, and page checks
  cache.js        TTL cache interface used by the API layer
  config.js       Environment-driven runtime configuration
  errors.js       Typed application errors and structured error rendering
  logger.js       JSON logger
  rateLimiter.js  Per-client fixed-window limiter
  server.js       HTTP routes, request IDs, rate limiting, cache orchestration
test/
  *.test.js       Meaningful unit and API behavior tests
  run-tests.js    Dependency-free in-process test runner
docs/
  architecture.md
  technology-decisions.md
  failure-modes.md
  observability-and-rollback.md
```

## Live Build Requirement

The homepage includes the required footer credit:

[Built for Digital Heroes Training Task](https://digitalheroesco.com)
