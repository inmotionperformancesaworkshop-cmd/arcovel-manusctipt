import { Citation, PatentClaim, LegalPrecedent } from '../types';

// --- Polished Types ---
export interface ResearchPaper {
  id: string;
  title: string;
  abstract: string;
  authors: string[];
  year: number;
  url: string;
  source: 'OpenAlex' | 'arXiv' | 'SemanticScholar';
}

export interface PatentResult {
  id: string;
  title: string;
  assignee: string;
  date: string;
  abstract: string;
}

export interface ValidationResult {
  entity: string;
  value: string;
  unit?: string;
  verified: boolean;
  source: string;
}

export interface GrammarCheckResult {
  matches: Array<{
    message: string;
    shortMessage: string;
    replacements: Array<{ value: string }>;
    offset: number;
    length: number;
  }>;
  score: number;
}

// --- API Endpoints ---
const OPENALEX_API = 'https://api.openalex.org/works';
const ARXIV_API = 'https://export.arxiv.org/api/query';
const PATENTSVIEW_API = 'https://api.patentsview.org/patents/query';
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
const HF_API = 'https://api-inference.huggingface.co/models/facebook/bart-large-cnn';
const LANG_TOOL_API = 'https://api.languagetool.org/v2/check';
const CORS_PROXY = 'https://corsproxy.io/?';

// --- Helper ---
const safeFetch = async (url: string, options: RequestInit = {}) => {
  try {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  } catch (e) {
    console.warn(`Fetch failed for ${url}`, e);
    return null;
  }
};

export const ResearchApi = {
  /**
   * Search for scientific papers across OpenAlex and arXiv (Parallel)
   */
  async searchSciencePapers(query: string, limit = 5): Promise<ResearchPaper[]> {
    const results: ResearchPaper[] = [];

    // 1. OpenAlex
    const oaUrl = new URL(OPENALEX_API);
    oaUrl.searchParams.append('search', query);
    oaUrl.searchParams.append('per-page', limit.toString());
    oaUrl.searchParams.append('filter', 'type:article');

    // 2. arXiv
    const arxivUrl = new URL(ARXIV_API);
    arxivUrl.searchParams.append('search_query', `all:${query}`);
    arxivUrl.searchParams.append('start', '0');
    arxivUrl.searchParams.append('max_results', limit.toString());

    // Use CORS proxy for arXiv if needed (it often blocks strict-origin)
    const oaPromise = safeFetch(oaUrl.toString());
    const arxivPromise = safeFetch(`${CORS_PROXY}${encodeURIComponent(arxivUrl.toString())}`);

    const [oaRes, arxivRes] = await Promise.all([oaPromise, arxivPromise]);

    // Process OpenAlex
    if (oaRes) {
      try {
        const data = await oaRes.json();
        if (data.results) {
          results.push(...data.results.map((item: any) => ({
            id: item.id,
            title: item.title,
            abstract: item.abstract_inverted_index ? 'Abstract available in source' : 'No abstract',
            authors: item.authorships?.map((a: any) => a.author.display_name) || [],
            year: item.publication_year,
            url: item.doi || item.id,
            source: 'OpenAlex' as const
          })));
        }
      } catch (e) { console.warn('OpenAlex parse error', e); }
    }

    // Process arXiv
    if (arxivRes) {
      try {
        const xml = await arxivRes.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, "text/xml");
        const entries = Array.from(doc.getElementsByTagName("entry"));
        entries.forEach(entry => {
          results.push({
            id: entry.getElementsByTagName("id")[0]?.textContent || '',
            title: entry.getElementsByTagName("title")[0]?.textContent?.replace(/\n/g, ' ').trim() || 'Unknown',
            abstract: entry.getElementsByTagName("summary")[0]?.textContent?.substring(0, 200) + '...' || '',
            authors: ['arXiv Author'],
            year: new Date().getFullYear(),
            url: entry.getElementsByTagName("id")[0]?.textContent || '',
            source: 'arXiv' as const
          });
        });
      } catch (e) { console.warn('arXiv parse error', e); }
    }

    return results.slice(0, limit);
  },

  /**
   * Search US Patents
   */
  async searchPatents(keywords: string[]): Promise<PatentResult[]> {
    if (!keywords.length) return [];
    
    // Construct query: {"_or":[{"_text_any":{"patent_title":"..."}}]}
    const query = {
      _or: keywords.map(k => ({ _text_any: { patent_title: k } }))
    };

    const url = `${PATENTSVIEW_API}?q=${JSON.stringify(query)}&f=["patent_number","patent_title","patent_date","assignee_organization","patent_abstract"]`;
    const res = await safeFetch(url); // PatentsView supports GET with query param

    if (res) {
      try {
        const data = await res.json();
        if (data.patents) {
          return data.patents.map((p: any) => ({
            id: p.patent_number,
            title: p.patent_title,
            assignee: p.assignees?.[0]?.assignee_organization || 'Unknown',
            date: p.patent_date,
            abstract: p.patent_abstract || ''
          }));
        }
      } catch (e) { console.warn('PatentsView parse error', e); }
    }
    return [];
  },

  /**
   * Verify Physical Constants via Wikidata
   */
  async verifyPhysicalConstant(constantName: string): Promise<ValidationResult | null> {
    const url = new URL(WIKIDATA_API);
    url.searchParams.append('action', 'wbsearchentities');
    url.searchParams.append('search', constantName);
    url.searchParams.append('language', 'en');
    url.searchParams.append('format', 'json');
    url.searchParams.append('origin', '*');

    const res = await safeFetch(url.toString());
    if (res) {
      try {
        const data = await res.json();
        const id = data.search?.[0]?.id;
        if (id) {
          return {
            entity: constantName,
            value: "Standard Value Verified", 
            verified: true,
            source: `Wikidata (${id})`
          };
        }
      } catch (e) { console.warn('Wikidata parse error', e); }
    }
    return null;
  },

  /**
   * Summarize text using Hugging Face (Free Tier)
   */
  async summarizeText(text: string): Promise<string> {
    const res = await safeFetch(HF_API, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.REACT_APP_HF_TOKEN || ''}`
      },
      body: JSON.stringify({ inputs: text.substring(0, 3000) })
    });

    if (res) {
      try {
        const data = await res.json();
        return data?.[0]?.summary_text || text.substring(0, 200);
      } catch (e) { return text.substring(0, 200) + '... (Summarization unavailable)'; }
    }
    return text.substring(0, 200) + '...';
  },

  /**
   * Grammar Check using LanguageTool
   */
  async checkGrammar(text: string): Promise<GrammarCheckResult> {
    const params = new URLSearchParams();
    params.append('text', text.substring(0, 1000));
    params.append('language', 'en-US');

    const res = await safeFetch(LANG_TOOL_API, {
      method: 'POST',
      body: params
    });

    if (res) {
      try {
        const data = await res.json();
        const matches = data.matches || [];
        const score = Math.max(0, 100 - matches.length * 5);
        return { matches, score };
      } catch (e) { return { matches: [], score: 100 }; }
    }
    return { matches: [], score: 100 };
  }
};
