import { describe, it, expect } from "vitest";
import { tradeInvariantValidator } from "../tradeInvariantValidator";
import { ActionItem, StockPositionItem } from "../../types/stockTypes";

describe("TradeInvariantValidator Unit Tests (FINOS Legend Invariant Guardrails)", () => {
  it("should clamp excessive BUY shares to available cash & position cap (35%)", () => {
    const rawAction: ActionItem = {
      action: "BUY",
      symbol: "NVDA",
      companyName: "NVIDIA Corp",
      suggestedShares: 500, // 500 * $100 = $50,000 (严重超出可用资金)
      estimatedPrice: 100,
      estimatedAmount: 50000,
      rationale: "大模型给出的超额买入建议",
      urgency: "HIGH",
      targetPrice: 120,
      stopLossPrice: 95,
    };

    const availableCash = 5000;
    const totalMarketValue = 10000; // 35% 上限 = $3500 => 35 股

    const result = tradeInvariantValidator.validateAndEnforce({
      action: rawAction,
      currentPrice: 100,
      availableCash,
      totalMarketValue,
      positionCapPct: 0.35,
    });

    expect(result.isValid).toBe(true);
    expect(result.action.suggestedShares).toBeLessThanOrEqual(35);
    expect(result.action.estimatedAmount).toBeLessThanOrEqual(3500);
    expect(result.status.wasClamped).toBe(true);
    expect(result.status.badges).toContain("CASH_BOUND_SAFE");
  });

  it("should self-heal inverted stop-loss and target prices", () => {
    const rawAction: ActionItem = {
      action: "BUY",
      symbol: "TSLA",
      companyName: "Tesla, Inc.",
      suggestedShares: 10,
      estimatedPrice: 200,
      estimatedAmount: 2000,
      rationale: "大模型点位倒挂幻觉测试",
      urgency: "HIGH",
      targetPrice: 180, // 异常：目标价低于现价 $200
      stopLossPrice: 220, // 异常：止损价高于现价 $200
    };

    const result = tradeInvariantValidator.validateAndEnforce({
      action: rawAction,
      currentPrice: 200,
      availableCash: 10000,
    });

    expect(result.action.stopLossPrice).toBeLessThan(200);
    expect(result.action.targetPrice).toBeGreaterThan(200);
    expect(result.status.wasClamped).toBe(true);
    expect(result.status.badges).toContain("STOP_LOSS_INTEGRITY");
    expect(result.action.stopLossPrice).toBe(192); // 4% default defense => 200 * 0.96
    expect(result.action.targetPrice).toBe(216); // 8% default target => 200 * 1.08
  });

  it("should clamp SELL / TRIM shares if they exceed real position shares", () => {
    const rawAction: ActionItem = {
      action: "TRIM",
      symbol: "AAPL",
      companyName: "Apple Inc.",
      suggestedShares: 50, // 企图卖出 50 股
      estimatedPrice: 220,
      estimatedAmount: 11000,
      rationale: "阶梯减仓",
      urgency: "MEDIUM",
    };

    const existingPosition: StockPositionItem = {
      symbol: "AAPL",
      shares: 20, // 实盘仅有 20 股
      costBasis: 200,
      marketPrice: 220,
    };

    const result = tradeInvariantValidator.validateAndEnforce({
      action: rawAction,
      currentPrice: 220,
      availableCash: 5000,
      existingPosition,
    });

    expect(result.action.suggestedShares).toBe(20); // 安全截断至 20 股
    expect(result.status.wasClamped).toBe(true);
    expect(result.status.badges).toContain("POSITION_TRIM_SAFE");
  });

  it("should validate entry zone bounds and verify invariant badges", () => {
    const rawAction: ActionItem = {
      action: "BUY",
      symbol: "MSFT",
      companyName: "Microsoft Corp",
      suggestedShares: 5,
      estimatedPrice: 400,
      estimatedAmount: 2000,
      rationale: "基本面建仓",
      urgency: "LOW",
      targetPrice: 440,
      stopLossPrice: 384,
      entryZone: { min: -10, max: 0 }, // 异常非法区间
    };

    const result = tradeInvariantValidator.validateAndEnforce({
      action: rawAction,
      currentPrice: 400,
      availableCash: 10000,
    });

    expect(result.action.entryZone).toBeDefined();
    expect(result.action.entryZone!.min).toBeGreaterThan(0);
    expect(result.action.entryZone!.max).toBeGreaterThan(result.action.entryZone!.min);
    expect(result.status.badges).toContain("ENTRY_ZONE_SAFE");
    expect(result.status.passedCount).toBe(result.status.totalChecks);
  });
});
