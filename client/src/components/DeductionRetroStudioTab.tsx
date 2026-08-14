import React, { useState, useMemo } from "react";
import {
  DollarSign,
  PieChart,
  TrendingUp,
  Sliders,
  RefreshCw,
  History,
  Sparkles,
  Bot,
  Award,
  BookOpen,
  ShieldCheck,
  Loader2,
  Activity,
  Globe,
  Compass,
  ExternalLink,
  Flame,
  AlertTriangle,
} from "lucide-react";
import { DeductionProgressStepper, StageStep } from "./DeductionProgressStepper";
import { PerStockDeductionRetroCard } from "./PerStockDeductionRetroCard";

export interface MacroMarketIntel {
  sentimentMood: "BULLISH" | "BEARISH" | "NEUTRAL" | "VOLATILE";
  sentimentScore: number;
  summaryHeadline: string;
  starSectors: string[];
  keyBulletPoints: Array<{
    title: string;
    snippet: string;
    source: string;
    url?: string;
  }>;
  macroTradingStance: {
    bias: string;
    positionStrategy: string;
    riskWarning: string;
  };
  distilledPromptContext: string;
}

export function parseMacroIntel(raw?: string): MacroMarketIntel {
  if (!raw) {
    return {
      sentimentMood: "NEUTRAL",
      sentimentScore: 50,
      summaryHeadline: "全网盘前资讯暂未检索到显著异常，大盘维持平稳震荡动向。",
      starSectors: ["大盘科技成长", "AI 算力与半导体", "宏观防御性消费"],
      keyBulletPoints: [],
      macroTradingStance: {
        bias: "中性震荡 · 控仓观望",
        positionStrategy: "建议总持仓保持在 50%~60%，避免盲目追高开盘冲高标的",
        riskWarning: "严格执行个股 -8.0% 软止损纪律，防范盘中流动性抽离",
      },
      distilledPromptContext: "【大盘宏观背景】当前大盘处于中性震荡格局，多空博弈均衡。推演策略：对持仓标的严守防线，对新开仓标的提高安全边际要求。",
    };
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed && (parsed.summaryHeadline || parsed.macroTradingStance || parsed.keyBulletPoints)) {
      return parsed;
    }
  } catch (e) {}

  const isBull = raw.toLowerCase().includes("gain") || raw.toLowerCase().includes("rally") || raw.toLowerCase().includes("surge");
  const isBear = raw.toLowerCase().includes("drop") || raw.toLowerCase().includes("plunge") || raw.toLowerCase().includes("fall");

  return {
    sentimentMood: isBull ? "BULLISH" : isBear ? "BEARISH" : "NEUTRAL",
    sentimentScore: isBull ? 72 : isBear ? 35 : 52,
    summaryHeadline: raw.slice(0, 120),
    starSectors: ["科技与半导体", "AI 算力与电力", "宏观利率与消费"],
    keyBulletPoints: [
      {
        title: "美股大盘全网盘前资讯摘要",
        snippet: raw.slice(0, 260),
        source: "SearXNG 聚合检索",
      }
    ],
    macroTradingStance: {
      bias: isBull ? "多头顺势 · 聚焦主线" : isBear ? "防守避险 · 严格控仓" : "震荡分化 · 波段应对",
      positionStrategy: isBull ? "建议总持仓保持在 65%~75%，顺应主线强势标的" : "建议总仓位控制在 50% 以内",
      riskWarning: "严格设定 5%-8% 个股阶梯止损位",
    },
    distilledPromptContext: raw.slice(0, 200),
  };
}

interface DeductionRetroStudioTabProps {
  netAssets: number;
  cashBalance: number;
  totalMarketValue: number;
  totalPnL: number;
  totalPnLPct: number;
  positions: any[];
  rebalanceActions: any[];
  perStockItems: any[];
  retrospectives: any[];
  marketOverview?: string;
  oversoldOpportunities?: any[];
  watchlist?: any[];
  screenerActions?: any[];
  isUnlocked: boolean;
  loading: boolean;
  currentStage: StageStep | null;
  onOpenKnowledgeGraph: (symbol: string) => void;
  onOpenUnlockModal: () => void;
  onExecuteRebalance: (budget: number, risk: string) => void;
}

// 统一的阶段阻塞同步遮罩与虚化指示器
interface StepSyncOverlayProps {
  status: "DONE" | "ACTIVE" | "PENDING";
  stepNumber: number;
  stepTitle: string;
  activeDetail?: string;
  currentRunningStep?: number;
}

const StepSyncOverlay: React.FC<StepSyncOverlayProps> = ({
  status,
  stepNumber,
  stepTitle,
  activeDetail,
  currentRunningStep,
}) => {
  if (status === "DONE") return null;

  if (status === "ACTIVE") {
    return (
      <div className="absolute inset-0 z-20 backdrop-blur-md bg-slate-950/85 rounded-2xl flex flex-col items-center justify-center p-6 text-center border border-cyan-500/40 animate-fade-in shadow-2xl">
        <div className="p-3 rounded-2xl bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 mb-3 shadow-lg shadow-cyan-500/30 animate-pulse">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 uppercase tracking-wide">
            ⚡ Step {stepNumber} 正在实时执行
          </span>
          <span className="text-xs text-white font-bold">{stepTitle}</span>
        </div>
        <p className="text-xs text-slate-300 mt-1.5 max-w-md font-medium leading-relaxed">
          {activeDetail || "正在调用底层接口与大模型处理数据..."}
        </p>
        <div className="mt-3 flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/90 border border-slate-800 text-[11px] text-cyan-400 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
          <span>阶段实时处理中 · 稍候自动进入下一环节</span>
        </div>
      </div>
    );
  }

  // PENDING (排队等待中)
  return (
    <div className="absolute inset-0 z-10 backdrop-blur-sm bg-slate-950/70 rounded-2xl flex flex-col items-center justify-center p-6 text-center border border-slate-800/80 animate-fade-in">
      <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-xs text-slate-400 font-medium shadow-md">
        <span className="w-2 h-2 rounded-full bg-amber-400/80 animate-pulse"></span>
        <span>⏳ 阶段排队中 · 等待 Step {currentRunningStep || 1} 完成后自动解锁</span>
      </div>
    </div>
  );
};

export const DeductionRetroStudioTab: React.FC<DeductionRetroStudioTabProps> = ({
  netAssets,
  cashBalance,
  totalMarketValue,
  totalPnL,
  totalPnLPct,
  positions,
  rebalanceActions,
  perStockItems,
  retrospectives,
  marketOverview,
  oversoldOpportunities = [],
  watchlist = [],
  screenerActions = [],
  isUnlocked,
  loading,
  currentStage,
  onOpenKnowledgeGraph,
  onOpenUnlockModal,
  onExecuteRebalance,
}) => {
  const [customBudget, setCustomBudget] = useState<number>(1000);
  const [riskPreference, setRiskPreference] = useState<string>("BALANCED");
  const [filterCategory, setFilterCategory] = useState<"ALL" | "HOLDING" | "CLEARED">("ALL");

  // 选股与超跌建仓搜索/动作筛选
  const [screenerSearchQuery, setScreenerSearchQuery] = useState<string>("");
  const [screenerActionFilter, setScreenerActionFilter] = useState<string>("ALL");

  const latestRetro = retrospectives && retrospectives.length > 0 ? retrospectives[0] : null;
  const isPnLPos = totalPnL >= 0;

  // 计算当前流水线各个阶段状态 (精准判定: DONE 已完成 / ACTIVE 当前执行 / PENDING 排队等待)
  const currentStep = currentStage?.step ?? (loading ? 1 : 5);
  const getStepStatus = (targetStep: number): "DONE" | "ACTIVE" | "PENDING" => {
    if (!loading) return "DONE";
    if (currentStep === targetStep) return "ACTIVE";
    if (currentStep > targetStep) return "DONE";
    return "PENDING";
  };

  const [strategyFilter, setStrategyFilter] = useState<string>("ALL");

  const holdingCount = useMemo(
    () => perStockItems.filter((item) => item.position && item.position.shares > 0).length,
    [perStockItems]
  );
  const clearedCount = useMemo(
    () => perStockItems.filter((item) => item.isCleared || (item.position && item.position.shares === 0)).length,
    [perStockItems]
  );
  const oversoldCount = useMemo(
    () => perStockItems.filter((item) => item.strategyCategory === "OVERSOLD_BUY").length,
    [perStockItems]
  );
  const fundamentalCount = useMemo(
    () => perStockItems.filter((item) => item.strategyCategory === "FUNDAMENTAL_BUY").length,
    [perStockItems]
  );
  const newsCount = useMemo(
    () => perStockItems.filter((item) => item.strategyCategory === "NEWS_CATALYST_BUY").length,
    [perStockItems]
  );
  const capitalCount = useMemo(
    () => perStockItems.filter((item) => item.strategyCategory === "CAPITAL_INFLOW_BUY").length,
    [perStockItems]
  );
  const watchCount = useMemo(
    () => perStockItems.filter((item) => item.strategyCategory === "WATCH_AND_WAIT").length,
    [perStockItems]
  );

  const filteredItems = perStockItems.filter((item) => {
    // 1. 持仓/清仓状态过滤
    if (filterCategory === "HOLDING" && (!item.position || item.position.shares <= 0)) return false;
    if (filterCategory === "CLEARED" && (!item.isCleared && (!item.position || item.position.shares > 0))) return false;

    // 2. 5大策略分类过滤
    if (strategyFilter !== "ALL" && item.strategyCategory !== strategyFilter) return false;

    return true;
  });

  // 汇总超跌机会与 Screener 动作列表
  const combinedScreenerItems = [
    ...oversoldOpportunities,
    ...screenerActions.filter((sa) => !oversoldOpportunities.some((oo) => oo.symbol === sa.symbol)),
  ];

  const filteredScreenerItems = combinedScreenerItems.filter((item) => {
    const matchesSearch =
      !screenerSearchQuery ||
      item.symbol.toLowerCase().includes(screenerSearchQuery.toLowerCase()) ||
      (item.companyName && item.companyName.toLowerCase().includes(screenerSearchQuery.toLowerCase()));
    const matchesFilter =
      screenerActionFilter === "ALL" ||
      (screenerActionFilter === "BUY" && item.action === "BUY") ||
      (screenerActionFilter === "TRIM" && (item.action === "TRIM" || item.action === "SELL")) ||
      (screenerActionFilter === "HOLD" && item.action === "HOLD");
    return matchesSearch && matchesFilter;
  });

  const parsedMacroIntel = useMemo(() => parseMacroIntel(marketOverview), [marketOverview]);

  const step1Status = getStepStatus(1);
  const step2Status = getStepStatus(2);
  const step3Status = getStepStatus(3);
  const step4Status = getStepStatus(4);

  return (
    <div className="space-y-6">
      {/* 顶部流水线执行步进指示器 (Live Stepper Indicator) */}
      <DeductionProgressStepper
        currentStage={currentStage}
        loading={loading}
      />

      {/* ========================================================================= */}
      {/* 🚀 STEP 1: MooMoo OpenD 实盘持仓、资产净值与自选股连通 */}
      {/* ========================================================================= */}
      <div className="relative overflow-hidden rounded-2xl space-y-4">
        <StepSyncOverlay
          status={step1Status}
          stepNumber={1}
          stepTitle="MooMoo OpenD 实盘持仓与资产连通"
          activeDetail={currentStage?.detail || "正在连接 127.0.0.1:11111 TCP 原生通道同步实盘资产、现金余额与持仓浮动盈亏..."}
          currentRunningStep={currentStep}
        />
        <div className={`space-y-4 transition-all duration-500 ${
          step1Status !== "DONE" ? "filter blur-[1px] select-none pointer-events-none opacity-40" : "filter blur-0 opacity-100"
        }`}>
          {/* 4 大核心资产 KPI 卡片 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Net Assets */}
            <div className="glass-card p-5 border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>总资产 Net Assets</span>
                <DollarSign className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-white tracking-tight">${netAssets.toFixed(2)}</div>
              <div className="mt-1 text-xs text-slate-400 flex items-center gap-1">
                <span>现金占比:</span>
                <span className="text-cyan-400 font-semibold">{((cashBalance / (netAssets || 1)) * 100).toFixed(1)}%</span>
              </div>
            </div>

            {/* Retrospective Accuracy */}
            <div className="glass-card p-5 border-slate-800 flex flex-col justify-between bg-indigo-950/20">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>前次推演预测准确率</span>
                <Award className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-indigo-300 tracking-tight">
                {latestRetro && latestRetro.accuracyScore !== undefined ? `${latestRetro.accuracyScore}%` : "暂无推演"}
              </div>
              <div className="mt-1 text-xs text-slate-400">
                {latestRetro && latestRetro.avoidedLoss ? `规避回调损失: $${latestRetro.avoidedLoss}` : "尚未产生复盘规避记录"}
              </div>
            </div>

            {/* Floating P&L */}
            <div className="glass-card p-5 border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>持仓浮动盈亏 P&L</span>
                <TrendingUp className={`w-4 h-4 ${isPnLPos ? "text-emerald-400" : "text-rose-400"}`} />
              </div>
              <div className={`mt-2 text-2xl font-bold tracking-tight ${isPnLPos ? "text-emerald-400" : "text-rose-400"}`}>
                {isPnLPos ? "+" : ""}${totalPnL.toFixed(2)}
              </div>
              <div className={`mt-1 text-xs font-semibold ${isPnLPos ? "text-emerald-400" : "text-rose-400"}`}>
                {isPnLPos ? "+" : ""}{totalPnLPct.toFixed(2)}%
              </div>
            </div>

            {/* Portfolio Risk & Budget KPI Card */}
            <div className="glass-card p-5 border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>调仓风控预算 Budget</span>
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-white tracking-tight">${customBudget}</div>
              <div className="mt-1 text-xs text-slate-400">
                风控偏好: <span className="text-cyan-300 font-semibold">{riskPreference === "BALANCED" ? "平衡型" : riskPreference === "CONSERVATIVE" ? "保守型" : "激进型"}</span>
              </div>
            </div>
          </div>

          {/* MooMoo OpenD 同步自选股 Quick Bar */}
          {watchlist && watchlist.length > 0 && (
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1.5">
              <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
                  <span>MooMoo OpenD 实时自选股池 ({watchlist.length} 标的)</span>
                </span>
                <span className="text-slate-500 text-[10px]">点击股票代码快速查看专属知识图谱</span>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {watchlist.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => onOpenKnowledgeGraph(item.symbol)}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-cyan-500/40 text-xs flex items-center gap-2 shrink-0 transition-all cursor-pointer"
                  >
                    <span className="font-bold text-white">{item.symbol}</span>
                    {item.companyName && item.companyName !== item.symbol && (
                      <span className="text-slate-400 text-[11px] truncate max-w-[90px]">{item.companyName}</span>
                    )}
                    {item.price && item.price > 0 ? (
                      <span className="text-emerald-400 font-medium">${item.price.toFixed(2)}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 🌐 STEP 2: SearXNG 全网宏观大盘动态与消息面全景 */}
      {/* ========================================================================= */}
      <div className="glass-card p-5 md:p-6 border-slate-800 bg-gradient-to-r from-slate-900/95 via-slate-900/75 to-indigo-950/25 relative overflow-hidden space-y-4 shadow-xl">
        <StepSyncOverlay
          status={step2Status}
          stepNumber={2}
          stepTitle="SearXNG 全网宏观与明星板块搜刮"
          activeDetail={currentStage?.detail || "正在通过 SearXNG 检索 Bloomberg/CNBC/Reuters 美股大盘走向、明星板块热点与宏观情绪..."}
          currentRunningStep={currentStep}
        />
        <div className={`space-y-4 transition-all duration-500 ${
          step2Status !== "DONE" ? "filter blur-[1px] select-none pointer-events-none opacity-40" : "filter blur-0 opacity-100"
        }`}>
          {/* Top Bar: Title + Sentiment Mood Badge + Star Sector Chips */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3.5 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shrink-0">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-base font-bold text-white tracking-tight">美股板块大盘动态 & SearXNG 消息面全景</h2>
                  {/* Market Sentiment Badge */}
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1.5 border ${
                    parsedMacroIntel.sentimentMood === "BULLISH"
                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                      : parsedMacroIntel.sentimentMood === "BEARISH"
                      ? "bg-rose-500/15 text-rose-300 border-rose-500/40"
                      : "bg-amber-500/15 text-amber-300 border-amber-500/40"
                  }`}>
                    <span className="w-2 h-2 rounded-full animate-pulse bg-current"></span>
                    <span>
                      {parsedMacroIntel.sentimentMood === "BULLISH"
                        ? `多头顺势 (${parsedMacroIntel.sentimentScore}分)`
                        : parsedMacroIntel.sentimentMood === "BEARISH"
                        ? `防守避险 (${parsedMacroIntel.sentimentScore}分)`
                        : `震荡分化 (${parsedMacroIntel.sentimentScore}分)`}
                    </span>
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  全网宏观情报 · Bloomberg/CNBC/Reuters 实时定调 · 自动注入个股推演
                </p>
              </div>
            </div>

            {/* Star Sectors Chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>明星主线:</span>
              </span>
              {parsedMacroIntel.starSectors.map((sector, i) => (
                <span
                  key={i}
                  className="px-2.5 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-cyan-300 font-medium hover:border-cyan-500/40 transition-all"
                >
                  {sector}
                </span>
              ))}
            </div>
          </div>

          {/* Headline Banner */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-cyan-500/20 text-xs text-slate-200 flex items-start gap-2.5">
            <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold shrink-0 mt-0.5">
              宏观定调
            </span>
            <span className="leading-relaxed font-medium text-slate-200">
              {parsedMacroIntel.summaryHeadline}
            </span>
          </div>

          {/* Body Grid: Left 7 Cols (News & Catalysts) + Right 5 Cols (Trading Directives & Prompt Injection) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left 7 Cols: 🔥 权威资讯精选与事件催化 */}
            <div className="lg:col-span-7 space-y-2.5">
              <div className="flex items-center justify-between text-xs text-slate-400 pb-1">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-cyan-400" />
                  <span>权威财经资讯精选 ({parsedMacroIntel.keyBulletPoints.length} 篇)</span>
                </span>
                <span className="text-[11px] text-slate-500">SearXNG 定向权威源</span>
              </div>

              {parsedMacroIntel.keyBulletPoints && parsedMacroIntel.keyBulletPoints.length > 0 ? (
                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                  {parsedMacroIntel.keyBulletPoints.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/90 text-xs space-y-1.5 hover:border-slate-700 transition-all"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-100 line-clamp-1 leading-snug">
                          {item.title}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-950/60 text-cyan-400 border border-cyan-800/40 shrink-0">
                          {item.source}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">
                        {item.snippet}
                      </p>
                      {item.url && (
                        <div className="flex justify-end pt-0.5">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold transition-all"
                          >
                            <span>阅读原文</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 italic text-center">
                  暂无检索到的宏观新闻，点击重新推演拉取。
                </div>
              )}
            </div>

            {/* Right 5 Cols: 🧭 今日操盘宏观指南与风控总纲 */}
            <div className="lg:col-span-5 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 pb-1">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>今日操盘宏观指南 & 纪律约束</span>
                </span>
                <span className="text-[11px] text-indigo-400 font-semibold">操盘总纲</span>
              </div>

              {/* 3 Directives Cards */}
              <div className="space-y-2">
                {/* 1. 策略定调 */}
                <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs flex items-start gap-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold shrink-0 mt-0.5">
                    策略基调
                  </span>
                  <span className="text-[11px] text-slate-200 font-semibold leading-relaxed">
                    {parsedMacroIntel.macroTradingStance.bias}
                  </span>
                </div>

                {/* 2. 仓位节奏 */}
                <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs flex items-start gap-2">
                  <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold shrink-0 mt-0.5">
                    仓位调控
                  </span>
                  <span className="text-[11px] text-slate-300 leading-relaxed">
                    {parsedMacroIntel.macroTradingStance.positionStrategy}
                  </span>
                </div>

                {/* 3. 风控防线 */}
                <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs flex items-start gap-2">
                  <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold shrink-0 mt-0.5">
                    风险防范
                  </span>
                  <span className="text-[11px] text-rose-300/90 leading-relaxed">
                    {parsedMacroIntel.macroTradingStance.riskWarning}
                  </span>
                </div>
              </div>

              {/* Downstream Prompt Injection Terminal Card */}
              <div className="p-3 bg-slate-950/95 rounded-xl border border-cyan-500/30 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-slate-400 pb-1 border-b border-slate-800">
                  <span className="flex items-center gap-1 font-mono text-cyan-400">
                    <Sparkles className="w-3 h-3" />
                    <span>个股推演注入 Context (Prompt)</span>
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    已注入 Step 3~4
                  </span>
                </div>
                <p className="text-[11px] font-mono text-slate-300/90 leading-relaxed bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
                  {parsedMacroIntel.distilledPromptContext}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 🎯 STEP 3 & 4: 标的多维挖掘 (Left 2 Cols) + 实盘持仓调仓决策矩阵 (Right 1 Col) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Per-Stock Unified Core Elements (Step 3 标的多维挖掘同步) */}
        <div className="lg:col-span-2 space-y-4 relative overflow-hidden rounded-2xl">
          <StepSyncOverlay
            status={step3Status}
            stepNumber={3}
            stepTitle="候选池构建与标的多维消歧挖掘"
            activeDetail={currentStage?.detail || "正在聚合候选池，对标的单独消歧挖掘重磅新闻、社区情绪、主力资金与知识图谱装载..."}
            currentRunningStep={currentStep}
          />
          <div className={`space-y-4 transition-all duration-500 ${
            step3Status !== "DONE" ? "filter blur-[1px] select-none pointer-events-none opacity-40" : "filter blur-0 opacity-100"
          }`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-cyan-400" />
                  <span>持仓及清仓标的【知识图谱 + 盘面 + 社区情绪 + 历史教训】推演</span>
                </h3>
                {loading && (
                  <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-xs font-semibold animate-pulse flex items-center gap-1">
                    <RefreshCw className="w-3 h-3 animate-spin text-cyan-400" />
                    Context 融合推理中...
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Category Filter Tabs */}
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                  <button
                    onClick={() => setFilterCategory("ALL")}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                      filterCategory === "ALL" ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    全部标的 ({perStockItems.length})
                  </button>
                  <button
                    onClick={() => setFilterCategory("HOLDING")}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                      filterCategory === "HOLDING" ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    当前持仓 ({holdingCount})
                  </button>
                  <button
                    onClick={() => setFilterCategory("CLEARED")}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                      filterCategory === "CLEARED" ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    既往清仓 ({clearedCount})
                  </button>
                </div>
              </div>
            </div>

            {/* 5大策略分类导航过滤栏 */}
            <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
              <span className="text-[11px] text-slate-400 font-bold px-1.5 flex items-center gap-1">
                <span>🎯 策略分类:</span>
              </span>
              {[
                { id: "ALL", label: `全部策略 (${perStockItems.length})`, icon: "🌐" },
                { id: "OVERSOLD_BUY", label: `超跌建仓 (${oversoldCount})`, icon: "📉", color: "text-cyan-300" },
                { id: "FUNDAMENTAL_BUY", label: `基本面亮眼 (${fundamentalCount})`, icon: "💎", color: "text-emerald-300" },
                { id: "NEWS_CATALYST_BUY", label: `消息面强劲 (${newsCount})`, icon: "🚀", color: "text-indigo-300" },
                { id: "CAPITAL_INFLOW_BUY", label: `大资金进入 (${capitalCount})`, icon: "🏦", color: "text-amber-300" },
                { id: "WATCH_AND_WAIT", label: `可以观望 (${watchCount})`, icon: "👀", color: "text-slate-400" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setStrategyFilter(cat.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    strategyFilter === cat.id
                      ? "bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20"
                      : "bg-slate-900/90 text-slate-400 hover:text-white border border-slate-800"
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {filteredItems.length > 0 ? (
                filteredItems.map((item, idx) => (
                  <PerStockDeductionRetroCard
                    key={idx}
                    item={item}
                    onOpenKnowledgeGraph={onOpenKnowledgeGraph}
                  />
                ))
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs glass-card border-slate-800">
                  当前筛选分类无符合标的
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Col: 仓位加减控制器 & 实盘持仓调仓决策矩阵 */}
        <div className="space-y-6">
          {/* Position Sizer Calculator */}
          <div className="glass-card p-6 border-slate-800 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-cyan-400" />
                <span>持仓加减控制总揽 (Sizer)</span>
              </h3>
            </div>

            {/* Budget Slider */}
            <div className="space-y-2 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>调仓资金预算 (Budget)</span>
                <span className="font-bold text-cyan-400 text-sm">${customBudget}</span>
              </div>
              <input
                type="range"
                min="100"
                max="5000"
                step="100"
                value={customBudget}
                onChange={(e) => setCustomBudget(Number(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            {/* Risk Preference Toggle */}
            <div className="space-y-2">
              <span className="text-xs text-slate-400 block">风险偏好 (Risk Tolerance)</span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: "CONSERVATIVE", label: "保守" },
                  { key: "BALANCED", label: "平衡" },
                  { key: "AGGRESSIVE", label: "激进" },
                ].map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setRiskPreference(item.key)}
                    className={`py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      riskPreference === item.key
                        ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Execute Deduction Button */}
            <button
              onClick={() => onExecuteRebalance(customBudget, riskPreference)}
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                  <span>⚡ 正在执行 Step 1~5 串行推演...</span>
                </>
              ) : (
                <span>重新推演实盘持仓调仓决策</span>
              )}
            </button>
          </div>

          {/* Real-time Position Rebalance Matrix (Step 4 Ollama 大模型融合推演同步) */}
          <div className="glass-card p-6 border-slate-800 space-y-4 relative overflow-hidden">
            <StepSyncOverlay
              status={step4Status}
              stepNumber={4}
              stepTitle="Ollama 大模型融合推演"
              activeDetail={currentStage?.detail || "Ollama 大模型正在执行 Map-Reduce 分段推理，计算定量调仓建议与止盈止损防线..."}
              currentRunningStep={currentStep}
            />
            <div className={`space-y-4 transition-all duration-500 ${
              step4Status !== "DONE" ? "filter blur-[1px] select-none pointer-events-none opacity-40" : "filter blur-0 opacity-100"
            }`}>
              <h3 className="text-base font-semibold text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-400" />
                  <span>实盘持仓调仓决策矩阵</span>
                </div>
                <span className="text-xs text-slate-400 font-mono">({perStockItems.length} 标的)</span>
              </h3>
              <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                {perStockItems.length > 0 ? (
                  perStockItems.map((item, idx) => {
                    const rec =
                      item.currentRecommendation ||
                      screenerActions?.find((a: any) => a.symbol.toUpperCase() === item.symbol.toUpperCase()) ||
                      rebalanceActions?.find((a: any) => a.symbol.toUpperCase() === item.symbol.toUpperCase());
                    const isBuy = rec?.action === "BUY";
                    const isTrim = rec?.action === "TRIM" || rec?.action === "SELL";
                    return (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1.5 hover:border-slate-700 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white flex items-center gap-1.5 flex-wrap">
                            <span>{item.symbol}</span>
                            {item.strategyCategoryLabel && (
                              <span className="text-[10px] font-semibold text-cyan-300 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                                {item.strategyCategoryLabel.split(" ")[0]} {item.strategyCategoryLabel.split(" ")[1]}
                              </span>
                            )}
                            <span className="text-[11px] font-normal text-slate-400 truncate max-w-[80px]">
                              {item.companyName}
                            </span>
                          </span>
                          {rec ? (
                            <span
                              className={`px-2 py-0.5 rounded font-bold text-[11px] shrink-0 ${
                                isBuy
                                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                                  : isTrim
                                  ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                                  : "bg-slate-800 text-slate-300 border border-slate-700"
                              }`}
                            >
                              {rec.action} ({rec.suggestedShares}股)
                            </span>
                          ) : step4Status === "ACTIVE" ? (
                            <span className="text-cyan-400 text-[11px] font-semibold animate-pulse flex items-center gap-1 shrink-0">
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              <span>推演中...</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded font-bold text-[11px] bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
                              HOLD (0股)
                            </span>
                          )}
                        </div>
                        {item.strategyCategoryReason && (
                          <p className="text-[11px] text-cyan-300/80 leading-tight">
                            🎯 {item.strategyCategoryReason}
                          </p>
                        )}
                        {item.pastRetro?.distilledLesson && (
                          <p className="text-[11px] text-indigo-300/90 leading-tight border-t border-slate-900 pt-1">
                            💡 纪律: {item.pastRetro.distilledLesson}
                          </p>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-slate-500 text-xs italic">暂无实盘持仓调仓矩阵</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
