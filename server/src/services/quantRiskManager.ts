import { ActionItem } from "../types/stockTypes";

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
}

export class QuantRiskManager {
  /**
   * 结合标的 ATR 真实波幅、溢出动量得分与账户资金，计算高胜率的止损止盈区间与持仓股数
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
  }): DynamicRiskTargetResult {
    const {
      currentPrice,
      action,
      urgency = "MEDIUM",
      spilloverAlphaScore = 0,
      networkRiskScore = 30,
      availableCash = 5000,
      totalBudget = 10000,
      customAtr,
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
      };
    }

    // 1. 估算真实波幅 ATR (默认以日波动 2.5% ~ 3.5% 为锚点)
    const baseVolPct = networkRiskScore > 60 ? 0.038 : 0.026;
    const atr = customAtr && customAtr > 0 ? customAtr : currentPrice * baseVolPct;

    // 2. 根据产业链溢出动量分微调止盈止损乘数
    // 溢出动量越强，允许给予更宽的向上止盈空间；网络风险越高，需收窄止损防线
    const alphaBonus = Math.max(-0.5, Math.min(1.0, spilloverAlphaScore / 50));
    const riskPenalty = Math.max(0, (networkRiskScore - 40) / 100);

    const stopMultiplier = Math.max(1.5, 2.0 + riskPenalty * 0.5); // 止损倍数 1.8 ~ 2.5 ATR
    const targetMultiplier = Math.max(3.2, 4.0 + alphaBonus * 1.2); // 止盈倍数 3.5 ~ 5.2 ATR

    let stopLossPrice = 0;
    let targetPrice = 0;
    let stopLossPct = 0;
    let takeProfitPct = 0;
    let riskRewardRatio = 2.0;

    if (action === "BUY") {
      const stopDistance = Math.max(currentPrice * 0.04, stopMultiplier * atr);
      const targetDistance = Math.max(currentPrice * 0.085, targetMultiplier * atr);

      stopLossPrice = Number(Math.max(0.01, currentPrice - stopDistance).toFixed(2));
      targetPrice = Number((currentPrice + targetDistance).toFixed(2));

      stopLossPct = Number((((stopLossPrice - currentPrice) / currentPrice) * 100).toFixed(1));
      takeProfitPct = Number((((targetPrice - currentPrice) / currentPrice) * 100).toFixed(1));

      const actualRisk = currentPrice - stopLossPrice;
      const actualReward = targetPrice - currentPrice;
      riskRewardRatio = actualRisk > 0 ? Number((actualReward / actualRisk).toFixed(2)) : 2.0;
    } else if (action === "TRIM" || action === "SELL") {
      // 减仓或清仓：止损位上移保本，止盈位为当前平仓指导价
      stopLossPrice = Number((currentPrice * 0.98).toFixed(2));
      targetPrice = Number((currentPrice * 1.02).toFixed(2));
      stopLossPct = -2.0;
      takeProfitPct = 2.0;
      riskRewardRatio = 1.0;
    } else {
      // HOLD
      stopLossPrice = Number((currentPrice * 0.94).toFixed(2));
      targetPrice = Number((currentPrice * 1.1).toFixed(2));
      stopLossPct = -6.0;
      takeProfitPct = 10.0;
      riskRewardRatio = 1.67;
    }

    // 3. 基于资金上限与凯利公式计算持仓头寸 (股数分配)
    const effectiveCapital = Math.min(availableCash, totalBudget);
    let positionWeight = 0.15; // 默认单票 15% 仓位

    if (urgency === "HIGH" && spilloverAlphaScore > 20) {
      positionWeight = 0.25; // 强确定性机会最高 25% 仓位
    } else if (urgency === "LOW" || networkRiskScore > 60) {
      positionWeight = 0.08; // 高风险或低置信度压低至 8%
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
    const projectedPnL = Number((suggestedShares * (targetPrice - currentPrice)).toFixed(2));
    const projectedPnLPct = takeProfitPct;

    return {
      targetPrice,
      stopLossPrice,
      takeProfitPct,
      stopLossPct,
      riskRewardRatio,
      projectedPnL,
      projectedPnLPct,
      suggestedShares,
      estimatedAmount,
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
    totalBudget: number = 10000
  ): ActionItem {
    const quantTargets = this.calculateDynamicRiskTargets({
      currentPrice,
      action: rawAction.action,
      urgency: rawAction.urgency,
      spilloverAlphaScore: spilloverAlpha,
      networkRiskScore: networkRisk,
      availableCash,
      totalBudget,
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
    };
  }
}

export const quantRiskManager = new QuantRiskManager();
