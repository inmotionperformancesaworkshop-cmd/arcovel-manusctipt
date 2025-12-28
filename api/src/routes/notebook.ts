import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import prisma from '../lib/prismaClient';
import { GoogleGenAI, Modality, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export default async function notebookRoutes(server: FastifyInstance) {

  // GET /api/notebook/:externalId/audio
  server.post('/:externalId/audio', async (request: FastifyRequest, reply: FastifyReply) => {
    const { externalId } = request.params as any;
    const body: any = request.body || {};
    const audience = body.audience || 'general';

    const job = await prisma.job.findUnique({ where: { externalId }, include: { sections: true } });
    if (!job) return reply.notFound('Job not found');

    const fullText = job.sections
      .filter((s: any) => s.status === 'complete' && s.content)
      .map((s: any) => `## ${s.sectionId}\n${s.content}`)
      .join('\n\n');

    if (!fullText) return reply.badRequest('No content generated yet');

    try {
      const prompt = `Generate a lively, engaging podcast dialogue between two hosts (Host and Expert) discussing the following manuscript. 
      The target audience is: ${audience}.
      Make it conversational, insightful, and highlight the key innovations.
      
      Manuscript:
      ${fullText.substring(0, 30000)}... (truncated)`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            multiSpeakerVoiceConfig: {
              speakerVoiceConfigs: [
                { speaker: 'Host', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
                { speaker: 'Expert', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } } }
              ]
            }
          }
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) throw new Error('No audio generated');

      return reply.send({ audio: base64Audio });
    } catch (err: any) {
      server.log.error(err);
      return reply.internalServerError(err.message);
    }
  });

  // POST /api/notebook/:externalId/report
  server.post('/:externalId/report', async (request: FastifyRequest, reply: FastifyReply) => {
    const { externalId } = request.params as any;
    const body: any = request.body || {};
    const type = body.type || 'summary';

    const job = await prisma.job.findUnique({ where: { externalId }, include: { sections: true } });
    if (!job) return reply.notFound();

    const fullText = job.sections
      .filter((s: any) => s.status === 'complete')
      .map((s: any) => s.content)
      .join('\n\n');

    const prompts: Record<string, string> = {
      summary: "Create a comprehensive executive summary of this manuscript.",
      faq: "Generate a list of 10 Frequently Asked Questions (FAQ) and answers based on this text.",
      timeline: "Extract a chronological timeline of events, discoveries, or process steps mentioned.",
      briefing: "Write a strategic briefing document for stakeholders highlighting risks, opportunities, and key specs."
    };

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `${prompts[type] || prompts.summary}\n\nText:\n${fullText.substring(0, 50000)}`,
      });

      return reply.send({ text: response.text });
    } catch (err: any) {
      return reply.internalServerError(err.message);
    }
  });

  // POST /api/notebook/:externalId/data
  server.post('/:externalId/data', async (request: FastifyRequest, reply: FastifyReply) => {
    const { externalId } = request.params as any;
    const job = await prisma.job.findUnique({ where: { externalId }, include: { sections: true } });
    if (!job) return reply.notFound();

    const fullText = job.sections
      .filter((s: any) => s.status === 'complete')
      .map((s: any) => s.content)
      .join('\n\n');

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: "Extract key quantitative data points, specifications, and metrics from this text into a JSON array.",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING, description: "Name of the metric or data point" },
                value: { type: Type.STRING, description: "The numerical value or spec" },
                unit: { type: Type.STRING, description: "Unit of measurement" },
                context: { type: Type.STRING, description: "Brief context or section found" }
              }
            }
          }
        }
      });

      return reply.send({ data: JSON.parse(response.text || '[]') });
    } catch (err: any) {
      return reply.internalServerError(err.message);
    }
  });
}