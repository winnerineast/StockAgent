export type MarketDataSource =
  | "MOOMOO_OPEND"
  | "YAHOO_FINANCE"
  | "SEARXNG_SEARCH"
  | "SEC_EDGAR"
  | "GOOGLE_TIMEFM"
  | "LOCAL_CACHE";

export type DataFreshnessStatus = "FRESH" | "DELAYED" | "STALE";
export type DataValidityStatus = "VALID" | "CROSS_FLAGGED" | "INVALID";

export interface SourceMeta {
  source: MarketDataSource;
  label: string;
  shortLabel: string;
  iconChar: string;
  colorName: string;
  badgeClass: string;
  dotClass: string;
  glowClass: string;
  description: string;
  defaultReliability: number;
}

export const SOURCE_METADATA_MAP: Record<MarketDataSource, SourceMeta> = {
  MOOMOO_OPEND: {
    source: "MOOMOO_OPEND",
    label: "MooMoo 实盘",
    shortLabel: "OpenD",
    iconChar: "🟢",
    colorName: "emerald",
    badgeClass: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:border-emerald-400/50",
    dotClass: "bg-emerald-400",
    glowClass: "shadow-emerald-500/20",
    description: "MooMoo 券商原生实盘 Level-2 逐笔撮合、买卖盘口与持仓",
    defaultReliability: 0.95,
  },
  YAHOO_FINANCE: {
    source: "YAHOO_FINANCE",
    label: "Yahoo Finance",
    shortLabel: "Yahoo",
    iconChar: "🟣",
    colorName: "purple",
    badgeClass: "bg-purple-500/10 text-purple-300 border-purple-500/30 hover:border-purple-400/50",
    dotClass: "bg-purple-400",
    glowClass: "shadow-purple-500/20",
    description: "Yahoo Finance 全球公开多源备用行情、PE/PB 估值与财报增速",
    defaultReliability: 0.85,
  },
  SEARXNG_SEARCH: {
    source: "SEARXNG_SEARCH",
    label: "SearXNG 资讯",
    shortLabel: "SearXNG",
    iconChar: "🔵",
    colorName: "sky",
    badgeClass: "bg-sky-500/10 text-sky-300 border-sky-500/30 hover:border-sky-400/50",
    dotClass: "bg-sky-400",
    glowClass: "shadow-sky-500/20",
    description: "SearXNG 全网聚合 70+ 引擎重磅新闻、彭博/路透催化剂",
    defaultReliability: 0.65,
  },
  SEC_EDGAR: {
    source: "SEC_EDGAR",
    label: "SEC 官方披露",
    shortLabel: "SEC",
    iconChar: "🟡",
    colorName: "amber",
    badgeClass: "bg-amber-500/10 text-amber-300 border-amber-500/30 hover:border-amber-400/50",
    dotClass: "bg-amber-400",
    glowClass: "shadow-amber-500/20",
    description: "SEC 官方 10-K / 10-Q 审计财报与 8-K 黑天鹅披露",
    defaultReliability: 0.90,
  },
  GOOGLE_TIMEFM: {
    source: "GOOGLE_TIMEFM",
    label: "Google TimeFM",
    shortLabel: "TimeFM",
    iconChar: "🔷",
    colorName: "indigo",
    badgeClass: "bg-indigo-500/10 text-indigo-300 border-indigo-500/30 hover:border-indigo-400/50",
    dotClass: "bg-indigo-400",
    glowClass: "shadow-indigo-500/20",
    description: "Google TimeFM 工业级时序基础模型动量与置信区间预测",
    defaultReliability: 0.75,
  },
  LOCAL_CACHE: {
    source: "LOCAL_CACHE",
    label: "本地认知库",
    shortLabel: "本地",
    iconChar: "⚪",
    colorName: "slate",
    badgeClass: "bg-slate-500/10 text-slate-300 border-slate-500/30 hover:border-slate-400/50",
    dotClass: "bg-slate-400",
    glowClass: "shadow-slate-500/20",
    description: "本地 SQLite 长期反思原则、产业链因果拓扑与历史推演快照",
    defaultReliability: 0.70,
  },
};

export function getSourceMetadata(source?: string): SourceMeta {
  if (!source) return SOURCE_METADATA_MAP.LOCAL_CACHE;
  const upper = source.toUpperCase();
  if (upper.includes("OPEND") || upper.includes("MOOMOO")) return SOURCE_METADATA_MAP.MOOMOO_OPEND;
  if (upper.includes("YAHOO") || upper.includes("YFINANCE")) return SOURCE_METADATA_MAP.YAHOO_FINANCE;
  if (upper.includes("SEARXNG") || upper.includes("NEWS")) return SOURCE_METADATA_MAP.SEARXNG_SEARCH;
  if (upper.includes("SEC") || upper.includes("EDGAR") || upper.includes("10-K") || upper.includes("10-Q")) return SOURCE_METADATA_MAP.SEC_EDGAR;
  if (upper.includes("TIMEFM") || upper.includes("GOOGLE")) return SOURCE_METADATA_MAP.GOOGLE_TIMEFM;
  return SOURCE_METADATA_MAP.LOCAL_CACHE;
}
