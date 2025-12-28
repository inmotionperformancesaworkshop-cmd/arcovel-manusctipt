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
export type SectionStatus = 'pending' | 'queued' | 'generating' | 'complete' | 'failed' | 'diffing';

export interface Section {
  id: SectionId;
  name: string;
  pages: string;
  category: 'core' | 'engineering' | 'business' | 'appendix';
  estimatedTokens: number;
}

export interface CitationConstraints {
  approvedCorpusOnly: boolean;
  flagUnverified: boolean;
  maxCitationsPerSection: number;
  requiredCitations: string[]; 
}

export interface SectionJob {
  sectionId: SectionId;
  status: SectionStatus;
  progress: number;
  content?: string;
  previousContent?: string;
  diff?: DiffResult;
  error?: string;
  attempts: number;
  startedAt?: number;
  completedAt?: number;
  tokenCount?: number;
}

export interface DiffResult {
  additions: number;
  deletions: number;
  modifications: number;
  significantChanges: string[];
  similarity: number;
}

export interface Citation {
  id: string;
  authors: string;
  title: string;
  journal?: string;
  year: number;
  doi?: string;
  referencedIn: SectionId[];
  validated: boolean;
  validationError?: string;
  citationCount?: number;
}

export interface LegalPrecedent {
  id: string;
  caseName: string;
  court: string;
  date: string;
  url: string;
  citation: string;
}

export interface CitationGraph {
  citations: Citation[];
  legalPrecedents?: LegalPrecedent[];
  orphanedRefs: string[];
  duplicates: Array<{ ids: string[]; reason: string }>;
  missingRefs: Array<{ sectionId: SectionId; refId: string }>;
  validationScore: number;
}

export interface PatentClaim {
  id: string;
  type: 'independent' | 'dependent';
  dependsOn?: string;
  text: string;
  noveltyScore: number;
  priorArtRisk: 'low' | 'medium' | 'high';
  supportingSections: SectionId[];
  sanitized: boolean;
}

export interface GenerationConfig {
  selectedSections: Record<SectionId, boolean>;
  outputFormat: FormatId;
  targetAudience: string;
  sanitizedOutput: boolean;
  generationOrder: SectionId[];
  maxRetries: number;
  citationConstraints: CitationConstraints;
}

export interface JobState {
  jobId: string;
  status: JobStatus;
  sections: Record<SectionId, SectionJob>;
  currentSection?: SectionId;
  startedAt?: number;
  completedAt?: number;
  totalTokens: number;
  config: GenerationConfig;
}

export type JobEvent = 
  | { type: 'START' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'CANCEL' }
  | { type: 'SECTION_COMPLETE'; sectionId: SectionId }
  | { type: 'SECTION_FAILED'; sectionId: SectionId; error: string }
  | { type: 'ALL_COMPLETE' }
  | { type: 'FATAL_ERROR'; error: string };

export interface GenerationProgressCallback {
  onProgress: (sectionId: SectionId, progress: number) => void;
  onSectionComplete: (sectionId: SectionId, content: string, tokenCount: number) => void;
  onSectionFailed: (sectionId: SectionId, error: string) => void;
  onJobComplete: () => void;
  onJobFailed: (error: string) => void;
}

// --- Notebook Types ---
export type NotebookAudience = 'general' | 'expert' | 'child' | 'investor';
export type NotebookReportType = 'summary' | 'faq' | 'timeline' | 'briefing';

export interface DataPoint {
  label: string;
  value: string;
  unit: string;
  context: string;
}

export interface NotebookState {
  audioUrl?: string;
  audioStatus: 'idle' | 'generating' | 'ready' | 'failed';
  reports: Record<NotebookReportType, string | null>;
  reportStatus: Record<NotebookReportType, 'idle' | 'generating' | 'ready' | 'failed'>;
  dataPoints: DataPoint[];
  dataStatus: 'idle' | 'generating' | 'ready' | 'failed';
}