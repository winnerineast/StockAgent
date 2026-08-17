import { describe, it, expect } from "vitest";
import { ActionPlanningSearchEngine } from "../actionPlanningSearchEngine";
import { MarketSimulationResult } from "../../types/stockTypes";

describe("ActionPlanningSearchEngine Unit Tests", () => {
  const dummySimulation: MarketSimulationResult = {
    symbol: "MSFT",
    simulationRounds: 2,
    agentStates: [
      {
        agentType: "LONG_ONLY_INSTITUTION",
        agentLabel: "机构",
        bias: "LEAN_LONG",
        biasScore: 25,
        confidenceScore: 75,
        targetPriceHorizon: 420.0,
        orderIntensity: 0.7,
        corePremise: "基本面健康",
        vulnerabilityTrigger: "财报不及预期",
      },
    ],
    equilibriumPriceCenter: 410.0,
    equilibriumDispersionPct: 4.5,
    liquidityFragilityScore: 25,
    dominantPlayer: "LONG_ONLY_INSTITUTION",
    gammaSupportLevel: 390.0,
    ctaBreakoutTrigger: 418.0,
  };

  it("1. 应当构建 3 大情景分支且分支概率之和近似为 1.0", () => {
    const policy = ActionPlanningSearchEngine.generateAdaptivePolicy({
      symbol: "MSFT",
      companyName: "Microsoft Corp",
      currentPrice: 400.0,
      simulation: dummySimulation,
      targetTimeHorizonDays: 5,
      targetProfitGoalPct: 8.0,
      maxDrawdownPct: 4.0,
      userAvailableBudget: 20000,
      totalPortfolioValue: 50000,
    });

    expect(policy.symbol).toBe("MSFT");
    expect(policy.scenarioTree.length).toBe(3);

    const names = policy.scenarioTree.map((s) => s.scenarioName);
    expect(names).toContain("BASE_EQUILIBRIUM");
    expect(names).toContain("BULLISH_CATALYST");
    expect(names).toContain("BEARISH_CONTROLLING");

    const totalProb = policy.scenarioTree.reduce((sum, s) => sum + s.probability, 0);
    expect(totalProb).toBeCloseTo(1.0, 1);
  });

  it("2. vn.py 量化风控应当严格截断单标的头寸上限 (<= 35% 组合总市值)", () => {
    const totalPortfolio = 10000;
    const policy = ActionPlanningSearchEngine.generateAdaptivePolicy({
      symbol: "MSFT",
      companyName: "Microsoft Corp",
      currentPrice: 400.0,
      simulation: dummySimulation,
      userAvailableBudget: 10000,
      totalPortfolioValue: totalPortfolio,
    });

    const maxAllowedCapital = totalPortfolio * 0.35; // 3500
    expect(policy.quantRiskVerdict.allocatedCapitalAmount).toBeLessThanOrEqual(maxAllowedCapital);
    expect(policy.quantRiskVerdict.recommendedShares).toBeGreaterThanOrEqual(0);
    expect(policy.quantRiskVerdict.hardStopLossPrice).toBeLessThan(400.0);
  });
});
