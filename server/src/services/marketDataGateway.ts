import {
  MarketDataSource,
  MarketDataGatewayConfig,
  UnifiedQuote,
  UnifiedFundamentals,
  UnifiedMacroSector,
  UnifiedCapitalFlow,
  TimeFmForecastItem,
  OpenDSnapshotItem,
  StockFundamentals,
} from "../types/stockTypes";
import { moomooAdapter } from "./moomooAdapter";
import { yahooFinanceAdapter } from "./yahooFinanceAdapter";
import { dataFreshnessGuard, DataFreshnessGuard } from "./dataFreshnessGuard";

export class MarketDataGateway {
  private static instance: MarketDataGateway;

  private config: MarketDataGatewayConfig = {
    primaryQuoteSource: "MOOMOO_OPEND",
    fallbackQuoteSource: "YAHOO_FINANCE",
    primaryFundamentalsSource: "YAHOO_FINANCE",
    fallbackFundamentalsSource: "SEC_EDGAR",
    enableCrossCheck: true,
    maxCrossCheckDeviationPct: 5.0,
  };

  public static getInstance(): MarketDataGateway {
    if (!MarketDataGateway.instance) {
      MarketDataGateway.instance = new MarketDataGateway();
    }
    return MarketDataGateway.instance;
  }

  /**
   * 全局动态配置数据源与降级策略
   */
  public configure(newConfig: Partial<MarketDataGatewayConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
    };
    console.log(`[MarketDataGateway] 配置已更新: PrimaryQuote=${this.config.primaryQuoteSource}, FallbackQuote=${this.config.fallbackQuoteSource}`);
  }

  public getConfig(): MarketDataGatewayConfig {
    return { ...this.config };
  }

  /**
   * 1. 批量获取统一行情 (自动降级容灾、交叉比对与 Badge 注入)
   */
  public async fetchQuotes(symbols: string[]): Promise<Map<string, UnifiedQuote>> {
    const result = new Map<string, UnifiedQuote>();
    if (!symbols || symbols.length === 0) return result;

    const upperSymbols = symbols.map((s) => s.trim().toUpperCase());
    const nowIso = new Date().toISOString();

    // 优先尝试 Primary Quote Source
    let primarySnapshots: OpenDSnapshotItem[] = [];
    if (this.config.primaryQuoteSource === "MOOMOO_OPEND") {
      try {
        primarySnapshots = await moomooAdapter.fetchMarketSnapshotsFromOpenD(upperSymbols);
      } catch (e) {
        primarySnapshots = [];
      }
    }

    const primaryMap = new Map<string, OpenDSnapshotItem>();
    primarySnapshots.forEach((s) => {
      if (s.lastPrice > 0 || (s.prevClosePrice && s.prevClosePrice > 0)) {
        primaryMap.set(s.symbol.toUpperCase(), s);
      }
    });

    // 找出缺失或价格为 0 的标的，通过 Fallback Quote Source 批量补齐
    const missingSymbols = upperSymbols.filter((sym) => !primaryMap.has(sym));
    let fallbackMap: Record<string, any> = {};

    if (missingSymbols.length > 0) {
      if (this.config.fallbackQuoteSource === "YAHOO_FINANCE") {
        try {
          fallbackMap = await yahooFinanceAdapter.fetchTickers(missingSymbols);
        } catch (e) {}
      }
    }

    // 组装 UnifiedQuote
    for (const sym of upperSymbols) {
      const pSnap = primaryMap.get(sym);
      const fSnap = fallbackMap[sym];

      let price = 0;
      let prevClose = 0;
      let source: MarketDataSource = this.config.primaryQuoteSource;
      let name = sym;
      let pe = undefined;

      if (pSnap && (pSnap.lastPrice > 0 || (pSnap.prevClosePrice && pSnap.prevClosePrice > 0))) {
        price = pSnap.lastPrice > 0 ? pSnap.lastPrice : pSnap.prevClosePrice || 0;
        prevClose = pSnap.prevClosePrice || price;
        name = pSnap.name || sym;
        pe = pSnap.peRatio;
        source = this.config.primaryQuoteSource;
      } else if (fSnap && fSnap.price > 0) {
        price = fSnap.price;
        prevClose = fSnap.prevClose || price;
        name = fSnap.companyName || sym;
        pe = fSnap.peRatio;
        source = this.config.fallbackQuoteSource;
      }

      // 执行时效性与正确性校验
      const sanity = dataFreshnessGuard.validatePriceSanity({
        primaryPrice: price,
        prevClosePrice: prevClose,
        openDPrice: pSnap?.lastPrice,
        yahooPrice: fSnap?.price,
      });

      const meta = DataFreshnessGuard.SOURCE_METADATA[source] || DataFreshnessGuard.SOURCE_METADATA.LOCAL_CACHE;
      const freshness = dataFreshnessGuard.evaluateFreshness(nowIso);

      const changeRate =
        prevClose > 0 && sanity.sanitizedPrice > 0
          ? Number((((sanity.sanitizedPrice - prevClose) / prevClose) * 100).toFixed(2))
          : 0;

      result.set(sym, {
        symbol: sym,
        name,
        price: sanity.sanitizedPrice,
        prevClose,
        changeRate,
        openPrice: pSnap?.openPrice || fSnap?.price,
        highPrice: pSnap?.highPrice || fSnap?.price,
        lowPrice: pSnap?.lowPrice || fSnap?.price,
        volume: pSnap?.volume,
        turnoverRate: pSnap?.turnoverRate,
        peRatio: pe,
        dataSource: source,
        sourceLabel: meta.label,
        sourceColor: meta.color,
        badgeClass: meta.badgeClass,
        freshness,
        validity: sanity.validityStatus,
        verifiedAt: nowIso,
        confidence: meta.defaultConfidence,
      });
    }

    return result;
  }

  /**
   * 获取单只股票统一行情
   */
  public async fetchQuote(symbol: string): Promise<UnifiedQuote | null> {
    const quotes = await this.fetchQuotes([symbol]);
    return quotes.get(symbol.toUpperCase()) || null;
  }

  /**
   * 2. 获取统一财务基本面与估值指标 (自动多源补齐与 Badge 注入)
   */
  public async fetchFundamentals(symbol: string): Promise<UnifiedFundamentals | null> {
    const symUpper = symbol.toUpperCase();
    const nowIso = new Date().toISOString();

    let raw: StockFundamentals | null = null;
    let source: MarketDataSource = this.config.primaryFundamentalsSource;

    // 优先从 Primary Fundamentals Source 获取
    if (this.config.primaryFundamentalsSource === "YAHOO_FINANCE") {
      try {
        raw = await yahooFinanceAdapter.fetchFundamentals(symUpper);
      } catch (e) {}
    }

    if (!raw) {
      source = "LOCAL_CACHE";
    }

    if (!raw) return null;

    const sanity = dataFreshnessGuard.validateFundamentalsSanity(raw);
    const meta = DataFreshnessGuard.SOURCE_METADATA[source] || DataFreshnessGuard.SOURCE_METADATA.LOCAL_CACHE;
    const freshness = dataFreshnessGuard.evaluateFreshness(nowIso);

    return {
      symbol: symUpper,
      companyName: raw.companyName || symUpper,
      peRatio: sanity.sanitizedFundamentals.peRatio,
      revenueGrowthPct: sanity.sanitizedFundamentals.revenueGrowthPct,
      netMarginPct: sanity.sanitizedFundamentals.netMarginPct,
      debtToEquity: sanity.sanitizedFundamentals.debtToEquity,
      nextEarningsDate: sanity.sanitizedFundamentals.nextEarningsDate,
      fundamentalSummary: sanity.sanitizedFundamentals.fundamentalSummary,
      dataSource: source,
      sourceLabel: meta.label,
      sourceColor: meta.color,
      badgeClass: meta.badgeClass,
      freshness,
      validity: sanity.validityStatus,
      verifiedAt: nowIso,
      confidence: meta.defaultConfidence,
    };
  }

  /**
   * 3. 获取 11 大行业板块资金流与行情
   */
  public async fetchMacroSectors(): Promise<any> {
    const rawSectors = await moomooAdapter.fetchMacroSectorsFromOpenD();
    const meta = DataFreshnessGuard.SOURCE_METADATA.MOOMOO_OPEND;

    return {
      ...rawSectors,
      dataSource: "MOOMOO_OPEND" as MarketDataSource,
      sourceLabel: meta.label,
      badgeClass: meta.badgeClass,
    };
  }

  /**
   * 4. 获取标的资金流向 (自动附带 Badge)
   */
  public async fetchCapitalFlows(symbols: string[]): Promise<Record<string, UnifiedCapitalFlow>> {
    const rawFlows = await moomooAdapter.fetchCapitalFlowsFromOpenD(symbols);
    const meta = DataFreshnessGuard.SOURCE_METADATA.MOOMOO_OPEND;
    const freshness = dataFreshnessGuard.evaluateFreshness(new Date().toISOString());

    const result: Record<string, UnifiedCapitalFlow> = {};
    for (const [sym, f] of Object.entries<any>(rawFlows)) {
      result[sym] = {
        symbol: sym,
        inFlow: f.inFlow || 0,
        mainInFlow: f.mainInFlow || 0,
        trend: f.inFlow > 0 ? "INFLOW" : f.inFlow < 0 ? "OUTFLOW" : "NEUTRAL",
        dataSource: "MOOMOO_OPEND",
        sourceLabel: meta.label,
        badgeClass: meta.badgeClass,
        freshness,
      };
    }
    return result;
  }

  /**
   * 5. 获取 Google TimeFM 工业级时序动量预测
   */
  public async fetchTimeFmForecasts(symbols: string[]): Promise<Record<string, TimeFmForecastItem>> {
    return await moomooAdapter.fetchTimeFmForecastsFromOpenD(symbols);
  }
}

export const marketDataGateway = MarketDataGateway.getInstance();
