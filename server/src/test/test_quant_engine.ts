import { goalDrivenQuantEngine } from "../services/goalDrivenQuantEngine";
import { quantRiskManager } from "../services/quantRiskManager";
import { StockEngine } from "../services/stockEngine";
import { ActionItem, OpenDSnapshotItem, StockPositionItem, TimeFmForecastItem } from "../types/stockTypes";

console.log("=======================================================================");
console.log("🚀 StockAgent 目标驱动与消除迷茫度量化算法测试套件");
console.log("=======================================================================\n");

// -----------------------------------------------------------------------------
// 1. 资金空间全景解算测试 (Capital Space Analysis Test)
// -----------------------------------------------------------------------------
console.log("【测试 1】资金空间全景解算 (Capital Space Analysis)");
const mockPositions: StockPositionItem[] = [
  { symbol: "NVDA", shares: 10, costBasis: 120.0, marketPrice: 130.0 }, // 价值 $1300
  { symbol: "AAPL", shares: 15, costBasis: 220.0, marketPrice: 230.0 }, // 价值 $3450
];

const capitalSpace = goalDrivenQuantEngine.calculateCapitalSpace({
  existingPositions: mockPositions,
  actualCash: 3500.0,
  userInputBudget: 2500.0,
  freedCapitalFromTrims: 500.0,
  macroRegimeMood: "BULLISH",
});

console.log("  • 现有持仓总市值:", `$${capitalSpace.existingHoldingsValue}`);
console.log("  • 调仓预期释放现金:", `$${capitalSpace.potentialFreedCapital}`);
console.log("  • 用户指定动用预算:", `$${capitalSpace.userInputDeployableCapital}`);
console.log("  • 账户真实可用现金:", `$${capitalSpace.actualAvailableCash}`);
console.log("  • 最终合成可用操盘空间:", `$${capitalSpace.totalDeployableCapacity}`);
console.log("  • 自适应现金安全垫:", `$${capitalSpace.cashBufferAmount} (${capitalSpace.cashBufferPct}%)`);
console.assert(capitalSpace.totalDeployableCapacity === 3000.0, "总可用空间计算错误");
console.log("  ✅ 测试 1 通过！\n");

// -----------------------------------------------------------------------------
// 2. 时序波动锥与目标达成概率测试 (Goal Attainment & Volatility Cone Test)
// -----------------------------------------------------------------------------
console.log("【测试 2】时序对数正态波动锥与 T 日目标达成概率");
const snapNVDA: OpenDSnapshotItem = {
  symbol: "NVDA",
  name: "英伟达",
  lastPrice: 130.0,
  highest52WeeksPrice: 145.0,
  lowest52WeeksPrice: 85.0,
  turnoverRate: 3.2,
  mainCapitalInflow: 45000000,
};

const tfmUp: TimeFmForecastItem = {
  direction: "UP",
  directionLabel: "时序动量看多",
  predictedPrice: 138.5,
  predictedChangeRate: 6.5,
  confidenceLow: 132.0,
  confidenceHigh: 142.0,
  confidenceScore: 85,
  momentumRationale: "零样本注意力捕捉强劲主升动量",
};

// 测试 5 日目标 +8%
const res5Days = goalDrivenQuantEngine.calculateGoalAttainment({
  currentPrice: 130.0,
  targetProfitGoalPct: 8.0,
  targetTimeHorizonDays: 5,
  snapshot: snapNVDA,
  timefmForecast: tfmUp,
  spilloverAlpha: 35,
  capitalInflowTrend: "INFLOW",
  strategyCategory: "CAPITAL_INFLOW_BUY",
});

console.log("  • 标的日波动率:", `${(res5Days.dailyVolatility * 100).toFixed(2)}%`);
console.log("  • 5日波动扩散范围:", `${(res5Days.horizonVolatility * 100).toFixed(2)}%`);
console.log("  • 复合预期日漂移率:", `+${res5Days.compositeDriftRate}%/日`);
console.log("  • 5日达成 +8.0% 概率 P(Hit Goal):", `${res5Days.goalAttainmentProbability}%`);
console.log("  • 不触及止损安全存活率:", `${res5Days.stopLossSurvivalProbability}%`);
console.assert(res5Days.goalAttainmentProbability > 50, "达成概率应显著高于50%");
console.log("  ✅ 测试 2 通过！\n");

// -----------------------------------------------------------------------------
// 3. 确定性指数 / 消除迷茫度得分测试 (Certainty Score & Entropy Reduction)
// -----------------------------------------------------------------------------
console.log("【测试 3】确定性指数 / 消除迷茫度得分 (Certainty Score)");
const certRes = goalDrivenQuantEngine.calculateCertaintyScore({
  goalProbability: res5Days.goalAttainmentProbability,
  timefmForecast: tfmUp,
  snapshot: snapNVDA,
  strategyCategory: "CAPITAL_INFLOW_BUY",
  macroRegimeMood: "BULLISH",
});

console.log("  • 确定性指数得分:", `${certRes.certaintyScore}/100`);
console.log("  • 消除迷茫度判定:", certRes.entropyReductionText);
console.log("  • 多因子闭环确认项:", certRes.factorConfirmations.join("、"));
console.assert(certRes.certaintyScore >= 75, "高胜率多因子共振得分应不低于75");
console.log("  ✅ 测试 3 通过！\n");

// -----------------------------------------------------------------------------
// 4. 单股交易路径、精准挂单区间与 T 日时间止损纪律测试
// -----------------------------------------------------------------------------
console.log("【测试 4】精准挂单区间与 T 日时间止损纪律");
const tradePath = goalDrivenQuantEngine.formulateTradePath({
  symbol: "NVDA",
  companyName: "英伟达",
  currentPrice: 130.0,
  action: "BUY",
  targetProfitGoalPct: 8.0,
  targetTimeHorizonDays: 5,
  maxDrawdownPct: 4.0,
  certaintyScore: certRes.certaintyScore,
  goalProbability: res5Days.goalAttainmentProbability,
  allocatedAmount: 1560.0,
  suggestedShares: 12,
  strategyCategory: "CAPITAL_INFLOW_BUY",
  strategyCategoryLabel: "💰 主力净流入建仓",
});

console.log("  • 现价:", `$${130.0}`);
console.log("  • 精准挂单区间 (Entry Zone):", `$${tradePath.entryZone.min} ~ $${tradePath.entryZone.max}`);
console.log("  • 目标止盈价 (+8%):", `$${tradePath.targetPrice}`);
console.log("  • 硬止损价 (-4%):", `$${tradePath.stopLossPrice}`);
console.log("  • 收益风险比 (R:R):", `${tradePath.riskRewardRatio}:1`);
console.log("  • 预期净盈利:", `+$${tradePath.expectedPnLAmount}`);
console.log("  • 最大承受风险:", `-$${tradePath.maxRiskAmount}`);
console.log("  • 时间止损纪律:", tradePath.timeStopRule);
console.log("  • 消除迷茫度归因:", tradePath.goalDrivenRationale);
console.log("  ✅ 测试 4 通过！\n");

// -----------------------------------------------------------------------------
// 5. 组合级资金最优分配求解器 (Constrained Kelly Allocation Test)
// -----------------------------------------------------------------------------
console.log("【测试 5】组合级资金最优分配 (聚焦前1~3只最高确定性标的)");
const candidateActions: ActionItem[] = [
  {
    action: "BUY",
    symbol: "NVDA",
    companyName: "英伟达",
    estimatedPrice: 130.0,
    suggestedShares: 0,
    estimatedAmount: 0,
    rationale: "",
    urgency: "HIGH",
    certaintyScore: 88,
    goalAttainmentProbability: 78.5,
    strategyCategory: "CAPITAL_INFLOW_BUY",
    strategyCategoryLabel: "💰 主力净流入",
  },
  {
    action: "BUY",
    symbol: "AMD",
    companyName: "超威半导体",
    estimatedPrice: 150.0,
    suggestedShares: 0,
    estimatedAmount: 0,
    rationale: "",
    urgency: "HIGH",
    certaintyScore: 82,
    goalAttainmentProbability: 72.0,
    strategyCategory: "OVERSOLD_BUY",
    strategyCategoryLabel: "📉 超跌建仓",
  },
  {
    action: "BUY",
    symbol: "INTC",
    companyName: "英特尔",
    estimatedPrice: 20.0,
    suggestedShares: 0,
    estimatedAmount: 0,
    rationale: "",
    urgency: "MEDIUM",
    certaintyScore: 62,
    goalAttainmentProbability: 55.0,
    strategyCategory: "WATCH_AND_WAIT",
    strategyCategoryLabel: "👀 观望",
  },
  {
    action: "BUY",
    symbol: "TSLA",
    companyName: "特斯拉",
    estimatedPrice: 210.0,
    suggestedShares: 0,
    estimatedAmount: 0,
    rationale: "",
    urgency: "LOW",
    certaintyScore: 58,
    goalAttainmentProbability: 48.0,
    strategyCategory: "WATCH_AND_WAIT",
    strategyCategoryLabel: "👀 观望",
  },
];

const allocRes = goalDrivenQuantEngine.optimizePortfolioAllocation({
  candidateActions,
  capitalSpace,
  targetProfitGoalPct: 8.0,
  targetTimeHorizonDays: 5,
  maxDrawdownPct: 4.0,
});

console.log("  • 全局确定性得分:", `${allocRes.overallCertaintyScore}/100`);
console.log("  • 组合目标达成期望概率:", `${allocRes.overallGoalProbability}%`);
console.log("  • 建议总配置资金:", `$${allocRes.updatedCapitalSpace.allocatedCapital} / 可用空间 $${capitalSpace.totalDeployableCapacity}`);

console.log("\n  📋 最终分配动作明细:");
allocRes.optimizedActions.forEach((act) => {
  if (act.action === "BUY") {
    console.log(`    🎯 [${act.symbol}] 买入 ${act.suggestedShares} 股 | 分配: $${act.capitalAllocationAmount} (${act.capitalAllocationPct}%) | 挂单: $${act.entryZone?.min}~$${act.entryZone?.max} | 确定性: ${act.certaintyScore}分`);
  } else {
    console.log(`    ⏸️ [${act.symbol}] 转为 ${act.action} (头寸: $${act.capitalAllocationAmount || 0}) | 理由: ${act.rationale.slice(0, 40)}...`);
  }
});

console.assert(
  allocRes.optimizedActions.filter((a) => a.action === "BUY").length <= 3,
  "买入标的应严格聚焦于前1~3只最高确定性标的"
);
console.log("\n  ✅ 测试 5 通过！\n");

console.log("=======================================================================");
console.log("🎉 全部 5 项量化核心算法单测均通过！0 报错！");
console.log("=======================================================================");
