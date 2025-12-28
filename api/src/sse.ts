import { FastifyInstance, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import Redis from 'ioredis';

// @ts-ignore
declare module 'fastify' {
  interface FastifyInstance {
    redisSub: Redis;
  }
  interface FastifyReply {
    sse(event: { event?: string; data: string; id?: string }): void;
  }
}

export default fp(async (server: FastifyInstance) => {
  const sub = new Redis(process.env.REDIS_URL || '');
  server.decorate('redisSub', sub);

  // Manual SSE decorator to allow low-level control
  server.decorateReply('sse', function (this: FastifyReply, { event, data, id }: { event?: string; data: string; id?: string }) {
    this.raw.write(
      `${id ? `id: ${id}\n` : ''}${event ? `event: ${event}\n` : ''}data: ${data}\n\n`
    );
  });

  server.addHook('onClose', async () => {
    try { await sub.quit(); } catch {}
  });
});