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

export interface EntryZone {
  min: number;
  max: number;
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

  // 目标驱动与资金空间量化新增字段
  targetTimeHorizonDays?: number;      // 限定交易日跨度 T (如 3, 5, 10, 20 天)
  targetProfitGoalPct?: number;        // 盈利目标 G% (如 +5%, +8%, +15%)
  goalAttainmentProbability?: number;  // T 日目标达成概率 % (如 74.5%)
  certaintyScore?: number;             // 确定性指数 / 消除迷茫度 (0~100)
  timeStopRule?: string;               // 严格时间止损纪律 (如 "持有至第 5 个交易日收盘前若未破目标无条件离场")
  entryZone?: EntryZone;               // 建议挂单建仓区间 { min, max }
  capitalAllocationAmount?: number;    // 建议分配操盘资金 ($)
  capitalAllocationPct?: number;       // 占总可用操盘空间比例 (%)
  maxRiskAmount?: number;              // 触及止损最大可承受损失 ($)
  expectedPnLAmount?: number;          // 目标达成预期净盈利 ($)
  goalDrivenRationale?: string;        // 消除迷茫度的核心因果逻辑
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
  lastAction?: "BUY" | "TRIM" | "HOLD" | "SELL" | string;
  lastTargetPrice?: number;
  lastStopLossPrice?: number;
  actualPriceAction?: string;
  pnlImpact?: number;
  accuracyScore?: number;
  distilledLesson?: string;
  // 实盘三态闭环检验归因
  verificationOutcome?: "EXPERIENCE" | "LESSON" | "RANDOM_NOISE";
  verificationOutcomeLabel?: string;
  verificationLesson?: string;
  actualNextClosePrice?: number;
  actualNextChangeRate?: number;
}

export interface TimeFmForecastItem {
  direction: "UP" | "DOWN" | "SIDEWAYS";
  directionLabel: string;
  predictedPrice: number;
  predictedChangeRate: number;
  confidenceLow: number;
  confidenceHigh: number;
  confidenceScore: number;
  momentumRationale: string;
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
  timefmForecast?: TimeFmForecastItem; // Google TimeFM 次日时序预测
  pastRetro: PastDeductionRetroPerStock; // 实盘三态闭环检验与经验库
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

export interface SectorSnapshotItem {
  symbol: string;
  name: string;
  category: "GROWTH" | "CYCLICAL" | "DEFENSIVE";
  lastPrice: number;
  changeRate: number;
  rsToSpy: number;
  capitalInflow: number;
  mainCapitalInflow: number;
  turnoverRate: number;
  quadrant: "LEADING" | "WEAKENING" | "LAGGING" | "IMPROVING";
  isLeading: boolean;
}

export interface BenchmarkSnapshotItem {
  symbol: string;
  name: string;
  lastPrice: number;
  changeRate: number;
}

export interface CredibleNewsItem {
  title: string;
  summary: string;
  sourceName: string;
  tier: 1 | 2 | 3;
  tierLabel: string;
  sentiment: "BULLISH" | "BEARISH" | "NEUTRAL";
  url: string;
  publishedTime?: string;
}

export interface CrossAssetAnchors {
  vix: number;
  vixChange: number;
  us10y: number;
  dxy: number;
  spyChange: number;
  qqqChange: number;
  iwmChange: number;
}

export interface DailyMacroSnapshotDTO {
  id?: string;
  snapshotDate: string;
  createdAt?: string;
  regimeMood: "BULLISH" | "BEARISH" | "NEUTRAL" | "VOLATILE";
  regimeScore: number;
  stanceBias: string;
  positionCapPct: number;
  stopLossPct: number;
  crossAsset: CrossAssetAnchors;
  sectors: SectorSnapshotItem[];
  benchmarks: BenchmarkSnapshotItem[];
  topNews: CredibleNewsItem[];
  promptContext: string;
  isLiveRealtime?: boolean;
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
  // 新增实时动态板块与信源结构
  macroSnapshot?: DailyMacroSnapshotDTO;
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

export interface CapitalSpaceAnalysis {
  existingHoldingsValue: number;       // 当前现有持仓总市值 ($)
  potentialFreedCapital: number;       // 调仓 (止盈/止损) 预计释放回流资金 ($)
  userInputDeployableCapital: number;  // 用户在控制舱指定动用资金 ($)
  actualAvailableCash: number;         // 账户当前真实闲置现金 ($)
  totalDeployableCapacity: number;     // 最终合成总可用操盘资金空间 ($)
  allocatedCapital: number;            // 建议开仓/加仓总分配金额 ($)
  cashBufferAmount: number;            // 建议保留的安全垫现金 ($)
  cashBufferPct: number;               // 现金安全垫比例 (%)
}

export interface GoalDrivenConstraint {
  targetTimeHorizonDays: number;       // 限定交易日 T (默认 5)
  targetProfitGoalPct: number;         // 盈利目标 G% (默认 8.0%)
  maxDrawdownPct: number;              // 最大回撤预算 D% (默认 4.0%)
  userDeployableBudget: number;        // 用户预算 C ($)
}

export type MarketSessionPhase =
  | "PRE_MARKET"         // 盘前分析推演期 (04:00 - 09:30 ET)
  | "INTRADAY"           // 盘中实时监控期 (09:30 - 16:00 ET)
  | "POST_MARKET"        // 盘后复盘归 Interpretation期 (16:00 - 20:00 ET)
  | "OVERNIGHT_CLOSED"   // 夜间休市静默期 (20:00 - 04:00 ET)
  | "WEEKEND_OR_HOLIDAY"; // 周末或 NYSE/NASDAQ 官方节假日休市

export type TimeTravelSimulationMode =
  | "REALTIME"           // 实时跟随真实物理时钟
  | "SIMULATE_PRE_MARKET" // 强制模拟盘前 (08:30 ET)
  | "SIMULATE_INTRADAY"  // 强制模拟盘中 (14:00 ET)
  | "SIMULATE_POST_MARKET"// 强制模拟盘后 (17:30 ET)
  | "SIMULATE_WEEKEND";  // 强制模拟周末研判

export interface MarketSessionContext {
  easternTimeStr: string;        // 美东时间字符串 (如 "2026-08-17 08:30:00 EDT")
  localTimeStr: string;          // 本地时间字符串
  isTradingDay: boolean;         // 今日是否为美股交易日
  marketPhase: MarketSessionPhase;
  phaseLabel: string;            // 人类可读标签 (如 "🟡 盘前推演期")
  phaseDescription: string;      // 时态核心指引 (如 "聚焦隔夜宏观、盘前跳空与开盘挂单预案")
  activeRoleName: string;        // 大模型当前担当角色 (如 "盘前首席策略官")
  timeToNextBellMinutes: number; // 距离下一次重要开闭盘关键时刻的分钟数
  countdownLabel: string;        // 倒计时提示 (如 "距离美股开盘还有 60 分钟")
  currentTradingDay: string;     // 当前或最近美股交易日 (YYYY-MM-DD)
  nextTradingDay: string;        // 下一个美股交易日 (YYYY-MM-DD)
  isSimulated?: boolean;         // 是否处于时空穿梭模拟模式
}

export interface DailyAllocationOutput {
  marketOverview: string;
  macroIntel?: MacroMarketIntel;
  macroSnapshot?: DailyMacroSnapshotDTO;
  marketSession?: MarketSessionContext; // 美股时空时态锚定上下文
  capitalSpace?: CapitalSpaceAnalysis;
  goalConstraints?: GoalDrivenConstraint;
  overallCertaintyScore?: number;      // 全局消除迷茫度得分 (0~100)
  overallGoalProbability?: number;     // 组合总体目标达成期望概率 (%)
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

