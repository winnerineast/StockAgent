import { describe, it, expect, beforeEach } from "vitest";
import {
  EvidenceReconciliationEngine,
  evidenceReconciliationEngine,
} from "../evidenceReconciliationEngine";

describe("EvidenceReconciliationEngine (Holistic Context Primitive: Multi-Factor Confidence & Conflict Reconciliation)", () => {
  let engine: EvidenceReconciliationEngine;

  beforeEach(() => {
    engine = EvidenceReconciliationEngine.getInstance();
  });

  describe("三因子置信度计算公式 c(b) 行为验证", () => {
    it("样本数饱和项: 随着客观证据条数增加，置信度单调递增并向饱和上限收敛", () => {
      const qDate = "2026-08-19";
      const lastDate = "2026-08-19";
      const reliabilitiesSingle = [0.95];
      const reliabilitiesThree = [0.95, 0.90, 0.95];
      const reliabilitiesTen = Array(10).fill(0.95);

      const score1 = engine.calculateConfidenceScore(1, lastDate, qDate, reliabilitiesSingle);
      const score3 = engine.calculateConfidenceScore(3, lastDate, qDate, reliabilitiesThree);
      const score10 = engine.calculateConfidenceScore(10, lastDate, qDate, reliabilitiesTen);

      // 单调递增
      expect(score1).toBeLessThan(score3);
      expect(score3).toBeLessThan(score10);
      // 满足 (1 - exp(-1/5)) * 1 * 0.95 ≈ 0.1812 * 0.95 ≈ 0.1722
      expect(score1).toBeCloseTo(0.1722, 2);
    });

    it("时间衰减项: 随着距离最新证据时间增加，置信度呈指数平滑衰减", () => {
      const qDate = "2026-08-19";
      const rels = [0.90, 0.90, 0.90];

      const scoreToday = engine.calculateConfidenceScore(3, "2026-08-19", qDate, rels);
      const score15DaysAgo = engine.calculateConfidenceScore(3, "2026-08-04", qDate, rels);
      const score60DaysAgo = engine.calculateConfidenceScore(3, "2026-06-20", qDate, rels);

      expect(scoreToday).toBeGreaterThan(score15DaysAgo);
      expect(score15DaysAgo).toBeGreaterThan(score60DaysAgo);
    });

    it("信源可靠度项: 实盘行情与 SEC 财报证据置信度显著高于社交网络新闻舆情", () => {
      const qDate = "2026-08-19";
      const lastDate = "2026-08-19";

      // 权威实盘/SEC 证据
      const scoreAuthoritative = engine.calculateConfidenceScore(
        3,
        lastDate,
        qDate,
        [EvidenceReconciliationEngine.SOURCE_RELIABILITY_PRIORS.MOOMOO_ORDERBOOK, EvidenceReconciliationEngine.SOURCE_RELIABILITY_PRIORS.SEC_FILING]
      );

      // 普通新闻/舆情证据
      const scoreSocial = engine.calculateConfidenceScore(
        3,
        lastDate,
        qDate,
        [EvidenceReconciliationEngine.SOURCE_RELIABILITY_PRIORS.NEWS_SEARCH, EvidenceReconciliationEngine.SOURCE_RELIABILITY_PRIORS.NEWS_SEARCH]
      );

      expect(scoreAuthoritative).toBeGreaterThan(scoreSocial);
    });
  });

  describe("证据冲突仲裁与争议区间判定 (Contested Band: |Δc| < 0.15)", () => {
    it("当多空双方置信度差异小于 0.15 时，应正确判定为 CONTESTED 并建议控仓观望", () => {
      // 多方 0.72 vs 空方 0.65，差值 0.07 < 0.15
      const result = engine.arbitrateConflict(0.72, 0.65);

      expect(result.status).toBe("CONTESTED");
      expect(result.isContested).toBe(true);
      expect(result.scoreDiff).toBeCloseTo(0.07, 3);
      expect(result.recommendedStance).toBe("REDUCE_EXPOSURE_AND_WAIT");
      expect(result.explanation).toContain("争议区间");
    });

    it("当多方置信度明显胜出 (差值 >= 0.15) 时，判定为 BULL_DOMINANT", () => {
      // 多方 0.85 vs 空方 0.40，差值 0.45 >= 0.15
      const result = engine.arbitrateConflict(0.85, 0.40);

      expect(result.status).toBe("BULL_DOMINANT");
      expect(result.isContested).toBe(false);
      expect(result.scoreDiff).toBeCloseTo(0.45, 3);
      expect(result.recommendedStance).toBe("PROCEED_LONG");
    });

    it("当空方风险证据显著胜出时，判定为 BEAR_DOMINANT", () => {
      // 多方 0.25 vs 空方 0.78，差值 0.53 >= 0.15
      const result = engine.arbitrateConflict(0.25, 0.78);

      expect(result.status).toBe("BEAR_DOMINANT");
      expect(result.isContested).toBe(false);
      expect(result.recommendedStance).toBe("PROCEED_SHORT");
    });
  });
});
