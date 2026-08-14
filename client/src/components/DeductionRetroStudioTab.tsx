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
import { MacroSectorStudioCard } from "./MacroSectorStudioCard";

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
  macroSnapshot?: any;
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
      <div className="absolute inset-0 z-20 backdrop-blur-md bg-slate-950/90 rounded-2xl flex flex-col items-center justify-center p-4 text-center border border-cyan-500/40 animate-fade-in shadow-2xl">
        <div className="p-2 rounded-xl bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 mb-2 shadow-md shadow-cyan-500/30 animate-pulse">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 uppercase tracking-wide">
            ⚡ Step {stepNumber} 正在实时执行
          </span>
          <span className="text-xs text-white font-bold">{stepTitle}</span>
        </div>
        <p className="text-xs text-slate-300 mt-1 max-w-md font-medium leading-relaxed">
          {activeDetail || "正在调用底层接口与大模型处理数据..."}
        </p>
        <div className="mt-2 flex items-center gap-2 px-3 py-0.5 rounded-full bg-slate-900/90 border border-slate-800 text-[11px] text-cyan-400 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
          <span>阶段实时处理中 · 稍候自动进入下一环节</span>
        </div>
      </div>
    );
  }

  // PENDING (排队等待中)
  return (
    <div className="absolute inset-0 z-10 backdrop-blur-sm bg-slate-950/70 rounded-2xl flex flex-col items-center justify-center p-3 text-center border border-slate-800/80 animate-fade-in">
      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/90 border border-slate-800 text-xs text-slate-400 font-medium shadow-md">
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
  const [filterCategory, setFilterCategory] = useState<"ALL" | "REBALANCE" | "HOLDING" | "WATCHLIST" | "CLEARED">("ALL");

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

  // 1. 判定标的是否为当前实盘持有 (持股 > 0)
  const isHolding = (item: any) => {
    return !!(item.position && item.position.shares > 0);
  };

  // 2. 判定标的是否为既往清仓 (实盘曾经买过且当前持股为 0，严格排除纯自选/候选标的)
  const isCleared = (item: any) => {
    if (item.candidateCategory === "WATCHLIST" || item.candidateCategory === "MACRO_CANDIDATE") {
      return false;
    }
    return !!(item.isCleared || (item.position && item.position.shares === 0));
  };

  // 3. 判定标的是否为自选/候选关注 (非持仓且非清仓)
  const isWatchlist = (item: any) => {
    if (isHolding(item) || isCleared(item)) return false;
    return item.candidateCategory === "WATCHLIST" || item.candidateCategory === "MACRO_CANDIDATE" || !item.position;
  };

  // 4. 判定标的是否具备明确的调仓动作 (建仓/加仓 BUY、减仓 TRIM、清仓 SELL/CLEAR，严格排除 HOLD / 观望)
  const isActionable = (item: any) => {
    const rec =
      item.currentRecommendation ||
      screenerActions?.find((a: any) => a.symbol.toUpperCase() === item.symbol.toUpperCase()) ||
      rebalanceActions?.find((a: any) => a.symbol.toUpperCase() === item.symbol.toUpperCase());
    
    if (rec && rec.action) {
      const act = rec.action.toUpperCase();
      if (act === "BUY" || act === "TRIM" || act === "SELL" || act === "CLEAR") {
        return true;
      }
      if (act === "HOLD") {
        return false;
      }
    }

    const kgAction = (item.knowledgeGraph?.actionAdvice || "").toUpperCase();
    if (kgAction === "BUY" || kgAction === "TRIM" || kgAction === "SELL" || kgAction === "CLEAR") {
      return true;
    }

    return false;
  };

  const rebalanceCount = useMemo(
    () => perStockItems.filter(isActionable).length,
    [perStockItems, screenerActions, rebalanceActions]
  );
  const holdingCount = useMemo(
    () => perStockItems.filter(isHolding).length,
    [perStockItems]
  );
  const watchlistCount = useMemo(
    () => perStockItems.filter(isWatchlist).length,
    [perStockItems]
  );
  const clearedCount = useMemo(
    () => perStockItems.filter(isCleared).length,
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
    // 1. 状态/池子归属与调仓意图过滤 (全部 / 需要调仓 / 持仓 / 自选关注 / 既往清仓)
    if (filterCategory === "REBALANCE") {
      if (!isActionable(item)) return false;
    } else if (filterCategory === "HOLDING") {
      if (!isHolding(item)) return false;
    } else if (filterCategory === "WATCHLIST") {
      if (!isWatchlist(item)) return false;
    } else if (filterCategory === "CLEARED") {
      if (!isCleared(item)) return false;
    }

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
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 🌐 STEP 2: 全网宏观大盘与 11 大行业板块量化中枢 (紧凑罗盘 + 3 维度穿透) */}
      {/* ========================================================================= */}
      <MacroSectorStudioCard
        macroIntel={parsedMacroIntel}
        liveMacroSnapshot={parsedMacroIntel?.macroSnapshot}
        loading={loading && step2Status === "ACTIVE"}
        currentStage={currentStage}
        stepStatus={step2Status}
        holdingSymbols={perStockItems.filter(isHolding).map((i) => i.symbol)}
      />

      {/* ========================================================================= */}
      {/* 🎯 STEP 3 & 4: 统一候选池与持仓多维推演 */}
      {/* ========================================================================= */}
      <div className="space-y-4 rounded-2xl">
        <div className="space-y-4">
          {/* 1. 大标题与推演状态 */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2 flex-wrap">
                  <span>持仓及候选标的【知识图谱 + 盘面 + 社区情绪 + 历史教训】推演</span>
                  <span className="text-xs font-normal text-slate-400 font-mono">
                    (涵盖持仓 · 24h清仓 · 自选关注 · 候选挖掘 共 {perStockItems.length} 标的)
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  全要素多维消歧 · 知识图谱因果传导 · 盘面异动 · 社区情绪 · 大资金动向 · 历史风控教训
                </p>
              </div>
            </div>

            {loading && (
              <span className="px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-xs font-semibold animate-pulse flex items-center gap-1.5 shrink-0">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                <span>全要素模型推演中...</span>
              </span>
            )}
          </div>

          {/* 2. 持仓加减控制总揽 (Sizer) —— 紧凑横向通栏设计，位于标题下方、策略分类上方 */}
          <div className="p-3 md:p-3.5 rounded-xl bg-slate-950/90 border border-cyan-500/25 shadow-lg shadow-cyan-500/5 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Sizer 标题与图标 */}
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <Sliders className="w-4 h-4" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-bold text-white">持仓加减控制 (Sizer)</span>
                  <span className="text-[11px] text-slate-400 hidden sm:inline">· 风控资金与模型偏好实时调配</span>
                </div>
              </div>

              {/* 预算调节滑块与数值显示 */}
              <div className="flex items-center gap-2.5 bg-slate-900/90 px-3 py-1 rounded-lg border border-slate-800">
                <span className="text-[11px] text-slate-400 font-semibold shrink-0">调仓资金预算:</span>
                <input
                  type="range"
                  min="100"
                  max="5000"
                  step="100"
                  value={customBudget}
                  onChange={(e) => setCustomBudget(Number(e.target.value))}
                  className="w-24 md:w-32 accent-cyan-400 cursor-pointer h-1.5"
                />
                <span className="text-xs font-bold text-cyan-400 font-mono">${customBudget}</span>
              </div>

              {/* 风险偏好切换 */}
              <div className="flex items-center gap-1 bg-slate-900/90 p-0.5 rounded-lg border border-slate-800 text-xs">
                <span className="text-[10px] text-slate-400 px-1 font-semibold">风控:</span>
                {[
                  { key: "CONSERVATIVE", label: "保守" },
                  { key: "BALANCED", label: "平衡" },
                  { key: "AGGRESSIVE", label: "激进" },
                ].map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setRiskPreference(item.key)}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                      riskPreference === item.key
                        ? "bg-cyan-500 text-slate-950 font-bold shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* 执行重新推演按钮 */}
              <button
                onClick={() => onExecuteRebalance(customBudget, riskPreference)}
                disabled={loading}
                className="px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shrink-0"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-950" />
                    <span>推演中...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 text-slate-950" />
                    <span>重新推演实盘调仓决策</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 3. 标签组 (池子归属标签 + 5大策略分类导航过滤栏) */}
          <div className="space-y-2">
            {/* 3.1 标的池归属标签组 (全部标的 / 需要调仓 / 当前持仓 / 自选关注 / 既往清仓) */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-slate-400 font-bold px-1 flex items-center gap-1">
                  <span>📂 标的分类:</span>
                </span>
                <button
                  onClick={() => setFilterCategory("ALL")}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    filterCategory === "ALL"
                      ? "bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20"
                      : "text-slate-400 hover:text-white bg-slate-900 border border-slate-800"
                  }`}
                >
                  全部标的 ({perStockItems.length})
                </button>

                {/* 🌟 核心调仓过滤标签：需要调仓 (加仓/减仓/建仓/清仓) */}
                <button
                  onClick={() => setFilterCategory("REBALANCE")}
                  className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    filterCategory === "REBALANCE"
                      ? "bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/30 ring-1 ring-emerald-400"
                      : "text-emerald-400 hover:text-emerald-300 bg-emerald-950/40 border border-emerald-500/40"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>⚡ 需要调仓 ({rebalanceCount})</span>
                </button>

                <button
                  onClick={() => setFilterCategory("HOLDING")}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    filterCategory === "HOLDING"
                      ? "bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20"
                      : "text-slate-400 hover:text-white bg-slate-900 border border-slate-800"
                  }`}
                >
                  当前持仓 ({holdingCount})
                </button>
                <button
                  onClick={() => setFilterCategory("WATCHLIST")}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    filterCategory === "WATCHLIST"
                      ? "bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20"
                      : "text-slate-400 hover:text-white bg-slate-900 border border-slate-800"
                  }`}
                >
                  自选关注 ({watchlistCount})
                </button>
                <button
                  onClick={() => setFilterCategory("CLEARED")}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    filterCategory === "CLEARED"
                      ? "bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20"
                      : "text-slate-400 hover:text-white bg-slate-900 border border-slate-800"
                  }`}
                >
                  既往清仓 ({clearedCount})
                </button>
              </div>

              <div className="text-[11px] text-slate-400 font-mono hidden md:block">
                已过滤显示: <strong className="text-cyan-400">{filteredItems.length}</strong> / {perStockItems.length} 标的
              </div>
            </div>

            {/* 3.2 5大策略分类导航过滤栏 */}
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
          </div>

          {/* 4. 统一股票列表展示区 (全通栏自包含结构，实盘调仓决策与多维推演卡片深度融合) */}
          <div className="space-y-4">
            {loading && (step3Status !== "DONE" || step4Status !== "DONE") ? (
              /* 🌟 紧凑优雅的推演阶段进度卡片，避免出现大面积空黑留白 */
              <div className="py-7 px-5 rounded-2xl bg-slate-950/90 backdrop-blur-md border border-cyan-500/30 flex flex-col items-center justify-center text-center shadow-2xl space-y-2.5 max-w-xl mx-auto my-2 animate-fade-in">
                <div className="p-2.5 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 shadow-md shadow-cyan-500/20 animate-pulse">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 uppercase tracking-wide">
                    ⚡ Step {step3Status !== "DONE" ? 3 : 4} 正在实时执行
                  </span>
                  <span className="text-xs text-white font-bold">
                    {step3Status !== "DONE" ? "候选池构建与标的多维消歧挖掘" : "Ollama 大模型融合推演与决策"}
                  </span>
                </div>
                <p className="text-xs text-slate-300 max-w-md font-medium leading-relaxed">
                  {currentStage?.detail || "正在聚合全要素候选池，深度执行图谱推理、多因子分类与定量调仓决策..."}
                </p>
                <div className="flex items-center gap-2 px-3 py-0.5 rounded-full bg-slate-900/90 border border-slate-800 text-[11px] text-cyan-400 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
                  <span>阶段实时处理中 · 稍候自动呈现推演卡片</span>
                </div>
              </div>
            ) : filteredItems.length > 0 ? (
              filteredItems.map((item, idx) => (
                <PerStockDeductionRetroCard
                  key={idx}
                  item={item}
                  onOpenKnowledgeGraph={onOpenKnowledgeGraph}
                />
              ))
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs glass-card border-slate-800 space-y-1.5">
                <div className="text-sm font-semibold text-slate-300">
                  {filterCategory === "REBALANCE"
                    ? "当前暂无需要加减仓位或建仓的标的"
                    : "当前筛选标签下暂无匹配标的"}
                </div>
                <p className="text-slate-500">
                  {filterCategory === "REBALANCE"
                    ? "模型判定当前持仓与自选标的均处于合理区间或观望状态，可点击“重新推演”或切换至“全部标的”查看"
                    : "可切换至“全部标的”或“全部策略”查看全局推演候选池"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
