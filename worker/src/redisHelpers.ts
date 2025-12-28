import Redis from 'ioredis';

export const STREAM_KEY = 'jobs:pending';
export const GROUP_NAME = 'orchestrators';

export async function ensureGroup(redis: Redis) {
  try {
    // Try to create group; MKSTREAM creates stream if not exists
    await redis.xgroup('CREATE', STREAM_KEY, GROUP_NAME, '$', 'MKSTREAM');
    console.log('Created consumer group', GROUP_NAME);
  } catch (err: any) {
    // If group exists, ignore
    if (err.message && err.message.includes('BUSYGROUP')) {
      console.log('Consumer group already exists:', GROUP_NAME);
    } else {
      throw err;
    }
  }
}

export const jobChannel = (externalId: string) => `job:${externalId}:events`;
export const jobStreamKey = (externalId: string) => `job:${externalId}:stream`;
export const redisJobKey = (externalId: string) => `job:${externalId}:meta`;