import { 
  JobState, JobStatus, JobEvent, SectionId, SectionJob, 
  GenerationConfig, GenerationProgressCallback, PatentClaim, CitationGraph
} from '../types';

const API_BASE = 'http://localhost:3000/api';

export class ManuscriptOrchestrator {
  private activeSources: Map<string, EventSource> = new Map();
  // Store configs for local jobs to drive the simulation correctly
  private localConfigs: Map<string, GenerationConfig> = new Map();

  async createJob(config: GenerationConfig): Promise<string> {
    try {
      const res = await fetch(`${API_BASE}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config })
      });
      if (!res.ok) throw new Error(`Backend Error: ${res.statusText}`);
      const data = await res.json();
      return data.externalId;
    } catch (e: any) {
      console.warn("Backend unavailable, falling back to Local Simulation Mode.", e);
      // Generate a local ID and store the config for the simulation runner
      const localId = `LOCAL-${Date.now()}`;
      this.localConfigs.set(localId, config);
      return localId;
    }
  }

  async executeJob(jobId: string, callbacks: GenerationProgressCallback): Promise<void> {
    // Check if this is a local fallback job
    if (jobId.startsWith('LOCAL-') || jobId.startsWith('SIM-')) {
      const config = this.localConfigs.get(jobId);
      await this.runSimulation(callbacks, jobId, config);
      return;
    }

    // 1. Open SSE connection FIRST to avoid missing events
    const url = `${API_BASE}/jobs/${jobId}/stream`;
    console.log(`[Orchestrator] Connecting to SSE: ${url}`);
    
    try {
      const evtSource = new EventSource(url);
      this.activeSources.set(jobId, evtSource);

      evtSource.onopen = () => {
        console.log("[Orchestrator] SSE Connected");
      };

      evtSource.onerror = (e) => {
        console.warn("[Orchestrator] SSE Error or Reconnecting", e);
      };

      evtSource.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleMessage(msg, jobId, callbacks);
        } catch (e) {
          console.warn("Failed to parse SSE message", event.data);
        }
      };

      evtSource.addEventListener('snapshot', (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleMessage(msg, jobId, callbacks);
        } catch (e) {
          console.warn("Failed to parse snapshot", event.data);
        }
      });

      // 2. Start the job on the backend
      // Small delay to ensure connection is registered (EventSource is usually fast, but just in case)
      setTimeout(async () => {
        try {
          const startRes = await fetch(`${API_BASE}/jobs/${jobId}/start`, { method: 'POST' });
          if (!startRes.ok) throw new Error('Failed to start job on backend');
        } catch (e) {
          console.error("Failed to start job", e);
          callbacks.onJobFailed("Failed to trigger job start");
          this.closeConnection(jobId);
        }
      }, 500);
    } catch (err) {
      console.error("Failed to setup SSE", err);
      callbacks.onJobFailed("Connection failed");
    }
  }

  /**
   * Client-side simulation to verify UI without backend dependency
   * Now supports iterating through actual requested sections
   */
  async runSimulation(
    callbacks: GenerationProgressCallback, 
    jobId?: string, 
    config?: GenerationConfig
  ): Promise<string> {
    const mockId = jobId || `SIM-${Date.now()}`;
    console.log(`[Orchestrator] Starting Client-Side Simulation: ${mockId}`);

    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    // Determine which sections to run
    const sectionsToRun = config?.generationOrder || ['test-section'];

    // Run simulation sequence
    (async () => {
      try {
        await sleep(500);
        this.handleMessage({ type: 'job.started', externalId: mockId }, mockId, callbacks);
        
        for (const sectionId of sectionsToRun) {
           // Skip if we were cancelled (simple check)
           // In a real implementation we'd check a flag, but this is a fire-and-forget async loop
           
           this.handleMessage({ type: 'section.queued', sectionId: sectionId }, mockId, callbacks);
           await sleep(800); // Queue delay

           // Progress simulation
           for (let p = 10; p <= 90; p += 25) {
             this.handleMessage({ type: 'section.progress', sectionId: sectionId, progress: p }, mockId, callbacks);
             await sleep(600); // Generation time
           }
           
           // Generate mock content based on section ID
           const mockContent = `## ${sectionId} (Simulated Result)\n\nThis content was generated in **Local Simulation Mode** because the backend API was unreachable.\n\n### Simulation Details\n- **Target Audience**: ${config?.targetAudience || 'Default'}\n- **Format**: ${config?.outputFormat || 'Standard'}\n\nThis confirms the UI can handle section completion events, progress updates, and Markdown rendering correctly.`;

           this.handleMessage({ 
            type: 'section.complete', 
            sectionId: sectionId, 
            content: mockContent, 
            tokenCount: 150 + Math.floor(Math.random() * 200) 
          }, mockId, callbacks);
           
           await sleep(500); // Post-processing delay
        }
        
        await sleep(500);
        this.handleMessage({ type: 'job.complete', externalId: mockId }, mockId, callbacks);
      } catch (e) {
        console.error("Simulation error", e);
        callbacks.onJobFailed("Simulation error");
      }
    })();

    return mockId;
  }

  private handleMessage(msg: any, jobId: string, callbacks: GenerationProgressCallback) {
    switch (msg.type) {
      case 'job.snapshot':
        if (msg.sections) {
          msg.sections.forEach((s: any) => {
            if (s.status === 'complete') {
              callbacks.onSectionComplete(s.sectionId, s.content || '', s.tokenCount || 0);
            } else if (s.status === 'generating') {
              callbacks.onProgress(s.sectionId, s.progress || 0);
            }
          });
        }
        break;
      case 'job.started':
        break;
      case 'section.queued':
        callbacks.onProgress(msg.sectionId, 0);
        break;
      case 'research.started':
      case 'agent.action':
        console.log(`[Agent] ${msg.sectionId}: ${msg.message}`);
        break;
      case 'section.progress':
        callbacks.onProgress(msg.sectionId, msg.progress);
        break;
      case 'section.complete':
        callbacks.onSectionComplete(msg.sectionId, msg.content, msg.tokenCount);
        break;
      case 'section.failed':
        callbacks.onSectionFailed(msg.sectionId, msg.error);
        break;
      case 'job.complete':
        callbacks.onJobComplete();
        this.closeConnection(jobId);
        break;
    }
  }

  private closeConnection(jobId: string) {
    const es = this.activeSources.get(jobId);
    if (es) {
      es.close();
      this.activeSources.delete(jobId);
      console.log("[Orchestrator] SSE Closed");
    }
  }

  // --- Utility stubs ---
  
  pauseJob(jobId: string): void {
    if (jobId.startsWith('LOCAL-')) {
       console.warn("Pause not supported in local mode");
       return;
    }
    console.warn("Pause not yet implemented on backend");
  }

  resumeJob(jobId: string): void {
     if (jobId.startsWith('LOCAL-')) {
       return;
    }
     console.warn("Resume not yet implemented on backend");
  }

  cancelJob(jobId: string): void {
    // For simulation, we might want to stop the async loop, but for now just cleanup
    this.closeConnection(jobId);
  }

  async retrySingleSection(jobId: string, sectionId: SectionId, cb: (p:number)=>void): Promise<any> {
    if (jobId.startsWith('LOCAL-')) {
      // Mock retry
      cb(0);
      await new Promise(r => setTimeout(r, 1000));
      cb(50);
      await new Promise(r => setTimeout(r, 1000));
      return { 
        content: `## ${sectionId} (Retried)\n\nRegenerated content in local mode.`, 
        diff: { additions: 10, deletions: 5, modifications: 2, similarity: 0.9 }
      };
    }
    throw new Error("Retry not implemented in v3.1 backend");
  }

  async validateCitations(jobId: string): Promise<CitationGraph> {
    if (jobId.startsWith('LOCAL-')) {
       return {
         citations: [
           { id: '1', authors: 'Bell, J.S.', title: 'On the Einstein Podolsky Rosen paradox', year: 1964, validated: true, referencedIn: ['fundamentals'] },
           { id: '2', authors: 'Doherty et al.', title: 'The nitrogen-vacancy colour centre in diamond', year: 2013, validated: true, referencedIn: ['engineering'] },
           { id: '3', authors: 'Smith, J.', title: 'Unverified Pre-print', year: 2024, validated: false, validationError: 'Source not found', referencedIn: ['validation'] }
         ],
         duplicates: [],
         missingRefs: [],
         orphanedRefs: [],
         validationScore: 0.85
       } as any;
    }
    return { citations: [], duplicates: [], missingRefs: [], orphanedRefs: [], validationScore: 1 };
  }

  async extractPatentClaims(jobId: string, sanitize: boolean): Promise<PatentClaim[]> {
    if (jobId.startsWith('LOCAL-')) {
      return [
        { id: 'c1', type: 'independent', text: 'A method for quantum sensing using nitrogen-vacancy centers...', noveltyScore: 0.9, priorArtRisk: 'low', supportingSections: ['engineering'], sanitized: sanitize },
        { id: 'c2', type: 'dependent', dependsOn: 'c1', text: 'The method of claim 1, wherein the readout is optical...', noveltyScore: 0.8, priorArtRisk: 'medium', supportingSections: ['engineering'], sanitized: sanitize }
      ];
    }
    return [];
  }
}

export const orchestrator = new ManuscriptOrchestrator();