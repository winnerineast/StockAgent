import { describe, it, expect } from "vitest";
import { tradeInvariantValidator } from "../tradeInvariantValidator";
import { ActionItem, OpenDSnapshotItem, StockPositionItem } from "../../types/stockTypes";

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
    expect(result.action.estimatedAmount).toBeLessThanOrEqual(3520);
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

  it("should clamp BUY suggestedShares to 0 when availableCash is 0 (P0 Cash Deficit Invariant)", () => {
    const rawAction: ActionItem = {
      action: "BUY",
      symbol: "NVDA",
      companyName: "NVIDIA Corp",
      suggestedShares: 10,
      estimatedPrice: 100,
      estimatedAmount: 1000,
      rationale: "现金归零时的误报买入",
      urgency: "HIGH",
    };

    const result = tradeInvariantValidator.validateAndEnforce({
      action: rawAction,
      currentPrice: 100,
      availableCash: 0,
      totalMarketValue: 100000,
      positionCapPct: 0.35,
    });

    expect(result.isValid).toBe(true);
    expect(result.action.suggestedShares).toBe(0);
    expect(result.action.estimatedAmount).toBe(0);
    expect(result.status.wasClamped).toBe(true);
    expect(result.status.badges).toContain("CASH_BOUND_SAFE");
    expect(result.status.diagnosticNotes?.join(" ")).toContain("可用现金不足");
  });

  it("should deduct existing position value from position cap during ADD_POSITION", () => {
    const rawAction: ActionItem = {
      action: "BUY",
      symbol: "NVDA",
      companyName: "NVIDIA Corp",
      suggestedShares: 200, // 试图买入 200 股 = $20,000
      estimatedPrice: 100,
      estimatedAmount: 20000,
      rationale: "大模型加仓建议",
      urgency: "HIGH",
    };

    // 总净值 $100,000，单票 35% 上限 = $35,000
    // 现有持仓 300 股 @ $100 = $30,000 (已占 30%)
    // 剩余可买额度 = $35,000 - $30,000 = $5,000 => 50 股
    const existingPosition: StockPositionItem = {
      symbol: "NVDA",
      shares: 300,
      costBasis: 90,
      marketPrice: 100,
    };

    const result = tradeInvariantValidator.validateAndEnforce({
      action: rawAction,
      currentPrice: 100,
      availableCash: 50000, // 现金充裕 $50k
      totalMarketValue: 100000, // 总市值 $100k
      existingPosition,
      positionCapPct: 0.35,
    });

    expect(result.isValid).toBe(true);
    expect(result.action.suggestedShares).toBe(50); // 严格限制为 50 股
    expect(result.action.estimatedAmount).toBe(5008.50); // $5000 本金 + $7.50 滑点 (0.15%) + $1.00 佣金
    expect(result.action.estimatedSlippageCost).toBe(7.50);
    expect(result.action.estimatedFee).toBe(1.00);
    expect(result.status.wasClamped).toBe(true);
    expect(result.status.diagnosticNotes?.join(" ")).toContain("扣减既有持仓后剩余可加仓");
  });

  it("should clamp suggestedShares to 0 if existing position already exceeds position cap", () => {
    const rawAction: ActionItem = {
      action: "BUY",
      symbol: "NVDA",
      companyName: "NVIDIA Corp",
      suggestedShares: 50,
      estimatedPrice: 100,
      estimatedAmount: 5000,
      rationale: "超限加仓尝试",
      urgency: "HIGH",
    };

    // 现有持仓 360 股 @ $100 = $36,000 (占 36%，已超 35% 上限)
    const existingPosition: StockPositionItem = {
      symbol: "NVDA",
      shares: 360,
      costBasis: 90,
      marketPrice: 100,
    };

    const result = tradeInvariantValidator.validateAndEnforce({
      action: rawAction,
      currentPrice: 100,
      availableCash: 20000,
      totalMarketValue: 100000,
      existingPosition,
      positionCapPct: 0.35,
    });

    expect(result.isValid).toBe(true);
    expect(result.action.suggestedShares).toBe(0);
    expect(result.action.estimatedAmount).toBe(0);
    expect(result.status.wasClamped).toBe(true);
    expect(result.status.diagnosticNotes?.join(" ")).toContain("已达到或超过单票 35% 上限");
  });

  it("should enforce ADV liquidity participation ceiling (2% ADV constraint)", () => {
    const rawAction: ActionItem = {
      action: "BUY",
      symbol: "SMALL_CAP",
      companyName: "Small Cap Growth Inc.",
      suggestedShares: 500, // 试图买入 500 股
      estimatedPrice: 20,
      estimatedAmount: 10000,
      rationale: "小盘股流动性冲击测试",
      urgency: "HIGH",
    };

    // 日均成交量 ADV 仅 5,000 股，2% 上限 = 100 股
    const snapshot: OpenDSnapshotItem = {
      symbol: "SMALL_CAP",
      name: "Small Cap Growth Inc.",
      lastPrice: 20,
      averageDailyVolume: 5000,
      turnoverRate: 1.2,
    };

    const result = tradeInvariantValidator.validateAndEnforce({
      action: rawAction,
      currentPrice: 20,
      availableCash: 50000,
      totalMarketValue: 100000,
      snapshot,
      maxAdvParticipationPct: 0.02, // 2% ADV
    });

    expect(result.isValid).toBe(true);
    expect(result.action.suggestedShares).toBe(100); // 严格被截断在 100 股
    expect(result.action.advLimitShares).toBe(100);
    expect(result.status.wasClamped).toBe(true);
    expect(result.status.badges).toContain("ADV_LIQUIDITY_SAFE");
    expect(result.status.badges).toContain("SLIPPAGE_PROTECTED");
    expect(result.status.diagnosticNotes?.join(" ")).toContain("超出流动性容量防御上限");
  });

  it("should calculate slippage buffer and widen entryZone ceiling for high turnover stocks", () => {
    const rawAction: ActionItem = {
      action: "BUY",
      symbol: "HOT_STOCK",
      companyName: "Hot Momentum Inc",
      suggestedShares: 50,
      estimatedPrice: 100,
      estimatedAmount: 5000,
      rationale: "高换手高滑点测试",
      urgency: "HIGH",
    };

    // 高换手率标的 (换手率 > 5%) 自适应增加滑点率至 0.25%
    const snapshot: OpenDSnapshotItem = {
      symbol: "HOT_STOCK",
      name: "Hot Momentum Inc",
      lastPrice: 100,
      turnoverRate: 8.5,
      volume: 1000000,
    };

    const result = tradeInvariantValidator.validateAndEnforce({
      action: rawAction,
      currentPrice: 100,
      availableCash: 20000,
      snapshot,
    });

    expect(result.action.slippagePct).toBe(0.25);
    expect(result.action.estimatedSlippageCost).toBe(12.50); // $5000 * 0.25%
    expect(result.action.entryZone).toBeDefined();
    expect(result.action.entryZone!.max).toBeGreaterThan(100.80);
    expect(result.status.badges).toContain("SLIPPAGE_PROTECTED");
  });

  it("should contract single stock position cap by 50% when approaching earnings date (Earnings Shield)", () => {
    const rawAction: ActionItem = {
      action: "BUY",
      symbol: "NVDA",
      companyName: "NVIDIA Corp",
      suggestedShares: 300, // 试图买入 300 股 = $30,000
      estimatedPrice: 100,
      estimatedAmount: 30000,
      rationale: "财报前冲刺建仓",
      urgency: "HIGH",
    };

    // 距财报日仅 2 天 (<= 3 天)
    // 账户总资金 $100,000，原 35% 上限 ($35,000) 自动收缩 50% 至 17.5% ($17,500 => 175 股)
    const result = tradeInvariantValidator.validateAndEnforce({
      action: rawAction,
      currentPrice: 100,
      availableCash: 50000,
      totalMarketValue: 100000,
      positionCapPct: 0.35,
      daysUntilEarnings: 2,
    });

    expect(result.isValid).toBe(true);
    expect(result.action.suggestedShares).toBe(175); // 严格被收缩至 175 股 ($17,500)
    expect(result.status.wasClamped).toBe(true);
    expect(result.status.badges).toContain("EARNINGS_RISK_SHIELD");
    expect(result.status.diagnosticNotes?.join(" ")).toContain("单票持仓上限已自动收缩 50% 至 17.5%");
    expect(result.action.orderStatus).toBe("PENDING_SUBMIT");
  });
});
