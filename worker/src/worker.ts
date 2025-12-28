import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();
import { JobService } from './job-service';

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const redis = new Redis(REDIS_URL);

const run = async () => {
  const service = new JobService(redis);
  await service.init();

  // Graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down worker...');
    try { await redis.quit(); } catch {}
    (process as any).exit(0);
  };

  (process as any).on('SIGINT', shutdown);
  (process as any).on('SIGTERM', shutdown);

  console.log('Worker started, entering main loop');
  await service.runLoop();
};

run().catch(err => {
  console.error('Worker crashed', err);
  (process as any).exit(1);
});