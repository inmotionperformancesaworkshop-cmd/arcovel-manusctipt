# Operating Notes & Next Actions

Mandatory before production:
- Replace OpenAIAdapter stub with an abort-aware streaming implementation using OpenAI streaming API (or SDK).
- Ensure provider streams respect AbortSignal and report usage metadata.
- Add Redis consumer group monitoring and reclaiming logic for pending/idle consumers (XCLAIM).
- Use a canonical externalId consistently in logs, Redis keys, and channels.
- Secrets must be stored in K8s secrets / vault in production.
- Add health/readiness endpoints to the API and worker.

Short-term improvements:
- Implement XCLAIM and pending message reprocessing for crashed workers.
- Add token accounting: prefer provider-reported usage; fallback to tokenizers.
- Add Prometheus metrics on FSM transitions and event counts.

If you'd like, I can:
- Implement the OpenAI streaming adapter next (abort-aware, usage capture)
- Add XCLAIM + pending-claim repair loop in worker
- Add simple integration tests (local Redis & Postgres) for the stream flow