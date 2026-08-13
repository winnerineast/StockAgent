export interface StockPositionItem {
  symbol: string;
  companyName?: string;
  shares: number;
  costBasis: number;
  marketPrice: number;
  notes?: string;
  isCleared?: boolean;
  clearedDate?: string;
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
  isOversoldOpportunity?: boolean;
  oversoldReason?: string;
  fundamentalScore?: number;
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
  isCleared?: boolean;
}

export interface TotalPnLState {
  totalMarketValue: number;
  totalCostBasis: number;
  totalPnL: number;
  totalPnLPct: number;
  cashBalance: number;
  netAssets: number;
  positions: PositionPnLItem[];
  recentlyClearedPositions?: PositionPnLItem[];
}

export interface StockFundamentals {
  symbol: string;
  companyName?: string;
  peRatio?: number;
  revenueGrowthPct?: number;
  netMarginPct?: number;
  debtToEquity?: number;
  nextEarningsDate?: string;
  fundamentalSummary?: string;
}

export interface CapitalFlowItem {
  trend: "INFLOW" | "OUTFLOW" | "NEUTRAL";
  description: string;
  netInflowAmount?: string;
}

export interface KnowledgeGraphEntityNode {
  id: string;
  name: string;
  type: "ROOT_STOCK" | "SUPPLIER" | "CLIENT" | "COMPETITOR" | "MACRO" | "CONCEPT";
  marketSymbol?: string;
  description?: string;
  recencyWeight?: number; // 0.0 - 1.0 time decay factor
  createdAt?: string;
}

export interface KnowledgeGraphRelationEdge {
  source: string;
  target: string;
  relation: string;
  impact: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
  recencyWeight?: number; // 0.0 - 1.0 time decay factor
  createdAt?: string;
}

export interface StockKnowledgeGraphItem {
  symbol: string;
  companyName: string;
  positionCategory: "EXISTING" | "NEW_DISCOVERY" | "CLEARED";
  industrySector: string;
  nodes: KnowledgeGraphEntityNode[];
  edges: KnowledgeGraphRelationEdge[];
  newsCatalysts: string[];
  actionAdvice: "BUY" | "SELL" | "HOLD" | "TRIM";
  guidanceText: string;
  compressedSummary?: string;
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

export interface CommunitySentimentItem {
  score?: number; // 0 - 100
  mood: "BULLISH" | "BEARISH" | "NEUTRAL" | "UNKNOWN";
  keyTopics: string[];
}

export interface SingleStockIntel {
  symbol: string;
  companyName?: string;
  latestNews: string[];
  communitySentiment: CommunitySentimentItem;
  capitalFlow: CapitalFlowItem;
  fundamentals?: StockFundamentals;
}

export interface StockDeductionRetroItem {
  symbol: string;
  companyName?: string;
  isCleared?: boolean;
  candidateCategory?: "EXISTING_HOLDING" | "WATCHLIST" | "MACRO_CANDIDATE";
  knowledgeGraph: StockKnowledgeGraphItem;
  latestNews: string[];
  communitySentiment?: CommunitySentimentItem;
  capitalFlow?: CapitalFlowItem;
  fundamentals?: StockFundamentals;
  position?: StockPositionItem;
  pastRetro: PastDeductionRetroPerStock;
  currentRecommendation?: ActionItem;
}

export interface StrategyProgressStage {
  step: number;
  totalSteps: number;
  stageId:
    | "OPEND_CONNECT"
    | "MACRO_SEARCH"
    | "CANDIDATE_ASSEMBLE"
    | "STOCK_DEEP_SEARCH"
    | "MAP_REDUCE_DEDUCTION"
    | "FINISHED";
  title: string;
  detail: string;
  progressPercent: number;
  timestamp: string;
}

export interface RetroPnLResult {
  accuracyScore?: number; // undefined if no prior history
  executionMatchRate?: number;
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
  oversoldOpportunities?: ActionItem[];
  riskAlerts: RiskAlert[];
  knowledgeGraph: StockKnowledgeGraphItem[];
  perStockDeductionRetro: StockDeductionRetroItem[];
  recentlyClearedPositions?: StockPositionItem[];
  narrativeReport: string;
}
