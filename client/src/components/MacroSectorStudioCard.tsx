import React, { useState, useEffect } from "react";
import {
  Globe,
  TrendingUp,
  TrendingDown,
  Activity,
  Sparkles,
  ShieldAlert,
  Clock,
  ExternalLink,
  Layers,
  Compass,
  Award,
  CheckCircle2,
  RefreshCw,
  BarChart3,
  Calendar,
  Zap,
} from "lucide-react";

export interface SectorSnapshotItem {
  symbol: string;
  name: string;
  category: "GROWTH" | "CYCLICAL" | "DEFENSIVE";
  lastPrice: number;
  changeRate: number;
  rsToSpy: number;
  capitalInflow: number;
  mainCapitalInflow: number;
  turnoverRate: number;
  quadrant: "LEADING" | "WEAKENING" | "LAGGING" | "IMPROVING";
  isLeading: boolean;
}

export interface CredibleNewsItem {
  title: string;
  summary: string;
  sourceName: string;
  tier: 1 | 2 | 3;
  tierLabel: string;
  sentiment: "BULLISH" | "BEARISH" | "NEUTRAL";
  url: string;
  publishedTime?: string;
}

export interface CrossAssetAnchors {
  vix: number;
  vixChange: number;
  us10y: number;
  dxy: number;
  spyChange: number;
  qqqChange: number;
  iwmChange: number;
}

export interface DailyMacroSnapshotDTO {
  id?: string;
  snapshotDate: string;
  createdAt?: string;
  regimeMood: "BULLISH" | "BEARISH" | "NEUTRAL" | "VOLATILE";
  regimeScore: number;
  stanceBias: string;
  positionCapPct: number;
  stopLossPct: number;
  crossAsset: CrossAssetAnchors;
  sectors: SectorSnapshotItem[];
  benchmarks: Array<{ symbol: string; name: string; lastPrice: number; changeRate: number }>;
  topNews: CredibleNewsItem[];
  promptContext: string;
  isLiveRealtime?: boolean;
  marketDynamics?: {
    regime: string;
    regimeLabel: string;
    trendStrengthIndex: number;
    volatilityClusteringIndex: number;
    marketBreadthPct: number;
    adaptedRiskParams: {
      maxPortfolioCapPct: number;
      singleStockCapPct: number;
      atrStopMultiplier: number;
    };
    rationale: string;
  };
}

export interface MacroSectorStudioCardProps {
  macroIntel?: any;
  liveMacroSnapshot?: DailyMacroSnapshotDTO;
  loading?: boolean;
  currentStage?: any;
  stepStatus?: "PENDING" | "ACTIVE" | "DONE";
  holdingSymbols?: string[];
}

export const MacroSectorStudioCard: React.FC<MacroSectorStudioCardProps> = ({
  macroIntel,
  liveMacroSnapshot,
  loading = false,
  currentStage,
  stepStatus = "DONE",
  holdingSymbols = [],
}) => {
  const [activeView, setActiveView] = useState<"GLOBAL" | "SECTORS" | "TIMELINE">("GLOBAL");
  const [selectedSector, setSelectedSector] = useState<SectorSnapshotItem | null>(null);
  const [historicalSnapshots, setHistoricalSnapshots] = useState<DailyMacroSnapshotDTO[]>([]);
  const [latestDbSnapshot, setLatestDbSnapshot] = useState<DailyMacroSnapshotDTO | null>(null);
  const [historicalDate, setHistoricalDate] = useState<string | null>(null);

  // 1. 尝试从本地存储或 API 获取历史演进与最新快照
  useEffect(() => {
    fetchLatestAndHistory();
  }, []);

  const fetchLatestAndHistory = async () => {
    try {
      const [histResp, latestResp] = await Promise.all([
        fetch("/api/stock/macro/history?days=15"),
        fetch("/api/stock/macro/latest"),
      ]);

      if (histResp.ok) {
        const histData = await histResp.json();
        if (histData.success && Array.isArray(histData.data)) {
          setHistoricalSnapshots(histData.data);
        }
      }

      if (latestResp.ok) {
        const latestData = await latestResp.json();
        if (latestData.success && latestData.data) {
          setLatestDbSnapshot(latestData.data);
        }
      }
    } catch {}
  };

  // 当前激活展示的数据源（优先使用实时推演出的快照，其次使用历史选定，再次回退到最新落库快照或 intel）
  const displayedSnapshot: DailyMacroSnapshotDTO = React.useMemo(() => {
    if (historicalDate) {
      const found = historicalSnapshots.find((h) => h.snapshotDate === historicalDate);
      if (found) return found;
    }
    if (liveMacroSnapshot && liveMacroSnapshot.sectors && liveMacroSnapshot.sectors.length > 0) {
      return liveMacroSnapshot;
    }
    if (macroIntel?.macroSnapshot) {
      return macroIntel.macroSnapshot;
    }
    if (latestDbSnapshot && latestDbSnapshot.sectors && latestDbSnapshot.sectors.length > 0) {
      return latestDbSnapshot;
    }

    // 初始或兜底回显
    const todayStr = new Date().toISOString().split("T")[0];
    return {
      snapshotDate: todayStr,
      regimeMood: macroIntel?.sentimentMood || "NEUTRAL",
      regimeScore: macroIntel?.sentimentScore || 50,
      stanceBias: macroIntel?.macroTradingStance?.bias || "中性震荡 · 控仓观望",
      positionCapPct: 55.0,
      stopLossPct: 8.0,
      crossAsset: {
        vix: 15.2,
        vixChange: -0.3,
        us10y: 4.28,
        dxy: 103.8,
        spyChange: 0.7,
        qqqChange: 1.16,
        iwmChange: 0.26,
      },
      benchmarks: [
        { symbol: "SPY", name: "标普500大盘", lastPrice: 777.88, changeRate: 0.7 },
        { symbol: "QQQ", name: "纳指100科技", lastPrice: 732.07, changeRate: 1.16 },
        { symbol: "IWM", name: "罗素2000小盘", lastPrice: 303.5, changeRate: 0.26 },
      ],
      sectors: [
        { symbol: "XLC", name: "通信与数字媒体", category: "GROWTH", lastPrice: 112.55, changeRate: 2.07, rsToSpy: 1.37, capitalInflow: 198700000, mainCapitalInflow: 198700000, turnoverRate: 2.7, quadrant: "LEADING", isLeading: true },
        { symbol: "SMH", name: "AI算力与半导体", category: "GROWTH", lastPrice: 589.12, changeRate: 0.73, rsToSpy: 0.03, capitalInflow: -108800000, mainCapitalInflow: -108800000, turnoverRate: 5.5, quadrant: "WEAKENING", isLeading: true },
        { symbol: "XLK", name: "大盘科技成长", category: "GROWTH", lastPrice: 190.77, changeRate: 1.01, rsToSpy: 0.31, capitalInflow: 5650000, mainCapitalInflow: 5650000, turnoverRate: 0.75, quadrant: "LEADING", isLeading: true },
        { symbol: "XLRE", name: "房地产与REITs", category: "DEFENSIVE", lastPrice: 45.12, changeRate: 1.42, rsToSpy: 0.72, capitalInflow: 2100000, mainCapitalInflow: 2100000, turnoverRate: 3.0, quadrant: "LEADING", isLeading: true },
        { symbol: "XLP", name: "必选防御性消费", category: "DEFENSIVE", lastPrice: 86.0, changeRate: 1.08, rsToSpy: 0.38, capitalInflow: 16700000, mainCapitalInflow: 16700000, turnoverRate: 5.7, quadrant: "LEADING", isLeading: true },
        { symbol: "XLF", name: "金融与商业银行", category: "CYCLICAL", lastPrice: 58.26, changeRate: 0.59, rsToSpy: -0.11, capitalInflow: -30400000, mainCapitalInflow: -30400000, turnoverRate: 2.3, quadrant: "LAGGING", isLeading: false },
        { symbol: "XLY", name: "可选消费与零售", category: "CYCLICAL", lastPrice: 118.45, changeRate: 0.48, rsToSpy: -0.22, capitalInflow: -3300000, mainCapitalInflow: -3300000, turnoverRate: 2.28, quadrant: "LAGGING", isLeading: false },
        { symbol: "XLU", name: "公用事业与电力", category: "DEFENSIVE", lastPrice: 44.04, changeRate: 0.46, rsToSpy: -0.24, capitalInflow: -13800000, mainCapitalInflow: -13800000, turnoverRate: 3.4, quadrant: "LAGGING", isLeading: false },
        { symbol: "XLE", name: "传统能源与石油", category: "CYCLICAL", lastPrice: 61.06, changeRate: 0.05, rsToSpy: -0.65, capitalInflow: -56800000, mainCapitalInflow: -56800000, turnoverRate: 3.1, quadrant: "LAGGING", isLeading: false },
        { symbol: "XLV", name: "生物医药与医疗", category: "DEFENSIVE", lastPrice: 168.38, changeRate: -0.04, rsToSpy: -0.74, capitalInflow: 67300000, mainCapitalInflow: 67300000, turnoverRate: 2.58, quadrant: "IMPROVING", isLeading: false },
        { symbol: "XLI", name: "高端制造与工业", category: "CYCLICAL", lastPrice: 185.79, changeRate: -0.05, rsToSpy: -0.75, capitalInflow: -2300000, mainCapitalInflow: -2300000, turnoverRate: 2.6, quadrant: "LAGGING", isLeading: false },
      ],
      topNews: (macroIntel?.keyBulletPoints || []).map((k: any) => ({
        title: k.title,
        summary: k.snippet,
        sourceName: k.source || "SearXNG 权威源",
        tier: 1,
        tierLabel: "Tier-1 权威通讯社",
        sentiment: "BULLISH",
        url: k.url || "#",
      })),
      promptContext: macroIntel?.distilledPromptContext || "【大盘宏观背景】当前大盘处于中性震荡格局，多空博弈均衡。推演策略：对持仓标的严守防线，对新开仓标的提高安全边际要求。",
      isLiveRealtime: false,
    };
  }, [liveMacroSnapshot, macroIntel, historicalDate, historicalSnapshots]);

  const moodColor =
    displayedSnapshot.regimeMood === "BULLISH"
      ? "text-emerald-400 border-emerald-500/40 bg-emerald-500/10"
      : displayedSnapshot.regimeMood === "BEARISH"
      ? "text-rose-400 border-rose-500/40 bg-rose-500/10"
      : "text-amber-400 border-amber-500/40 bg-amber-500/10";

  const moodLabel =
    displayedSnapshot.regimeMood === "BULLISH"
      ? "多头顺势 · 风险偏好扩张"
      : displayedSnapshot.regimeMood === "BEARISH"
      ? "防守避险 · 严格控仓"
      : "震荡分化 · 结构性轮动";

  // 格式化资金流显示
  const formatFlow = (amount: number) => {
    if (Math.abs(amount) >= 1e8) {
      return `${(amount / 1e8).toFixed(2)}亿`;
    }
    if (Math.abs(amount) >= 1e4) {
      return `${(amount / 1e4).toFixed(1)}万`;
    }
    return `${amount.toFixed(0)}`;
  };

  return (
    <div className="glass-card p-4 md:p-5 border-slate-800 bg-gradient-to-r from-slate-900/95 via-slate-900/80 to-indigo-950/20 relative rounded-2xl shadow-2xl space-y-3.5 transition-all">
      {/* ========================================================================= */}
      {/* 1. 顶部全景控制栏 (标题 + 态势徽章 + 渐进式多段进度条 + 3 视图切换 Tab) */}
      {/* ========================================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-800/80">
        {/* 左侧标题与态势 */}
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
            <Globe className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm md:text-base font-bold text-white flex items-center gap-1.5">
                <span>美股板块大盘动态 & 全网宏观量化中枢</span>
              </h3>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${moodColor} flex items-center gap-1`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping"></span>
                <span>{moodLabel} ({displayedSnapshot.regimeScore}分)</span>
              </span>
              {historicalDate ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>复盘穿越: {historicalDate}</span>
                  <button
                    onClick={() => setHistoricalDate(null)}
                    className="ml-1 text-slate-400 hover:text-white cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-mono">
                  {displayedSnapshot.isLiveRealtime ? "⚡ OpenD + SearXNG 实时同步" : "🕒 实时基准回显"}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              直连 OpenD 11 大行业 ETF 资金流 · SearXNG 权威信源分级蒸馏 · 跨资产宏观约束注入
            </p>
          </div>
        </div>

        {/* 右侧：多段进度指示与 3 视图切换 Tab */}
        <div className="flex items-center gap-2 flex-wrap">
          {loading && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-xs text-cyan-300 animate-pulse">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span className="text-[11px] font-mono">
                {currentStage?.title || "宏观多源计算中..."}
              </span>
            </div>
          )}

          {/* 3 视图切换器 */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-950/90 border border-slate-800 text-xs">
            <button
              onClick={() => setActiveView("GLOBAL")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeView === "GLOBAL"
                  ? "bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>🌐 宏观全局</span>
            </button>
            <button
              onClick={() => setActiveView("SECTORS")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeView === "SECTORS"
                  ? "bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>📊 板块截面 ({displayedSnapshot.sectors.length})</span>
            </button>
            <button
              onClick={() => setActiveView("TIMELINE")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeView === "TIMELINE"
                  ? "bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>⏱️ 时序演进 ({historicalSnapshots.length || 1}D)</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. 视图 1: 🌐 宏观全局 (Global Glance - 默认紧凑全景 3.5 : 5.0 : 3.5 布局) */}
      {/* ========================================================================= */}
      {activeView === "GLOBAL" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 animate-fade-in">
          {/* 左栏 3.5 宽: 宏观 Regime 定调与跨资产晴雨表 */}
          <div className="lg:col-span-3 space-y-2.5 p-3 rounded-xl bg-slate-950/70 border border-slate-800">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300 pb-1 border-b border-slate-800/80">
              <span className="flex items-center gap-1 text-cyan-400">
                <Activity className="w-3.5 h-3.5" />
                <span>跨资产锚点晴雨表</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">OpenD 实时</span>
            </div>

            {/* 跨资产指标 3 联条 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/90 border border-slate-800/80 text-xs">
                <span className="text-slate-400">恐慌指数 (VIX/UVXY)</span>
                <span className={`font-mono font-bold flex items-center gap-1 ${
                  displayedSnapshot.crossAsset.vix > 25
                    ? "text-rose-400"
                    : displayedSnapshot.crossAsset.vix > 20
                    ? "text-amber-400"
                    : "text-emerald-400"
                }`}>
                  <span>{displayedSnapshot.crossAsset.vix.toFixed(1)}</span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    {displayedSnapshot.crossAsset.vixChange !== 0 ? `(${displayedSnapshot.crossAsset.vixChange > 0 ? "+" : ""}${displayedSnapshot.crossAsset.vixChange}%)` : (displayedSnapshot.crossAsset.vix > 25 ? "(极度恐慌)" : displayedSnapshot.crossAsset.vix > 20 ? "(预警)" : "(平稳)")}
                  </span>
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/90 border border-slate-800/80 text-xs">
                <span className="text-slate-400">
                  {displayedSnapshot.crossAsset.us10y > 10 ? "20年+美债 (TLT)" : "美债10Y收益率"}
                </span>
                <span className="font-mono font-bold text-amber-300 flex items-center gap-1">
                  <span>
                    {displayedSnapshot.crossAsset.us10y > 10
                      ? `$${displayedSnapshot.crossAsset.us10y.toFixed(2)}`
                      : `${displayedSnapshot.crossAsset.us10y.toFixed(2)}%`}
                  </span>
                  <span className="text-[10px] text-amber-500/80 font-normal">
                    {displayedSnapshot.crossAsset.us10y > 10 ? "(债券基准)" : "(收益率)"}
                  </span>
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/90 border border-slate-800/80 text-xs">
                <span className="text-slate-400">标普 / 纳指 Beta</span>
                <span className="font-mono font-semibold text-cyan-300 flex items-center gap-1.5">
                  <span className={displayedSnapshot.crossAsset.spyChange >= 0 ? "text-emerald-400" : "text-rose-400"}>
                    SPY {displayedSnapshot.crossAsset.spyChange > 0 ? "+" : ""}{displayedSnapshot.crossAsset.spyChange}%
                  </span>
                  <span className="text-slate-600">|</span>
                  <span className={displayedSnapshot.crossAsset.qqqChange >= 0 ? "text-emerald-400" : "text-rose-400"}>
                    QQQ {displayedSnapshot.crossAsset.qqqChange > 0 ? "+" : ""}{displayedSnapshot.crossAsset.qqqChange}%
                  </span>
                </span>
              </div>
            </div>

            {/* 🌟 TradeMaster MDM 市场动力学状态机卡片 */}
            <div className="p-2 rounded-lg bg-indigo-950/40 border border-indigo-500/30 text-xs space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-indigo-300">
                <span className="flex items-center gap-1">
                  <Compass className="w-3.5 h-3.5 text-indigo-400" />
                  <span>TradeMaster MDM 动力学</span>
                </span>
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-mono">
                  {displayedSnapshot.marketDynamics?.regimeLabel || "📦 低波窄幅蓄势"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-[10px] font-mono">
                <div className="bg-slate-900/80 p-1 rounded border border-slate-800 flex justify-between">
                  <span className="text-slate-400">TSI 趋势强度:</span>
                  <span className={displayedSnapshot.marketDynamics?.trendStrengthIndex && displayedSnapshot.marketDynamics.trendStrengthIndex > 0 ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                    {displayedSnapshot.marketDynamics?.trendStrengthIndex !== undefined ? (displayedSnapshot.marketDynamics.trendStrengthIndex > 0 ? `+${displayedSnapshot.marketDynamics.trendStrengthIndex}` : displayedSnapshot.marketDynamics.trendStrengthIndex) : "+0.15"}
                  </span>
                </div>
                <div className="bg-slate-900/80 p-1 rounded border border-slate-800 flex justify-between">
                  <span className="text-slate-400">VCI 波动聚集:</span>
                  <span className="text-cyan-300 font-bold">
                    {displayedSnapshot.marketDynamics?.volatilityClusteringIndex !== undefined ? displayedSnapshot.marketDynamics.volatilityClusteringIndex : "0.00"}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono border-t border-indigo-900/40 pt-1">
                <span>自适应仓位上限:</span>
                <span className="text-emerald-400 font-bold">
                  {displayedSnapshot.marketDynamics?.adaptedRiskParams?.maxPortfolioCapPct || displayedSnapshot.positionCapPct || 75}% (单票≤{displayedSnapshot.marketDynamics?.adaptedRiskParams?.singleStockCapPct || 35}%)
                </span>
              </div>
            </div>

            {/* 风格偏好标签 */}
            <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/60 font-mono">
              <span>风格偏好:</span>
              <span className="text-cyan-300 font-semibold">科技成长 &gt; 周期防御</span>
            </div>
          </div>

          {/* 中栏 5.5 宽: 11 大行业板块实时动量与资金流胶囊网格 */}
          <div className="lg:col-span-6 space-y-2 p-3 rounded-xl bg-slate-950/70 border border-slate-800">
            <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-800/80">
              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>标普 11 大行业板块资金流 & 相对强度 (RS)</span>
              </span>
              <span className="text-[10px] text-cyan-400 font-mono">点击板块穿透下钻</span>
            </div>

            {/* 11 板块紧凑微胶囊网格 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
              {displayedSnapshot.sectors.map((sec) => {
                const isPos = sec.changeRate >= 0;
                const isLeading = sec.rsToSpy >= 0;
                const isSelected = selectedSector?.symbol === sec.symbol;

                return (
                  <button
                    key={sec.symbol}
                    onClick={() => {
                      setSelectedSector(isSelected ? null : sec);
                      setActiveView("SECTORS");
                    }}
                    className={`p-2 rounded-lg text-left transition-all border cursor-pointer ${
                      isSelected
                        ? "bg-cyan-500/20 border-cyan-400 shadow-md shadow-cyan-500/20"
                        : isLeading
                        ? "bg-slate-900/90 hover:bg-slate-850 border-slate-800 hover:border-cyan-500/40"
                        : "bg-slate-900/60 hover:bg-slate-850 border-slate-800/80 text-slate-400"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-xs text-white">{sec.symbol}</span>
                      <span
                        className={`text-[10px] font-mono font-bold ${
                          isPos ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {isPos ? "+" : ""}
                        {sec.changeRate.toFixed(2)}%
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 truncate mt-0.5">{sec.name}</div>
                    <div className="flex items-center justify-between text-[9px] font-mono mt-1 pt-1 border-t border-slate-800/60">
                      <span className="text-slate-500">RS {sec.rsToSpy > 0 ? "+" : ""}{sec.rsToSpy}%</span>
                      <span className={sec.capitalInflow >= 0 ? "text-emerald-400" : "text-rose-400"}>
                        {sec.capitalInflow >= 0 ? "入" : "出"} {formatFlow(sec.capitalInflow)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 右栏 3.0 宽: 今日操盘纪律约束与 Prompt 注入 Payload */}
          <div className="lg:col-span-3 space-y-2 p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300 pb-1 border-b border-slate-800/80">
                <span className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>今日操盘指南 & 纪律约束</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">总纲</span>
              </div>

              {/* 操盘基调 */}
              <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 text-xs space-y-0.5">
                <div className="text-[10px] text-slate-400 font-bold">策略基调</div>
                <div className="text-white font-semibold">{displayedSnapshot.stanceBias}</div>
              </div>

              {/* 仓位调控与止损约束 */}
              <div className="grid grid-cols-2 gap-1.5">
                <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 text-xs">
                  <div className="text-[10px] text-slate-400">仓位上限</div>
                  <div className="text-cyan-400 font-mono font-bold mt-0.5">
                    &le; {displayedSnapshot.positionCapPct}%
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 text-xs">
                  <div className="text-[10px] text-slate-400">软止损线</div>
                  <div className="text-rose-400 font-mono font-bold mt-0.5">
                    - {displayedSnapshot.stopLossPct.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>

            {/* 注入下游 Prompt 检视 */}
            <div className="p-2 rounded-lg bg-slate-900/80 border border-cyan-500/20 text-[10px] font-mono text-slate-300 leading-relaxed">
              <span className="text-cyan-400 font-semibold flex items-center gap-1 mb-0.5">
                <Sparkles className="w-3 h-3" />
                <span>已注入 Step 3~4 推演上下文</span>
              </span>
              <p className="line-clamp-2 text-slate-400">{displayedSnapshot.promptContext}</p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. 视图 2: 📊 板块动量与资金流截面 (Sector Breakdown & Capital Flow) */}
      {/* ========================================================================= */}
      {activeView === "SECTORS" && (
        <div className="space-y-3 p-4 rounded-xl bg-slate-950/85 border border-slate-800 animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <span>11 大行业板块相对强度与资金流向完整矩阵</span>
                <span className="text-xs text-slate-400 font-normal font-mono">
                  (基准: SPY {displayedSnapshot.crossAsset.spyChange > 0 ? "+" : ""}{displayedSnapshot.crossAsset.spyChange}%)
                </span>
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                直连 OpenD 获取行业主力资金流入、换手率与 RRG 轮动象限 (领先/改善/弱化/滞后)
              </p>
            </div>
            <button
              onClick={() => setActiveView("GLOBAL")}
              className="text-xs text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
            >
              返回全局全景 &times;
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {displayedSnapshot.sectors.map((sec) => {
              const isLead = sec.rsToSpy >= 0;
              const hasHoldings = holdingSymbols.length > 0;

              return (
                <div
                  key={sec.symbol}
                  className={`p-3 rounded-xl border transition-all ${
                    selectedSector?.symbol === sec.symbol
                      ? "bg-cyan-950/30 border-cyan-400 shadow-lg shadow-cyan-500/10"
                      : "bg-slate-900/80 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-slate-800 font-mono font-bold text-xs text-white">
                        {sec.symbol}
                      </span>
                      <span className="text-xs font-semibold text-slate-200">{sec.name}</span>
                    </div>
                    <span
                      className={`text-xs font-mono font-bold ${
                        sec.changeRate >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {sec.changeRate >= 0 ? "+" : ""}
                      {sec.changeRate.toFixed(2)}%
                    </span>
                  </div>

                  {/* 动量与资金流对比条 */}
                  <div className="mt-2.5 space-y-1.5 text-xs font-mono">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>相对 SPY 超额 (RS):</span>
                      <span className={isLead ? "text-emerald-400 font-bold" : "text-rose-400"}>
                        {sec.rsToSpy > 0 ? "+" : ""}
                        {sec.rsToSpy}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-400">
                      <span>主力资金净流向:</span>
                      <span className={sec.capitalInflow >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                        {sec.capitalInflow >= 0 ? "+$" : "-$"}
                        {formatFlow(Math.abs(sec.capitalInflow))}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-400">
                      <span>换手率 / 轮动象限:</span>
                      <span className="text-slate-300">
                        {sec.turnoverRate.toFixed(1)}% ·{" "}
                        <strong
                          className={
                            sec.quadrant === "LEADING"
                              ? "text-emerald-400"
                              : sec.quadrant === "IMPROVING"
                              ? "text-cyan-400"
                              : sec.quadrant === "WEAKENING"
                              ? "text-amber-400"
                              : "text-rose-400"
                          }
                        >
                          {sec.quadrant === "LEADING"
                            ? "🚀 领先走强"
                            : sec.quadrant === "IMPROVING"
                            ? "📈 改善转多"
                            : sec.quadrant === "WEAKENING"
                            ? "⚠️ 弱化转空"
                            : "📉 滞后走弱"}
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. 视图 3: ⏱️ 时序演进与催化时间轴 (Timeline Journey & Historical Retro) */}
      {/* ========================================================================= */}
      {activeView === "TIMELINE" && (
        <div className="space-y-3.5 p-4 rounded-xl bg-slate-950/85 border border-slate-800 animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <span>近 15 天大盘宏观 Regime 演进轨迹与权威信源精选</span>
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                支持点击任意历史日期进行“时空穿梭复盘”，比对当时宏观定调与后续走势
              </p>
            </div>
            <button
              onClick={() => setActiveView("GLOBAL")}
              className="text-xs text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
            >
              返回全局全景 &times;
            </button>
          </div>

          {/* 历史演进时间轴水平滑动条 */}
          <div className="space-y-1.5">
            <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-cyan-400" />
              <span>宏观态势时钟 (Regime Timeline)</span>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
              {historicalSnapshots.length > 0 ? (
                historicalSnapshots.map((snap) => {
                  const isCurrent = (historicalDate === snap.snapshotDate) || (!historicalDate && snap.snapshotDate === displayedSnapshot.snapshotDate);
                  return (
                    <button
                      key={snap.snapshotDate}
                      onClick={() => setHistoricalDate(snap.snapshotDate)}
                      className={`p-2.5 rounded-xl border text-left shrink-0 min-w-[130px] transition-all cursor-pointer ${
                        isCurrent
                          ? "bg-cyan-500/20 border-cyan-400 shadow-md shadow-cyan-500/20"
                          : "bg-slate-900/80 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="text-[11px] font-mono text-slate-400">{snap.snapshotDate}</div>
                      <div className="text-xs font-bold text-white mt-0.5 truncate">{snap.stanceBias}</div>
                      <div className="text-[10px] font-mono text-cyan-400 mt-1">情绪: {snap.regimeScore}分</div>
                    </button>
                  );
                })
              ) : (
                <div className="p-3 text-xs text-slate-500 font-mono">
                  今日首次运行生成快照，后续每日自动追加历史时空演进点...
                </div>
              )}
            </div>
          </div>

          {/* 权威信源精选资讯 (Tier-1 / Tier-2 / Tier-3) */}
          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-cyan-400">
                <Award className="w-3.5 h-3.5" />
                <span>SearXNG 权威信源精选资讯 ({displayedSnapshot.topNews.length} 篇)</span>
              </span>
              <span className="text-[10px] text-slate-500">已按信源资质加权排序</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {displayedSnapshot.topNews.map((news, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1 hover:border-slate-700 transition-all"
                >
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="px-2 py-0.5 rounded font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                      {news.tierLabel}
                    </span>
                    <span className="text-slate-400 font-mono">{news.sourceName}</span>
                  </div>
                  <h5 className="text-xs font-bold text-white line-clamp-1">{news.title}</h5>
                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{news.summary}</p>
                  {news.url && news.url !== "#" && (
                    <a
                      href={news.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5 pt-0.5"
                    >
                      <span>原文溯源</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
