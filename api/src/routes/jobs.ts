import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import prisma from '../lib/prismaClient';
import redis from '../lib/redisClient';

export default async function routes(server: FastifyInstance) {
  
  // Create Job
  server.post('/jobs', async (request: FastifyRequest, reply: FastifyReply) => {
    const body: any = request.body || {};
    const externalId = `RTQCC-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
    const job = await prisma.job.create({
      data: {
        externalId,
        config: body.config || {},
        status: 'idle'
      }
    });
    return reply.send({ externalId, jobId: job.id });
  });

  // Start Job (Enqueue)
  server.post('/jobs/:externalId/start', async (request: FastifyRequest, reply: FastifyReply) => {
    const { externalId } = request.params as any;

    const streamKey = 'jobs:pending';
    const fields = {
      action: 'start',
      externalId
    };
    await redis.xadd(streamKey, '*', ...Object.entries(fields).flat());
    return reply.send({ enqueued: true, externalId });
  });

  // Debug: Simulate Stream Events
  server.post('/jobs/:externalId/simulate', async (request: FastifyRequest, reply: FastifyReply) => {
    const { externalId } = request.params as any;
    const channel = `job:${externalId}:events`;

    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    // Simulate a sequence of events
    (async () => {
      await redis.publish(channel, JSON.stringify({ type: 'job.started', externalId }));
      await sleep(500);
      await redis.publish(channel, JSON.stringify({ type: 'section.queued', sectionId: 'test-section' }));
      await sleep(500);
      await redis.publish(channel, JSON.stringify({ type: 'section.progress', sectionId: 'test-section', progress: 25 }));
      await sleep(500);
      await redis.publish(channel, JSON.stringify({ type: 'section.progress', sectionId: 'test-section', progress: 75 }));
      await sleep(500);
      await redis.publish(channel, JSON.stringify({ type: 'section.complete', sectionId: 'test-section', content: 'Debug content generated successfully.', tokenCount: 42 }));
      await sleep(500);
      await redis.publish(channel, JSON.stringify({ type: 'job.complete', externalId }));
    })();

    return reply.send({ started: true });
  });

  // Server-Sent Events (SSE) for Job Streaming
  server.get('/jobs/:externalId/stream', async (request: FastifyRequest, reply: FastifyReply) => {
    const { externalId } = request.params as any;
    const channel = `job:${externalId}:events`;

    // SSE Headers
    const headers = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    };
    reply.raw.writeHead(200, headers);

    server.log.info(`[SSE] Client connected to job ${externalId}`);

    // Create a dedicated Redis subscriber for this connection
    const sub = redis.duplicate();

    // Promise that resolves when connection closes to keep the handler alive
    let resolveClose: () => void;
    const closePromise = new Promise<void>(resolve => {
      resolveClose = resolve;
    });

    // Cleanup function
    const cleanup = () => {
      server.log.info(`[SSE] Client disconnected from job ${externalId}`);
      sub.quit().catch(() => {});
      if (resolveClose) resolveClose();
    };

    request.raw.on('close', cleanup);
    request.raw.on('error', cleanup);

    // Subscribe to Redis events
    sub.subscribe(channel, (err) => {
      if (err) {
        server.log.error(`[SSE] Failed to subscribe: ${err.message}`);
        reply.sse({ event: 'error', data: JSON.stringify({ message: 'Failed to subscribe' }) });
        cleanup();
      }
    });

    sub.on('message', (chan, message) => {
      if (chan === channel) {
        // Forward Redis message to SSE client
        reply.sse({ data: message });
      }
    });

    // Send initial snapshot
    try {
      const job = await prisma.job.findUnique({ where: { externalId }, include: { sections: true } });
      if (job) {
        reply.sse({ 
          event: 'snapshot', 
          data: JSON.stringify({ 
            type: 'job.snapshot', 
            status: job.status, 
            sections: job.sections 
          }) 
        });
      } else {
        // If testing simulation, we might not have a job in DB if we generated a random ID on frontend only.
        // But the simulation endpoint doesn't need DB.
        reply.sse({ event: 'info', data: JSON.stringify({ message: 'Connected to stream' }) });
      }
    } catch (e) {
      server.log.error(`[SSE] Snapshot failed: ${e}`);
    }

    await closePromise;
  });
}