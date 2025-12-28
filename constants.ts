import { SectionId, FormatId, Section, CitationConstraints } from './types';

export const ESSENTIAL_BY_FORMAT: Record<FormatId, SectionId[]> = {
  comprehensive: ['executiveSummary', 'fundamentals', 'q3Effect', 'validation'],
  nature: ['executiveSummary', 'q3Effect', 'validation'],
  patent: ['fundamentals', 'q3Effect', 'engineering'],
  investor: ['executiveSummary', 'applications', 'economics'],
  academic: ['executiveSummary', 'fundamentals', 'q3Effect', 'validation', 'appendices']
};

export const DEFAULT_CITATION_CONSTRAINTS: CitationConstraints = {
  approvedCorpusOnly: false,
  flagUnverified: true,
  maxCitationsPerSection: 50,
  requiredCitations: [
    '10.1103/PhysicsPhysiqueFizika.1.195', // Bell 1964
    '10.1016/j.physrep.2013.02.001' // Doherty NV review
  ]
};

export const SECTIONS_DATA: Section[] = [
  { id: 'executiveSummary', name: 'Executive Summary', pages: '1-6', category: 'core', estimatedTokens: 2000 },
  { id: 'fundamentals', name: 'Fundamental Physics', pages: '7-80', category: 'core', estimatedTokens: 25000 },
  { id: 'q3Effect', name: 'Q3 Effect Discovery', pages: '81-110', category: 'core', estimatedTokens: 12000 },
  { id: 'validation', name: 'Validation & Proof', pages: '111-150', category: 'core', estimatedTokens: 15000 },
  { id: 'engineering', name: 'Device Engineering', pages: '151-200', category: 'engineering', estimatedTokens: 18000 },
  { id: 'applications', name: 'Applications', pages: '231-280', category: 'business', estimatedTokens: 16000 },
  { id: 'economics', name: 'Economics & Strategy', pages: '281-320', category: 'business', estimatedTokens: 14000 },
  { id: 'ecosystem', name: 'SA Quantum Ecosystem', pages: '321-350', category: 'business', estimatedTokens: 10000 },
  { id: 'specifications', name: 'Technical Specs', pages: '351-400', category: 'engineering', estimatedTokens: 17000 },
  { id: 'appendices', name: 'Appendices & References', pages: '431-520', category: 'appendix', estimatedTokens: 20000 }
];

export const FORMATS = [
  { id: 'comprehensive', name: 'Comprehensive', subtitle: 'Full 520 pages', size: '~150,000 words' },
  { id: 'nature', name: 'Nature Article', subtitle: 'High Impact', size: '~4,500 words + SI' },
  { id: 'patent', name: 'Patent App', subtitle: 'IP Focused', size: '~25,000 words' },
  { id: 'investor', name: 'Investor Deck', subtitle: 'Pitch Ready', size: '~8,000 words' },
  { id: 'academic', name: 'Academic Thesis', subtitle: 'Deep Dive', size: '~50,000 words' }
] as const;

export const AUDIENCES = [
  { id: 'academic', name: 'Academic / Peer Review', focus: 'Technical rigor & citations' },
  { id: 'investor', name: 'Investors / Business', focus: 'Market opportunity & ROI' },
  { id: 'technical', name: 'Engineering Teams', focus: 'Implementation details' },
  { id: 'policy', name: 'Government / Policy', focus: 'Strategic impact & sov-tech' },
  { id: 'general', name: 'General Scientific', focus: 'Accessibility & clarity' }
];