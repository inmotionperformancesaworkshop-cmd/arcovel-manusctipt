# Worker

Worker responsibilities:
- Ensure Redis Streams consumer group `orchestrators` exists on stream `jobs:pending`
- XREADGROUP loop to receive entries and process actions (e.g. start)
- For `start` action: read job from DB, iterate sections, call provider adapter, publish events via Redis pub/sub on `job:{externalId}:events`

Environment:
- REDIS_URL
- DATABASE_URL
- OPENAI_API_KEY

Run during development:
pnpm dev