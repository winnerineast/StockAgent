import { describe, it, expect } from "vitest";
import { marketDynamicsService } from "../marketDynamicsService";

describe("MarketDynamicsService (MDM)", () => {
  it("should classify strong trend with low volatility as TRENDING_BULL", () => {
    const report = marketDynamicsService.evaluateRegime({
      tsi: 0.45,
      vci: -0.5,
      marketBreadthPct: 72.0,
      llmSentimentMood: "BULLISH",
    });

    expect(report.regime).toBe("TRENDING_BULL");
    expect(report.adaptedRiskParams.maxPortfolioCapPct).toBe(80);
    expect(report.adaptedRiskParams.singleStockCapPct).toBe(35);
    expect(report.adaptedRiskParams.atrStopMultiplier).toBe(2.0);
  });

  it("should classify negative trend as TRENDING_BEAR and enforce strict risk limits", () => {
    const report = marketDynamicsService.evaluateRegime({
      tsi: -0.35,
      vci: 1.2,
      marketBreadthPct: 28.0,
      llmSentimentMood: "BEARISH",
    });

    expect(report.regime).toBe("TRENDING_BEAR");
    expect(report.adaptedRiskParams.maxPortfolioCapPct).toBe(30);
    expect(report.adaptedRiskParams.singleStockCapPct).toBe(15);
    expect(report.adaptedRiskParams.atrStopMultiplier).toBe(1.2);
  });

  it("should classify high volatility clustering as HIGH_VOLATILITY_CHOP", () => {
    const report = marketDynamicsService.evaluateRegime({
      tsi: 0.05,
      vci: 1.8,
      marketBreadthPct: 35.0,
      llmSentimentMood: "VOLATILE",
    });

    expect(report.regime).toBe("HIGH_VOLATILITY_CHOP");
    expect(report.adaptedRiskParams.maxPortfolioCapPct).toBe(45);
    expect(report.adaptedRiskParams.singleStockCapPct).toBe(20);
  });

  it("should default to COMPRESSED_CONSOLIDATION for mild neutral conditions", () => {
    const report = marketDynamicsService.evaluateRegime({
      tsi: 0.1,
      vci: 0.2,
      marketBreadthPct: 52.0,
      llmSentimentMood: "NEUTRAL",
    });

    expect(report.regime).toBe("COMPRESSED_CONSOLIDATION");
    expect(report.adaptedRiskParams.maxPortfolioCapPct).toBe(60);
  });
});
