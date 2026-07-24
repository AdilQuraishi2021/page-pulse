# Observability and Rollback Plan

## Monitor

- API request rate, p50/p95/p99 latency, status-code distribution, and error codes.
- Cache hit ratio and Redis latency.
- Rate-limit rejections by client and route.
- Active audits, queue depth, oldest queued job age, worker success/failure rate, and timeout rate.
- Outbound fetch latency, content-type rejection rate, response-size rejection rate, and DNS/connect errors.
- Saturation signals: CPU, memory, file descriptors, socket usage, and event-loop delay.

## Alert

- p95 API latency above SLA for 5 minutes.
- Error rate above 2% for 5 minutes, excluding expected `400` validation errors.
- Queue oldest job age above the SLA threshold.
- Redis unavailable or p95 Redis latency above 100 ms.
- Worker timeout rate or `FETCH_FAILED` rate spikes above baseline.
- Cache hit ratio drops sharply after a deploy.

## Rollback

Deploy with immutable versions and health checks. Use rolling or blue/green deployments:

1. Release to a small percentage of traffic.
2. Compare latency, error rate, timeout rate, and cache behavior with the previous version.
3. If alerts fire, route traffic back to the previous healthy version.
4. Keep database migrations backward-compatible for at least one release.
5. For config-caused incidents, roll back environment variables separately from code.
