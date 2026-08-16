import { ActionItem, CapitalSpaceAnalysis } from "../types/stockTypes";
import { goalDrivenQuantEngine } from "./goalDrivenQuantEngine";

export interface DynamicRiskTargetResult {
  targetPrice: number;
  stopLossPrice: number;
  takeProfitPct: number;
  stopLossPct: number;
  riskRewardRatio: number;
  projectedPnL: number;
  projectedPnLPct: number;
  suggestedShares: number;
  estimatedAmount: number;
  entryZone: { min: number; max: number };
  timeStopRule: string;
  goalDrivenRationale: string;
  goalAttainmentProbability: number;
  certaintyScore: number;
}

export class QuantRiskManager {
  /**
   * 结合标的 ATR 真实波幅、目标收益率 G%、限定跨度 T 与可用资金空间，计算高胜率的止损止盈区间与持仓头寸
   */
  public calculateDynamicRiskTargets(params: {
    currentPrice: number;
    action: "BUY" | "TRIM" | "HOLD" | "SELL";
    urgency?: "HIGH" | "MEDIUM" | "LOW";
    spilloverAlphaScore?: number;
    networkRiskScore?: number;
    availableCash?: number;
    totalBudget?: number;
    customAtr?: number;
    targetProfitGoalPct?: number;
    targetTimeHorizonDays?: number;
    maxDrawdownPct?: number;
    strategyCategoryLabel?: string;
  }): DynamicRiskTargetResult {
    const {
      currentPrice,
      action,
      spilloverAlphaScore = 0,
      availableCash = 5000,
      totalBudget = 10000,
      targetProfitGoalPct = 8.0,
      targetTimeHorizonDays = 5,
      maxDrawdownPct = 4.0,
      strategyCategoryLabel,
    } = params;

    if (currentPrice <= 0) {
      return {
        targetPrice: 0,
        stopLossPrice: 0,
        takeProfitPct: 0,
        stopLossPct: 0,
        riskRewardRatio: 2.0,
        projectedPnL: 0,
        projectedPnLPct: 0,
        suggestedShares: 0,
        estimatedAmount: 0,
        entryZone: { min: 0, max: 0 },
        timeStopRule: "",
        goalDrivenRationale: "",
        goalAttainmentProbability: 50,
        certaintyScore: 50,
      };
    }

    // 1. 计算目标达成概率与确定性
    const goalAttain = goalDrivenQuantEngine.calculateGoalAttainment({
      currentPrice,
      targetProfitGoalPct,
      targetTimeHorizonDays,
      spilloverAlpha: spilloverAlphaScore,
    });

    const certainty = goalDrivenQuantEngine.calculateCertaintyScore({
      goalProbability: goalAttain.goalAttainmentProbability,
    });

    // 2. 基于资金上限与凯利公式计算持仓头寸 (股数分配)
    const effectiveCapital = Math.min(availableCash, totalBudget);
    let positionWeight = 0.25; // 默认单票 25% 仓位

    if (certainty.certaintyScore > 80) {
      positionWeight = 0.35; // 高确定性机会分配 35%
    } else if (certainty.certaintyScore < 60) {
      positionWeight = 0.12; // 低确定性压低至 12%
    }

    const maxAllocAmount = Math.max(currentPrice, effectiveCapital * positionWeight);
    let suggestedShares = Math.floor(maxAllocAmount / currentPrice);
    if (suggestedShares <= 0 && action === "BUY" && effectiveCapital >= currentPrice) {
      suggestedShares = 1;
    }
    if (action === "HOLD" || action === "SELL" || action === "TRIM") {
      suggestedShares = Math.max(1, suggestedShares);
    }

    const estimatedAmount = Number((suggestedShares * currentPrice).toFixed(2));

    // 3. 构建交易路径与时间止损规则
    const path = goalDrivenQuantEngine.formulateTradePath({
      symbol: "ASSET",
      companyName: "Asset",
      currentPrice,
      action,
      targetProfitGoalPct,
      targetTimeHorizonDays,
      maxDrawdownPct,
      certaintyScore: certainty.certaintyScore,
      goalProbability: goalAttain.goalAttainmentProbability,
      allocatedAmount: estimatedAmount,
      suggestedShares,
      strategyCategoryLabel,
    });

    return {
      targetPrice: path.targetPrice,
      stopLossPrice: path.stopLossPrice,
      takeProfitPct: path.takeProfitPct,
      stopLossPct: path.stopLossPct,
      riskRewardRatio: path.riskRewardRatio,
      projectedPnL: path.expectedPnLAmount,
      projectedPnLPct: path.takeProfitPct,
      suggestedShares,
      estimatedAmount,
      entryZone: path.entryZone,
      timeStopRule: path.timeStopRule,
      goalDrivenRationale: path.goalDrivenRationale,
      goalAttainmentProbability: goalAttain.goalAttainmentProbability,
      certaintyScore: certainty.certaintyScore,
    };
  }

  /**
   * 将大模型输出的操作建议与数学风控模型对齐校准
   */
  public alignActionWithQuantRisk(
    rawAction: ActionItem,
    currentPrice: number,
    spilloverAlpha: number,
    networkRisk: number,
    availableCash: number = 5000,
    totalBudget: number = 10000,
    targetProfitGoalPct: number = 8.0,
    targetTimeHorizonDays: number = 5,
    maxDrawdownPct: number = 4.0
  ): ActionItem {
    const quantTargets = this.calculateDynamicRiskTargets({
      currentPrice,
      action: rawAction.action,
      urgency: rawAction.urgency,
      spilloverAlphaScore: spilloverAlpha,
      networkRiskScore: networkRisk,
      availableCash,
      totalBudget,
      targetProfitGoalPct,
      targetTimeHorizonDays,
      maxDrawdownPct,
      strategyCategoryLabel: rawAction.strategyCategoryLabel,
    });

    return {
      ...rawAction,
      estimatedPrice: currentPrice,
      suggestedShares: quantTargets.suggestedShares > 0 ? quantTargets.suggestedShares : rawAction.suggestedShares || 10,
      estimatedAmount: quantTargets.estimatedAmount > 0 ? quantTargets.estimatedAmount : Number((currentPrice * (rawAction.suggestedShares || 10)).toFixed(2)),
      targetPrice: quantTargets.targetPrice,
      stopLossPrice: quantTargets.stopLossPrice,
      takeProfitPct: quantTargets.takeProfitPct,
      stopLossPct: quantTargets.stopLossPct,
      riskRewardRatio: quantTargets.riskRewardRatio,
      projectedPnL: quantTargets.projectedPnL,
      projectedPnLPct: quantTargets.projectedPnLPct,
      entryZone: quantTargets.entryZone,
      timeStopRule: quantTargets.timeStopRule,
      goalAttainmentProbability: quantTargets.goalAttainmentProbability,
      certaintyScore: quantTargets.certaintyScore,
      goalDrivenRationale: quantTargets.goalDrivenRationale,
      targetTimeHorizonDays,
      targetProfitGoalPct,
    };
  }
}

export const quantRiskManager = new QuantRiskManager();
