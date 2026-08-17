import {
  AdaptiveActionPolicy,
  MarketSimulationResult,
  ScenarioBranch,
} from "../types/stockTypes";

export interface PlanningInput {
  symbol: string;
  companyName: string;
  currentPrice: number;
  simulation: MarketSimulationResult;
  targetTimeHorizonDays?: number;
  targetProfitGoalPct?: number;
  maxDrawdownPct?: number;
  userAvailableBudget?: number;
  totalPortfolioValue?: number;
  atr14?: number;
  macroRegime?: string;
}

export interface PlanningConfig {
  maxSinglePositionWeightPct?: number; // 默认单标的上限 35%
  maxAccountRiskBudgetPct?: number;    // 默认单笔最大风险 1.5%
  defaultTimeHorizonDays?: number;     // 默认 5 个交易日
  defaultProfitGoalPct?: number;       // 默认 +8.0%
  defaultMaxDrawdownPct?: number;      // 默认 -5.0%
}

export const DEFAULT_PLANNING_CONFIG: Required<PlanningConfig> = {
  maxSinglePositionWeightPct: 35.0,
  maxAccountRiskBudgetPct: 1.5,
  defaultTimeHorizonDays: 5,
  defaultProfitGoalPct: 8.0,
  defaultMaxDrawdownPct: 5.0,
};

/**
 * 蒙特卡洛情景树与自适应行动规划器 (ActionPlanningSearchEngine)
 * 在多主体博弈仿真沙盘的基础上，依据用户收益目标与风险约束，搜索出 3 大情景演化分支及最优行动预案。
 */
export class ActionPlanningSearchEngine {
  /**
   * 生成自适应行动策略包 (AdaptiveActionPolicy)
   */
  public static generateAdaptivePolicy(
    input: PlanningInput,
    customConfig?: PlanningConfig
  ): AdaptiveActionPolicy {
    const config: Required<PlanningConfig> = {
      ...DEFAULT_PLANNING_CONFIG,
      ...(customConfig || {}),
    };

    const {
      symbol,
      companyName,
      currentPrice,
      simulation,
      targetTimeHorizonDays = config.defaultTimeHorizonDays,
      targetProfitGoalPct = config.defaultProfitGoalPct,
      maxDrawdownPct = config.defaultMaxDrawdownPct,
      userAvailableBudget = 10000,
      totalPortfolioValue = userAvailableBudget,
      atr14 = currentPrice * 0.035,
      macroRegime = "NEUTRAL",
    } = input;

    const basePrice = Math.max(0.01, currentPrice);

    // ==========================================
    // 1. 动态测算三态情景概率 (Probability Distribution)
    // ==========================================
    // 基准概率受分歧度与脆弱性约束：分歧度越大，基准概率越低，极端分支概率越高
    let baseProb = 0.55 - (simulation.equilibriumDispersionPct / 100) * 0.3;
    baseProb = Math.max(0.35, Math.min(0.70, baseProb));

    // 多头突破概率：受主导力量与大盘加持
    let bullBonus = 0;
    if (simulation.dominantPlayer === "LONG_ONLY_INSTITUTION" || simulation.dominantPlayer === "MOMENTUM_CTA") {
      bullBonus += 0.08;
    }
    if (macroRegime === "BULLISH") bullBonus += 0.07;
    else if (macroRegime === "BEARISH") bullBonus -= 0.10;

    let bullProb = (1.0 - baseProb) * (0.6 + bullBonus);
    bullProb = Math.max(0.10, Math.min(0.50, bullProb));

    // 空头踩踏防守概率：归一化闭环
    let bearProb = Number((1.0 - baseProb - bullProb).toFixed(4));
    if (bearProb < 0.05) {
      bearProb = 0.05;
      baseProb = Number((1.0 - bullProb - bearProb).toFixed(4));
    }

    baseProb = Number(baseProb.toFixed(2));
    bullProb = Number(bullProb.toFixed(2));
    bearProb = Number((1.0 - baseProb - bullProb).toFixed(2));

    // ==========================================
    // 2. 构建 3 大情景演化分支
    // ==========================================

    // 分支 1: 基准中枢演化 (Base Equilibrium)
    const baseTarget = simulation.equilibriumPriceCenter;
    const baseEntryMin = Number((basePrice * 0.992).toFixed(2));
    const baseEntryMax = Number((basePrice * 1.006).toFixed(2));
    const baseScenario: ScenarioBranch = {
      scenarioName: "BASE_EQUILIBRIUM",
      scenarioLabel: `基准博弈中枢演化 (${(baseProb * 100).toFixed(0)}% 概率)`,
      probability: baseProb,
      triggerCondition: `盘口价格在 [${baseEntryMin}, ${baseEntryMax}] 箱体内震荡，机构与散户博弈处于常态均衡。`,
      projectedPriceTarget: baseTarget,
      recommendedAction: baseTarget >= basePrice ? "BUY_SCALE_IN" : "HOLD_AND_OBSERVE",
      entryZone: { min: baseEntryMin, max: baseEntryMax },
      executionRule: `若盘中回踩 $${baseEntryMin}~$${baseEntryMax} 吸筹区间，建议分批挂单买入，持有跨度 ${targetTimeHorizonDays} 个交易日。`,
      timeHorizonDays: targetTimeHorizonDays,
    };

    // 分支 2: 利好向上突破 (Bullish Catalyst)
    const bullTarget = Number((basePrice * (1 + targetProfitGoalPct / 100)).toFixed(2));
    const breakoutTrigger = simulation.ctaBreakoutTrigger ?? Number((basePrice * 1.03).toFixed(2));
    const bullScenario: ScenarioBranch = {
      scenarioName: "BULLISH_CATALYST",
      scenarioLabel: `向上共振突破 (${(bullProb * 100).toFixed(0)}% 概率)`,
      probability: bullProb,
      triggerCondition: `放量向上突破 $${breakoutTrigger} 阻力位，或突发利好触发散户追涨与 CTA 趋势加仓。`,
      projectedPriceTarget: bullTarget,
      recommendedAction: "BUY_AGGRESSIVE",
      entryZone: { min: basePrice, max: breakoutTrigger },
      executionRule: `若盘中突破 $${breakoutTrigger} 且成交量放大，执行顺势右侧追单，锁定 +${targetProfitGoalPct}% 止盈目标。`,
      timeHorizonDays: Math.max(2, Math.round(targetTimeHorizonDays * 0.7)),
    };

    // 分支 3: 破位踩踏防守 (Bearish Controlling)
    const hardStopPrice = Number(
      (Math.max(basePrice * (1 - maxDrawdownPct / 100), basePrice - atr14 * 1.5)).toFixed(2)
    );
    const gammaSupport = simulation.gammaSupportLevel ?? Number((basePrice * 0.965).toFixed(2));
    const bearScenario: ScenarioBranch = {
      scenarioName: "BEARISH_CONTROLLING",
      scenarioLabel: `破位踩踏防守 (${(bearProb * 100).toFixed(0)}% 概率)`,
      probability: bearProb,
      triggerCondition: `击穿做市商支撑线 $${gammaSupport} 或跌破硬止损线 $${hardStopPrice}，触发多头砍仓踩踏。`,
      projectedPriceTarget: hardStopPrice,
      recommendedAction: "CLOSE_HARD_STOP",
      entryZone: { min: hardStopPrice, max: gammaSupport },
      executionRule: `若跌破 $${hardStopPrice}，无条件市价清仓离场，将单笔回撤严格控制在 -${maxDrawdownPct}% 红线以内。`,
      timeHorizonDays: 1,
    };

    const scenarioTree = [baseScenario, bullScenario, bearScenario];

    // ==========================================
    // 3. vn.py 量化风控头寸计算 (硬纪律约束)
    // ==========================================
    // 单股止损风险敞口 ($)
    const perShareRisk = Math.max(0.01, basePrice - hardStopPrice);
    // 单笔最大允许亏损金 ($)
    const maxRiskBudget = (totalPortfolioValue * config.maxAccountRiskBudgetPct) / 100;

    // 基于风险预算反推最大允许股数
    let riskAllowedShares = Math.floor(maxRiskBudget / perShareRisk);

    // 单标的组合上限截断 (<= 35% 组合总市值)
    const maxCapitalCap = (totalPortfolioValue * config.maxSinglePositionWeightPct) / 100;
    const capitalAllowedShares = Math.floor(Math.min(userAvailableBudget, maxCapitalCap) / basePrice);

    // 最终建议买入股数
    const recommendedShares = Math.max(0, Math.min(riskAllowedShares, capitalAllowedShares));
    const allocatedCapitalAmount = Number((recommendedShares * basePrice).toFixed(2));
    const capitalAllocationPct = Number(
      ((allocatedCapitalAmount / (userAvailableBudget > 0 ? userAvailableBudget : totalPortfolioValue)) * 100).toFixed(1)
    );
    const maxRiskLossDollar = Number((recommendedShares * perShareRisk).toFixed(2));

    return {
      symbol: symbol.toUpperCase(),
      companyName: companyName || symbol,
      currentPrice: basePrice,
      simulation,
      scenarioTree,
      quantRiskVerdict: {
        recommendedShares,
        allocatedCapitalAmount,
        capitalAllocationPct,
        hardStopLossPrice: hardStopPrice,
        maxRiskLossDollar,
        atr14: Number(atr14.toFixed(2)),
      },
    };
  }
}

export const actionPlanningSearchEngine = ActionPlanningSearchEngine;
