import { describe, it, expect } from "vitest";
import { prudexCompassService } from "../prudexCompassService";

describe("PrudexCompassService", () => {
  it("should return default benchmark score on empty logs", () => {
    const score = prudexCompassService.evaluateFromLogs([]);
    expect(score.overallScore).toBe(75);
    expect(score.radarAxes.length).toBe(6);
    expect(score.diagnosisAdvice.length).toBeGreaterThan(0);
  });

  it("should evaluate 6 axes correctly on synthetic verified trade logs", () => {
    const logs = [
      {
        symbol: "NVDA",
        action: "BUY",
        triggerPrice: 120,
        actualNextClosePrice: 125,
        verificationOutcome: "EXPERIENCE",
        pnlImpactAmount: 250,
        certaintyScore: 85,
        evidenceNewsJson: JSON.stringify([{ title: "AI Earnings Beat" }]),
        evidenceFundamentalsJson: JSON.stringify({ pe: 35 }),
        evidenceLiveMarketJson: JSON.stringify({ inflow: 500000 }),
      },
      {
        symbol: "AAPL",
        action: "BUY",
        triggerPrice: 220,
        actualNextClosePrice: 224,
        verificationOutcome: "EXPERIENCE",
        pnlImpactAmount: 180,
        certaintyScore: 80,
        evidenceNewsJson: JSON.stringify([{ title: "Apple Event" }]),
        evidenceFundamentalsJson: JSON.stringify({ pe: 30 }),
        evidenceLiveMarketJson: JSON.stringify({ inflow: 200000 }),
      },
      {
        symbol: "TSLA",
        action: "TRIM",
        triggerPrice: 250,
        actualNextClosePrice: 242,
        verificationOutcome: "EXPERIENCE",
        pnlImpactAmount: 120,
        certaintyScore: 75,
        evidenceNewsJson: JSON.stringify([{ title: "Deliveries Update" }]),
      },
      {
        symbol: "AMD",
        action: "BUY",
        triggerPrice: 160,
        actualNextClosePrice: 156,
        verificationOutcome: "LESSON",
        pnlImpactAmount: -80,
        certaintyScore: 60,
      },
    ];

    const score = prudexCompassService.evaluateFromLogs(logs);

    expect(score.totalEvaluatedLogs).toBe(4);
    // 3 wins out of 4 -> win rate 75%
    expect(score.profitabilityScore).toBeGreaterThanOrEqual(70);
    // Risk control should be high because loss is small (-80)
    expect(score.riskControlScore).toBeGreaterThanOrEqual(70);
    // Covers 4 unique symbols -> universality high
    expect(score.universalityScore).toBeGreaterThanOrEqual(60);
    // Explainability high because 3 logs have evidence JSON
    expect(score.explainabilityScore).toBeGreaterThanOrEqual(70);
    expect(score.radarAxes.length).toBe(6);
    expect(score.overallScore).toBeGreaterThan(60);
  });
});
