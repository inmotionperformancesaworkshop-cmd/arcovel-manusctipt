# RTQCC - Orchestrator Monorepo (v3.1 → Production Scaffold)

This repository is a full-stack scaffold implementing the v3.1 architecture you designed:
- Fastify API (HTTP + SSE)
- Worker process (Redis Streams consumer group)
- Redis Streams for reliable job queueing
- Postgres (Prisma) for durable metadata
- MinIO (S3-compatible) for content storage
- OpenAI provider adapter stub with AbortSignal support
- Docker Compose for local development

Goals:
- Reproduce your ManuscriptOrchestrator architecture as a backend worker
- Use `externalId` (RTQCC-...) as the canonical Redis key / channel name
- Create Redis consumer group reliably on worker startup
- Provide SSE endpoint that fans out worker events to clients
- Provide a clean codebase to extend with abort-aware provider streaming and token reconciliation

Workspace layout
- /api       — Fastify API server (job CRUD, start/pause/resume/cancel, SSE)
- /worker    — Worker process: ensures consumer groups, XREADGROUP loop, job processing
- /prisma    — Prisma schema & migrations
- /lib       — Shared interfaces and provider adapter skeletons

Quickstart (local)
1. Copy `.env.example` -> `.env` and adjust values.
2. Start dev environment:
   docker-compose up --build
3. Wait for Postgres / Redis / MinIO to be healthy.
4. From host, run Prisma migrate/generate (or the compose container will run generate):
   pnpm -w prisma:generate
5. API: http://localhost:3000
   - POST /jobs        -> create job (returns externalId)
   - POST /jobs/:id/start -> enqueue job to Redis Stream
   - GET  /jobs/:id/stream -> SSE progress

Notes
- This is a scaffold and intentionally conservative: provider adapter is a stub you can replace with a full OpenAI streaming implementation that accepts AbortSignal.
- Worker publishes progress events to Redis pub/sub channel: `job:{externalId}:events`. API subscribes and forwards to SSE consumers.
- Redis Streams group name: `orchestrators` on stream `jobs:pending`. Worker will create the group if missing.
- Job metadata and section state are persisted in Postgres via Prisma.

Next steps after this scaffold
- Implement OpenAI streaming adapter using official SDK / fetch streams and wire AbortSignal through the entire call chain.
- Add token accounting by reading OpenAI usage metadata and post-hoc tokenization.
- Add Prometheus metrics and health endpoints.
- Harden production deployment: K8s manifests, secrets, readiness probes.
