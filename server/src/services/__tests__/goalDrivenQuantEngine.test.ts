import { describe, it, expect } from "vitest";
import { goalDrivenQuantEngine } from "../goalDrivenQuantEngine";
import { OpenDSnapshotItem } from "../../types/stockTypes";

describe("GoalDrivenQuantEngine Unit Tests (Issue #4: Volatility & Fat-Tail Model)", () => {
  it("should calculate statistically robust annualized volatility using Parkinson & ATR fusion", () => {
    const snapshot: OpenDSnapshotItem = {
      symbol: "NVDA",
      name: "NVIDIA Corp",
      lastPrice: 100,
      highPrice: 102,
      lowPrice: 98,
      prevClosePrice: 99,
      turnoverRate: 2.5,
    };

    const annVol = goalDrivenQuantEngine.calculateAnnualizedVolatility({
      currentPrice: 100,
      snapshot,
    });

    // 5% 日内振幅对应年化波动率约在 35% ~ 65% 之间
    expect(annVol).toBeGreaterThanOrEqual(30.0);
    expect(annVol).toBeLessThanOrEqual(70.0);
  });

  it("should respect bounded statistical guardrails for extreme low/high volatility", () => {
    // 极低波动标的 (如公用事业蓝筹)
    const lowVolSnap: OpenDSnapshotItem = {
      symbol: "SO",
      name: "Southern Co",
      lastPrice: 80,
      highPrice: 80.1,
      lowPrice: 79.9,
      prevClosePrice: 80.0,
      turnoverRate: 0.1,
    };

    const lowVol = goalDrivenQuantEngine.calculateAnnualizedVolatility({
      currentPrice: 80,
      snapshot: lowVolSnap,
    });

    // 至少维持 12% 基准下限
    expect(lowVol).toBeGreaterThanOrEqual(12.0);

    // 极大波动 meme 股
    const highVolSnap: OpenDSnapshotItem = {
      symbol: "MEME",
      name: "Meme Stock Inc",
      lastPrice: 10,
      highPrice: 20,
      lowPrice: 5,
      prevClosePrice: 10,
      turnoverRate: 50.0,
    };

    const highVol = goalDrivenQuantEngine.calculateAnnualizedVolatility({
      currentPrice: 10,
      snapshot: highVolSnap,
    });

    // 限制在 85% 上限以内
    expect(highVol).toBeLessThanOrEqual(85.0);
  });

  it("should apply fat-tail jump diffusion adjustment to calculate conservative goal probability", () => {
    const normalSnap: OpenDSnapshotItem = {
      symbol: "AAPL",
      name: "Apple Inc",
      lastPrice: 200,
      highPrice: 204,
      lowPrice: 196,
      prevClosePrice: 198,
      turnoverRate: 1.2,
    };

    const attainment = goalDrivenQuantEngine.calculateGoalAttainment({
      currentPrice: 200,
      targetProfitGoalPct: 8.0,
      targetTimeHorizonDays: 5,
      snapshot: normalSnap,
    });

    expect(attainment.dailyVolatility).toBeGreaterThan(0);
    expect(attainment.horizonVolatility).toBeGreaterThan(0);
    expect(attainment.goalAttainmentProbability).toBeGreaterThanOrEqual(20.0);
    expect(attainment.goalAttainmentProbability).toBeLessThanOrEqual(92.0);
    expect(attainment.stopLossSurvivalProbability).toBeGreaterThanOrEqual(25.0);
  });
});
