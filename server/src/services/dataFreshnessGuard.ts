import {
  MarketDataSource,
  DataFreshnessStatus,
  DataValidityStatus,
  ProvenanceTaggedField,
  DataFreshnessReport,
  StockFundamentals,
} from "../types/stockTypes";

export interface PriceSanityResult {
  isValid: boolean;
  sanitizedPrice: number;
  validityStatus: DataValidityStatus;
  deviationPct?: number;
  warningNote?: string;
}

export interface FundamentalsSanityResult {
  isValid: boolean;
  sanitizedFundamentals: StockFundamentals;
  validityStatus: DataValidityStatus;
  isLossMaking: boolean;
  warningNote?: string;
}

export class DataFreshnessGuard {
  private static instance: DataFreshnessGuard;

  public static getInstance(): DataFreshnessGuard {
    if (!DataFreshnessGuard.instance) {
      DataFreshnessGuard.instance = new DataFreshnessGuard();
    }
    return DataFreshnessGuard.instance;
  }

  /**
   * 官方数据源元数据与 Color Code 字典
   */
  public static readonly SOURCE_METADATA: Record<
    MarketDataSource,
    { label: string; color: string; badgeClass: string; defaultConfidence: number }
  > = {
    MOOMOO_OPEND: {
      label: "MooMoo 实盘",
      color: "emerald",
      badgeClass: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
      defaultConfidence: 0.95,
    },
    YAHOO_FINANCE: {
      label: "Yahoo Finance",
      color: "purple",
      badgeClass: "bg-purple-500/10 text-purple-300 border-purple-500/30",
      defaultConfidence: 0.85,
    },
    SEARXNG_SEARCH: {
      label: "SearXNG 资讯",
      color: "sky",
      badgeClass: "bg-sky-500/10 text-sky-300 border-sky-500/30",
      defaultConfidence: 0.65,
    },
    SEC_EDGAR: {
      label: "SEC 官方披露",
      color: "amber",
      badgeClass: "bg-amber-500/10 text-amber-300 border-amber-500/30",
      defaultConfidence: 0.90,
    },
    GOOGLE_TIMEFM: {
      label: "Google TimeFM",
      color: "indigo",
      badgeClass: "bg-indigo-500/10 text-indigo-300 border-indigo-500/30",
      defaultConfidence: 0.75,
    },
    LOCAL_CACHE: {
      label: "本地认知库",
      color: "slate",
      badgeClass: "bg-slate-500/10 text-slate-300 border-slate-500/30",
      defaultConfidence: 0.70,
    },
  };

  /**
   * 1. 价格物理合法性与多源交叉校验 (Price Sanity & Cross-Checking)
   */
  public validatePriceSanity(params: {
    primaryPrice?: number;
    prevClosePrice?: number;
    openDPrice?: number;
    yahooPrice?: number;
  }): PriceSanityResult {
    const { primaryPrice, prevClosePrice, openDPrice, yahooPrice } = params;

    // 优先采用显式的主价格，若无则取 OpenD 或 Yahoo
    let effPrice =
      primaryPrice && primaryPrice > 0
        ? primaryPrice
        : openDPrice && openDPrice > 0
        ? openDPrice
        : yahooPrice && yahooPrice > 0
        ? yahooPrice
        : 0;

    if (!effPrice || effPrice <= 0 || isNaN(effPrice) || !isFinite(effPrice)) {
      return {
        isValid: false,
        sanitizedPrice: 0,
        validityStatus: "INVALID",
        warningNote: "价格非数值或小于等于零",
      };
    }

    // 涨跌幅异常跳空检验 (如日内涨跌超过 50%)
    if (prevClosePrice && prevClosePrice > 0) {
      const changeRatio = Math.abs((effPrice - prevClosePrice) / prevClosePrice);
      if (changeRatio > 0.8) {
        return {
          isValid: true,
          sanitizedPrice: effPrice,
          validityStatus: "CROSS_FLAGGED",
          warningNote: `价格单日跳空变动达 ${(changeRatio * 100).toFixed(1)}%，可能存在拆股/合股未除权或极端异动`,
        };
      }
    }

    // 多源交叉比对检验 (Cross-Check: OpenD vs Yahoo)
    if (openDPrice && openDPrice > 0 && yahooPrice && yahooPrice > 0) {
      const avg = (openDPrice + yahooPrice) / 2;
      const diff = Math.abs(openDPrice - yahooPrice);
      const devPct = Number(((diff / avg) * 100).toFixed(2));

      if (devPct > 5.0) {
        return {
          isValid: true,
          sanitizedPrice: openDPrice, // 优先以实盘 OpenD 为准
          validityStatus: "CROSS_FLAGGED",
          deviationPct: devPct,
          warningNote: `OpenD ($${openDPrice}) 与 Yahoo ($${yahooPrice}) 价差偏离 ${devPct}% > 5%，已采纳实盘报价`,
        };
      }

      return {
        isValid: true,
        sanitizedPrice: openDPrice,
        validityStatus: "VALID",
        deviationPct: devPct,
      };
    }

    return {
      isValid: true,
      sanitizedPrice: effPrice,
      validityStatus: "VALID",
    };
  }

  /**
   * 2. 财务基本面合理性与异常清洗 (Fundamentals Sanity Check)
   */
  public validateFundamentalsSanity(fundamentals?: StockFundamentals | null): FundamentalsSanityResult {
    if (!fundamentals) {
      return {
        isValid: false,
        sanitizedFundamentals: { symbol: "" },
        validityStatus: "INVALID",
        isLossMaking: false,
        warningNote: "基本面数据为空",
      };
    }

    let pe = fundamentals.peRatio;
    let isLoss = false;
    let validity: DataValidityStatus = "VALID";
    let warning: string | undefined = undefined;

    // 负市盈率处理 (亏损企业)
    if (pe !== undefined && pe !== null) {
      if (isNaN(pe) || !isFinite(pe)) {
        pe = undefined;
      } else if (pe <= 0) {
        isLoss = true;
        warning = `企业当前为净亏损状态 (PE <= 0)，已自动切换为 PS / 营收增速估值模型`;
      } else if (pe > 3000) {
        warning = `PE 估值高达 ${pe.toFixed(0)} 处于极端微利离群区间`;
        validity = "CROSS_FLAGGED";
      }
    }

    // 营收增速合理性过滤
    let revGrowth = fundamentals.revenueGrowthPct;
    if (revGrowth !== undefined && revGrowth !== null) {
      if (isNaN(revGrowth) || !isFinite(revGrowth) || revGrowth < -100 || revGrowth > 10000) {
        revGrowth = undefined;
      }
    }

    const sanitized: StockFundamentals = {
      ...fundamentals,
      peRatio: pe,
      revenueGrowthPct: revGrowth,
    };

    const hasAnyMetric =
      (sanitized.peRatio !== undefined && sanitized.peRatio > 0) ||
      sanitized.revenueGrowthPct !== undefined ||
      sanitized.debtToEquity !== undefined;

    return {
      isValid: hasAnyMetric || isLoss,
      sanitizedFundamentals: sanitized,
      validityStatus: validity,
      isLossMaking: isLoss,
      warningNote: warning,
    };
  }

  /**
   * 3. 数据时效性判定 (Data Freshness State Machine)
   */
  public evaluateFreshness(
    timestampStr?: string,
    isMarketClosed: boolean = false
  ): DataFreshnessStatus {
    if (!timestampStr) return "STALE";

    const t = new Date(timestampStr).getTime();
    if (isNaN(t)) return "STALE";

    const now = Date.now();
    const diffMs = Math.max(0, now - t);
    const diffMins = diffMs / (1000 * 60);
    const diffHours = diffMins / 60;

    // 盘中时段：15分钟内黄金时效，24小时内轻度延迟，超过24小时陈旧
    if (!isMarketClosed) {
      if (diffMins <= 15) return "FRESH";
      if (diffHours <= 24) return "DELAYED";
      return "STALE";
    }

    // 休市/周末时段：4天内 (覆盖周五至周一开盘) 为有效，14天内为轻度延迟，超过14天为陈旧
    const diffDays = diffHours / 24;
    if (diffDays <= 4) return "FRESH";
    if (diffDays <= 14) return "DELAYED";
    return "STALE";
  }

  /**
   * 4. 包装生成带溯源与 Color Code 的字段对象
   */
  public createProvenanceField<T>(
    value: T,
    source: MarketDataSource,
    timestampStr?: string,
    validity: DataValidityStatus = "VALID",
    warningNote?: string
  ): ProvenanceTaggedField<T> {
    const meta = DataFreshnessGuard.SOURCE_METADATA[source] || DataFreshnessGuard.SOURCE_METADATA.LOCAL_CACHE;
    const freshness = this.evaluateFreshness(timestampStr);

    return {
      value,
      source,
      sourceLabel: meta.label,
      sourceColor: meta.color,
      freshness,
      validity,
      verifiedAt: timestampStr || new Date().toISOString(),
      warningNote,
    };
  }
}

export const dataFreshnessGuard = DataFreshnessGuard.getInstance();
