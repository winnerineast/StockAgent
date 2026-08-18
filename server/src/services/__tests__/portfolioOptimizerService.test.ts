import { describe, it, expect } from "vitest";
import { portfolioOptimizerService } from "../portfolioOptimizerService";

describe("PortfolioOptimizerService", () => {
  it("should handle empty candidates safely", () => {
    const res = portfolioOptimizerService.optimizeAllocation({
      candidates: [],
      totalDeployableCapital: 10000,
    });

    expect(res.cashWeight).toBe(1.0);
    expect(res.expectedSharpeRatio).toBe(0.0);
    expect(Object.keys(res.optimalWeights).length).toBe(0);
  });

  it("should distribute weights across multi-stock candidates within regime cap and single stock cap", () => {
    const candidates = [
      {
        symbol: "NVDA",
        expectedReturnPct: 12.0,
        volatilityPct: 30.0,
        sector: "AI算力与半导体",
        confidenceScore: 85,
        currentPrice: 130,
      },
      {
        symbol: "MSFT",
        expectedReturnPct: 8.0,
        volatilityPct: 18.0,
        sector: "大盘科技成长",
        confidenceScore: 90,
        currentPrice: 420,
      },
      {
        symbol: "XOM",
        expectedReturnPct: 6.0,
        volatilityPct: 15.0,
        sector: "传统能源与石油",
        confidenceScore: 70,
        currentPrice: 110,
      },
    ];

    const res = portfolioOptimizerService.optimizeAllocation({
      candidates,
      totalDeployableCapital: 50000,
      maxRegimeCapPct: 70.0,
      singleStockCapPct: 30.0,
    });

    expect(res.optimalWeights["NVDA"]).toBeDefined();
    expect(res.optimalWeights["MSFT"]).toBeDefined();
    expect(res.optimalWeights["XOM"]).toBeDefined();

    // 单票不超过 30%
    expect(res.optimalWeights["NVDA"]).toBeLessThanOrEqual(0.301);
    expect(res.optimalWeights["MSFT"]).toBeLessThanOrEqual(0.301);
    expect(res.optimalWeights["XOM"]).toBeLessThanOrEqual(0.301);

    // 总投资权重不超过 70% (现金保留至少 30%)
    expect(res.cashWeight).toBeGreaterThanOrEqual(0.29);

    // 计算出的股数为正整数
    expect(res.suggestedSharesMap["NVDA"]).toBeGreaterThan(0);
    expect(res.suggestedSharesMap["MSFT"]).toBeGreaterThan(0);
    expect(res.expectedSharpeRatio).toBeGreaterThan(0);
  });

  it("should enforce sector exposure ceiling if multiple stocks are in the same sector", () => {
    const candidates = [
      {
        symbol: "NVDA",
        expectedReturnPct: 15.0,
        volatilityPct: 25.0,
        sector: "AI算力与半导体",
        confidenceScore: 90,
        currentPrice: 130,
      },
      {
        symbol: "AMD",
        expectedReturnPct: 14.0,
        volatilityPct: 28.0,
        sector: "AI算力与半导体",
        confidenceScore: 85,
        currentPrice: 150,
      },
      {
        symbol: "TSM",
        expectedReturnPct: 12.0,
        volatilityPct: 22.0,
        sector: "AI算力与半导体",
        confidenceScore: 88,
        currentPrice: 170,
      },
    ];

    const res = portfolioOptimizerService.optimizeAllocation({
      candidates,
      totalDeployableCapital: 20000,
      maxSectorExposurePct: 50.0,
    });

    const totalSemiWeight =
      (res.optimalWeights["NVDA"] || 0) +
      (res.optimalWeights["AMD"] || 0) +
      (res.optimalWeights["TSM"] || 0);

    expect(totalSemiWeight).toBeLessThanOrEqual(0.505);
  });
});
