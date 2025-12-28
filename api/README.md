# API Service

Fastify server exposing:
- POST /api/jobs
- POST /api/jobs/:externalId/start
- GET  /api/jobs/:externalId/stream  (SSE)

Behavior:
- When /start is called it XADDs to Redis Stream `jobs:pending`.
- SSE endpoint subscribes to Redis pub/sub channel `job:{externalId}:events` and forwards events to clients.

Environment:
- REDIS_URL
- DATABASE_URL
- OPENAI_API_KEY

Run during development:
pnpm dev