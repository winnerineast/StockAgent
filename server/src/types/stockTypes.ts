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
  volume?: number;
  averageDailyVolume?: number;
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

export type StockActionVerdict =
  | "OPEN_POSITION"   // 1. 建仓 (无仓开仓)
  | "ADD_POSITION"    // 2. 加仓 (浮盈/回踩支撑追加头寸)
  | "TRIM_POSITION"   // 3. 减仓 (触及阻力/阶段锁利避险)
  | "CLOSE_POSITION"  // 4. 清仓 (破位硬止损/逻辑破坏清仓)
  | "HOLD_AND_WATCH"  // 5. 持有/观望 (中性观望)
  | "INSUFFICIENT_DATA_ABORT"; // 6. 🚨 信息不足·推演硬熔断

// 1. 数据缺失诊断与刚性准入契约
export interface MissingDataDiagnostic {
  category: "LIVE_MARKET" | "NEWS_SEARCH" | "FUNDAMENTALS" | "KNOWLEDGE_GRAPH" | "OPTIONS_CHAIN";
  field: string;
  severity: "CRITICAL" | "WARNING";
  description: string;
  remedyAction: string;
}

export interface DataSufficiencyConfig {
  requireOrderBookPrice?: boolean;
  requireMainCapitalFlow?: boolean;
  requireNewsCoverage?: boolean;
  maxNewsAgeDays?: number;
  requireFundamentalsPe?: boolean;
  requireKnowledgeGraph?: boolean;
  minKnowledgeGraphNodes?: number;
  requireOptionGamma?: boolean;
}

export interface DataSufficiencyReport {
  symbol: string;
  isSufficient: boolean;
  completenessScore: number; // 0 ~ 100
  criticalMissingCount: number;
  warningCount: number;
  missingItems: MissingDataDiagnostic[];
  abortReason?: string;
  evaluatedAt: string;
}

// 2. 多主体博弈仿真与情景演化契约
export type MarketParticipantType =
  | "LONG_ONLY_INSTITUTION"  // 长线价值机构
  | "MOMENTUM_CTA"           // 动量量化
  | "MARKET_MAKER_GAMMA"     // 做市商/期权Gamma
  | "RETAIL_SENTIMENT";      // 散户情绪

export interface AgentBeliefState {
  agentType: MarketParticipantType;
  agentLabel: string;
  bias: "STRONG_LONG" | "LEAN_LONG" | "NEUTRAL" | "LEAN_SHORT" | "STRONG_SHORT";
  biasScore: number;          // -100 ~ +100
  confidenceScore: number;    // 0 ~ 100
  targetPriceHorizon: number; // 心理预期目标价
  orderIntensity: number;     // 资金参与烈度 0.0 ~ 1.0
  corePremise: string;        // 核心判断依据
  vulnerabilityTrigger: string; // 迫使其反向止损/踩踏的触发条件
}

export interface MarketSimulationResult {
  symbol: string;
  simulationRounds: number;
  agentStates: AgentBeliefState[];
  equilibriumPriceCenter: number;  // 虚拟博弈出清中枢价
  equilibriumDispersionPct: number;// 多空分歧度 (% 越大代表博弈越激烈)
  liquidityFragilityScore: number; // 流动性踩踏脆弱指数 (0~100)
  dominantPlayer: MarketParticipantType; // 当前盘面主导力量
  gammaSupportLevel?: number;      // 做市商Gamma防御位
  institutionalAccumulationFloor?: number; // 机构吸筹托底价
  ctaBreakoutTrigger?: number;     // CTA触发追涨/杀跌临界点
  liquidityFragility?: LiquidityFragilityInfo; // 微观流动性脆弱度与滑点缓冲区间
}

export interface ScenarioBranch {
  scenarioName: "BASE_EQUILIBRIUM" | "BULLISH_CATALYST" | "BEARISH_CONTROLLING";
  scenarioLabel: string;
  probability: number;            // 出现概率 0.0 ~ 1.0 (总和 1.0)
  triggerCondition: string;       // 触发条件
  projectedPriceTarget: number;   // 演化目标价
  recommendedAction: "BUY_AGGRESSIVE" | "BUY_SCALE_IN" | "HOLD_AND_OBSERVE" | "TRIM_DEFENSIVE" | "CLOSE_HARD_STOP";
  entryZone: { min: number; max: number };
  executionRule: string;          // 具体挂单指令 (供上班族手机挂单)
  timeHorizonDays: number;
}

export interface AdaptiveActionPolicy {
  symbol: string;
  companyName: string;
  currentPrice: number;
  simulation: MarketSimulationResult;
  scenarioTree: ScenarioBranch[];
  quantRiskVerdict: {
    recommendedShares: number;
    allocatedCapitalAmount: number;
    capitalAllocationPct: number;
    hardStopLossPrice: number;
    maxRiskLossDollar: number;
    atr14: number;
  };
}

export interface NewsEvidenceItem {
  title: string;
  summary: string;
  sourceName: string;
  tier: 1 | 2 | 3;
  tierLabel: string;
  sentiment: "BULLISH" | "BEARISH" | "NEUTRAL";
  url: string;
  publishedTime?: string;
}

export interface FundamentalsEvidence {
  peRatio?: number;
  pbRatio?: number;
  revenueGrowthPct?: number;
  netMarginPct?: number;
  debtToEquity?: number;
  nextEarningsDate?: string;
  valuationScore?: number;
  valuationStatus?: string;
  summary?: string;
}

export interface LiveMarketEvidence {
  curPrice: number;
  costBasis?: number;
  shares?: number;
  pnlAmount?: number;
  pnlPct?: number;
  mainCapitalInflow?: number;
  capitalInflow?: number;
  turnoverRate?: number;
  flowTrend?: "INFLOW" | "OUTFLOW" | "NEUTRAL";
  description?: string;
}

export interface TimeFmEvidence {
  direction: "UP" | "DOWN" | "SIDEWAYS";
  predictedPrice: number;
  predictedChangePct: number;
  confidenceLow: number;
  confidenceHigh: number;
  targetAttainmentProbability: number;
  momentumRationale?: string;
}

export interface PastLessonEvidence {
  id?: string;
  date: string;
  action: string;
  outcome: "EXPERIENCE" | "LESSON" | "RANDOM_NOISE";
  outcomeLabel: string;
  lessonText: string;
  pnlImpactAmount?: number;
}

export interface Evidence5Pillars {
  news: NewsEvidenceItem[];
  fundamentals?: FundamentalsEvidence;
  liveMarket: LiveMarketEvidence;
  timefm?: TimeFmEvidence;
  pastLessons: PastLessonEvidence[];
}

export interface ConsolidatedPrincipleItem {
  id: string;
  portfolioId: string;
  symbol: string;
  principleType: "INDIVIDUAL_STOCK" | "SECTOR_RULE" | "GLOBAL_DISCIPLINE";
  category: "ENTRY_DISCIPLINE" | "STOP_LOSS_RULE" | "TAKE_PROFIT_RULE" | "EVENT_CATALYST";
  title: string;
  distilledRule: string;
  sampleCount: number;
  confidenceWeight: number; // 0.0 ~ 1.0 (with time-decay)
  firstLearnedDate: string;
  lastReinforcedDate: string;
  isArchived: boolean;
  evidenceLogIds?: string[];
  // Holistic Context 时态与变更追溯增强
  validStart?: string;          // 生效起始日期 YYYY-MM-DD
  validEnd?: string | null;     // 失效截止日期 YYYY-MM-DD (null 表示当前持续有效 +∞)
  supersededById?: string;      // 被哪条新原则取代
  supersedeReason?: string;     // 演进/推翻的原因证据摘要
  evidenceWeightSum?: number;   // 支撑此原则的累计证据加权分
}

export interface TemporalEvolutionItem {
  id: string;
  deductionDate: string;
  actionType: StockActionVerdict;
  actionTypeLabel: string;
  whySummary: string;
  triggerPrice: number;
  targetPrice?: number;
  stopLossPrice?: number;
  entryZone?: EntryZone;
  timeStopDays?: number;
  certaintyScore?: number;
  goalAttainmentProbability?: number;
  isVerified: boolean;
  actualNextClosePrice?: number;
  actualNextChangeRate?: number;
  verificationOutcome?: "EXPERIENCE" | "LESSON" | "RANDOM_NOISE";
  verificationOutcomeLabel?: string;
  verificationLesson?: string;
  pnlImpactAmount?: number;
  evidence?: Evidence5Pillars;
}

export interface Evidence3PillarsHighlights {
  fundamentalAnchor: string;    // 📊 基本面与估值锚点 (如: PE 28 处于历史 15% 分位，Q2 营收增速 +35%)
  catalystAnchor: string;       // 📰 权威资讯与催化锚点 (如: 彭博今日确认其获得甲骨文 $500M 算力大单)
  flowRiskAnchor: string;       // 🏦 资金与 ATR 防线 (如: OpenD 主力资金净流入 $1.2B，ATR 软止损 $125.4，盈亏比 2.3)
}

export interface TradeInvariantStatus {
  isVerified: boolean;
  passedCount: number;
  totalChecks: number;
  badges: string[]; // ["CASH_BOUND_SAFE", "STOP_LOSS_INTEGRITY", "POSITION_CAP_SAFE", "PRICE_VALID", "ENTRY_ZONE_SAFE"]
  diagnosticNotes?: string[];
  wasClamped?: boolean;
}

export interface UsStockSpecialIntel {
  earningsDate?: string;          // 财报发布日期 YYYY-MM-DD
  daysToEarnings?: number;        // 距离财报发布还剩天数 (负数表示已发布完)
  isEarningsBlackout: boolean;    // 是否处于财报静默/高危黑天鹅窗口 (<= 7 天)
  earningsRiskLevel: "HIGH" | "MEDIUM" | "SAFE"; // 财报黑天鹅风险等级
  earningsRiskLabel: string;      // 友好标签 (如: "⚠️ 距财报仅 4 天 · 静默高风险")
  unusualOptionActivity?: {       // 美股特色期权异动 / Gamma 偏斜
    hasUnusualFlow: boolean;
    callPutVolumeRatio?: number;  // 认购/认沽交易量比率 (PCR)
    impliedVolatilityPct?: number;// 隐含波动率 IV %
    gammaBias: "CALL_SQUEEZE" | "PUT_HEDGING" | "NEUTRAL";
    gammaBiasLabel: string;
    flowSummary: string;
  };
}

export interface ActionItem {
  action: "BUY" | "SELL" | "HOLD" | "TRIM";
  actionType?: StockActionVerdict;
  whySummary?: string;
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
  evidence?: Evidence5Pillars;
  evidenceHighlights?: Evidence3PillarsHighlights; // ⚡ 30秒极速决策 3 大核心客观事实锚点
  invariantStatus?: TradeInvariantStatus;          // 🛡️ 交易与数据不变量校验状态

  // 多智能体对抗辩论与美股特色异动字段 (TradingAgents 务实落地)
  bullThesis?: string;                         // 🟢 多方核心主线与催化支撑
  bearishRiskPoint?: string;                   // 🔴 空方最严苛反驳点/最大下行破位风险
  bullBearVerdict?: string;                    // ⚖️ 多空交锋最终裁决与防守底线
  usSpecialIntel?: UsStockSpecialIntel;        // 📅 美股财报静默期与期权异动雷达

  // vn.py 量化内核新增字段
  atr?: number;                        // 14日真实波幅 ($)
  atrPct?: number;                     // ATR 占当前股价百分比 (%)
  perShareRisk?: number;               // 单股止损风险敞口 ($)
  maxRiskBudget?: number;              // 单笔最大允许风险金 ($，按 1.5% 账户资金预算)
  positionWeightPct?: number;          // 建议仓位占总资产比率 (%)

  // 数据完备性与博弈世界模型扩展字段
  dataSufficiencyReport?: DataSufficiencyReport; // 数据完备性评估与缺失诊断报告
  simulationResult?: MarketSimulationResult;     // 微观多主体博弈仿真出清结果
  scenarioBranches?: ScenarioBranch[];           // 三态情景演化分支
  adaptivePolicy?: AdaptiveActionPolicy;         // 最终自适应行动策略包

  // 微观市场结构与执行摩擦成本字段 (Issue #3 & #5)
  slippagePct?: number;                          // 预估滑点率 (%)
  estimatedSlippageCost?: number;                // 预估滑点冲击成本 ($)
  estimatedFee?: number;                         // 预估交易佣金与规费 ($)
  advLimitShares?: number;                       // 基于 ADV 2% 限制的最大建议股数
  orderStatus?: OrderExecutionStatus;            // 订单生命周期状态
}

export type OrderExecutionStatus =
  | "PENDING_SUBMIT"   // 待提交 / 策略已生成待确认
  | "ACKNOWLEDGED"     // 券商已接单 / 挂单中
  | "PARTIAL_FILLED"   // 部分成交
  | "FILLED"           // 全部成交
  | "REJECTED"         // 废单 / 拒单 (如风控阻断或资金不足)
  | "CANCELLED"        // 用户或算法撤单
  | "EXPIRED";         // 挂单过期

export interface OrderExecutionItem {
  orderId: string;
  strategyId?: string;
  symbol: string;
  action: "BUY" | "SELL" | "TRIM";
  status: OrderExecutionStatus;
  submittedShares: number;
  filledShares: number;
  submittedPrice: number;
  averageFillPrice?: number;
  targetPrice?: number;
  stopLossPrice?: number;
  submittedAt: string;
  updatedAt: string;
  statusMessage?: string;
  rejectionReason?: string;
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

export type GraphRelationSemanticType = "SUPPORT" | "COMPETE" | "RELATED" | "SUPERSEDE";

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
  // Holistic Context 赫布活边与 4-Type 语义关系
  relationSemantic?: GraphRelationSemanticType; // 论文 4-edge 词汇表 (SUPPORT / COMPETE / RELATED / SUPERSEDE)
  hebbianWeight?: number;                       // 0.0 ~ 1.0 赫布动态权重 (初始 0.15, >=0.5 激活为 Living Edge)
  lastCoActivatedAt?: string;                   // 上次共激活/共检索日期 YYYY-MM-DD
  coActivationCount?: number;                   // 历史累计共激活次数
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
  credibleNews?: NewsEvidenceItem[];
  communitySentiment?: CommunitySentimentItem;
  capitalFlow?: CapitalFlowItem;
  fundamentals?: StockFundamentals;
  position?: StockPositionItem;
  openDSnapshot?: OpenDSnapshotItem;
  timefmForecast?: TimeFmForecastItem; // Google TimeFM 次日时序预测
  pastRetro: PastDeductionRetroPerStock; // 实盘三态闭环检验与经验库
  currentRecommendation?: ActionItem;
  evidence5Pillars?: Evidence5Pillars;
  evidenceHighlights?: Evidence3PillarsHighlights; // ⚡ 30秒极速决策 3 大核心客观事实锚点
  invariantStatus?: TradeInvariantStatus;          // 🛡️ 交易与数据不变量校验状态
  bullThesis?: string;                             // 🟢 多方核心主线与催化支撑
  bearishRiskPoint?: string;                       // 🔴 空方最严苛反驳点/最大下行破位风险
  bullBearVerdict?: string;                        // ⚖️ 多空交锋最终裁决与防守底线
  usSpecialIntel?: UsStockSpecialIntel;            // 📅 美股财报静默期与期权异动雷达
  liquidityFragility?: LiquidityFragilityInfo;     // 🛡️ 微观流动性脆弱度与智能挂单滑点保护
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

  // vn.py 经典量化复盘统计指标
  sortinoRatio?: number;        // 索提诺比率 (仅惩罚下行负收益波动)
  downsideDeviation?: number;   // 下行风险标准差 (%)
  profitExpectancy?: number;    // 单笔数学期望值 ($ 或 %)
  winLossRatio?: number;        // 盈亏比 (AvgWin / AvgLoss)
  winRate?: number;             // 胜率 (%)
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
  marketDynamics?: MarketDynamicsReport; // 📊 市场动力学状态机报告 (MDM)
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
  // 向后兼容旧版字段
  promptContextText?: string;
  knowledgeGraphContext?: string;
  searxngNewsContext?: string;
  positionsContext?: string;
  lessonsContext?: string;
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

// =========================================================================
// 🚀 TradeMaster & FinAgent 深度量化与反思扩展契约
// =========================================================================

// 1. 市场动力学状态机 (TradeMaster MDM)
export type MarketDynamicsRegime =
  | "TRENDING_BULL"              // 单边主升牛市
  | "TRENDING_BEAR"              // 单边下行熊市
  | "HIGH_VOLATILITY_CHOP"       // 高波宽幅洗盘震荡
  | "COMPRESSED_CONSOLIDATION";  // 低波窄幅蓄势整理

export interface MarketDynamicsReport {
  regime: MarketDynamicsRegime;
  regimeLabel: string;
  trendStrengthIndex: number;    // TSI 趋势强度 (-1.0 ~ +1.0)
  volatilityClusteringIndex: number; // VCI 波动率聚集度 (如 -2.0 ~ +3.0)
  marketBreadthPct: number;      // 市场广度 (标普/纳指成分股站上20日线比例 %)
  adaptedRiskParams: {
    maxPortfolioCapPct: number;  // 动态总仓位上限 (30% ~ 85%)
    singleStockCapPct: number;   // 动态单票上限 (15% ~ 35%)
    atrStopMultiplier: number;   // 动态 ATR 止损乘数 (1.2x ~ 2.2x)
  };
  rationale: string;
  evaluatedAt: string;
}

// 2. 微观流动性脆弱性与滑点保护缓冲 (Microstructure Slippage Protection)
export interface LiquidityFragilityInfo {
  bidAskSpreadPct: number;       // 做市商买卖盘价差率 (%)
  turnoverRate5d: number;        // 5日平均换手率 (%)
  liquidityFragilityIndex: number;// 流动性踩踏脆弱性指数 (0 ~ 100)
  slippageBufferMin: number;     // 考虑流动性支撑的挂单下界 ($)
  slippageBufferMax: number;     // 考虑防追高滑点的挂单上界 ($)
  slippageWarning?: string;      // 踩踏与滑点预警提示
}

// 3. 组合权重凸优化求解契约 (TradeMaster EIIE / Markowitz Risk-Parity)
export interface PortfolioAllocationCandidate {
  symbol: string;
  companyName?: string;
  expectedReturnPct: number;
  volatilityPct: number;
  sector: string;
  confidenceScore: number;
  currentPrice: number;
}

export interface PortfolioAllocationResult {
  optimalWeights: Record<string, number>; // symbol -> weight (0.0 ~ 0.35)
  cashWeight: number;                     // 留存现金比例 (0.0 ~ 1.0)
  allocatedCapitalMap: Record<string, number>; // symbol -> $ allocated
  suggestedSharesMap: Record<string, number>;  // symbol -> exact integer shares
  expectedSharpeRatio: number;
  sectorExposure: Record<string, number>; // sector -> total weight
  allocationExplanation: string;
}

// 4. PRUDEX-Compass 6 维综合评估体系 (TradeMaster Benchmark)
export interface PrudexRadarMetric {
  name: string;
  value: string | number;
  description: string;
}

export interface PrudexRadarAxis {
  axis: "P" | "R" | "U" | "D" | "E" | "X";
  axisName: string;
  score: number;               // 0 ~ 100
  benchmark: number;           // 行业基准分 (如 65)
  subMetrics: PrudexRadarMetric[];
}

export interface PrudexCompassScore {
  overallScore: number;        // 综合体检得分 (0 ~ 100)
  profitabilityScore: number;  // P: 收益力 (Sharpe, Win Rate, Annualized Return)
  riskControlScore: number;    // R: 风控力 (Max Drawdown, Sortino, Downside Risk)
  universalityScore: number;   // U: 周期普适性 (Regime Stability)
  diversityScore: number;      // D: 持仓多样性 (Sector HHI Index)
  reliabilityScore: number;    // E: 置信校准度 (Expected Calibration Error)
  explainabilityScore: number; // X: 证据可解释性 (5-Pillars Completeness)
  radarAxes: PrudexRadarAxis[];
  diagnosisAdvice: string[];   // 针对薄弱维度的诊断与改进指引
  samplePeriodDays: number;
  totalEvaluatedLogs: number;
  evaluatedAt: string;
}

// 5. FinAgent 模式的双层反思架构 (Dual-Level Memory Reflection)
export interface DualLevelReflectionItem {
  id: string;
  level: "L1_TACTICAL" | "L2_STRATEGIC";
  levelLabel: string;          // "🎯 L1 单票战术反思" | "🏛️ L2 全局战略纪律"
  symbol?: string;             // L1 绑定单票，L2 为 "GLOBAL"
  category: "ENTRY_DISCIPLINE" | "STOP_LOSS_RULE" | "TAKE_PROFIT_RULE" | "EVENT_CATALYST" | "RISK_AVOIDANCE";
  ruleSummary: string;
  triggerContext: string;
  enforcementAction: string;
  sampleCount: number;
  confidenceWeight: number;
}

export interface DualLevelReflectionReport {
  tacticalReflections: DualLevelReflectionItem[];
  strategicDisciplines: DualLevelReflectionItem[];
  totalPrinciplesCount: number;
  activeEnforcedCount: number;
  latestReinforcedDate: string;
}

export interface DailyAllocationOutput {
  marketOverview: string;
  macroIntel?: MacroMarketIntel;
  macroSnapshot?: DailyMacroSnapshotDTO;
  marketDynamics?: MarketDynamicsReport; // 📊 市场动力学状态机
  prudexCompass?: PrudexCompassScore;    // 🧭 PRUDEX-Compass 6 维复盘罗盘
  dualLevelMemory?: DualLevelReflectionReport; // 🧠 FinAgent 双层反思原则库
  portfolioAllocation?: PortfolioAllocationResult; // 📐 组合权重优化结果
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

// =========================================================================
// 🌐 Holistic Context 认知图谱与证据仲裁契约
// =========================================================================

export type EvidenceSourceType =
  | "MOOMOO_ORDERBOOK"
  | "SEC_FILING"
  | "TIME_FM"
  | "ANALYST_REPORT"
  | "NEWS_SEARCH"
  | "USER_INPUT";

export interface EvidenceItemForConfidence {
  id: string;
  sourceType: EvidenceSourceType;
  reliability?: number;
  timestamp: string;
  contentSummary?: string;
}

export interface ConflictArbitrationResult {
  status: "BULL_DOMINANT" | "BEAR_DOMINANT" | "CONTESTED";
  dominantScore: number;
  bullScore: number;
  bearScore: number;
  scoreDiff: number;
  isContested: boolean;
  explanation: string;
  recommendedStance: "PROCEED_LONG" | "PROCEED_SHORT" | "REDUCE_EXPOSURE_AND_WAIT";
}

export interface AbstentionDecision {
  shouldAbstain: boolean;
  reason?: string;
  maxConfidence: number;
  threshold: number;
  contestedRisk: boolean;
  fallbackAction: StockActionVerdict;
}

// =========================================================================
// 🎨 多数据源溯源 (Data Provenance)、时效性与正确性校验契约
// =========================================================================

export type MarketDataSource =
  | "MOOMOO_OPEND"     // 🟢 MooMoo 实盘实时 (Level-2 资金流/逐笔撮合)
  | "YAHOO_FINANCE"    // 🟣 Yahoo Finance 全球多源备用行情 & 财报
  | "SEARXNG_SEARCH"   // 🔵 SearXNG 全网聚合新闻 & 催化
  | "SEC_EDGAR"        // 🟡 SEC 官方 10-K/10-Q 披露 & 8-K 黑天鹅
  | "GOOGLE_TIMEFM"    // 🔷 Google TimeFM 工业级时序动量预测
  | "LOCAL_CACHE";     // ⚪ 本地 SQLite 知识库 & 历史推演快照

export type DataFreshnessStatus =
  | "FRESH"            // 🟢 黄金时效 (盘中<=15分钟 / 盘后前收有效)
  | "DELAYED"          // 🟡 轻度延迟 (15分钟 ~ 24小时)
  | "STALE";           // 🔴 过时陈旧 (>24小时 / 需强制刷新)

export type DataValidityStatus =
  | "VALID"            // ✅ 物理合法且多源一致
  | "CROSS_FLAGGED"    // ⚠️ 多源比对存在轻度偏离 (已自动调和)
  | "INVALID";         // ❌ 异常脏数据 (已被清洗过滤)

export interface ProvenanceTaggedField<T> {
  value: T;
  source: MarketDataSource;
  sourceLabel: string;
  sourceColor: string; // Tailwind color class / badge theme
  freshness: DataFreshnessStatus;
  validity: DataValidityStatus;
  verifiedAt: string;  // 校验时间戳 ISO
  warningNote?: string;
}

export interface DataFreshnessReport {
  symbol: string;
  overallStatus: DataFreshnessStatus;
  overallValidity: DataValidityStatus;
  quoteSource: MarketDataSource;
  fundamentalsSource: MarketDataSource;
  isPriceFresh: boolean;
  isFundamentalsValid: boolean;
  priceCrossCheckDeviationPct?: number;
  flags: string[];
  evaluatedAt: string;
}

// =========================================================================
// 🚀 统一市场数据提供者门面 (MarketDataGateway) 契约
// =========================================================================

export interface UnifiedQuote {
  symbol: string;
  name: string;
  price: number;
  prevClose: number;
  changeRate: number;
  openPrice?: number;
  highPrice?: number;
  lowPrice?: number;
  volume?: number;
  turnoverRate?: number;
  peRatio?: number;
  // 🌟 自动注入的溯源 Badge 元数据
  dataSource: MarketDataSource;
  sourceLabel: string;
  sourceColor: string;
  badgeClass: string;
  freshness: DataFreshnessStatus;
  validity: DataValidityStatus;
  verifiedAt: string;
  confidence: number;
}

export interface UnifiedFundamentals {
  symbol: string;
  companyName?: string;
  peRatio?: number;
  revenueGrowthPct?: number;
  netMarginPct?: number;
  debtToEquity?: number;
  nextEarningsDate?: string;
  fundamentalSummary?: string;
  // 🌟 自动注入的溯源 Badge 元数据
  dataSource: MarketDataSource;
  sourceLabel: string;
  sourceColor: string;
  badgeClass: string;
  freshness: DataFreshnessStatus;
  validity: DataValidityStatus;
  verifiedAt: string;
  confidence: number;
}

export interface UnifiedMacroSector {
  sectorId: string;
  name: string;
  etfSymbol: string;
  changePercent: number;
  inFlow: number;
  mainInFlow: number;
  dataSource: MarketDataSource;
  sourceLabel: string;
  badgeClass: string;
  freshness: DataFreshnessStatus;
}

export interface UnifiedCapitalFlow {
  symbol: string;
  inFlow: number;
  mainInFlow: number;
  trend: "INFLOW" | "OUTFLOW" | "NEUTRAL";
  dataSource: MarketDataSource;
  sourceLabel: string;
  badgeClass: string;
  freshness: DataFreshnessStatus;
}

export interface MarketDataGatewayConfig {
  primaryQuoteSource: MarketDataSource;
  fallbackQuoteSource: MarketDataSource;
  primaryFundamentalsSource: MarketDataSource;
  fallbackFundamentalsSource: MarketDataSource;
  enableCrossCheck: boolean;
  maxCrossCheckDeviationPct: number;
}





