import Redis from 'ioredis';
// @ts-ignore
import { PrismaClient } from '@prisma/client';
import { ensureGroup, STREAM_KEY, GROUP_NAME, jobChannel } from './redisHelpers';
import { GeminiAdapter } from './geminiAdapter';
import { Provider } from './provider';

const db = new PrismaClient();

export class JobService {
  redis: Redis;
  consumerName: string;
  provider: Provider;

  constructor(redis: Redis, consumerName = `orchestrator-${Math.random().toString(36).slice(2,6)}`) {
    this.redis = redis;
    this.consumerName = consumerName;
    // Use the Gemini Adapter with the Pro model for complex reasoning
    this.provider = new GeminiAdapter(process.env.API_KEY || '', 'gemini-3-pro-preview');
  }

  async init() {
    await ensureGroup(this.redis);
    await this.recoverAbandoned();
  }

  async recoverAbandoned() {
    const MIN_IDLE_TIME = 60000;
    const BATCH_SIZE = 10;
    let cursor = '0-0';
    try {
      do {
        const reply = await this.redis.xautoclaim(STREAM_KEY, GROUP_NAME, this.consumerName, MIN_IDLE_TIME, cursor, 'COUNT', BATCH_SIZE);
        if (!reply) break;
        const [nextCursor, entries] = reply as [string, any[]];
        cursor = nextCursor;
        if (entries && entries.length > 0) {
          for (const entry of entries) {
            const id = entry[0];
            const list = entry[1];
            const fields: Record<string, string> = {};
            for (let i = 0; i < list.length; i += 2) fields[list[i]] = list[i+1];
            await this.handleEntry(id, fields);
          }
        }
      } while (cursor !== '0-0');
    } catch (err) { console.error('Recovery error', err); }
  }

  async runLoop() {
    while (true) {
      try {
        const res = await this.redis.xreadgroup(
          'GROUP', GROUP_NAME, this.consumerName, 
          'COUNT', 1,
          'BLOCK', 5000, 
          'STREAMS', STREAM_KEY, 
          '>'
        );

        if (!res) continue;

        for (const [, entries] of res as any) {
          for (const entry of entries) {
            const id = entry[0];
            const list = entry[1];
            const fields: Record<string, string> = {};
            for (let i = 0; i < list.length; i += 2) {
              fields[list[i]] = list[i+1];
            }
            await this.handleEntry(id, fields);
          }
        }
      } catch (err) {
        console.error('Error in runLoop', err);
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  async handleEntry(id: string, fields: Record<string,string>) {
    const action = fields.action;
    const externalId = fields.externalId;
    
    if (!externalId) {
      await this.redis.xack(STREAM_KEY, GROUP_NAME, id);
      return;
    }

    try {
      if (action === 'start') {
        await this.processStartJob(externalId);
      }
      await this.redis.xack(STREAM_KEY, GROUP_NAME, id);
    } catch (err) {
      console.error(`Failed to process stream entry ${id}`, err);
    }
  }

  async processStartJob(externalId: string) {
    const job = await db.job.findUnique({ where: { externalId }, include: { sections: true } });
    if (!job) return;

    await db.job.update({ where: { id: job.id }, data: { status: 'running', startedAt: new Date() }});
    await this.redis.publish(jobChannel(externalId), JSON.stringify({ type: 'job.started', externalId }));

    const config: any = job.config || {};
    const generationOrder: string[] = config.generationOrder || (job.sections.map((s: any) => s.sectionId));
    const selected: Record<string, boolean> = config.selectedSections || job.sections.reduce((acc: any, s: any) => { acc[s.sectionId] = true; return acc; }, {});

    for (const sectionId of generationOrder) {
      if (!selected[sectionId]) continue;

      let section = await db.section.findFirst({ where: { jobId: job.id, sectionId }});
      if (!section) {
        section = await db.section.create({ data: { jobId: job.id, sectionId, status: 'queued' }});
      }

      await this.redis.publish(jobChannel(externalId), JSON.stringify({ type: 'section.queued', sectionId }));
      const ac = new AbortController();
      const signal = ac.signal;

      try {
        await db.section.update({ where: { id: section.id }, data: { status: 'generating', startedAt: new Date() }});

        // Prompt Construction
        const prompt = `Task: Write the "${sectionId}" section of the manuscript.
        
        Output Format: ${config.outputFormat}
        Target Audience: ${config.targetAudience}
        
        Please proceed with researching and writing this section.`;

        const providerRes = await this.provider.generateSection(sectionId, prompt, signal, async (pct) => {
          // Throttle DB updates, but stream Redis events freely
          if (Math.random() > 0.7) { 
             await db.section.update({ where: { id: section!.id }, data: { progress: Math.min(100, Math.round(pct)) }});
          }
          await this.redis.publish(jobChannel(externalId), JSON.stringify({ type: 'section.progress', sectionId, progress: Math.round(pct) }));
        });

        await db.section.update({
          where: { id: section.id },
          data: {
            status: 'complete',
            content: providerRes.content,
            tokenCount: providerRes.tokenCount,
            completedAt: new Date(),
            progress: 100
          }
        });

        await db.job.update({ where: { id: job.id }, data: { totalTokens: { increment: providerRes.tokenCount }}});
        await this.redis.publish(jobChannel(externalId), JSON.stringify({ type: 'section.complete', sectionId, tokenCount: providerRes.tokenCount, content: providerRes.content }));
        
      } catch (err: any) {
        console.error(`Section ${sectionId} failed:`, err);
        await db.section.update({ where: { id: section.id }, data: { status: 'failed', attempts: { increment: 1 } }});
        await this.redis.publish(jobChannel(externalId), JSON.stringify({ type: 'section.failed', sectionId, error: err?.message || 'error' }));
      }
    }

    await db.job.update({ where: { id: job.id }, data: { status: 'complete', completedAt: new Date() }});
    await this.redis.publish(jobChannel(externalId), JSON.stringify({ type: 'job.complete', externalId }));
  }
}