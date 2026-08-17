import {
  AgentBeliefState,
  MarketParticipantType,
  MarketSimulationResult,
  OpenDSnapshotItem,
  SingleStockIntel,
  StockFundamentals,
  StockKnowledgeGraphItem,
  TimeFmEvidence,
} from "../types/stockTypes";

export interface SimulationParams {
  symbol: string;
  currentPrice: number;
  snapshot?: OpenDSnapshotItem;
  intel?: SingleStockIntel;
  fundamentals?: StockFundamentals;
  knowledgeGraph?: StockKnowledgeGraphItem;
  timefm?: TimeFmEvidence;
  spilloverAlpha?: number;
  networkRisk?: number;
  macroRegime?: string; // "BULLISH" | "BEARISH" | "NEUTRAL" | "VOLATILE"
}

export interface SimulatorConfig {
  institutionWeight?: number; // 默认 0.35
  ctaWeight?: number;         // 默认 0.25
  marketMakerWeight?: number; // 默认 0.20
  retailWeight?: number;      // 默认 0.20
  maxPriceDeviationPct?: number; // 默认 25% 最大心理偏差截断
}

export const DEFAULT_SIMULATOR_CONFIG: Required<SimulatorConfig> = {
  institutionWeight: 0.35,
  ctaWeight: 0.25,
  marketMakerWeight: 0.20,
  retailWeight: 0.20,
  maxPriceDeviationPct: 25.0,
};

/**
 * 微观多主体博弈仿真与出清引擎 (MultiAgentMarketSimulator)
 * 模拟 4 类微观交易主体在当前信息场下的博弈推演，计算虚拟出清价格中枢、多空分歧度与流动性踩踏脆弱性。
 */
export class MultiAgentMarketSimulator {
  /**
   * 执行完整的双轮博弈与出清仿真
   */
  public static simulate(
    params: SimulationParams,
    customConfig?: SimulatorConfig
  ): MarketSimulationResult {
    const config: Required<SimulatorConfig> = {
      ...DEFAULT_SIMULATOR_CONFIG,
      ...(customConfig || {}),
    };

    const {
      symbol,
      currentPrice,
      snapshot,
      intel,
      fundamentals,
      knowledgeGraph,
      timefm,
      spilloverAlpha = 0,
      networkRisk = 25,
      macroRegime = "NEUTRAL",
    } = params;

    const basePrice = Math.max(0.01, currentPrice);

    // ==========================================
    // 1. 机构价值 Agent (A_inst)
    // ==========================================
    const pe = fundamentals?.peRatio ?? snapshot?.peRatio ?? 25;
    const peScore = Math.max(-50, Math.min(50, (30 - pe) * 1.8));
    const mainInflow = snapshot?.mainCapitalInflow ?? 0;
    const flowScore = Math.max(-40, Math.min(40, mainInflow > 0 ? 25 : mainInflow < 0 ? -25 : 0));
    const spilloverImpact = Math.max(-20, Math.min(20, spilloverAlpha * 0.3));

    const instRawBias = peScore + flowScore + spilloverImpact;
    const instBiasScore = Math.max(-100, Math.min(100, instRawBias));
    const instConfidence = Math.max(40, Math.min(95, 60 + Math.abs(instBiasScore) * 0.35));
    const instTargetOffset = (instBiasScore / 100) * 0.12; // 机构预期目标波动 ±12%
    const instTargetPrice = Number((basePrice * (1 + instTargetOffset)).toFixed(2));

    const instState: AgentBeliefState = {
      agentType: "LONG_ONLY_INSTITUTION",
      agentLabel: "长线价值机构 (Long-Only)",
      bias:
        instBiasScore >= 35
          ? "STRONG_LONG"
          : instBiasScore >= 10
          ? "LEAN_LONG"
          : instBiasScore <= -35
          ? "STRONG_SHORT"
          : instBiasScore <= -10
          ? "LEAN_SHORT"
          : "NEUTRAL",
      biasScore: Number(instBiasScore.toFixed(1)),
      confidenceScore: Number(instConfidence.toFixed(1)),
      targetPriceHorizon: instTargetPrice,
      orderIntensity: Number((0.4 + Math.abs(instBiasScore) * 0.005).toFixed(2)),
      corePremise: `PE=${pe.toFixed(1)}, 主力资金=${mainInflow > 0 ? "净流入" : "流出/平衡"}, 产业链溢出分=${spilloverAlpha.toFixed(0)}`,
      vulnerabilityTrigger: `若下次财报不及预期或估值PE扩张超过历史90%分位则触发防守减仓。`,
    };

    // ==========================================
    // 2. 动量量化 Agent (A_cta)
    // ==========================================
    let ctaScore = 0;
    if (timefm?.direction === "UP") ctaScore += 45;
    else if (timefm?.direction === "DOWN") ctaScore -= 45;

    const turnover = snapshot?.turnoverRate ?? 1.5;
    if (turnover > 3.0) ctaScore += (timefm?.direction === "UP" ? 15 : -15);

    const ctaBiasScore = Math.max(-100, Math.min(100, ctaScore));
    const ctaConfidence = Math.max(35, Math.min(90, timefm?.targetAttainmentProbability ?? 65));
    const ctaTargetOffset = (ctaBiasScore / 100) * 0.15;
    const ctaTargetPrice = Number((basePrice * (1 + ctaTargetOffset)).toFixed(2));

    const ctaState: AgentBeliefState = {
      agentType: "MOMENTUM_CTA",
      agentLabel: "动量量化策略 (CTA)",
      bias:
        ctaBiasScore >= 35
          ? "STRONG_LONG"
          : ctaBiasScore >= 10
          ? "LEAN_LONG"
          : ctaBiasScore <= -35
          ? "STRONG_SHORT"
          : ctaBiasScore <= -10
          ? "LEAN_SHORT"
          : "NEUTRAL",
      biasScore: Number(ctaBiasScore.toFixed(1)),
      confidenceScore: Number(ctaConfidence.toFixed(1)),
      targetPriceHorizon: ctaTargetPrice,
      orderIntensity: Number((0.5 + Math.abs(ctaBiasScore) * 0.004).toFixed(2)),
      corePremise: `TimeFM时序预测=${timefm?.direction ?? "SIDEWAYS"}, 换手率=${turnover.toFixed(1)}%`,
      vulnerabilityTrigger: `跌破 20 日均线支撑或 ATR 波动率突破止损线时无条件反手止损。`,
    };

    // ==========================================
    // 3. 做市商 / 流动性防御 Agent (A_mm)
    // ==========================================
    // 做市商倾向于均值回归，高波动时拉宽防御区间
    let mmScore = -instBiasScore * 0.25 - ctaBiasScore * 0.2; // 逆动量做市
    if (networkRisk > 60) mmScore -= 20; // 传染风险高时抽离做多流动性

    const mmBiasScore = Math.max(-100, Math.min(100, mmScore));
    const mmConfidence = Math.max(50, Math.min(95, 75 - networkRisk * 0.2));
    const mmTargetOffset = (mmBiasScore / 100) * 0.06; // 做市商较贴近现价
    const mmTargetPrice = Number((basePrice * (1 + mmTargetOffset)).toFixed(2));

    const mmState: AgentBeliefState = {
      agentType: "MARKET_MAKER_GAMMA",
      agentLabel: "做市商流动性 (Market Maker)",
      bias:
        mmBiasScore >= 20
          ? "LEAN_LONG"
          : mmBiasScore <= -20
          ? "LEAN_SHORT"
          : "NEUTRAL",
      biasScore: Number(mmBiasScore.toFixed(1)),
      confidenceScore: Number(mmConfidence.toFixed(1)),
      targetPriceHorizon: mmTargetPrice,
      orderIntensity: 0.6,
      corePremise: `网络集中度风险=${networkRisk.toFixed(0)}, 宏观状态=${macroRegime}`,
      vulnerabilityTrigger: `盘口买卖失衡超阈值或极端单边行情触发做市流动性抽离。`,
    };

    // ==========================================
    // 4. 散户情绪 Agent (A_retail)
    // ==========================================
    let retailScore = 0;
    const newsCount = intel?.latestNews?.length ?? 0;
    const sentimentMood = intel?.communitySentiment?.mood;
    if (sentimentMood === "BULLISH") retailScore += 40;
    else if (sentimentMood === "BEARISH") retailScore -= 40;
    if (newsCount > 2) retailScore += retailScore >= 0 ? 15 : -15; // 舆情放大

    const retailBiasScore = Math.max(-100, Math.min(100, retailScore));
    const retailConfidence = Math.max(30, Math.min(85, 50 + Math.abs(retailBiasScore) * 0.3));
    const retailTargetOffset = (retailBiasScore / 100) * 0.20; // 散户预期最极端 ±20%
    const retailTargetPrice = Number((basePrice * (1 + retailTargetOffset)).toFixed(2));

    const retailState: AgentBeliefState = {
      agentType: "RETAIL_SENTIMENT",
      agentLabel: "散户情绪场 (Retail)",
      bias:
        retailBiasScore >= 35
          ? "STRONG_LONG"
          : retailBiasScore >= 10
          ? "LEAN_LONG"
          : retailBiasScore <= -35
          ? "STRONG_SHORT"
          : retailBiasScore <= -10
          ? "LEAN_SHORT"
          : "NEUTRAL",
      biasScore: Number(retailBiasScore.toFixed(1)),
      confidenceScore: Number(retailConfidence.toFixed(1)),
      targetPriceHorizon: retailTargetPrice,
      orderIntensity: Number((0.3 + Math.abs(retailBiasScore) * 0.005).toFixed(2)),
      corePremise: `社区情绪=${intel?.communitySentiment ?? "NEUTRAL"}, 催化新闻条数=${newsCount}`,
      vulnerabilityTrigger: `快速冲高回落 > 3% 极易引发恐慌抛盘踩踏。`,
    };

    const agentStates = [instState, ctaState, mmState, retailState];

    // ==========================================
    // 5. 虚拟出清与博弈清算 (Arbitrator Clearing)
    // ==========================================
    const totalWeight =
      config.institutionWeight * instState.orderIntensity +
      config.ctaWeight * ctaState.orderIntensity +
      config.marketMakerWeight * mmState.orderIntensity +
      config.retailWeight * retailState.orderIntensity;

    const weightedPriceSum =
      instTargetPrice * (config.institutionWeight * instState.orderIntensity) +
      ctaTargetPrice * (config.ctaWeight * ctaState.orderIntensity) +
      mmTargetPrice * (config.marketMakerWeight * mmState.orderIntensity) +
      retailTargetPrice * (config.retailWeight * retailState.orderIntensity);

    const rawEquilibrium = weightedPriceSum / (totalWeight > 0 ? totalWeight : 1.0);
    const equilibriumPriceCenter = Number(rawEquilibrium.toFixed(2));

    // 计算博弈分歧度 (Dispersion Index): 4 角色目标价的标准差占基准价的百分比
    const targetPrices = agentStates.map((a) => a.targetPriceHorizon);
    const meanTarget = targetPrices.reduce((a, b) => a + b, 0) / targetPrices.length;
    const variance =
      targetPrices.reduce((sum, p) => sum + Math.pow(p - meanTarget, 2), 0) / targetPrices.length;
    const stdDev = Math.sqrt(variance);
    const equilibriumDispersionPct = Number(((stdDev / basePrice) * 100).toFixed(2));

    // 计算流动性踩踏脆弱指数 (Liquidity Fragility Score 0~100)
    // 散户极度乐观而机构做空，或多空分歧度极高时，脆弱指数飙升
    const retailVsInstConflict = Math.abs(retailBiasScore - instBiasScore);
    const fragilityRaw = equilibriumDispersionPct * 2.2 + retailVsInstConflict * 0.25 + networkRisk * 0.2;
    const liquidityFragilityScore = Math.max(5, Math.min(95, Math.round(fragilityRaw)));

    // 判定主导角色 (按参与烈度与置信度乘积最高者)
    let dominantPlayer: MarketParticipantType = "LONG_ONLY_INSTITUTION";
    let maxPower = -1;
    agentStates.forEach((a) => {
      const power = a.orderIntensity * a.confidenceScore;
      if (power > maxPower) {
        maxPower = power;
        dominantPlayer = a.agentType;
      }
    });

    // 计算关键博弈点位
    const gammaSupportLevel = Number((basePrice * 0.965).toFixed(2));
    const institutionalAccumulationFloor = Number(
      (Math.min(basePrice * 0.98, instTargetPrice * 0.95)).toFixed(2)
    );
    const ctaBreakoutTrigger = Number((basePrice * 1.035).toFixed(2));

    return {
      symbol: symbol.toUpperCase(),
      simulationRounds: 2,
      agentStates,
      equilibriumPriceCenter,
      equilibriumDispersionPct,
      liquidityFragilityScore,
      dominantPlayer,
      gammaSupportLevel,
      institutionalAccumulationFloor,
      ctaBreakoutTrigger,
    };
  }
}

export const multiAgentMarketSimulator = MultiAgentMarketSimulator;
