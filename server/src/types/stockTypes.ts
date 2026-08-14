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

export type StockStrategyCategory =
  | "OVERSOLD_BUY"        // 1. 超跌建仓
  | "FUNDAMENTAL_BUY"     // 2. 基本面亮眼建仓
  | "NEWS_CATALYST_BUY"   // 3. 消息面强劲建仓
  | "CAPITAL_INFLOW_BUY"  // 4. 近期大资金进入建仓
  | "WATCH_AND_WAIT";     // 5. 可以观望

export interface OpenDSnapshotItem {
  symbol: string;
  name: string;
  lastPrice: number;
  openPrice?: number;
  highPrice?: number;
  lowPrice?: number;
  prevClosePrice?: number;
  highest52WeeksPrice?: number;
  lowest52WeeksPrice?: number;
  peRatio?: number;
  peTtmRatio?: number;
  pbRatio?: number;
  netProfit?: number;
  earningPerShare?: number;
  totalMarketVal?: number;
  turnoverRate?: number;
  prePrice?: number;
  preChangeRate?: number;
  afterPrice?: number;
  afterChangeRate?: number;
  capitalInflow?: number;
  mainCapitalInflow?: number;
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
  strategyCategory?: StockStrategyCategory;
  strategyCategoryLabel?: string;
  strategyCategoryReason?: string;
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
  sector?: string;
  beta?: number;
  marketCap?: string;
  recentSignalScore?: number; // -1.0 to 1.0 (quant signal score)
  financialSummary?: string;
  recencyWeight?: number; // 0.0 - 1.0 time decay factor
  createdAt?: string;
}

export interface KnowledgeGraphRelationEdge {
  source: string;
  target: string;
  relation: string;
  relationType?: "UPSTREAM_SUPPLIER" | "DOWNSTREAM_CLIENT" | "COMPETITOR" | "MACRO_DRIVER" | "CONCEPT_THEME";
  exposurePct?: number; // 0.0 - 1.0 (revenue/cost dependency percentage)
  elasticity?: number; // Price/earnings transmission elasticity (Beta)
  timeLagDays?: number; // Lead-lag transmission delay in trading days
  impact: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
  recencyWeight?: number; // 0.0 - 1.0 time decay factor
  createdAt?: string;
}

export interface KnowledgeGraphTripletItem {
  subject: string;
  relation: string;
  relationType?: string;
  object: string;
  impact: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
  exposurePct?: number;
  timeLagDays?: number;
  elasticity?: number;
  signalScore?: number;
  note?: string;
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
  spilloverAlphaScore?: number; // -100 to 100 quant lead-lag alpha score
  networkRiskScore?: number; // 0 to 100 supply chain & concentration risk score
  structuredTriplets?: KnowledgeGraphTripletItem[];
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
  strategyCategory?: StockStrategyCategory;
  strategyCategoryLabel?: string;
  strategyCategoryReason?: string;
  knowledgeGraph: StockKnowledgeGraphItem;
  latestNews: string[];
  communitySentiment?: CommunitySentimentItem;
  capitalFlow?: CapitalFlowItem;
  fundamentals?: StockFundamentals;
  position?: StockPositionItem;
  openDSnapshot?: OpenDSnapshotItem;
  pastRetro: PastDeductionRetroPerStock;
  currentRecommendation?: ActionItem;
}

export interface StrategyProgressStage {
  step: number;
  totalSteps: number;
  stageId:
    | "OPEND_CONNECT"
    | "MACRO_SEARCH"
    | "CANDIDATE_AND_SEARCH"
    | "OLLAMA_DEDUCTION"
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

export interface MacroMarketIntel {
  sentimentMood: "BULLISH" | "BEARISH" | "NEUTRAL" | "VOLATILE";
  sentimentScore: number; // 0 - 100
  summaryHeadline: string;
  starSectors: string[];
  keyBulletPoints: Array<{
    title: string;
    snippet: string;
    source: string;
    url?: string;
  }>;
  macroTradingStance: {
    bias: string;
    positionStrategy: string;
    riskWarning: string;
  };
  distilledPromptContext: string;
}

export interface DeductionPipelineData {
  modelUsed: string;
  promptContextText: string;
  knowledgeGraphContext: string;
  searxngNewsContext: string;
  positionsContext: string;
  lessonsContext: string;
  rawOllamaOutput?: string;
}


export interface DailyAllocationOutput {
  marketOverview: string;
  macroIntel?: MacroMarketIntel;
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
