# Technology Decision Record

## Runtime: Node.js HTTP Service

Decision: Use Node.js with the built-in HTTP server and Fetch API.

Alternative rejected: Express with a large middleware stack. Express is familiar, but the required surface is small and Node's built-ins reduce dependency and supply-chain risk for this assessment.

## Cache and Rate Limiting: Redis in Production

Decision: Use in-memory implementations locally, with Redis as the production backing store.

Alternative rejected: Process memory only. It is fast and simple, but it breaks when the service has multiple instances and loses state on restart.

## Queue: Redis-backed BullMQ or Managed Queue

Decision: Use a bounded queue for burst absorption and asynchronous audit execution.

Alternative rejected: Unlimited in-process promises. That approach can exhaust sockets, memory, and file descriptors during a 500-request burst.

## Database: Postgres

Decision: Store durable audit metadata and customer history in Postgres.

Alternative rejected: Document-only storage. Audit records are structured and relational enough for Postgres, especially for account, API key, and reporting queries.

## Deployment: Containerized API and Workers

Decision: Package API and workers as containers behind a load balancer.

Alternative rejected: Single VM deployment. A VM can work early, but independent horizontal scaling and rollbacks are cleaner with containers.
