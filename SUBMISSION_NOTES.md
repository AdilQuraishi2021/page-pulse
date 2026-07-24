# Digital Heroes SDE Assessment Submission

## Applicant

Adil Quraishi

## Role

Role 03 / 16 - Software Development (SDE)

## Submitted Work

Task A and Task B are completed for the Page Pulse URL audit service.

## Links

- GitHub Repository: https://github.com/AdilQuraishi2021/page-pulse
- Live App: https://page-pulse-gules.vercel.app
- Live Architecture Page: https://page-pulse-gules.vercel.app/architecture.html
- Health Endpoint: https://page-pulse-gules.vercel.app/api/health

## Task A Summary

Page Pulse is a production-minded URL audit API with:

- HTTP/HTTPS URL validation
- Request timeout handling
- Concurrency backpressure
- Structured JSON errors
- Configurable cache window
- Per-client rate limiting
- Structured logs with request IDs
- Meaningful tests
- GitHub Actions CI on push and pull request
- README API contract
- Live deployed page with the required Digital Heroes footer credit

## Task B Summary

The scale design covers 10,000 audits per day, bursts of 500 concurrent requests, and customer-facing SLA needs through:

- Stateless API instances
- CDN/WAF and load balancer
- Redis-backed shared cache
- Redis-backed or managed queue
- Separate worker pool for audits
- Postgres for durable audit metadata
- Structured logs, metrics, tracing, alerting, and rollback plan
- Failure-mode analysis and mitigations

## AI Usage Note

I used AI assistance to speed up scaffolding, review edge cases, generate documentation structure, and refine the deployment flow. The implementation decisions, testing, deployment verification, and final submission choices were reviewed and validated by me, including running the API locally, testing Docker, pushing the public GitHub repo, and verifying the live Vercel deployment.

## Verification

The following checks were run successfully:

```bash
npm run build
npm test
```

The live deployment was also verified with:

- `GET /`
- `GET /architecture.html`
- `GET /api/health`
- `POST /api/audit`

The required footer credit appears on the public pages:

"Built for Digital Heroes Training Task" linked to https://digitalheroesco.com
