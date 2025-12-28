export type SectionId =
  | 'executiveSummary'
  | 'fundamentals'
  | 'q3Effect'
  | 'validation'
  | 'engineering'
  | 'applications'
  | 'economics'
  | 'ecosystem'
  | 'specifications'
  | 'appendices';

export type FormatId = 'comprehensive' | 'nature' | 'patent' | 'investor' | 'academic';

export type JobStatus = 'idle' | 'running' | 'paused' | 'complete' | 'failed' | 'cancelled';

export interface GenerationConfig {
  selectedSections: Record<SectionId, boolean>;
  outputFormat: FormatId;
  targetAudience: string;
  sanitizedOutput: boolean;
  generationOrder: SectionId[];
  maxRetries: number;
  citationConstraints: any;
}