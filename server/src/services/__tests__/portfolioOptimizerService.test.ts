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

  it("should correctly compute standard Sharpe ratio based on (R_p - R_f) / sigma_p", () => {
    // 单只标的测试，便于验证精确 Sharpe 公式
    const candidate = {
      symbol: "NVDA",
      expectedReturnPct: 20.0, // 预期收益 20%
      volatilityPct: 20.0,     // 波动率 20%
      sector: "AI算力与半导体",
      confidenceScore: 100,
      currentPrice: 100,
    };

    // 投资权重 100%, 行业上限 100%, 无风险利率 4% => R_p = 20%, R_f = 4%, sigma_p = 20%
    // 预期 Sharpe = (20 - 4) / 20 = 0.80
    const res = portfolioOptimizerService.optimizeAllocation({
      candidates: [candidate],
      totalDeployableCapital: 10000,
      maxRegimeCapPct: 100.0,
      singleStockCapPct: 100.0,
      maxSectorExposurePct: 100.0,
      riskFreeRate: 4.0,
    });

    expect(res.optimalWeights["NVDA"]).toBe(1.0);
    expect(res.expectedSharpeRatio).toBe(0.80);
  });

  it("should penalize same-sector concentration via Markowitz cross-covariance terms", () => {
    // 相同板块标的 (rho = 0.65)
    const sameSectorCandidates = [
      {
        symbol: "NVDA",
        expectedReturnPct: 16.0,
        volatilityPct: 20.0,
        sector: "AI算力与半导体",
        confidenceScore: 100,
        currentPrice: 100,
      },
      {
        symbol: "AMD",
        expectedReturnPct: 16.0,
        volatilityPct: 20.0,
        sector: "AI算力与半导体",
        confidenceScore: 100,
        currentPrice: 100,
      },
    ];

    // 跨板块分散化标的 (rho = 0.25)
    const diversifiedCandidates = [
      {
        symbol: "NVDA",
        expectedReturnPct: 16.0,
        volatilityPct: 20.0,
        sector: "AI算力与半导体",
        confidenceScore: 100,
        currentPrice: 100,
      },
      {
        symbol: "JNJ",
        expectedReturnPct: 16.0,
        volatilityPct: 20.0,
        sector: "医疗保健与医药",
        confidenceScore: 100,
        currentPrice: 100,
      },
    ];

    const sameRes = portfolioOptimizerService.optimizeAllocation({
      candidates: sameSectorCandidates,
      totalDeployableCapital: 10000,
      maxRegimeCapPct: 100.0,
      singleStockCapPct: 50.0,
      riskFreeRate: 4.0,
    });

    const diffRes = portfolioOptimizerService.optimizeAllocation({
      candidates: diversifiedCandidates,
      totalDeployableCapital: 10000,
      maxRegimeCapPct: 100.0,
      singleStockCapPct: 50.0,
      riskFreeRate: 4.0,
    });

    // 相同收益下，跨行业分散化组合的真实方差更低，因此夏普比率应严格高于同行业集中组合
    expect(diffRes.expectedSharpeRatio).toBeGreaterThan(sameRes.expectedSharpeRatio);
  });
});
