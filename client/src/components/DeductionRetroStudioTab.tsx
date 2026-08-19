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
  Search,
  ArrowUpDown,
  Filter,
  SlidersHorizontal,
  Target,
  Lock,
  Copy,
  Check,
  Moon,
  ClipboardList,
  CheckCircle2,
} from "lucide-react";
import { formatOrderSlipText } from "../utils/orderSlipFormatter";
import { DeductionProgressStepper, StageStep } from "./DeductionProgressStepper";
import { PerStockDeductionRetroCard } from "./PerStockDeductionRetroCard";
import { MacroSectorStudioCard } from "./MacroSectorStudioCard";
import { SingleStockDeductionModal } from "./SingleStockDeductionModal";
import { RetrospectiveTab } from "./RetrospectiveTab";

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
      summaryHeadline: "全网最新时态资讯检索就绪，大盘维持基准平稳震荡动向。",
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
        title: "美股大盘全网最新资讯摘要",
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
  openDConnected?: boolean;
  searxngConnected?: boolean;
  ollamaStatus?: {
    connected: boolean;
    models: string[];
    recommendedModel: string;
    message: string;
  };
  selectedOllamaModel?: string;
  onRefreshStatus?: () => void;
  onStartDeduction?: () => void;
  liveDeductionPipeline?: any;
  onOpenDeductionModal?: (symbol?: string) => void;
  prudexCompass?: any;
  dualLevelMemory?: any;
  marketSession?: {
    easternTimeStr: string;
    localTimeStr: string;
    isTradingDay: boolean;
    marketPhase: string;
    phaseLabel: string;
    phaseDescription: string;
    activeRoleName: string;
    timeToNextBellMinutes: number;
    countdownLabel: string;
    currentTradingDay: string;
    nextTradingDay: string;
    isSimulated?: boolean;
  } | null;
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
  openDConnected = false,
  searxngConnected = false,
  ollamaStatus = { connected: false, models: [], recommendedModel: "", message: "" },
  selectedOllamaModel = "",
  onRefreshStatus,
  onStartDeduction,
  liveDeductionPipeline,
  onOpenDeductionModal,
  prudexCompass,
  dualLevelMemory,
  marketSession,
}) => {
  const [customBudget, setCustomBudget] = useState<number>(1000);
  const [riskPreference, setRiskPreference] = useState<string>("BALANCED");
  const [studioView, setStudioView] = useState<"STUDIO" | "PRUDEX_RETRO">("STUDIO");
  const [filterCategory, setFilterCategory] = useState<
    "ALL" | "HIGH_CERTAINTY" | "REBALANCE" | "HOLDING" | "WATCHLIST" | "EXPERIENCE" | "LESSON" | "CLEARED"
  >("ALL");
  const [strategyFilter, setStrategyFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"CERTAINTY_DESC" | "GOAL_PROB_DESC" | "ALLOCATION_DESC" | "PNL_DESC" | "SYMBOL_ASC">("CERTAINTY_DESC");
  const [searchStockQuery, setSearchStockQuery] = useState<string>("");
  const [selectedStockForModal, setSelectedStockForModal] = useState<any | null>(null);

  // 4 大核心环境就绪状态判断
  const ollamaReady = !!ollamaStatus?.connected && Array.isArray(ollamaStatus?.models) && ollamaStatus.models.length > 0;
  const isAllPreflightReady = openDConnected && searxngConnected && ollamaReady && isUnlocked;

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

  // 🌟 计算当前已完成大模型推理的标的 Set
  const completedSymbols = useMemo(() => {
    if (!liveDeductionPipeline || !Array.isArray(liveDeductionPipeline.traces)) {
      return new Set<string>();
    }
    return new Set<string>(
      liveDeductionPipeline.traces
        .map((t: any) => t.symbol?.toUpperCase())
        .filter(Boolean)
    );
  }, [liveDeductionPipeline]);

  // 从当前阶段日志中提取正在计算的标的代码
  const activeComputingSymbol = useMemo(() => {
    if (!currentStage || currentStage.step !== 4) return undefined;
    const match = currentStage.detail?.match(/\[([A-Z0-9.\-_]+)\]/);
    return match ? match[1] : undefined;
  }, [currentStage]);

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

  // 5. 判定标的是否属于高确定性精选重仓 (得分 >= 75 或建议买入)
  const isHighCertainty = (item: any) => {
    const score = item.currentRecommendation?.certaintyScore ?? 0;
    const isBuy = item.currentRecommendation?.action === "BUY" && (item.currentRecommendation?.suggestedShares || 0) > 0;
    return score >= 75 || isBuy;
  };

  // 6. 判定历史核验结果
  const isExperience = (item: any) => item.pastRetro?.verificationOutcome === "EXPERIENCE";
  const isLesson = (item: any) => item.pastRetro?.verificationOutcome === "LESSON";

  // 各分类数量动态统计
  const highCertaintyCount = useMemo(() => perStockItems.filter(isHighCertainty).length, [perStockItems]);
  const rebalanceCount = useMemo(() => perStockItems.filter(isActionable).length, [perStockItems, screenerActions, rebalanceActions]);
  const holdingCount = useMemo(() => perStockItems.filter(isHolding).length, [perStockItems]);
  const watchlistCount = useMemo(() => perStockItems.filter(isWatchlist).length, [perStockItems]);
  const experienceCount = useMemo(() => perStockItems.filter(isExperience).length, [perStockItems]);
  const lessonCount = useMemo(() => perStockItems.filter(isLesson).length, [perStockItems]);
  const clearedCount = useMemo(() => perStockItems.filter(isCleared).length, [perStockItems]);

  const oversoldCount = useMemo(() => perStockItems.filter((item) => item.strategyCategory === "OVERSOLD_BUY").length, [perStockItems]);
  const fundamentalCount = useMemo(() => perStockItems.filter((item) => item.strategyCategory === "FUNDAMENTAL_BUY").length, [perStockItems]);
  const newsCount = useMemo(() => perStockItems.filter((item) => item.strategyCategory === "NEWS_CATALYST_BUY").length, [perStockItems]);
  const capitalCount = useMemo(() => perStockItems.filter((item) => item.strategyCategory === "CAPITAL_INFLOW_BUY").length, [perStockItems]);
  const watchCount = useMemo(() => perStockItems.filter((item) => item.strategyCategory === "WATCH_AND_WAIT").length, [perStockItems]);

  const filteredItems = useMemo(() => {
    let result = perStockItems.filter((item) => {
      // 1. 搜索关键词匹配
      if (searchStockQuery) {
        const q = searchStockQuery.toLowerCase().trim();
        const symMatch = item.symbol?.toLowerCase().includes(q);
        const nameMatch = item.companyName?.toLowerCase().includes(q);
        if (!symMatch && !nameMatch) return false;
      }

      // 2. 状态/决策与确定性池子过滤
      if (filterCategory === "HIGH_CERTAINTY") {
        if (!isHighCertainty(item)) return false;
      } else if (filterCategory === "REBALANCE") {
        if (!isActionable(item)) return false;
      } else if (filterCategory === "HOLDING") {
        if (!isHolding(item)) return false;
      } else if (filterCategory === "WATCHLIST") {
        if (!isWatchlist(item)) return false;
      } else if (filterCategory === "EXPERIENCE") {
        if (!isExperience(item)) return false;
      } else if (filterCategory === "LESSON") {
        if (!isLesson(item)) return false;
      } else if (filterCategory === "CLEARED") {
        if (!isCleared(item)) return false;
      }

      // 3. 5大策略分类过滤
      if (strategyFilter !== "ALL" && item.strategyCategory !== strategyFilter) return false;

      return true;
    });

    // 4. 多维度智能排序
    result = [...result].sort((a, b) => {
      if (sortBy === "CERTAINTY_DESC") {
        const scoreA = a.currentRecommendation?.certaintyScore ?? (isHighCertainty(a) ? 80 : 50);
        const scoreB = b.currentRecommendation?.certaintyScore ?? (isHighCertainty(b) ? 80 : 50);
        return scoreB - scoreA;
      }
      if (sortBy === "GOAL_PROB_DESC") {
        const probA = a.currentRecommendation?.goalAttainmentProbability ?? 50;
        const probB = b.currentRecommendation?.goalAttainmentProbability ?? 50;
        return probB - probA;
      }
      if (sortBy === "ALLOCATION_DESC") {
        const amtA = (a.currentRecommendation?.suggestedShares || 0) * (a.currentRecommendation?.estimatedPrice || a.position?.marketPrice || 0);
        const amtB = (b.currentRecommendation?.suggestedShares || 0) * (b.currentRecommendation?.estimatedPrice || b.position?.marketPrice || 0);
        return amtB - amtA;
      }
      if (sortBy === "PNL_DESC") {
        const pnlA = a.position ? (a.position.marketPrice - a.position.costBasis) * a.position.shares : -999999;
        const pnlB = b.position ? (b.position.marketPrice - b.position.costBasis) * b.position.shares : -999999;
        return pnlB - pnlA;
      }
      if (sortBy === "SYMBOL_ASC") {
        return a.symbol.localeCompare(b.symbol);
      }
      return 0;
    });

    return result;
  }, [perStockItems, filterCategory, strategyFilter, sortBy, searchStockQuery, screenerActions, rebalanceActions]);

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

  // 🌟 上班族 30 秒操盘：过滤出今晚真正需要挂单执行的标的 (BUY / TRIM / SELL)
  const [copiedSlipSymbol, setCopiedSlipSymbol] = useState<string | null>(null);
  const tonightActionableList = useMemo(() => {
    return perStockItems
      .filter((item) => {
        const rec = item.currentRecommendation;
        if (!rec) return false;
        const act = rec.action;
        return (act === "BUY" && (rec.suggestedShares || 0) > 0) || act === "TRIM" || act === "SELL";
      })
      .map((item) => {
        const rec = item.currentRecommendation;
        return {
          symbol: item.symbol,
          companyName: item.companyName,
          action: rec.action,
          actionType: (rec as any).actionType,
          suggestedShares: rec.suggestedShares,
          estimatedPrice: rec.estimatedPrice || item.position?.marketPrice || 0,
          estimatedAmount: rec.estimatedAmount,
          entryZone: rec.entryZone,
          stopLossPrice: rec.stopLossPrice,
          targetPrice: rec.targetPrice,
          whySummary: rec.whySummary || rec.rationale || item.strategyCategoryReason,
        };
      });
  }, [perStockItems]);

  const handleCopySingleSlip = (item: any) => {
    const slip = formatOrderSlipText(item);
    navigator.clipboard.writeText(slip);
    setCopiedSlipSymbol(item.symbol);
    setTimeout(() => setCopiedSlipSymbol(null), 2000);
  };

  const handleCopyAllSlips = () => {
    if (tonightActionableList.length === 0) return;
    const allText = tonightActionableList
      .map((item) => formatOrderSlipText(item))
      .join("\n\n------------------------\n\n");
    navigator.clipboard.writeText(allText);
    setCopiedSlipSymbol("ALL");
    setTimeout(() => setCopiedSlipSymbol(null), 2500);
  };

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
        liveDeductionPipeline={liveDeductionPipeline}
        onOpenDeductionModal={onOpenDeductionModal}
      />

      {/* 🌟 美股交易时态与大模型使命战略横幅 */}
      {marketSession && (
        <div className={`p-4 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-lg transition-all ${
          marketSession.marketPhase === "PRE_MARKET"
            ? "bg-gradient-to-r from-amber-950/40 via-slate-900 to-amber-950/20 border-amber-500/30"
            : marketSession.marketPhase === "INTRADAY"
            ? "bg-gradient-to-r from-emerald-950/40 via-slate-900 to-emerald-950/20 border-emerald-500/30"
            : marketSession.marketPhase === "POST_MARKET"
            ? "bg-gradient-to-r from-indigo-950/40 via-slate-900 to-indigo-950/20 border-indigo-500/30"
            : "bg-slate-900/90 border-slate-800"
        }`}>
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800 shrink-0 mt-0.5 shadow-inner">
              <Compass className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm text-white">{marketSession.phaseLabel}</span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                  AI角色: {marketSession.activeRoleName}
                </span>
                {marketSession.isSimulated && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                    ⚡ 时空穿梭模拟模式
                  </span>
                )}
                <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                  • {marketSession.countdownLabel}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                {marketSession.phaseDescription}
              </p>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-2 text-xs font-mono bg-slate-950/80 px-3.5 py-1.5 rounded-xl border border-slate-800 text-slate-300 self-end md:self-auto">
            <span className="text-slate-400">美东时间:</span>
            <span className="text-cyan-300 font-bold">{marketSession.easternTimeStr}</span>
          </div>
        </div>
      )}

      {/* 🌟 操盘推演中枢 vs PRUDEX 6维质量评估与双层原则库 切换 Tab */}
      <div className="flex items-center justify-between gap-3 p-1.5 rounded-2xl bg-slate-950/80 border border-slate-800">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setStudioView("STUDIO")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              studioView === "STUDIO"
                ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                : "text-slate-400 hover:text-white bg-slate-900/60"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>🎯 今日实盘推演与决策中枢 (Daily Deduction Studio)</span>
          </button>
          <button
            onClick={() => setStudioView("PRUDEX_RETRO")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              studioView === "PRUDEX_RETRO"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20 ring-1 ring-indigo-400"
                : "text-slate-400 hover:text-white bg-slate-900/60"
            }`}
          >
            <Compass className="w-4 h-4 text-indigo-400" />
            <span>🧭 PRUDEX 6维体检 & FinAgent 原则库 (Retro & Quality Radar)</span>
          </button>
        </div>
      </div>

      {studioView === "PRUDEX_RETRO" ? (
        <RetrospectiveTab
          retrospectives={retrospectives}
          loading={loading}
          onTriggerRetro={onStartDeduction || (() => {})}
          prudexCompass={prudexCompass}
          dualLevelMemory={dualLevelMemory}
        />
      ) : (
        <>
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

      {/* 🌟 上班族极简 30 秒操盘看板 (Tonight's Action Checklist) */}
      <div className="p-4 md:p-5 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950/20 border border-cyan-500/30 shadow-xl shadow-cyan-950/20 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-inner">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-white text-sm">🌙 今晚操盘小抄 (Tonight's Action Checklist)</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                  {tonightActionableList.length > 0 ? `需执行 ${tonightActionableList.length} 笔挂单` : "无需挂单 · 安稳持仓"}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                面向下班看盘的上班族，抹平认知负荷，直接输出可对着券商 App 复制的限价指令
              </p>
            </div>
          </div>

          {tonightActionableList.length > 0 && (
            <button
              onClick={handleCopyAllSlips}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-md cursor-pointer ${
                copiedSlipSymbol === "ALL"
                  ? "bg-emerald-500 text-slate-950 border-emerald-400"
                  : "bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white border-cyan-400/40 hover:scale-105"
              }`}
            >
              {copiedSlipSymbol === "ALL" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSlipSymbol === "ALL" ? "✓ 全部挂单小抄已复制" : "📋 复制今晚全部挂单小抄"}</span>
            </button>
          )}
        </div>

        {tonightActionableList.length === 0 ? (
          <div className="flex items-center gap-3 py-2 text-xs text-slate-300">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-emerald-300">持仓均处于健康观察区间，今晚无高胜率建仓/减仓信号。</span>
              <span className="text-slate-400 ml-1.5">无需在券商进行任何操作，安稳睡觉。</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {tonightActionableList.map((act) => {
              const isBuy = act.action === "BUY";
              const isTrim = act.action === "TRIM" || act.action === "SELL";
              const isCopied = copiedSlipSymbol === act.symbol;

              return (
                <div
                  key={act.symbol}
                  className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-cyan-500/40 transition-all flex flex-col justify-between gap-2.5 shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{act.symbol}</span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                            isBuy
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                              : isTrim
                              ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                              : "bg-slate-800 text-slate-300 border-slate-700"
                          }`}
                        >
                          {isBuy ? `🟢 建仓 ${act.suggestedShares}股` : `🟡 减仓 ${act.suggestedShares}股`}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate max-w-[180px] mt-0.5">
                        {act.companyName || act.symbol}
                      </p>
                    </div>

                    <button
                      onClick={() => handleCopySingleSlip(act)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border cursor-pointer ${
                        isCopied
                          ? "bg-emerald-500 text-slate-950 border-emerald-400"
                          : "bg-slate-900 hover:bg-slate-800 text-cyan-300 border-cyan-500/30"
                      }`}
                      title="复制单票挂单小抄"
                    >
                      {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{isCopied ? "已复制" : "复制"}</span>
                    </button>
                  </div>

                  <div className="space-y-1 text-xs font-mono bg-slate-900/90 p-2 rounded-lg border border-slate-800/80">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-400 font-sans">挂单限价:</span>
                      <strong className="text-cyan-300">
                        {act.entryZone ? `$${act.entryZone.min.toFixed(2)} ~ $${act.entryZone.max.toFixed(2)}` : `$${act.estimatedPrice.toFixed(2)}`}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-400 font-sans">止损/止盈:</span>
                      <span>
                        <strong className="text-rose-400">${act.stopLossPrice?.toFixed(2) || "--"}</strong>
                        <span className="text-slate-500 mx-1">/</span>
                        <strong className="text-emerald-400">${act.targetPrice?.toFixed(2) || "--"}</strong>
                      </span>
                    </div>
                  </div>

                  {act.whySummary && (
                    <p className="text-[11px] text-slate-400 line-clamp-1 italic">
                      💡 {act.whySummary}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
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

          {/* 3. 目标驱动量化智能导航与分类控制台 (2-Tier Integrated Quant Navigation Console) */}
          <div className="space-y-2.5">
            {/* 3.1 Tier 1: 标的决策与确定性池子过滤栏 + 实时搜索框 */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 p-2.5 rounded-2xl bg-slate-950/90 border border-slate-800/90 text-xs shadow-lg shadow-cyan-950/10">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-slate-400 font-bold px-1.5 flex items-center gap-1 shrink-0">
                  <Filter className="w-3.5 h-3.5 text-cyan-400" />
                  <span>标的与决策:</span>
                </span>

                {/* 1. 全部标的 */}
                <button
                  onClick={() => setFilterCategory("ALL")}
                  className={`px-2.5 py-1 rounded-xl font-semibold transition-all cursor-pointer ${
                    filterCategory === "ALL"
                      ? "bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20"
                      : "text-slate-400 hover:text-white bg-slate-900 border border-slate-800"
                  }`}
                >
                  🌐 全部标的 ({perStockItems.length})
                </button>

                {/* 2. 🏆 核心高确定性精选重仓 */}
                <button
                  onClick={() => setFilterCategory("HIGH_CERTAINTY")}
                  className={`px-3 py-1 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    filterCategory === "HIGH_CERTAINTY"
                      ? "bg-amber-500 text-slate-950 font-extrabold shadow-md shadow-amber-500/30 ring-1 ring-amber-400"
                      : "text-amber-400 hover:text-amber-300 bg-amber-950/40 border border-amber-500/40"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>🏆 高确定性重仓 ({highCertaintyCount})</span>
                </button>

                {/* 3. ⚡ 建议调仓 (买入/减仓/清仓) */}
                <button
                  onClick={() => setFilterCategory("REBALANCE")}
                  className={`px-3 py-1 rounded-xl font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    filterCategory === "REBALANCE"
                      ? "bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/30 ring-1 ring-emerald-400"
                      : "text-emerald-400 hover:text-emerald-300 bg-emerald-950/40 border border-emerald-500/40"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>⚡ 建议调仓 ({rebalanceCount})</span>
                </button>

                {/* 4. 🛡️ 实盘持仓 */}
                <button
                  onClick={() => setFilterCategory("HOLDING")}
                  className={`px-2.5 py-1 rounded-xl font-semibold transition-all cursor-pointer ${
                    filterCategory === "HOLDING"
                      ? "bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20"
                      : "text-slate-400 hover:text-white bg-slate-900 border border-slate-800"
                  }`}
                >
                  🛡️ 实盘持仓 ({holdingCount})
                </button>

                {/* 5. ⏳ 自选备选 */}
                <button
                  onClick={() => setFilterCategory("WATCHLIST")}
                  className={`px-2.5 py-1 rounded-xl font-semibold transition-all cursor-pointer ${
                    filterCategory === "WATCHLIST"
                      ? "bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20"
                      : "text-slate-400 hover:text-white bg-slate-900 border border-slate-800"
                  }`}
                >
                  ⏳ 观察备选 ({watchlistCount})
                </button>

                {/* 6. 🟢 成功经验反哺 (若有) */}
                {experienceCount > 0 && (
                  <button
                    onClick={() => setFilterCategory("EXPERIENCE")}
                    className={`px-2.5 py-1 rounded-xl font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                      filterCategory === "EXPERIENCE"
                        ? "bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20"
                        : "text-emerald-300 hover:text-white bg-emerald-950/30 border border-emerald-500/30"
                    }`}
                  >
                    <span>🟢 经验反哺 ({experienceCount})</span>
                  </button>
                )}

                {/* 7. 🔴 失败教训警示 (若有) */}
                {lessonCount > 0 && (
                  <button
                    onClick={() => setFilterCategory("LESSON")}
                    className={`px-2.5 py-1 rounded-xl font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                      filterCategory === "LESSON"
                        ? "bg-rose-500 text-white font-bold shadow-md shadow-rose-500/20"
                        : "text-rose-300 hover:text-white bg-rose-950/30 border border-rose-500/30"
                    }`}
                  >
                    <span>🔴 教训警示 ({lessonCount})</span>
                  </button>
                )}

                {/* 8. 既往清仓 */}
                {clearedCount > 0 && (
                  <button
                    onClick={() => setFilterCategory("CLEARED")}
                    className={`px-2.5 py-1 rounded-xl font-semibold transition-all cursor-pointer ${
                      filterCategory === "CLEARED"
                        ? "bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20"
                        : "text-slate-400 hover:text-white bg-slate-900 border border-slate-800"
                    }`}
                  >
                    既往清仓 ({clearedCount})
                  </button>
                )}
              </div>

              {/* 实时标的搜索框 */}
              <div className="relative min-w-[200px] shrink-0">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="搜索代码 / 公司名..."
                  value={searchStockQuery}
                  onChange={(e) => setSearchStockQuery(e.target.value)}
                  className="w-full pl-8 pr-7 py-1 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/70 transition-all font-mono"
                />
                {searchStockQuery && (
                  <button
                    onClick={() => setSearchStockQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* 3.2 Tier 2: 5大策略量化驱动因子过滤栏 + 多维排序下拉选择器 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 text-xs">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-slate-400 font-bold px-1.5 flex items-center gap-1 shrink-0">
                  <Target className="w-3.5 h-3.5 text-indigo-400" />
                  <span>策略因子:</span>
                </span>
                {[
                  { id: "ALL", label: `全部因子 (${perStockItems.length})`, icon: "🌐" },
                  { id: "CAPITAL_INFLOW_BUY", label: `主力净流入 (${capitalCount})`, icon: "💰", color: "text-amber-300" },
                  { id: "OVERSOLD_BUY", label: `超跌反弹 (${oversoldCount})`, icon: "📉", color: "text-cyan-300" },
                  { id: "FUNDAMENTAL_BUY", label: `安全边际 (${fundamentalCount})`, icon: "💎", color: "text-emerald-300" },
                  { id: "NEWS_CATALYST_BUY", label: `消息催化 (${newsCount})`, icon: "🚀", color: "text-indigo-300" },
                  { id: "WATCH_AND_WAIT", label: `中性观望 (${watchCount})`, icon: "👀", color: "text-slate-400" },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setStrategyFilter(cat.id)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                      strategyFilter === cat.id
                        ? "bg-indigo-600 text-white font-bold shadow-md shadow-indigo-500/20 ring-1 ring-indigo-400"
                        : "bg-slate-900/90 text-slate-400 hover:text-white border border-slate-800"
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                  </button>
                ))}
              </div>

              {/* 多维排序下拉选择器 + 计数 */}
              <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
                <div className="flex items-center gap-1.5 bg-slate-900/90 px-2.5 py-1 rounded-xl border border-slate-800 text-[11px] text-slate-300">
                  <ArrowUpDown className="w-3 h-3 text-cyan-400" />
                  <span className="text-slate-400 hidden md:inline">排序:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer text-[11px]"
                  >
                    <option value="CERTAINTY_DESC" className="bg-slate-900 text-white">🏆 确定性得分 (从高到低)</option>
                    <option value="GOAL_PROB_DESC" className="bg-slate-900 text-white">🎯 T日达成概率 (从高到低)</option>
                    <option value="ALLOCATION_DESC" className="bg-slate-900 text-white">💰 建议分配金额 (从多到少)</option>
                    <option value="PNL_DESC" className="bg-slate-900 text-white">📈 实盘浮动盈亏 (从高到低)</option>
                    <option value="SYMBOL_ASC" className="bg-slate-900 text-white">🔤 股票代码 (A-Z)</option>
                  </select>
                </div>

                <div className="text-[11px] text-slate-400 font-mono">
                  已显示: <strong className="text-cyan-400 font-bold">{filteredItems.length}</strong> / {perStockItems.length} 标的
                </div>
              </div>
            </div>
          </div>

          {/* 4. 统一股票列表展示区 (全通栏自包含结构，实盘调仓决策与多维推演卡片深度融合) */}
          <div className="space-y-4">
            {/* 🌟 推演进行中的顶层流动进度横幅 (有多少数据显示多少数据，不再全局遮罩阻断) */}
            {loading && (
              <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-cyan-500/30 flex items-center justify-between gap-3 text-xs shadow-xl animate-fade-in">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 animate-pulse">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">⚡ 标的推演流式进行中</span>
                      <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono">
                        已就绪 {completedSymbols.size}/{perStockItems.length}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-0.5 font-medium">
                      {currentStage?.detail || "大模型多主体博弈逐一推演中，各标的卡片随计算完成实时解锁呈现..."}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] font-mono text-cyan-300 hidden sm:inline">
                    {Math.round((completedSymbols.size / Math.max(1, perStockItems.length)) * 100)}%
                  </span>
                  <div className="w-20 bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800 hidden sm:block">
                    <div
                      className="bg-cyan-400 h-full transition-all duration-300"
                      style={{ width: `${Math.round((completedSymbols.size / Math.max(1, perStockItems.length)) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {filteredItems.length > 0 ? (
              filteredItems.map((item, idx) => {
                const isComputed = !loading || completedSymbols.has(item.symbol.toUpperCase());
                return (
                  <PerStockDeductionRetroCard
                    key={item.symbol || idx}
                    item={item}
                    onOpenKnowledgeGraph={onOpenKnowledgeGraph}
                    onOpenDeductionModal={(stockItem) => setSelectedStockForModal(stockItem)}
                    isDeductionRunning={loading}
                    isDeductionComputed={isComputed}
                    activeComputingSymbol={activeComputingSymbol}
                  />
                );
              })
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
      </>
      )}

      {/* 🌟 目标驱动与消除迷茫度单股独立全景推演控制舱 (支持随时一键关闭返回主页面) */}
      {selectedStockForModal && (
        <SingleStockDeductionModal
          isOpen={true}
          item={selectedStockForModal}
          availableCash={cashBalance}
          totalBudget={netAssets}
          onClose={() => setSelectedStockForModal(null)}
          onOpenKnowledgeGraph={onOpenKnowledgeGraph}
        />
      )}
    </div>
  );
};
