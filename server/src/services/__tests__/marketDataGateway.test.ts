import { describe, it, expect, beforeEach, vi } from "vitest";
import { MarketDataGateway, marketDataGateway } from "../marketDataGateway";

describe("MarketDataGateway (统一市场数据提供者门面与解耦适配器中枢)", () => {
  let gateway: MarketDataGateway;

  beforeEach(() => {
    gateway = MarketDataGateway.getInstance();
    // 重置默认配置
    gateway.configure({
      primaryQuoteSource: "MOOMOO_OPEND",
      fallbackQuoteSource: "YAHOO_FINANCE",
      primaryFundamentalsSource: "YAHOO_FINANCE",
    });
  });

  describe("1. 统一接口与数据源 Badge 自动注入", () => {
    it("获取的 UnifiedQuote 自动附带统一 Color Code、时效状态与置信度元数据", async () => {
      const quotes = await gateway.fetchQuotes(["AAPL"]);
      const aapl = quotes.get("AAPL");

      expect(aapl).toBeDefined();
      expect(aapl!.symbol).toBe("AAPL");
      expect(aapl!.price).toBeGreaterThan(0);
      expect(aapl!.dataSource).toBeDefined();
      expect(aapl!.sourceLabel).toBeDefined();
      expect(aapl!.badgeClass).toContain("border-");
      expect(aapl!.freshness).toBe("FRESH");
      expect(aapl!.validity).toBe("VALID");
      expect(aapl!.confidence).toBeGreaterThan(0.5);
    }, 15000);

    it("获取的 UnifiedFundamentals 自动附带 Badge 与合理性指标", async () => {
      const fund = await gateway.fetchFundamentals("AAPL");

      expect(fund).toBeDefined();
      expect(fund!.symbol).toBe("AAPL");
      expect(fund!.peRatio).toBeGreaterThan(0);
      expect(fund!.dataSource).toBe("YAHOO_FINANCE");
      expect(fund!.sourceLabel).toBe("Yahoo Finance");
      expect(fund!.badgeClass).toContain("purple");
      expect(fund!.freshness).toBe("FRESH");
    }, 15000);
  });

  describe("2. 单一中枢全局数据源切换 (Single Switch Configuration)", () => {
    it("可一键切换主数据源配置并生效", () => {
      gateway.configure({
        primaryQuoteSource: "YAHOO_FINANCE",
        fallbackQuoteSource: "MOOMOO_OPEND",
      });

      const config = gateway.getConfig();
      expect(config.primaryQuoteSource).toBe("YAHOO_FINANCE");
      expect(config.fallbackQuoteSource).toBe("MOOMOO_OPEND");
    });
  });

  describe("3. 多源平滑降级与容灾测试", () => {
    it("对未知/离线标的自动通过备用数据源补齐，绝不返回空", async () => {
      const quotes = await gateway.fetchQuotes(["AMD", "NVDA"]);
      expect(quotes.get("AMD")).toBeDefined();
      expect(quotes.get("NVDA")).toBeDefined();
      expect(quotes.get("AMD")!.price).toBeGreaterThan(0);
      expect(quotes.get("NVDA")!.price).toBeGreaterThan(0);
    }, 15000);
  });
});
