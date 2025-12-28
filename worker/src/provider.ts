export interface ProviderResult {
  content: string;
  tokenCount: number;
  metadata?: Record<string, any>;
}

export interface Provider {
  generateSection(sectionId: string, prompt: string, signal?: AbortSignal, onProgress?: (pct: number) => void): Promise<ProviderResult>;
}