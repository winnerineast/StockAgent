import { describe, it, expect } from "vitest";
import { MultiAgentMarketSimulator } from "../multiAgentMarketSimulator";
import { OpenDSnapshotItem, SingleStockIntel, StockFundamentals, TimeFmEvidence } from "../../types/stockTypes";

describe("MultiAgentMarketSimulator Unit Tests", () => {
  const snapshot: OpenDSnapshotItem = {
    symbol: "AAPL",
    name: "Apple Inc",
    lastPrice: 200.0,
    peRatio: 30.0,
    mainCapitalInflow: 10000000,
    turnoverRate: 1.8,
  };

  const fundamentals: StockFundamentals = {
    symbol: "AAPL",
    peRatio: 30.0,
    revenueGrowthPct: 15.0,
  };

  const intel: SingleStockIntel = {
    symbol: "AAPL",
    companyName: "Apple Inc",
    latestNews: ["苹果宣布在 AI 领域取得突破性进展"],
    communitySentiment: { mood: "BULLISH", score: 85, keyTopics: ["AI 突破"] },
    capitalFlow: { trend: "INFLOW", description: "主力大单持续买入" },
  };

  const timefm: TimeFmEvidence = {
    direction: "UP",
    predictedPrice: 206.0,
    predictedChangePct: 3.0,
    confidenceLow: 198.0,
    confidenceHigh: 212.0,
    targetAttainmentProbability: 75,
  };

  it("1. 应当成功执行 4 角色多主体博弈并输出出清中枢价与分歧度", () => {
    const result = MultiAgentMarketSimulator.simulate({
      symbol: "AAPL",
      currentPrice: 200.0,
      snapshot,
      fundamentals,
      intel,
      timefm,
      macroRegime: "BULLISH",
    });

    expect(result.symbol).toBe("AAPL");
    expect(result.simulationRounds).toBe(2);
    expect(result.agentStates.length).toBe(4);

    // 检查 4 个智能体角色存在
    const types = result.agentStates.map((a) => a.agentType);
    expect(types).toContain("LONG_ONLY_INSTITUTION");
    expect(types).toContain("MOMENTUM_CTA");
    expect(types).toContain("MARKET_MAKER_GAMMA");
    expect(types).toContain("RETAIL_SENTIMENT");

    // 出清价格中枢应当在合理边界内
    expect(result.equilibriumPriceCenter).toBeGreaterThan(150.0);
    expect(result.equilibriumPriceCenter).toBeLessThan(250.0);

    // 分歧度与脆弱指数应为有效数字
    expect(result.equilibriumDispersionPct).toBeGreaterThanOrEqual(0);
    expect(result.liquidityFragilityScore).toBeGreaterThanOrEqual(0);
    expect(result.liquidityFragilityScore).toBeLessThanOrEqual(100);
    expect(result.dominantPlayer).toBeDefined();
  });

  it("2. 当散户极度看空且大盘熊市时，博弈中枢价应向下修正", () => {
    const bearishIntel: SingleStockIntel = {
      symbol: "AAPL",
      companyName: "Apple Inc",
      communitySentiment: { mood: "BEARISH", score: 15, keyTopics: ["削减订单", "下调评级"] },
      capitalFlow: { trend: "OUTFLOW", description: "主力大单流出" },
      latestNews: ["供应链订单削减", "分析师下调评级"],
    };
    const bearishTimefm: TimeFmEvidence = {
      ...timefm,
      direction: "DOWN",
      predictedPrice: 190.0,
    };

    const result = MultiAgentMarketSimulator.simulate({
      symbol: "AAPL",
      currentPrice: 200.0,
      snapshot: { ...snapshot, mainCapitalInflow: -5000000 },
      fundamentals,
      intel: bearishIntel,
      timefm: bearishTimefm,
      macroRegime: "BEARISH",
    });

    expect(result.equilibriumPriceCenter).toBeLessThan(200.0);
  });
});
