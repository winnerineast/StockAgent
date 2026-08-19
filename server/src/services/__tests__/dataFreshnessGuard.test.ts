import { describe, it, expect, beforeEach } from "vitest";
import { DataFreshnessGuard, dataFreshnessGuard } from "../dataFreshnessGuard";

describe("DataFreshnessGuard (多源数据时效性、正确性校验与 Color Code 溯源守卫)", () => {
  let guard: DataFreshnessGuard;

  beforeEach(() => {
    guard = DataFreshnessGuard.getInstance();
  });

  describe("1. 价格物理合法性与多源交叉校验 (Price Sanity & Cross-Checking)", () => {
    it("正常价格通过校验并标记为 VALID", () => {
      const result = guard.validatePriceSanity({ primaryPrice: 310.03 });
      expect(result.isValid).toBe(true);
      expect(result.sanitizedPrice).toBe(310.03);
      expect(result.validityStatus).toBe("VALID");
    });

    it("小于等于零或 NaN 价格被正确拦截为 INVALID", () => {
      const resultZero = guard.validatePriceSanity({ primaryPrice: 0 });
      const resultNegative = guard.validatePriceSanity({ primaryPrice: -50.2 });
      const resultNaN = guard.validatePriceSanity({ primaryPrice: NaN });

      expect(resultZero.isValid).toBe(false);
      expect(resultNegative.isValid).toBe(false);
      expect(resultNaN.isValid).toBe(false);
      expect(resultZero.validityStatus).toBe("INVALID");
    });

    it("单日极端跳空变动 (>80%) 标记为 CROSS_FLAGGED 风险警示", () => {
      const result = guard.validatePriceSanity({
        primaryPrice: 200.0,
        prevClosePrice: 100.0, // 跳空 100%
      });
      expect(result.isValid).toBe(true);
      expect(result.validityStatus).toBe("CROSS_FLAGGED");
      expect(result.warningNote).toContain("单日跳空");
    });

    it("多源交叉比对: OpenD 与 Yahoo 价格一致 (偏离 <= 3%) 时确认通过", () => {
      const result = guard.validatePriceSanity({
        openDPrice: 310.03,
        yahooPrice: 309.50, // 偏离约 0.17%
      });
      expect(result.isValid).toBe(true);
      expect(result.validityStatus).toBe("VALID");
      expect(result.sanitizedPrice).toBe(310.03);
      expect(result.deviationPct).toBeLessThan(1.0);
    });

    it("多源交叉比对: OpenD 与 Yahoo 偏离较大 (> 5%) 时发出 CROSS_FLAGGED 警示并以实盘为准", () => {
      const result = guard.validatePriceSanity({
        openDPrice: 310.03,
        yahooPrice: 285.00, // 偏离约 8.4%
      });
      expect(result.isValid).toBe(true);
      expect(result.validityStatus).toBe("CROSS_FLAGGED");
      expect(result.sanitizedPrice).toBe(310.03); // 以 OpenD 实盘为准
      expect(result.deviationPct).toBeGreaterThan(5.0);
      expect(result.warningNote).toContain("偏离");
    });
  });

  describe("2. 财务基本面合理性与异常清洗 (Fundamentals Sanity)", () => {
    it("正常正市盈率与营收增速通过校验", () => {
      const result = guard.validateFundamentalsSanity({
        symbol: "AAPL",
        peRatio: 35.5,
        revenueGrowthPct: 16.4,
      });
      expect(result.isValid).toBe(true);
      expect(result.isLossMaking).toBe(false);
      expect(result.sanitizedFundamentals.peRatio).toBe(35.5);
    });

    it("负市盈率 (亏损企业) 自动识别为 isLossMaking 并给出估值切换指引", () => {
      const result = guard.validateFundamentalsSanity({
        symbol: "GROWTH_STOCK",
        peRatio: -12.5,
        revenueGrowthPct: 85.0,
      });
      expect(result.isValid).toBe(true);
      expect(result.isLossMaking).toBe(true);
      expect(result.warningNote).toContain("亏损");
    });

    it("极端高估值离群点 (PE > 3000) 标记为 CROSS_FLAGGED", () => {
      const result = guard.validateFundamentalsSanity({
        symbol: "OUTLIER",
        peRatio: 4500.0,
      });
      expect(result.isValid).toBe(true);
      expect(result.validityStatus).toBe("CROSS_FLAGGED");
      expect(result.warningNote).toContain("极端微利离群区间");
    });
  });

  describe("3. 数据时效性判定 (Data Freshness State Machine)", () => {
    it("盘中时段: 10分钟内为 FRESH，2小时前为 DELAYED，3天前为 STALE", () => {
      const now = new Date();
      const tenMinsAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();

      expect(guard.evaluateFreshness(tenMinsAgo, false)).toBe("FRESH");
      expect(guard.evaluateFreshness(twoHoursAgo, false)).toBe("DELAYED");
      expect(guard.evaluateFreshness(threeDaysAgo, false)).toBe("STALE");
    });

    it("休市/周末时段: 2天内有效收盘价判定为 FRESH", () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      expect(guard.evaluateFreshness(twoDaysAgo, true)).toBe("FRESH");
    });
  });

  describe("4. 统一 Color Code 溯源对象生成", () => {
    it("正确附加数据源标签、视觉主题色与时效性标记", () => {
      const field = guard.createProvenanceField(
        310.03,
        "MOOMOO_OPEND",
        new Date().toISOString()
      );
      expect(field.value).toBe(310.03);
      expect(field.source).toBe("MOOMOO_OPEND");
      expect(field.sourceLabel).toBe("MooMoo 实盘");
      expect(field.sourceColor).toBe("emerald");
      expect(field.freshness).toBe("FRESH");
      expect(field.validity).toBe("VALID");
    });
  });
});
