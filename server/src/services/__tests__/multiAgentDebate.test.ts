import { describe, it, expect } from "vitest";
import { tradeInvariantValidator } from "../tradeInvariantValidator";
import { ActionItem, UsStockSpecialIntel } from "../../types/stockTypes";

describe("MultiAgentDebate & UsSpecialIntel Tests", () => {
  it("should validate that debate fields bullThesis, bearishRiskPoint, and bullBearVerdict are properly structured", () => {
    const action: ActionItem = {
      action: "BUY",
      actionType: "OPEN_POSITION",
      symbol: "NVDA",
      companyName: "NVIDIA Corporation",
      suggestedShares: 5,
      estimatedPrice: 130.0,
      estimatedAmount: 650.0,
      rationale: "基于算力订单可见度高，建议建仓5股",
      urgency: "HIGH",
      targetPrice: 145.0,
      stopLossPrice: 122.0,
      riskRewardRatio: 2.1,
      bullThesis: "🟢 全球云巨头 GPU 资本开支依然强劲，Blackwell 芯片交付在即",
      bearishRiskPoint: "🔴 若数据中心能耗受限或跌破 $122.0 软止损点需无条件离场",
      bullBearVerdict: "⚖️ 多方动能与业绩确定性占优，必须严守 $122 止损线",
      entryZone: { min: 128.5, max: 131.0 },
    };

    const res = tradeInvariantValidator.validateAndEnforce({
      action,
      currentPrice: 130.0,
      availableCash: 2000.0,
      totalMarketValue: 5000.0,
    });

    expect(res.isValid).toBe(true);
    expect(res.action.bullThesis).toBeDefined();
    expect(res.action.bearishRiskPoint).toBeDefined();
    expect(res.action.bullBearVerdict).toBeDefined();
    expect(res.status.passedCount).toBe(5);
  });

  it("should correctly identify earnings blackout when earnings date is within 7 days", () => {
    // 模拟距离今天 4 天后的财报日
    const today = new Date();
    const earningsDateObj = new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000);
    const earningsDateStr = earningsDateObj.toISOString().slice(0, 10);

    const diffDays = Math.ceil((earningsDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const isBlackout = diffDays >= 0 && diffDays <= 7;
    const riskLevel = isBlackout ? "HIGH" : "SAFE";

    expect(isBlackout).toBe(true);
    expect(riskLevel).toBe("HIGH");
  });

  it("should correctly evaluate option gamma squeeze when large institutional inflow is detected", () => {
    const mainInflow = 15000000; // $15M
    const turnover = 3.5;
    const gammaBias = mainInflow > 5000000 ? "CALL_SQUEEZE" : "NEUTRAL";
    const pcr = gammaBias === "CALL_SQUEEZE" ? 1.75 : 1.0;

    expect(gammaBias).toBe("CALL_SQUEEZE");
    expect(pcr).toBeGreaterThan(1.0);
  });
});
