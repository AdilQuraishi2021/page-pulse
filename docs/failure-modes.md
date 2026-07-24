# Failure Mode Analysis

## 1. Target Websites Are Slow or Hang

Risk: Worker saturation causes customer-facing latency and cascading failures.

Mitigation: Enforce request timeouts, response-size limits, redirect limits, per-host concurrency limits, and bounded queues. Return `202` for queued work and `503` when global capacity is exhausted.

## 2. Redis Is Unavailable

Risk: Cache, rate limiting, and queue coordination degrade at the same time.

Mitigation: Run Redis in managed HA mode, alert on connection failures, use short local fallback limits for abuse protection, and temporarily bypass cache while preserving correctness. If queue Redis is unavailable, fail closed for new async work and keep health checks degraded.

## 3. Traffic Burst Exceeds Worker Capacity

Risk: Queue latency violates the SLA and stale jobs pile up.

Mitigation: Autoscale workers on queue depth and oldest job age, cap queue length, shed load with structured `503` responses, keep cache TTL configurable, and apply customer-specific rate limits/API quotas.
