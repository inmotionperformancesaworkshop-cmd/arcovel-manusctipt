import fetch from 'node-fetch';
import { Provider, ProviderResult } from './provider';

interface OpenAIStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    delta: {
      content?: string;
    };
    finish_reason: string | null;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * OpenAI Streaming Adapter
 * Connects to OpenAI API using native fetch/stream parsing to support:
 * - Real-time progress updates
 * - AbortSignal cancellation
 * - Token usage reporting (via stream_options)
 */
export class OpenAIAdapter implements Provider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'gpt-4o') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generateSection(
    sectionId: string, 
    prompt: string, 
    signal?: AbortSignal, 
    onProgress?: (pct: number) => void
  ): Promise<ProviderResult> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key is missing. Ensure OPENAI_API_KEY is set in environment.');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are a professional scientific writer for Arcovel. Write the requested manuscript section in Markdown format.' },
          { role: 'user', content: prompt }
        ],
        stream: true,
        stream_options: { include_usage: true }
      }),
      signal: signal as any
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API Error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    if (!response.body) {
      throw new Error('No response body received from OpenAI');
    }

    let content = '';
    let tokenCount = 0;
    let usageMetadata: any = undefined;
    
    // Heuristic: Estimate progress assuming ~5000 chars for a substantial section.
    // This allows the progress bar to move before completion.
    const EXPECTED_CHARS = 5000; 

    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    try {
      for await (const chunk of response.body) {
        // Manual check not strictly necessary if signal passed to fetch, but good for fast loops
        if (signal?.aborted) {
          throw new Error('Generation cancelled by user');
        }

        const decodedChunk = decoder.decode(chunk as Uint8Array, { stream: true });
        buffer += decodedChunk;

        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; 

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          
          const dataStr = trimmed.slice(6);
          if (dataStr === '[DONE]') continue;

          try {
            const data: OpenAIStreamChunk = JSON.parse(dataStr);
            
            // Accumulate content
            if (data.choices && data.choices.length > 0) {
              const delta = data.choices[0].delta;
              if (delta.content) {
                content += delta.content;
                
                // Report progress
                if (onProgress) {
                  const currentLen = content.length;
                  // Cap heuristic progress at 99% so it doesn't look stuck if we overshoot
                  const pct = Math.min(99, Math.floor((currentLen / EXPECTED_CHARS) * 100));
                  onProgress(pct);
                }
              }
            }

            // Capture final usage stats
            if (data.usage) {
              usageMetadata = data.usage;
              tokenCount = data.usage.completion_tokens;
            }
          } catch (e) {
            console.warn('Failed to parse SSE chunk:', line);
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || signal?.aborted) {
        throw new Error('Generation cancelled');
      }
      throw err;
    }

    // Fallback if usage not reported by API
    if (tokenCount === 0 && content.length > 0) {
      tokenCount = Math.ceil(content.length / 4);
    }

    return {
      content,
      tokenCount,
      metadata: {
        model: this.model,
        usage: usageMetadata
      }
    };
  }
}