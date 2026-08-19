import { describe, it, expect, beforeEach } from "vitest";
import {
  ConfidenceAbstentionGate,
  confidenceAbstentionGate,
} from "../confidenceAbstentionGate";
import { ActionItem, ConflictArbitrationResult } from "../../types/stockTypes";

describe("ConfidenceAbstentionGate (Holistic Context Primitive: Confidence-Aware Abstention)", () => {
  let gate: ConfidenceAbstentionGate;

  beforeEach(() => {
    gate = ConfidenceAbstentionGate.getInstance();
  });

  const baseBuyAction: ActionItem = {
    symbol: "NVDA",
    action: "BUY",
    actionType: "OPEN_POSITION",
    suggestedShares: 15,
    estimatedPrice: 128.5,
    estimatedAmount: 1927.5,
    rationale: "突破布林线上轨，建议顺势建仓",
    urgency: "HIGH",
    targetPrice: 145.0,
    stopLossPrice: 122.0,
  };

  const baseSellAction: ActionItem = {
    symbol: "NVDA",
    action: "SELL",
    actionType: "CLOSE_POSITION",
    suggestedShares: 15,
    estimatedPrice: 120.0,
    estimatedAmount: 1800.0,
    rationale: "跌破刚性止损红线，无条件斩仓避险",
    urgency: "HIGH",
  };

  describe("进攻性买入动作的主动弃权判定", () => {
    it("当综合置信度低于 0.40 时，主动弃权并修正为 HOLD_AND_WATCH", () => {
      const lowConfidence = 0.28; // 低于 0.40 门禁
      const { decision, adjustedAction } = gate.evaluateAbstention(baseBuyAction, lowConfidence);

      expect(decision.shouldAbstain).toBe(true);
      expect(decision.maxConfidence).toBe(0.28);
      expect(adjustedAction.action).toBe("HOLD");
      expect(adjustedAction.actionType).toBe("HOLD_AND_WATCH");
      expect(adjustedAction.suggestedShares).toBe(0);
      expect(adjustedAction.estimatedAmount).toBe(0);
      expect(adjustedAction.whySummary).toContain("主动弃权");
    });

    it("当多空证据面临 Contested 胶着争议时，主动弃权并控制风险", () => {
      const highConfidence = 0.70;
      const contestedResult: ConflictArbitrationResult = {
        status: "CONTESTED",
        dominantScore: 0.70,
        bullScore: 0.70,
        bearScore: 0.65,
        scoreDiff: 0.05,
        isContested: true,
        explanation: "多空证据高度胶着",
        recommendedStance: "REDUCE_EXPOSURE_AND_WAIT",
      };

      const { decision, adjustedAction } = gate.evaluateAbstention(
        baseBuyAction,
        highConfidence,
        contestedResult
      );

      expect(decision.shouldAbstain).toBe(true);
      expect(decision.contestedRisk).toBe(true);
      expect(adjustedAction.actionType).toBe("HOLD_AND_WATCH");
    });

    it("当置信度充足 (>= 0.40) 且无争议时，正常放行买入动作", () => {
      const sufficientConfidence = 0.78;
      const { decision, adjustedAction } = gate.evaluateAbstention(baseBuyAction, sufficientConfidence);

      expect(decision.shouldAbstain).toBe(false);
      expect(adjustedAction.action).toBe("BUY");
      expect(adjustedAction.suggestedShares).toBe(15);
    });
  });

  describe("防守性减仓/止损清仓动作的刚性不变量保护", () => {
    it("无论置信度高低，止损清仓与风险减仓均不被弃权门禁阻断，确保刚性截断防线生效", () => {
      const lowConfidence = 0.15; // 极低置信度
      const { decision, adjustedAction } = gate.evaluateAbstention(baseSellAction, lowConfidence);

      // 绝不弃权防守操作
      expect(decision.shouldAbstain).toBe(false);
      expect(adjustedAction.action).toBe("SELL");
      expect(adjustedAction.actionType).toBe("CLOSE_POSITION");
      expect(adjustedAction.suggestedShares).toBe(15);
    });
  });
});
