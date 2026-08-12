export interface StockPositionItem {
  symbol: string;
  companyName?: string;
  shares: number;
  costBasis: number;
  marketPrice: number;
  notes?: string;
}

export interface ActionItem {
  action: "BUY" | "SELL" | "HOLD" | "TRIM";
  symbol: string;
  companyName?: string;
  suggestedShares: number;
  estimatedPrice: number;
  estimatedAmount: number;
  rationale: string;
  urgency: "HIGH" | "MEDIUM" | "LOW";
  targetPrice?: number;
  stopLossPrice?: number;
  riskRewardRatio?: number;
  takeProfitPct?: number;
  stopLossPct?: number;
  projectedPnL?: number;
  projectedPnLPct?: number;
  timeHorizon?: string;
}

export interface RiskAlert {
  level: "WARNING" | "CRITICAL" | "INFO";
  title: string;
  description: string;
  relatedSymbol?: string;
}

export interface PositionPnLItem {
  symbol: string;
  companyName?: string;
  shares: number;
  costBasis: number;
  currentPrice: number;
  marketValue: number;
  pnl: number;
  pnlPct: number;
  costValue: number;
  concentrationPct: number;
}

export interface TotalPnLState {
  totalMarketValue: number;
  totalCostBasis: number;
  totalPnL: number;
  totalPnLPct: number;
  cashBalance: number;
  netAssets: number;
  positions: PositionPnLItem[];
}

export interface KnowledgeGraphEntityNode {
  id: string;
  name: string;
  type: "ROOT_STOCK" | "SUPPLIER" | "CLIENT" | "COMPETITOR" | "MACRO" | "CONCEPT";
  marketSymbol?: string;
  description?: string;
}

export interface KnowledgeGraphRelationEdge {
  source: string;
  target: string;
  relation: string;
  impact: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
}

export interface StockKnowledgeGraphItem {
  symbol: string;
  companyName: string;
  positionCategory: "EXISTING" | "NEW_DISCOVERY";
  industrySector: string;
  nodes: KnowledgeGraphEntityNode[];
  edges: KnowledgeGraphRelationEdge[];
  newsCatalysts: string[];
  actionAdvice: "BUY" | "SELL" | "HOLD" | "TRIM";
  guidanceText: string;
}

export interface PastDeductionRetroPerStock {
  lastStrategyDate?: string;
  lastAction?: "BUY" | "TRIM" | "HOLD" | "SELL";
  lastTargetPrice?: number;
  lastStopLossPrice?: number;
  actualPriceAction?: string;
  pnlImpact?: number;
  accuracyScore?: number;
  distilledLesson?: string;
}

export interface StockDeductionRetroItem {
  symbol: string;
  companyName?: string;
  // 1. 每一只股票的知识图谱
  knowledgeGraph: StockKnowledgeGraphItem;
  // 2. 股票最新消息
  latestNews: string[];
  // 3. 持仓情况
  position?: StockPositionItem;
  // 4. 之前推演这只股票以及实际盘面变化的复盘
  pastRetro: PastDeductionRetroPerStock;
  // 当前推演建议
  currentRecommendation?: ActionItem;
}

export interface StrategyProgressStage {
  step: number;
  totalSteps: number;
  stageId:
    | "OPEND_CONNECT"
    | "QUOTES_FETCH"
    | "NEWS_SEARCH"
    | "CONTEXT_ASSEMBLE"
    | "AI_DEDUCTION"
    | "GUARDRAIL_CALIBRATE"
    | "FINISHED";
  title: string;
  detail: string;
  progressPercent: number;
  timestamp: string;
}

export interface RetroPnLResult {
  accuracyScore: number;
  executionMatchRate: number;
  avoidedLoss: number;
  totalRealizedPnL: number;
  summaryText: string;
  lessonsLearned: string[];
}

export interface DailyAllocationOutput {
  marketOverview: string;
  existingPositionGuidance: string;
  newPositionGuidance: string;
  actions: ActionItem[];
  riskAlerts: RiskAlert[];
  knowledgeGraph: StockKnowledgeGraphItem[];
  perStockDeductionRetro: StockDeductionRetroItem[];
  narrativeReport: string;
}
