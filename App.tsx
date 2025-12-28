import React, { useState, useCallback, useEffect } from 'react';
import { 
  FileText, Download, Settings, Zap, CheckCircle, AlertCircle, Shield, 
  Eye, EyeOff, GripVertical, FileJson, RefreshCw, GitCompare,
  BookOpen, Scale, Loader2, Link2, Play, Pause, RotateCcw, Square, 
  Cpu, Activity, Archive, Layout, Signal, Headphones, Mic2, FileBarChart, Table
} from 'lucide-react';
import { 
  SectionId, FormatId, JobStatus, SectionStatus, CitationConstraints, 
  GenerationConfig, SectionJob, CitationGraph, PatentClaim, DiffResult,
  NotebookAudience, NotebookReportType, DataPoint, NotebookState
} from './types';
import { 
  ESSENTIAL_BY_FORMAT, DEFAULT_CITATION_CONSTRAINTS, SECTIONS_DATA, 
  FORMATS, AUDIENCES 
} from './constants';
import { orchestrator } from './services/orchestrator';

// --- Arcovel Logo Component ---
const ArcovelLogo = () => (
  <svg width="40" height="40" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Outer technical ring segments */}
    <path d="M50 5 A45 45 0 0 1 95 50" stroke="#475569" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    <path d="M95 50 A45 45 0 0 1 50 95" stroke="#475569" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
    <path d="M50 95 A45 45 0 0 1 5 50" stroke="#f97c16" strokeWidth="4" strokeLinecap="round" />
    <path d="M5 50 A45 45 0 0 1 50 5" stroke="#475569" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    
    {/* Inner mechanical ring */}
    <circle cx="50" cy="50" r="35" stroke="#1e293b" strokeWidth="8" opacity="0.8" />
    <circle cx="50" cy="50" r="35" stroke="#f97c16" strokeWidth="2" opacity="0.6" strokeDasharray="10 5" />

    {/* Center hub */}
    <circle cx="50" cy="50" r="10" fill="#f97c16" />
    
    {/* Needle pointer (SW direction) */}
    <path d="M50 50 L20 80" stroke="#f97c16" strokeWidth="4" strokeLinecap="round" />
    <circle cx="20" cy="80" r="3" fill="#fff" />
    
    {/* Decorative ticks */}
    <line x1="50" y1="15" x2="50" y2="25" stroke="#fff" strokeWidth="2" />
    <line x1="85" y1="50" x2="75" y2="50" stroke="#fff" strokeWidth="2" />
    <line x1="50" y1="85" x2="50" y2="75" stroke="#fff" strokeWidth="2" />
    <line x1="15" y1="50" x2="25" y2="50" stroke="#fff" strokeWidth="2" />
  </svg>
);

const SectionItem: React.FC<{
  sectionId: SectionId;
  index: number;
  essential: boolean;
  selected: boolean;
  dragged: boolean;
  onDragStart: (id: string) => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
  onToggle: (id: SectionId) => void;
  onMove: (id: SectionId, direction: 'up' | 'down') => void;
  isFirst: boolean;
  isLast: boolean;
}> = ({ sectionId, index, essential, selected, dragged, onDragStart, onDragOver, onDragEnd, onToggle, onMove, isFirst, isLast }) => {
  const section = SECTIONS_DATA.find(s => s.id === sectionId);
  if (!section) return null;

  return (
    <div
      draggable={!essential}
      onDragStart={() => onDragStart(sectionId)}
      onDragOver={(e) => onDragOver(e, sectionId)}
      onDragEnd={onDragEnd}
      className={`group flex items-center gap-4 p-4 bg-white rounded-xl border transition-all duration-200 ${
        dragged ? 'opacity-40 border-brand-500 shadow-inner bg-brand-50' : 'border-slate-200 hover:border-brand-300 hover:shadow-md'
      } ${!selected ? 'opacity-60 bg-slate-50' : ''}`}
    >
      <div className={`cursor-grab p-1 rounded hover:bg-slate-100 ${essential ? 'invisible' : 'text-slate-400'}`}>
        <GripVertical className="w-5 h-5" />
      </div>
      
      <div className="relative">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggle(sectionId)}
          disabled={essential}
          className="w-5 h-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-slate-100 text-slate-600 font-mono text-sm font-bold rounded-lg group-hover:bg-brand-100 group-hover:text-brand-700 transition-colors">
        {index + 1}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-slate-900 truncate">{section.name}</span>
          {essential && (
            <span className="px-2 py-0.5 bg-brand-100 text-brand-700 text-[10px] font-bold uppercase tracking-wide rounded-full">
              Essential
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Layout className="w-3 h-3" />
            {section.pages} pages
          </span>
          <span className="w-1 h-1 rounded-full bg-slate-300"></span>
          <span className="flex items-center gap-1">
            <Cpu className="w-3 h-3" />
            ~{(section.estimatedTokens / 1000).toFixed(0)}k tokens
          </span>
          <span className={`ml-auto px-2 py-0.5 rounded-md text-[10px] font-medium border ${
            section.category === 'core' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
            section.category === 'engineering' ? 'bg-cyan-50 text-cyan-700 border-cyan-200' :
            section.category === 'business' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
            'bg-slate-100 text-slate-700 border-slate-200'
          }`}>
            {section.category.toUpperCase()}
          </span>
        </div>
      </div>
    </div>
  );
};

const JobStatusBadge: React.FC<{ status: SectionStatus; progress: number }> = ({ status, progress }) => {
  switch (status) {
    case 'pending': return <span className="flex items-center gap-2 text-slate-400 text-sm"><div className="w-2 h-2 rounded-full bg-slate-300" /> Pending</span>;
    case 'queued': return <span className="flex items-center gap-2 text-brand-600 text-sm"><Loader2 className="w-3 h-3 animate-spin" /> Queued</span>;
    case 'generating': return <span className="flex items-center gap-2 text-purple-600 text-sm font-medium"><Loader2 className="w-3 h-3 animate-spin" /> Generating {progress}%</span>;
    case 'complete': return <span className="flex items-center gap-2 text-emerald-600 text-sm font-medium"><CheckCircle className="w-4 h-4" /> Complete</span>;
    case 'failed': return <span className="flex items-center gap-2 text-red-600 text-sm font-medium"><AlertCircle className="w-4 h-4" /> Failed</span>;
    case 'diffing': return <span className="flex items-center gap-2 text-amber-600 text-sm font-medium animate-pulse"><GitCompare className="w-3 h-3" /> Diffing</span>;
    default: return null;
  }
};

const NotebookView: React.FC<{
  jobId: string;
  notebookState: NotebookState;
  setNotebookState: React.Dispatch<React.SetStateAction<NotebookState>>;
}> = ({ jobId, notebookState, setNotebookState }) => {
  const [activeTab, setActiveTab] = useState<'audio' | 'reports' | 'data'>('audio');
  const [selectedAudience, setSelectedAudience] = useState<NotebookAudience>('general');
  const [selectedReport, setSelectedReport] = useState<NotebookReportType>('summary');

  const generateAudio = async () => {
    setNotebookState(p => ({ ...p, audioStatus: 'generating' }));
    try {
      const res = await fetch(`http://localhost:3000/api/notebook/${jobId}/audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audience: selectedAudience })
      });
      const data = await res.json();
      if (data.audio) {
        setNotebookState(p => ({ ...p, audioStatus: 'ready', audioUrl: `data:audio/wav;base64,${data.audio}` }));
      } else {
        throw new Error('No audio returned');
      }
    } catch (e) {
      setNotebookState(p => ({ ...p, audioStatus: 'failed' }));
    }
  };

  const generateReport = async (type: NotebookReportType) => {
    setNotebookState(p => ({ ...p, reportStatus: { ...p.reportStatus, [type]: 'generating' } }));
    try {
      const res = await fetch(`http://localhost:3000/api/notebook/${jobId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      });
      const data = await res.json();
      setNotebookState(p => ({ 
        ...p, 
        reports: { ...p.reports, [type]: data.text },
        reportStatus: { ...p.reportStatus, [type]: 'ready' }
      }));
    } catch (e) {
      setNotebookState(p => ({ ...p, reportStatus: { ...p.reportStatus, [type]: 'failed' } }));
    }
  };

  const extractData = async () => {
    setNotebookState(p => ({ ...p, dataStatus: 'generating' }));
    try {
      const res = await fetch(`http://localhost:3000/api/notebook/${jobId}/data`, { method: 'POST' });
      const data = await res.json();
      setNotebookState(p => ({ ...p, dataStatus: 'ready', dataPoints: data.data || [] }));
    } catch (e) {
      setNotebookState(p => ({ ...p, dataStatus: 'failed' }));
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden min-h-[600px] flex flex-col">
      <div className="bg-slate-900 text-white p-6 relative overflow-hidden">
        {/* Abstract Background Element */}
        <div className="absolute top-0 right-0 p-32 bg-brand-600 rounded-full blur-[100px] opacity-10 pointer-events-none"></div>

        <div className="flex items-center gap-4 mb-6 relative z-10">
          <ArcovelLogo />
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              <span className="text-slate-300">arc</span><span className="text-brand-500">ovel</span>
              <span className="ml-2 text-white font-light opacity-80">Notebook</span>
            </h2>
            <p className="text-slate-400 text-sm">AI-powered insights, audio overviews, and structured data extraction.</p>
          </div>
        </div>
        <div className="flex gap-1 bg-slate-800 p-1 rounded-lg w-fit relative z-10">
          <button onClick={() => setActiveTab('audio')} className={`px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium transition-colors ${activeTab === 'audio' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
            <Headphones className="w-4 h-4" /> Audio Overview
          </button>
          <button onClick={() => setActiveTab('reports')} className={`px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium transition-colors ${activeTab === 'reports' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
            <FileBarChart className="w-4 h-4" /> Reports
          </button>
          <button onClick={() => setActiveTab('data')} className={`px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium transition-colors ${activeTab === 'data' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
            <Table className="w-4 h-4" /> Data Table
          </button>
        </div>
      </div>

      <div className="p-6 flex-1 bg-slate-50">
        {activeTab === 'audio' && (
          <div className="max-w-2xl mx-auto space-y-8">
            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold text-slate-900">Deep Dive Audio Overview</h3>
              <p className="text-slate-600">Generate a podcast-style conversation about your manuscript.</p>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Target Audience</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['general', 'expert', 'child', 'investor'] as const).map(aud => (
                    <button
                      key={aud}
                      onClick={() => setSelectedAudience(aud)}
                      className={`px-3 py-2 rounded-lg border text-sm capitalize ${selectedAudience === aud ? 'bg-brand-50 border-brand-500 text-brand-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                      {aud}
                    </button>
                  ))}
                </div>
              </div>

              {notebookState.audioStatus === 'ready' && notebookState.audioUrl && (
                <div className="bg-slate-100 p-4 rounded-lg flex flex-col gap-2 items-center">
                  <div className="w-full flex justify-between items-center text-xs text-slate-500 font-mono mb-1">
                     <span>HOST (KORE)</span>
                     <span>EXPERT (FENRIR)</span>
                  </div>
                  <audio controls src={notebookState.audioUrl} className="w-full" />
                </div>
              )}

              {notebookState.audioStatus === 'generating' && (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 text-brand-600 animate-spin mx-auto mb-3" />
                  <p className="text-slate-600 font-medium">Synthesizing conversation...</p>
                  <p className="text-slate-400 text-xs mt-1">This may take up to a minute.</p>
                </div>
              )}

              {notebookState.audioStatus !== 'generating' && (
                <button 
                  onClick={generateAudio}
                  className="w-full py-4 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-brand-200 flex items-center justify-center gap-2 transition-transform active:scale-95"
                >
                  <Mic2 className="w-5 h-5" /> 
                  {notebookState.audioStatus === 'ready' ? 'Regenerate Overview' : 'Generate Audio Overview'}
                </button>
              )}
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="grid md:grid-cols-12 gap-6 h-full">
            <div className="md:col-span-3 space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2">Report Types</label>
              {(['summary', 'faq', 'timeline', 'briefing'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setSelectedReport(type)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${selectedReport === type ? 'bg-white border-brand-500 shadow-md text-brand-700 font-medium' : 'bg-slate-100 border-transparent text-slate-600 hover:bg-white hover:border-slate-300'}`}
                >
                  <div className="capitalize">{type}</div>
                </button>
              ))}
              <button 
                onClick={() => generateReport(selectedReport)}
                disabled={notebookState.reportStatus[selectedReport] === 'generating'}
                className="w-full mt-4 py-2 bg-slate-900 text-white rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-slate-800 disabled:opacity-50"
              >
                {notebookState.reportStatus[selectedReport] === 'generating' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Generate {selectedReport}
              </button>
            </div>
            <div className="md:col-span-9 bg-white rounded-xl border border-slate-200 p-8 shadow-sm h-[500px] overflow-y-auto font-mono text-sm leading-relaxed">
              {notebookState.reportStatus[selectedReport] === 'generating' ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin mb-2" />
                  Generating {selectedReport}...
                </div>
              ) : notebookState.reports[selectedReport] ? (
                <div className="whitespace-pre-wrap">{notebookState.reports[selectedReport]}</div>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 italic">
                  Select a report type and click generate to view insights.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'data' && (
          <div className="space-y-4">
             <div className="flex justify-between items-center">
               <h3 className="font-bold text-slate-900">Extracted Data Points</h3>
               <button 
                 onClick={extractData}
                 disabled={notebookState.dataStatus === 'generating'}
                 className="px-4 py-2 bg-brand-600 text-white rounded-lg font-medium flex items-center gap-2 hover:bg-brand-700 disabled:opacity-50"
               >
                 {notebookState.dataStatus === 'generating' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                 Extract Data
               </button>
             </div>
             
             <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
               <table className="w-full text-sm text-left">
                 <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                   <tr>
                     <th className="px-6 py-3">Metric / Label</th>
                     <th className="px-6 py-3">Value</th>
                     <th className="px-6 py-3">Unit</th>
                     <th className="px-6 py-3">Context</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                   {notebookState.dataPoints.length > 0 ? notebookState.dataPoints.map((dp, i) => (
                     <tr key={i} className="hover:bg-slate-50">
                       <td className="px-6 py-3 font-medium text-slate-900">{dp.label}</td>
                       <td className="px-6 py-3 text-brand-600 font-bold">{dp.value}</td>
                       <td className="px-6 py-3 text-slate-500">{dp.unit}</td>
                       <td className="px-6 py-3 text-slate-500 text-xs max-w-xs truncate" title={dp.context}>{dp.context}</td>
                     </tr>
                   )) : (
                     <tr>
                       <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">
                         {notebookState.dataStatus === 'generating' ? 'Analyzing manuscript text...' : 'No data extracted yet.'}
                       </td>
                     </tr>
                   )}
                 </tbody>
               </table>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Main App Component ---

const App: React.FC = () => {
  // --- Existing State ---
  const [selectedSections, setSelectedSections] = useState<Record<SectionId, boolean>>({
    executiveSummary: true, fundamentals: true, q3Effect: true, validation: true,
    engineering: true, applications: true, economics: true, ecosystem: true,
    specifications: true, appendices: true
  });
  const [outputFormat, setOutputFormat] = useState<FormatId>('comprehensive');
  const [targetAudience, setTargetAudience] = useState<string>('academic');
  const [sanitizedOutput, setSanitizedOutput] = useState<boolean>(false);
  const [generationOrder, setGenerationOrder] = useState<SectionId[]>(SECTIONS_DATA.map(s => s.id));
  const [maxRetries, setMaxRetries] = useState<number>(3);
  const [citationConstraints, setCitationConstraints] = useState<CitationConstraints>(DEFAULT_CITATION_CONSTRAINTS);
  
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus>('idle');
  const [sectionJobs, setSectionJobs] = useState<Record<string, SectionJob>>({});
  
  const [citationGraph, setCitationGraph] = useState<CitationGraph | null>(null);
  const [patentClaims, setPatentClaims] = useState<PatentClaim[]>([]);
  const [showCitationPanel, setShowCitationPanel] = useState(false);
  const [showPatentPanel, setShowPatentPanel] = useState(false);
  
  const [validatingCitations, setValidatingCitations] = useState(false);
  const [extractingClaims, setExtractingClaims] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [promptCopied, setPromptCopied] = useState(false);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

  // --- New Notebook State ---
  const [viewMode, setViewMode] = useState<'orchestrator' | 'notebook'>('orchestrator');
  const [notebookState, setNotebookState] = useState<NotebookState>({
    audioStatus: 'idle',
    reports: { summary: null, faq: null, timeline: null, briefing: null },
    reportStatus: { summary: 'idle', faq: 'idle', timeline: 'idle', briefing: 'idle' },
    dataPoints: [],
    dataStatus: 'idle'
  });

  // --- Effects ---
  const essentialSections = ESSENTIAL_BY_FORMAT[outputFormat];
  const isEssential = (id: SectionId) => essentialSections.includes(id);

  // Sync essential sections
  useEffect(() => {
    setSelectedSections(prev => {
      const next = { ...prev };
      essentialSections.forEach(id => next[id] = true);
      return next;
    });
    setGenerationOrder(prev => {
      const missing = essentialSections.filter(id => !prev.includes(id));
      return missing.length ? [...missing, ...prev] : prev;
    });
  }, [outputFormat, essentialSections]);

  // Cleanup on unmount (FIX #2)
  useEffect(() => {
    return () => {
      if (currentJobId && jobStatus !== 'complete' && !currentJobId.startsWith('SIM-')) {
        // Only cancel real jobs
        orchestrator.cancelJob(currentJobId);
      }
    };
  }, [currentJobId, jobStatus]);

  // --- Handlers (Existing) ---
  const toggleSection = useCallback((id: SectionId) => {
    if (isEssential(id)) return;
    setSelectedSections(prev => ({ ...prev, [id]: !prev[id] }));
  }, [essentialSections]);

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedItem || draggedItem === targetId) return;
    setGenerationOrder(prev => {
      const newOrder = [...prev];
      const fromIdx = newOrder.indexOf(draggedItem as SectionId);
      const toIdx = newOrder.indexOf(targetId as SectionId);
      if (fromIdx !== -1 && toIdx !== -1) {
        newOrder.splice(fromIdx, 1);
        newOrder.splice(toIdx, 0, draggedItem as SectionId);
      }
      return newOrder;
    });
  };

  const moveSection = (id: SectionId, dir: 'up' | 'down') => {
    setGenerationOrder(prev => {
      const idx = prev.indexOf(id);
      if ((dir === 'up' && idx === 0) || (dir === 'down' && idx === prev.length - 1)) return prev;
      const newOrder = [...prev];
      const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
      [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
      return newOrder;
    });
  };

  const getConfig = useCallback((): GenerationConfig => ({
    selectedSections,
    outputFormat,
    targetAudience,
    sanitizedOutput,
    generationOrder: generationOrder.filter(id => selectedSections[id]),
    maxRetries,
    citationConstraints
  }), [selectedSections, outputFormat, targetAudience, sanitizedOutput, generationOrder, maxRetries, citationConstraints]);

  const startGeneration = async () => {
    setErrorMessage('');
    try {
      const config = getConfig();
      const jobId = await orchestrator.createJob(config);
      setCurrentJobId(jobId);
      setJobStatus('running');
      
      const initialJobs: Record<string, SectionJob> = {};
      config.generationOrder.forEach(id => {
        initialJobs[id] = { sectionId: id, status: 'pending', progress: 0, attempts: 0 };
      });
      setSectionJobs(initialJobs);

      await orchestrator.executeJob(jobId, {
        onProgress: (sid, prog) => setSectionJobs((p: Record<string, SectionJob>) => {
          const prev = p[sid];
          return prev ? { ...p, [sid]: { ...prev, progress: prog, status: 'generating' } } : p;
        }),
        onSectionComplete: (sid, content, toks) => setSectionJobs((p: Record<string, SectionJob>) => {
          const prev = p[sid];
          return prev ? { ...p, [sid]: { ...prev, status: 'complete', content, tokenCount: toks } } : p;
        }),
        onSectionFailed: (sid, err) => setSectionJobs((p: Record<string, SectionJob>) => {
          const prev = p[sid];
          return prev ? { ...p, [sid]: { ...prev, status: 'failed', error: err } } : p;
        }),
        onJobComplete: () => setJobStatus('complete'),
        onJobFailed: (err) => { setJobStatus('failed'); setErrorMessage(err); }
      });
    } catch (err: any) {
      setJobStatus('failed');
      setErrorMessage(err.message || 'Start failed');
    }
  };

  const runSimulation = async () => {
    setErrorMessage('');
    setJobStatus('running');
    setSectionJobs({ 'test-section': { sectionId: 'test-section' as any, status: 'pending', progress: 0, attempts: 0 } });
    
    try {
      const simId = await orchestrator.runSimulation({
        onProgress: (sid, prog) => setSectionJobs((p: Record<string, SectionJob>) => ({
          ...p, [sid]: { ...(p[sid] || {}), progress: prog, status: 'generating' }
        })),
        onSectionComplete: (sid, content, toks) => setSectionJobs((p: Record<string, SectionJob>) => ({
          ...p, [sid]: { ...(p[sid] || {}), status: 'complete', content, tokenCount: toks }
        })),
        onSectionFailed: (sid, err) => setSectionJobs((p: Record<string, SectionJob>) => ({
          ...p, [sid]: { ...(p[sid] || {}), status: 'failed', error: err }
        })),
        onJobComplete: () => setJobStatus('complete'),
        onJobFailed: (err) => { setJobStatus('failed'); setErrorMessage(err); }
      });
      setCurrentJobId(simId);
    } catch (err: any) {
      setJobStatus('failed');
      setErrorMessage(err.message);
    }
  };

  const retrySection = async (sectionId: SectionId) => {
    if (!currentJobId) return;
    setSectionJobs(prev => ({ ...prev, [sectionId]: { ...prev[sectionId], status: 'generating', progress: 0 } }));
    try {
      const result = await orchestrator.retrySingleSection(currentJobId, sectionId, (prog) => {
        setSectionJobs(prev => ({ ...prev, [sectionId]: { ...prev[sectionId], progress: prog } }));
      });
      setSectionJobs(prev => ({ ...prev, [sectionId]: { ...prev[sectionId], status: 'complete', content: result.content, diff: result.diff } }));
    } catch (err: any) {
      setSectionJobs(prev => ({ ...prev, [sectionId]: { ...prev[sectionId], status: 'failed', error: err.message } }));
    }
  };

  const validateCitations = async () => {
    if (!currentJobId) return;
    setValidatingCitations(true);
    try {
      const graph = await orchestrator.validateCitations(currentJobId);
      setCitationGraph(graph);
      setShowCitationPanel(true);
    } catch (err) { setErrorMessage('Citation validation failed'); } 
    finally { setValidatingCitations(false); }
  };

  const extractClaims = async () => {
    if (!currentJobId) return;
    setExtractingClaims(true);
    try {
      const claims = await orchestrator.extractPatentClaims(currentJobId, sanitizedOutput);
      setPatentClaims(claims);
      setShowPatentPanel(true);
    } catch (err) { setErrorMessage('Claim extraction failed'); }
    finally { setExtractingClaims(false); }
  };

  const copyPrompt = async () => {
    const config = getConfig();
    const prompt = `# RTQCC Manuscript Spec v3.1\n\nFormat: ${outputFormat}\nAudience: ${targetAudience}\nProtected: ${sanitizedOutput}\n\nSections:\n${config.generationOrder.join('\n')}`;
    await navigator.clipboard.writeText(prompt);
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 2000);
  };

  const getOverallProgress = () => {
    const jobs = Object.values(sectionJobs);
    if (!jobs.length) return 0;
    return Math.round((jobs.filter((j: SectionJob) => j.status === 'complete').length / jobs.length) * 100);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Replaced Icon Box with Custom Logo */}
            <div className="flex-shrink-0">
               <ArcovelLogo />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 leading-tight">
                <span className="text-arc-DEFAULT">arc</span><span className="text-brand-500">ovel</span>
                <span className="text-slate-400 font-light ml-2">RTQCC Orchestrator</span>
              </h1>
              <p className="text-xs text-slate-500 font-medium tracking-wide uppercase">Licence-First Deep Tech Firmware</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button 
                onClick={() => setViewMode('orchestrator')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${viewMode === 'orchestrator' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Manuscript
              </button>
              <button 
                onClick={() => setViewMode('notebook')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${viewMode === 'notebook' ? 'bg-white shadow text-brand-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Notebook
              </button>
            </div>
            {currentJobId && (
              <div className="hidden md:flex flex-col items-end">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Session ID</span>
                <span className="font-mono text-xs text-slate-700 bg-slate-100 px-2 py-1 rounded border border-slate-200">{currentJobId}</span>
              </div>
            )}
            <button 
              onClick={runSimulation}
              disabled={jobStatus === 'running'}
              className="p-2 hover:bg-slate-100 rounded-full text-brand-600 hover:text-brand-700 transition-colors"
              title="Test Connection (Simulation)"
            >
              <Signal className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        
        {viewMode === 'notebook' ? (
          currentJobId ? (
            <NotebookView 
              jobId={currentJobId} 
              notebookState={notebookState}
              setNotebookState={setNotebookState}
            />
          ) : (
            <div className="text-center py-20 bg-white rounded-xl border border-slate-200 shadow-sm">
              <BookOpen className="w-16 h-16 text-slate-200 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-900">No Manuscript Active</h3>
              <p className="text-slate-500 mt-2">Generate a manuscript or run a simulation to unlock Notebook features.</p>
              <button onClick={runSimulation} className="mt-6 px-6 py-2 bg-brand-600 text-white rounded-lg font-bold hover:bg-brand-700">
                Run Simulation
              </button>
            </div>
          )
        ) : (
          /* ORCHESTRATOR VIEW */
          <div className="grid lg:grid-cols-12 gap-8">
             {/* LEFT COLUMN: Configuration */}
             <div className="lg:col-span-4 space-y-6">
               
               {/* Global Controls */}
               <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
                 <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                   <Shield className="w-4 h-4 text-brand-600" /> Global Constraints
                 </h2>
                 
                 <div className="space-y-3">
                   <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                     <div className="flex items-center gap-3">
                       <div className={`p-2 rounded-md ${sanitizedOutput ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-500'}`}>
                         {sanitizedOutput ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                       </div>
                       <div className="flex flex-col">
                         <span className="text-sm font-semibold text-slate-900">IP Protection</span>
                         <span className="text-[10px] text-slate-500">{sanitizedOutput ? 'Strict Sanitization' : 'Open Mode'}</span>
                       </div>
                     </div>
                     <button 
                       onClick={() => setSanitizedOutput(!sanitizedOutput)}
                       className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${sanitizedOutput ? 'bg-brand-600' : 'bg-slate-300'}`}
                     >
                       <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${sanitizedOutput ? 'translate-x-6' : 'translate-x-1'}`} />
                     </button>
                   </div>

                   <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="flex items-center gap-3">
                       <div className="p-2 bg-slate-200 text-slate-600 rounded-md">
                         <RefreshCw className="w-4 h-4" />
                       </div>
                       <span className="text-sm font-semibold text-slate-900">Max Retries</span>
                     </div>
                     <input 
                       type="number" min="1" max="5" 
                       value={maxRetries} onChange={e => setMaxRetries(Number(e.target.value))}
                       className="w-16 text-center text-sm font-bold border-slate-300 rounded-md focus:ring-brand-500 focus:border-brand-500"
                     />
                   </div>

                   <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                     <div className="flex items-center gap-3">
                       <div className={`p-2 rounded-md ${citationConstraints.approvedCorpusOnly ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'}`}>
                         <Link2 className="w-4 h-4" />
                       </div>
                        <div className="flex flex-col">
                         <span className="text-sm font-semibold text-slate-900">Citation Check</span>
                         <span className="text-[10px] text-slate-500">{citationConstraints.approvedCorpusOnly ? 'Verified Only' : 'Standard'}</span>
                       </div>
                     </div>
                      <button 
                       onClick={() => setCitationConstraints(p => ({...p, approvedCorpusOnly: !p.approvedCorpusOnly}))}
                       className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${citationConstraints.approvedCorpusOnly ? 'bg-green-600' : 'bg-slate-300'}`}
                     >
                       <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${citationConstraints.approvedCorpusOnly ? 'translate-x-6' : 'translate-x-1'}`} />
                     </button>
                   </div>
                 </div>
               </div>

               {/* Format Selection */}
               <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                 <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                   <Layout className="w-4 h-4 text-brand-600" /> Output Format
                 </h2>
                 <div className="space-y-2">
                   {FORMATS.map(fmt => (
                     <label key={fmt.id} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${outputFormat === fmt.id ? 'bg-brand-50 border-brand-200 ring-1 ring-brand-200' : 'bg-white border-transparent hover:bg-slate-50'}`}>
                       <input type="radio" name="format" value={fmt.id} checked={outputFormat === fmt.id} onChange={(e) => setOutputFormat(e.target.value as FormatId)} className="mt-1 text-brand-600 focus:ring-brand-500" />
                       <div>
                         <div className="font-semibold text-slate-900 text-sm">{fmt.name}</div>
                         <div className="text-xs text-slate-500">{fmt.subtitle} • {fmt.size}</div>
                       </div>
                     </label>
                   ))}
                 </div>
               </div>

               {/* Audience Selection */}
               <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                 <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                   <BookOpen className="w-4 h-4 text-brand-600" /> Target Audience
                 </h2>
                 <select 
                   value={targetAudience} 
                   onChange={(e) => setTargetAudience(e.target.value)}
                   className="w-full text-sm border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500"
                 >
                   {AUDIENCES.map(aud => (
                     <option key={aud.id} value={aud.id}>{aud.name}</option>
                   ))}
                 </select>
                 <p className="mt-2 text-xs text-slate-500">
                   Optimizes for: {AUDIENCES.find(a => a.id === targetAudience)?.focus}
                 </p>
               </div>
             </div>

             {/* RIGHT COLUMN: Execution & Results */}
             <div className="lg:col-span-8 space-y-6">
               
               {/* Progress Banner */}
               {Object.keys(sectionJobs).length > 0 && (
                  <div className="bg-slate-900 rounded-xl p-6 text-white shadow-xl relative overflow-hidden">
                     <div className="absolute top-0 right-0 p-32 bg-brand-500 rounded-full blur-[100px] opacity-20 -mr-16 -mt-16 pointer-events-none"></div>
                     
                     <div className="flex items-center justify-between mb-4 relative z-10">
                       <div>
                         <h2 className="text-2xl font-bold flex items-center gap-2">
                           {jobStatus === 'running' ? <Activity className="w-6 h-6 animate-pulse text-brand-400" /> : <Archive className="w-6 h-6 text-slate-400" />}
                           Generation Status
                         </h2>
                         <p className="text-slate-400 text-sm mt-1">Job ID: <span className="font-mono text-slate-300">{currentJobId}</span></p>
                       </div>
                       <div className="flex gap-2">
                         {jobStatus === 'running' && <button onClick={() => orchestrator.pauseJob(currentJobId!)} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg"><Pause className="w-5 h-5" /></button>}
                         {jobStatus === 'paused' && <button onClick={() => orchestrator.resumeJob(currentJobId!)} className="p-2 bg-brand-600 hover:bg-brand-700 rounded-lg"><Play className="w-5 h-5" /></button>}
                         {['running', 'paused'].includes(jobStatus) && <button onClick={() => orchestrator.cancelJob(currentJobId!)} className="p-2 bg-red-500/20 hover:bg-red-500/40 text-red-200 rounded-lg"><Square className="w-5 h-5" /></button>}
                       </div>
                     </div>

                     <div className="relative h-4 bg-slate-800 rounded-full overflow-hidden mb-2">
                       <div className="absolute top-0 left-0 h-full bg-brand-500 transition-all duration-500 ease-out shadow-[0_0_15px_rgba(14,165,233,0.6)]" style={{ width: `${getOverallProgress()}%` }}>
                         <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(45deg,rgba(255,255,255,0.2)25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)50%,rgba(255,255,255,0.2)75%,transparent_75%,transparent)] bg-[length:20px_20px] animate-[move_1s_linear_infinite]"></div>
                       </div>
                     </div>
                     <div className="flex justify-between text-xs font-mono text-slate-400">
                       <span>{getOverallProgress()}% Complete</span>
                       <span>{Object.values(sectionJobs).reduce((acc: number, job: SectionJob) => acc + (job.tokenCount || 0), 0).toLocaleString()} Tokens Generated</span>
                     </div>
                  </div>
               )}

               {/* Error Message */}
               {errorMessage && (
                 <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center gap-3">
                   <AlertCircle className="w-5 h-5" />
                   <span className="flex-1 font-medium">{errorMessage}</span>
                   <button onClick={() => setErrorMessage('')} className="text-red-600 hover:text-red-800">Dismiss</button>
                 </div>
               )}

               {/* Section List */}
               <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                 <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                   <h3 className="font-bold text-slate-900 flex items-center gap-2">
                     <Layout className="w-4 h-4 text-brand-600" /> 
                     Section Manifest 
                     <span className="text-xs font-normal text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                       {essentialSections.length} Essential
                     </span>
                   </h3>
                   <div className="text-xs text-slate-500">Drag to reorder priority</div>
                 </div>
                 
                 <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
                   {generationOrder.map((sectionId, index) => {
                     const job = sectionJobs[sectionId] as SectionJob | undefined;
                     if (job) {
                       const section = SECTIONS_DATA.find(s => s.id === sectionId);
                       return (
                         <div key={sectionId} className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                            <div className="w-8 h-8 flex items-center justify-center bg-slate-100 text-slate-500 font-bold text-sm rounded-lg">{index + 1}</div>
                            <div className="flex-1">
                               <div className="flex items-center justify-between mb-1">
                                 <span className="font-semibold text-slate-900">{section?.name}</span>
                                 <JobStatusBadge status={job.status} progress={job.progress} />
                               </div>
                               {job.diff && (
                                 <div className="flex gap-3 text-xs font-mono mt-2 bg-slate-50 p-2 rounded border border-slate-100">
                                   <span className="text-emerald-600">+{job.diff.additions}</span>
                                   <span className="text-red-600">-{job.diff.deletions}</span>
                                   <span className="text-amber-600">~{job.diff.modifications}</span>
                                   <span className="text-slate-400">| {Math.floor(job.diff.similarity * 100)}% Match</span>
                                 </div>
                               )}
                               {job.error && <div className="text-xs text-red-600 mt-1">{job.error}</div>}
                            </div>
                            <div className="flex gap-2">
                               {job.status === 'failed' && (
                                 <button onClick={() => retrySection(sectionId)} className="p-2 hover:bg-slate-100 rounded text-slate-500 hover:text-red-600"><RotateCcw className="w-4 h-4" /></button>
                               )}
                               {job.status === 'complete' && (
                                 <button onClick={() => retrySection(sectionId)} className="p-2 hover:bg-slate-100 rounded text-slate-500 hover:text-brand-600" title="Regenerate"><RefreshCw className="w-4 h-4" /></button>
                               )}
                            </div>
                         </div>
                       );
                     }

                     return (
                       <SectionItem 
                         key={sectionId}
                         sectionId={sectionId}
                         index={index}
                         essential={isEssential(sectionId)}
                         selected={selectedSections[sectionId]}
                         dragged={draggedItem === sectionId}
                         onDragStart={setDraggedItem}
                         onDragOver={handleDragOver}
                         onDragEnd={() => setDraggedItem(null)}
                         onToggle={toggleSection}
                         onMove={moveSection}
                         isFirst={index === 0}
                         isLast={index === generationOrder.length - 1}
                       />
                     );
                   })}
                 </div>
               </div>

               {/* Action Bar */}
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 <button onClick={copyPrompt} className="flex items-center justify-center gap-2 p-3 rounded-xl font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors">
                   <Download className="w-4 h-4" /> {promptCopied ? 'Copied!' : 'Copy Config'}
                 </button>
                 <button 
                   onClick={startGeneration} 
                   disabled={['running', 'paused'].includes(jobStatus)}
                   className="md:col-span-1 flex items-center justify-center gap-2 p-3 rounded-xl font-bold text-white bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 shadow-lg shadow-brand-200 disabled:opacity-50 disabled:shadow-none transition-all transform active:scale-95"
                 >
                   <Zap className="w-4 h-4 fill-current" /> Generate
                 </button>
                 <button 
                   onClick={validateCitations}
                   disabled={validatingCitations || !currentJobId}
                   className="flex items-center justify-center gap-2 p-3 rounded-xl font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                 >
                   {validatingCitations ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />} Validate
                 </button>
                 <button 
                   onClick={extractClaims}
                   disabled={extractingClaims || !currentJobId}
                   className="flex items-center justify-center gap-2 p-3 rounded-xl font-semibold bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                 >
                   {extractingClaims ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scale className="w-4 h-4" />} Claims
                 </button>
               </div>
             </div>
          </div>
        )}

        {/* Results Modals (Existing) */}
        {showCitationPanel && citationGraph && (
          <div className="fixed bottom-4 right-4 z-50 w-96 bg-white rounded-xl shadow-2xl border border-emerald-200 overflow-hidden animate-in slide-in-from-bottom-4">
            <div className="bg-emerald-50 px-5 py-3 border-b border-emerald-100 flex justify-between items-center">
              <h3 className="font-bold text-emerald-900 flex items-center gap-2"><Link2 className="w-4 h-4" /> Citation Verification</h3>
              <button onClick={() => setShowCitationPanel(false)} className="text-emerald-700 hover:text-emerald-900">×</button>
            </div>
            <div className="p-5 max-h-80 overflow-y-auto space-y-2">
              {citationGraph.citations.map(c => (
                <div key={c.id} className="text-sm flex gap-3 p-2 hover:bg-slate-50 rounded">
                  {c.validated ? <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />}
                  <div>
                    <div className="font-medium text-slate-900">{c.authors} ({c.year})</div>
                    <div className="text-slate-500 italic">{c.title}</div>
                    <div className="text-xs text-brand-600 mt-1">{c.doi}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-emerald-50/50 px-5 py-2 text-xs text-emerald-800 font-mono border-t border-emerald-100">
              Score: {(citationGraph.validationScore * 100).toFixed(1)}% Reliability
            </div>
          </div>
        )}

        {showPatentPanel && patentClaims.length > 0 && (
           <div className="fixed bottom-4 left-4 z-50 w-96 bg-white rounded-xl shadow-2xl border border-purple-200 overflow-hidden animate-in slide-in-from-bottom-4">
            <div className="bg-purple-50 px-5 py-3 border-b border-purple-100 flex justify-between items-center">
              <h3 className="font-bold text-purple-900 flex items-center gap-2"><Scale className="w-4 h-4" /> Extracted Claims {sanitizedOutput && <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full uppercase">Sanitized</span>}</h3>
              <button onClick={() => setShowPatentPanel(false)} className="text-purple-700 hover:text-purple-900">×</button>
            </div>
            <div className="p-5 space-y-4 max-h-80 overflow-y-auto">
              {patentClaims.map((claim, idx) => (
                <div key={claim.id} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                   <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Claim {idx + 1} ({claim.type})</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${claim.priorArtRisk === 'low' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>Risk: {claim.priorArtRisk}</span>
                   </div>
                   <p className="text-sm text-slate-800 font-medium leading-relaxed">{claim.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default App;