import { GoogleGenAI, FunctionDeclaration, Type, Tool, Content, Part } from "@google/genai";
import { Provider, ProviderResult } from './provider';
import { ResearchTools } from './research';

// Define the tools available to the Agent
const searchPapersTool: FunctionDeclaration = {
  name: "searchPapers",
  description: "Search for scientific papers and pre-prints on OpenAlex and arXiv. Use this to find citations and validate scientific claims.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      topic: { type: Type.STRING, description: "The scientific topic to search for" }
    },
    required: ["topic"]
  }
};

const verifyConstantTool: FunctionDeclaration = {
  name: "verifyConstant",
  description: "Verify a physical constant value using Wikidata.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      constantName: { type: Type.STRING, description: "The name of the constant (e.g. 'Planck constant')" }
    },
    required: ["constantName"]
  }
};

export class GeminiAdapter implements Provider {
  private client: GoogleGenAI;
  private modelName: string;

  constructor(apiKey: string, modelName: string = 'gemini-3-pro-preview') {
    this.client = new GoogleGenAI({ apiKey });
    this.modelName = modelName;
  }

  async generateSection(
    sectionId: string, 
    prompt: string, 
    signal?: AbortSignal, 
    onProgress?: (pct: number) => void
  ): Promise<ProviderResult> {
    
    const chat = this.client.chats.create({
      model: this.modelName,
      config: {
        systemInstruction: `You are the Arcovel Manuscript Orchestrator, an expert scientific writer.
        Your task is to write the "${sectionId}" section of a technical manuscript.

        OPERATIONAL PROTOCOL:
        1. **Research First**: Before writing, use 'searchPapers' to find relevant literature.
        2. **Verify Facts**: Use 'verifyConstant' for any physical constants or numerical data.
        3. **Cite Sources**: When you use information from the tools, cite the source (e.g., Author, Year).
        4. **Writing Style**: Professional, objective, academic Markdown. Use LaTeX for math.
        
        DO NOT hallucinate citations. Only use those found via tools or strictly common knowledge.`,
        tools: [{ functionDeclarations: [searchPapersTool, verifyConstantTool] }],
        temperature: 0.5,
      }
    });

    let finalContent = "";
    let tokenCount = 0;
    let turn = 0;
    const MAX_TURNS = 10;
    
    // Initial message
    let currentInput: string | Part[] = prompt;

    while (turn < MAX_TURNS) {
      if (signal?.aborted) throw new Error('Generation cancelled');

      const result = await chat.sendMessageStream({ message: currentInput });
      
      let toolCalls: any[] = [];
      let textChunkCount = 0;

      for await (const chunk of result) {
        if (signal?.aborted) throw new Error('Generation cancelled');

        // Capture text
        const text = chunk.text;
        if (text) {
          finalContent += text;
          textChunkCount++;
          tokenCount += Math.ceil(text.length / 4);
          if (onProgress) {
             // Heuristic progress based on turns and chunks
             onProgress(Math.min(99, (turn * 10) + Math.min(textChunkCount, 10)));
          }
        }

        // Capture Tool Calls
        const fcs = chunk.functionCalls;
        if (fcs && fcs.length > 0) {
          toolCalls.push(...fcs);
        }
      }

      // If no tools called, we are likely done (model finished response)
      if (toolCalls.length === 0) {
        break;
      }

      // Execute Tools
      const functionResponses: Part[] = [];
      for (const call of toolCalls) {
        console.log(`[Agent] Executing tool: ${call.name} args: ${JSON.stringify(call.args)}`);
        let output: any = { error: "Unknown tool" };
        
        try {
          if (call.name === "searchPapers") {
            output = await ResearchTools.searchPapers(call.args.topic);
          } else if (call.name === "verifyConstant") {
            output = await ResearchTools.verifyConstant(call.args.constantName);
          }
        } catch (e: any) {
          output = { error: e.message };
        }

        // Format strictly as Part with functionResponse
        functionResponses.push({
          functionResponse: {
            name: call.name,
            response: { result: output },
            id: call.id
          }
        });
      }

      // Prepare next input (Tool Outputs)
      currentInput = functionResponses;
      turn++;
    }

    return {
      content: finalContent,
      tokenCount,
      metadata: { model: this.modelName, turns: turn }
    };
  }
}