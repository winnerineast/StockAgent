import { ActionItem, CapitalSpaceAnalysis, OpenDSnapshotItem } from "../types/stockTypes";
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
  atr?: number;
  atrPct?: number;
  perShareRisk?: number;
  maxRiskBudget?: number;
}

export class QuantRiskManager {
  /**
   * 结合标的 ATR 真实波幅、目标收益率 G%、限定跨度 T 与单笔 1.5% 固定风险预算，计算高胜率的止损止盈区间与持仓头寸
   */
  public calculateDynamicRiskTargets(params: {
    symbol?: string;
    companyName?: string;
    currentPrice: number;
    action: "BUY" | "TRIM" | "HOLD" | "SELL";
    urgency?: "HIGH" | "MEDIUM" | "LOW";
    spilloverAlphaScore?: number;
    networkRiskScore?: number;
    availableCash?: number;
    totalBudget?: number;
    customAtr?: number;
    snapshot?: OpenDSnapshotItem;
    targetProfitGoalPct?: number;
    targetTimeHorizonDays?: number;
    maxDrawdownPct?: number;
    strategyCategoryLabel?: string;
  }): DynamicRiskTargetResult {
    const {
      symbol = "",
      companyName = "",
      currentPrice,
      action,
      spilloverAlphaScore = 0,
      availableCash = 0,
      totalBudget = 0,
      targetProfitGoalPct = 8.0,
      targetTimeHorizonDays = 5,
      maxDrawdownPct = 4.0,
      strategyCategoryLabel,
      snapshot,
      customAtr,
    } = params;

    const sym = symbol || snapshot?.symbol || "STOCK";
    const cName = companyName || snapshot?.name || sym;

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
        atr: 0,
        atrPct: 0,
        perShareRisk: 0,
        maxRiskBudget: 0,
      };
    }

    // 1. 计算目标达成概率与确定性
    const goalAttain = goalDrivenQuantEngine.calculateGoalAttainment({
      currentPrice,
      targetProfitGoalPct,
      targetTimeHorizonDays,
      spilloverAlpha: spilloverAlphaScore,
      snapshot,
      customAtr,
    });

    const certainty = goalDrivenQuantEngine.calculateCertaintyScore({
      goalProbability: goalAttain.goalAttainmentProbability,
      snapshot,
    });

    // 2. 基于单笔 1.5% 最大可承受损失 (Fixed Risk Budget) 与 资金上限 计算持仓头寸
    const effectiveCapital = totalBudget > 0 && availableCash > 0
      ? Math.min(availableCash, totalBudget)
      : (availableCash > 0 ? availableCash : totalBudget);

    let positionWeight = 0.25; // 默认单票 25% 资金上限

    if (certainty.certaintyScore > 80) {
      positionWeight = 0.35; // 高确定性机会上限 35%
    } else if (certainty.certaintyScore < 60) {
      positionWeight = 0.12; // 低确定性压低至 12%
    }

    // 预求解基于 ATR 的交易路径获取真实单股风险
    const prePath = goalDrivenQuantEngine.formulateTradePath({
      symbol: sym,
      companyName: cName,
      currentPrice,
      action,
      targetProfitGoalPct,
      targetTimeHorizonDays,
      maxDrawdownPct,
      certaintyScore: certainty.certaintyScore,
      goalProbability: goalAttain.goalAttainmentProbability,
      strategyCategoryLabel,
      snapshot,
      customAtr,
    });

    const maxRiskBudget = effectiveCapital > 0 ? Math.max(1.0, effectiveCapital * 0.015) : 0;
    const perShareRisk = Math.max(0.1, prePath.perShareRisk);
    const sharesByRisk = maxRiskBudget > 0 ? Math.floor(maxRiskBudget / perShareRisk) : 0;
    const maxAllocAmount = effectiveCapital > 0 ? Math.max(currentPrice, effectiveCapital * positionWeight) : currentPrice;
    const sharesByCapital = Math.floor(maxAllocAmount / currentPrice);

    let suggestedShares = Math.min(sharesByCapital, Math.max(1, sharesByRisk));

    if (suggestedShares <= 0 && action === "BUY" && effectiveCapital >= currentPrice) {
      suggestedShares = 1;
    }
    if (action === "HOLD" || action === "SELL" || action === "TRIM") {
      suggestedShares = Math.max(1, suggestedShares);
    }

    const estimatedAmount = Number((suggestedShares * currentPrice).toFixed(2));

    // 3. 构建完整交易路径与时间止损规则
    const path = goalDrivenQuantEngine.formulateTradePath({
      symbol: sym,
      companyName: cName,
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
      snapshot,
      customAtr,
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
      atr: path.atr,
      atrPct: path.atrPct,
      perShareRisk: path.perShareRisk,
      maxRiskBudget: Number(maxRiskBudget.toFixed(2)),
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
    availableCash: number = 0,
    totalBudget: number = 0,
    targetProfitGoalPct: number = 8.0,
    targetTimeHorizonDays: number = 5,
    maxDrawdownPct: number = 4.0,
    snapshot?: OpenDSnapshotItem,
    customAtr?: number
  ): ActionItem {
    const quantTargets = this.calculateDynamicRiskTargets({
      symbol: rawAction.symbol,
      companyName: rawAction.companyName,
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
      snapshot,
      customAtr,
    });

    return {
      ...rawAction,
      estimatedPrice: currentPrice,
      suggestedShares: quantTargets.suggestedShares > 0 ? quantTargets.suggestedShares : rawAction.suggestedShares || 1,
      estimatedAmount: quantTargets.estimatedAmount > 0 ? quantTargets.estimatedAmount : Number((currentPrice * (rawAction.suggestedShares || 1)).toFixed(2)),
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
      atr: quantTargets.atr,
      atrPct: quantTargets.atrPct,
      perShareRisk: quantTargets.perShareRisk,
      maxRiskBudget: quantTargets.maxRiskBudget,
    };
  }
}

export const quantRiskManager = new QuantRiskManager();

