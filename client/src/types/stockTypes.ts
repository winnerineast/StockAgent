export interface AgentLLMTraceItem {
  id: string;
  agentRole: "MACRO_ANALYST" | "STOCK_BULL_BEAR_DEBATER" | "HEBBIAN_ARBITRATOR" | "QUANT_OPTIMIZER";
  agentLabel: string;
  symbol?: string;
  companyName?: string;
  modelName: string;
  // 🌟 100% 真实输入与输出
  systemPrompt?: string;
  userPrompt: string;
  thinkingText?: string;
  rawResponseText: string;
  parsedOutput?: any;
  // 🌟 核心 Context 细节
  knowledgeGraphTriplets?: string[];
  searxngNewsSnippets?: string[];
  fundamentalsSnippet?: string;
  // 🌟 执行元数据
  durationMs: number;
  status: "SUCCESS" | "TIMEOUT_FALLBACK" | "ERROR_FALLBACK";
  timestamp: string;
}

export interface DeductionPipelineData {
  modelUsed: string;
  totalDurationMs: number;
  totalTokensEstimated?: number;
  traces: AgentLLMTraceItem[]; // 全量多 Agent 真实调用链路
  macroSummaryPrompt?: string;
  macroRawResponse?: string;
  promptContextText?: string;
  knowledgeGraphContext?: string;
  searxngNewsContext?: string;
  positionsContext?: string;
  lessonsContext?: string;
  rawOllamaOutput?: string;
}
