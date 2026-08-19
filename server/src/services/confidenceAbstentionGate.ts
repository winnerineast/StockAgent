import {
  ActionItem,
  AbstentionDecision,
  ConflictArbitrationResult,
  StockActionVerdict,
} from "../types/stockTypes";

export class ConfidenceAbstentionGate {
  private static instance: ConfidenceAbstentionGate;

  public static getInstance(): ConfidenceAbstentionGate {
    if (!ConfidenceAbstentionGate.instance) {
      ConfidenceAbstentionGate.instance = new ConfidenceAbstentionGate();
    }
    return ConfidenceAbstentionGate.instance;
  }

  public readonly DEFAULT_ABSTENTION_THRESHOLD = 0.40; // 论文默认置信度门禁 τ=0.40

  /**
   * 论文核心机制: 置信度自适应的主动弃权门禁 (Confidence-aware Abstention Gate)
   * 将长程交互中的“低置信度盲目交易/幻觉”转化为“主动观望弃权”防御性行为
   * 
   * @param action 原计划生成的交易动作
   * @param confidenceScore 综合客观事实证据计算的置信度得分 (0.0 ~ 1.0)
   * @param conflictResult 多空博弈冲突仲裁结果 (可选)
   * @param threshold 弃权门禁阈值 (默认 0.40)
   */
  public evaluateAbstention(
    action: ActionItem,
    confidenceScore: number,
    conflictResult?: ConflictArbitrationResult,
    threshold: number = this.DEFAULT_ABSTENTION_THRESHOLD
  ): {
    decision: AbstentionDecision;
    adjustedAction: ActionItem;
  } {
    const isAggressiveBuy =
      action.action === "BUY" ||
      action.actionType === "OPEN_POSITION" ||
      action.actionType === "ADD_POSITION";

    const isRiskReduction =
      action.action === "SELL" ||
      action.action === "TRIM" ||
      action.actionType === "CLOSE_POSITION" ||
      action.actionType === "TRIM_POSITION";

    const isContested = conflictResult?.isContested ?? false;
    const isBelowThreshold = confidenceScore < threshold;

    // 1. 若是刚性防守/止损减仓动作，优先执行风控，不触发看多弃权
    if (isRiskReduction) {
      return {
        decision: {
          shouldAbstain: false,
          maxConfidence: confidenceScore,
          threshold,
          contestedRisk: isContested,
          fallbackAction: action.actionType || "HOLD_AND_WATCH",
        },
        adjustedAction: action,
      };
    }

    // 2. 若是进攻性建仓/加仓，且面临低置信度或剧烈争议，触发主动弃权观望
    if (isAggressiveBuy && (isBelowThreshold || isContested)) {
      const reason = isBelowThreshold
        ? `🛡️ [主动弃权门禁] 综合证据置信度 ${(confidenceScore * 100).toFixed(1)}% 低于安全开仓阈值 ${(threshold * 100).toFixed(1)}%，触发主动观望弃权 (Abstain)，拒绝在模糊胜率下开仓。`
        : `🛡️ [主动弃权门禁] ${conflictResult?.explanation || "多空双方证据分歧剧烈处于争议区间"}，触发安全观望弃权，暂缓进攻性建仓。`;

      const adjusted: ActionItem = {
        ...action,
        action: "HOLD",
        actionType: "HOLD_AND_WATCH" as StockActionVerdict,
        suggestedShares: 0,
        estimatedAmount: 0,
        whySummary: reason,
        rationale: `[Holistic Context 弃权门禁触发] ${reason}\n原始策略建议: ${action.rationale}`,
        urgency: "LOW",
      };

      return {
        decision: {
          shouldAbstain: true,
          reason,
          maxConfidence: confidenceScore,
          threshold,
          contestedRisk: isContested,
          fallbackAction: "HOLD_AND_WATCH",
        },
        adjustedAction: adjusted,
      };
    }

    // 3. 置信度充足且无严重争议，正常放行
    return {
      decision: {
        shouldAbstain: false,
        maxConfidence: confidenceScore,
        threshold,
        contestedRisk: isContested,
        fallbackAction: action.actionType || "HOLD_AND_WATCH",
      },
      adjustedAction: action,
    };
  }
}

export const confidenceAbstentionGate = ConfidenceAbstentionGate.getInstance();
