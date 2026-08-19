import React, { useState, useMemo, useEffect } from "react";
import {
  ArrowLeft,
  X,
  Sparkles,
  DollarSign,
  Target,
  ShieldAlert,
  Clock,
  TrendingUp,
  TrendingDown,
  Layers,
  Zap,
  Search,
  PieChart,
  BookOpen,
  Award,
  Activity,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
  History,
  Compass,
  FileText,
  Flame,
} from "lucide-react";
export type StockActionVerdict =
  | "OPEN_POSITION"
  | "ADD_POSITION"
  | "TRIM_POSITION"
  | "CLOSE_POSITION"
  | "HOLD_AND_WATCH";

export interface ConsolidatedPrincipleItem {
  id: string;
  portfolioId: string;
  symbol: string;
  principleType: string;
  category: string;
  title: string;
  distilledRule: string;
  sampleCount: number;
  confidenceWeight: number;
  firstLearnedDate: string;
  lastReinforcedDate: string;
  isArchived: boolean;
}

export interface TemporalEvolutionItem {
  id: string;
  deductionDate: string;
  actionType: StockActionVerdict;
  actionTypeLabel: string;
  whySummary: string;
  triggerPrice: number;
  targetPrice?: number;
  stopLossPrice?: number;
  entryZone?: { min: number; max: number };
  timeStopDays?: number;
  certaintyScore?: number;
  goalAttainmentProbability?: number;
  isVerified: boolean;
  actualNextClosePrice?: number;
  actualNextChangeRate?: number;
  verificationOutcome?: string;
  verificationOutcomeLabel?: string;
  verificationLesson?: string;
  pnlImpactAmount?: number;
}

interface SingleStockDeductionModalProps {
  isOpen: boolean;
  item: any;
  availableCash?: number;
  totalBudget?: number;
  onClose: () => void;
  onOpenKnowledgeGraph: (symbol: string) => void;
}

export const SingleStockDeductionModal: React.FC<SingleStockDeductionModalProps> = ({
  isOpen,
  item,
  availableCash = 3000,
  totalBudget = 10000,
  onClose,
  onOpenKnowledgeGraph,
}) => {
  // 交互式可调参数 (用户可在单股独立舱内实时演化)
  const [targetT, setTargetT] = useState<number>(5);
  const [targetG, setTargetG] = useState<number>(8.0);
  const [maxD, setMaxD] = useState<number>(4.0);
  const [budgetC, setBudgetC] = useState<number>(2000);
  const [activeMainTab, setActiveMainTab] = useState<"decision" | "evidence" | "timeline" | "principles">("decision");
  const [activeEvidencePillar, setActiveEvidencePillar] = useState<1 | 2 | 3 | 4 | 5>(1);

  // 异步获取该标的历史演进时间轴与长期原则
  const [timelineHistory, setTimelineHistory] = useState<TemporalEvolutionItem[]>([]);
  const [principlesList, setPrinciplesList] = useState<ConsolidatedPrincipleItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  // 监听 ESC 键关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // 当 item 切换时同步默认参数并拉取历史时间轴
  useEffect(() => {
    if (item?.currentRecommendation) {
      if (typeof item.currentRecommendation.targetTimeHorizonDays === "number") {
        setTargetT(item.currentRecommendation.targetTimeHorizonDays);
      }
      if (typeof item.currentRecommendation.targetProfitGoalPct === "number") {
        setTargetG(item.currentRecommendation.targetProfitGoalPct);
      }
    }

    if (item?.symbol && isOpen) {
      fetchSymbolHistoryAndPrinciples(item.symbol);
    }
  }, [item, isOpen]);

  const fetchSymbolHistoryAndPrinciples = async (sym: string) => {
    setLoadingHistory(true);
    try {
      const [histRes, prinRes] = await Promise.all([
        fetch(`/api/stock/deduction/history/${sym}`),
        fetch(`/api/stock/memory/principles/${sym}`),
      ]);
      const histJson = await histRes.json();
      const prinJson = await prinRes.json();
      if (histJson.success && Array.isArray(histJson.data)) {
        setTimelineHistory(histJson.data);
      }
      if (prinJson.success && Array.isArray(prinJson.data)) {
        setPrinciplesList(prinJson.data);
      }
    } catch (e) {
      console.warn("Failed to fetch symbol history:", e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const rawPrice =
    item?.position?.marketPrice ||
    item?.openDSnapshot?.lastPrice ||
    item?.currentRecommendation?.estimatedPrice ||
    100.0;
  const curPrice = typeof rawPrice === "number" && !isNaN(rawPrice) && rawPrice > 0 ? rawPrice : Number(rawPrice) || 100.0;

  const pos = item?.position;
  const rec = item?.currentRecommendation;
  const past = item?.pastRetro || {};
  const tfm = item?.timefmForecast;
  const kg = item?.knowledgeGraph || {};
  const flow = item?.capitalFlow;
  const fund = item?.fundamentals;
  const sentiment = item?.communitySentiment;
  const ev = item?.evidence5Pillars || rec?.evidence;

  // 操盘动作体系标准化判定
  const isHolding = pos && pos.shares > 0;
  const actionVerdict: StockActionVerdict = rec?.actionType || (
    rec?.action === "BUY"
      ? (isHolding ? "ADD_POSITION" : "OPEN_POSITION")
      : rec?.action === "SELL" || rec?.action === "TRIM"
      ? (rec?.action === "SELL" ? "CLOSE_POSITION" : "TRIM_POSITION")
      : "HOLD_AND_WATCH"
  );

  const verdictMeta: Record<StockActionVerdict, { label: string; badgeClass: string; borderClass: string; icon: string; desc: string }> = {
    OPEN_POSITION: {
      label: "建议建仓 (OPEN)",
      badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-emerald-500/20",
      borderClass: "border-emerald-500/40",
      icon: "🟢",
      desc: "当前处于低吸安全边际区间，多因子与时序动量共振向上，建议在预设挂单区间首次建仓。",
    },
    ADD_POSITION: {
      label: "建议加仓 (ADD)",
      badgeClass: "bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-cyan-500/20",
      borderClass: "border-cyan-500/40",
      icon: "🟢",
      desc: "实盘底仓浮盈且处于上升通道回踩支撑位，确定性强化，建议逢低追加头寸放大收益。",
    },
    TRIM_POSITION: {
      label: "建议减仓 (TRIM)",
      badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-amber-500/20",
      borderClass: "border-amber-500/40",
      icon: "🟡",
      desc: "股价触及阶段阻力位或大盘风险收紧，建议主动分批止盈减仓，锁定部分利润并释放现金。",
    },
    CLOSE_POSITION: {
      label: "建议清仓 (CLOSE)",
      badgeClass: "bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-rose-500/20",
      borderClass: "border-rose-500/40",
      icon: "🔴",
      desc: "股价触及硬止损红线或核心投资逻辑破坏，建议坚决执行无条件清仓离场，规避本金永久损失。",
    },
    HOLD_AND_WATCH: {
      label: "保持观望 (HOLD)",
      badgeClass: "bg-slate-800 text-slate-300 border-slate-700 shadow-slate-900/50",
      borderClass: "border-slate-800",
      icon: "⚪",
      desc: "走势处于健康观察区间或多空博弈均衡期，未触发极限信号，建议保持现有底仓或继续跟踪。",
    },
  };

  const currentVerdict = verdictMeta[actionVerdict] || verdictMeta.HOLD_AND_WATCH;

  // ---------------------------------------------------------------------------
  // 客户端实时对数正态波动锥与达成概率快速模拟测算
  // ---------------------------------------------------------------------------
  const stdNormalCDF = (x: number): number => {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    const absX = Math.abs(x) / Math.SQRT2;
    const t = 1.0 / (1.0 + p * absX);
    const y = 1.0 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX));
    return 0.5 * (1.0 + sign * y);
  };

  const calculatedMetrics = useMemo(() => {
    const validT = Math.max(1, targetT || 5);
    const validG = Math.max(0.1, targetG || 8.0);
    const validD = Math.max(0.1, maxD || 4.0);
    const validB = Math.max(10, budgetC || 2000);

    const dailyVol = 0.026;
    const horizonVol = dailyVol * Math.sqrt(validT);

    let dailyDrift = 0.001;
    if (tfm?.direction === "UP") dailyDrift += 0.008;
    else if (tfm?.direction === "DOWN") dailyDrift -= 0.008;
    if (flow?.trend === "INFLOW") dailyDrift += 0.004;
    else if (flow?.trend === "OUTFLOW") dailyDrift -= 0.004;

    const horizonMean = dailyDrift * validT;
    const targetReturn = validG / 100;
    const zScore = (targetReturn - horizonMean) / (horizonVol || 0.001);
    const goalProb = Number((Math.max(0.05, Math.min(0.95, 1 - stdNormalCDF(zScore))) * 100).toFixed(1));

    const stopReturn = -validD / 100;
    const zStop = (stopReturn - horizonMean) / (horizonVol || 0.001);
    const stopProb = Number((Math.max(0.02, Math.min(0.9, stdNormalCDF(zStop))) * 100).toFixed(1));
    const survivalRate = Number((100 - stopProb).toFixed(1));

    let score = 50;
    const confirmations: string[] = [];
    if (tfm?.direction === "UP") { score += 18; confirmations.push("TimeFM 时序动量向上"); }
    if (flow?.trend === "INFLOW") { score += 14; confirmations.push("盘口主力资金净流入"); }
    if (past.verificationOutcome === "EXPERIENCE") { score += 10; confirmations.push("历史实盘核验成功经验反哺"); }
    if (item?.strategyCategory && item.strategyCategory !== "WATCH_AND_WAIT") { score += 12; confirmations.push(item.strategyCategoryLabel || "策略形态突破"); }
    score = Math.max(20, Math.min(96, score));

    const entryMin = Number((curPrice * 0.992).toFixed(2));
    const entryMax = Number((curPrice * 1.006).toFixed(2));
    const tpPrice = Number((curPrice * (1 + targetReturn)).toFixed(2));
    const slPrice = Number((curPrice * (1 + stopReturn)).toFixed(2));

    const allocatedAmount = Math.min(validB, 1500);
    const suggestedShares = Math.max(1, Math.floor(allocatedAmount / curPrice));
    const expectedPnL = Number((suggestedShares * curPrice * targetReturn).toFixed(2));
    const maxRisk = Number((suggestedShares * curPrice * (validD / 100)).toFixed(2));
    const riskReward = Number((validG / validD).toFixed(1));

    return {
      dailyVol,
      horizonVol,
      goalProb,
      survivalRate,
      finalCertainty: score,
      confirmations,
      entryZone: { min: entryMin, max: entryMax },
      tpPrice,
      slPrice,
      allocatedAmount,
      suggestedShares,
      expectedPnL,
      maxRisk,
      riskReward,
    };
  }, [targetT, targetG, maxD, budgetC, curPrice, tfm, flow, past, item]);

  const whyStatement = rec?.whySummary || rec?.goalDrivenRationale || rec?.rationale || currentVerdict.desc;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div
        className="relative w-full max-w-5xl max-h-[92vh] flex flex-col rounded-3xl bg-slate-900/95 border border-cyan-500/30 shadow-2xl shadow-cyan-950/50 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部标题栏与快捷关闭 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Compass className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white tracking-tight">{item.symbol}</h3>
                <span className="text-xs text-slate-400 font-medium">{item.companyName || item.symbol}</span>
                {isHolding ? (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                    实盘持仓 {pos?.shares}股
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                    候选自选标的
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5 font-mono">
                <span>实时现价: <strong className="text-white">${curPrice.toFixed(2)}</strong></span>
                {pos && pos.costBasis > 0 && (
                  <span>持仓成本: <strong className="text-slate-300">${pos.costBasis.toFixed(2)}</strong></span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onOpenKnowledgeGraph(item.symbol)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-xs font-semibold text-cyan-300 border border-slate-700 transition-all shadow-sm"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>因果图谱</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800/60 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 transition-all border border-slate-700"
              title="按 ESC 或点击关闭"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 顶部主导航 Tab */}
        <div className="flex items-center gap-2 px-6 py-2 border-b border-slate-800 bg-slate-950/40 shrink-0 text-xs overflow-x-auto">
          <button
            onClick={() => setActiveMainTab("decision")}
            className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${
              activeMainTab === "decision"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Target className="w-4 h-4" />
            <span>🎯 操盘决策与定量执行</span>
          </button>
          <button
            onClick={() => setActiveMainTab("evidence")}
            className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${
              activeMainTab === "evidence"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>🏛️ 5 大事实证据支柱</span>
          </button>
          <button
            onClick={() => setActiveMainTab("timeline")}
            className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${
              activeMainTab === "timeline"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <History className="w-4 h-4" />
            <span>⏳ 历史演进时间轴 ({timelineHistory.length})</span>
          </button>
          <button
            onClick={() => setActiveMainTab("principles")}
            className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${
              activeMainTab === "principles"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Award className="w-4 h-4" />
            <span>🧠 长期认知原则库 ({principlesList.length})</span>
          </button>
        </div>

        {/* 弹窗核心可滚动工作区 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

          {/* ========================================================================= */}
          {/* TAB 1: 操盘决策与定量执行主看板 */}
          {/* ========================================================================= */}
          {activeMainTab === "decision" && (
            <div className="space-y-6 animate-fade-in">
              {/* 1. 操盘动作核心指令看板 (Master Verdict Banner) */}
              <div className={`p-5 rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border ${currentVerdict.borderClass} shadow-xl space-y-4`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className="text-3xl">{currentVerdict.icon}</span>
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className={`px-3.5 py-1 rounded-full text-sm font-extrabold border shadow-lg ${currentVerdict.badgeClass}`}>
                          {currentVerdict.label}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                          确定性得分: <strong className="text-amber-400 font-mono">{calculatedMetrics.finalCertainty}分</strong>
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          目标周期: {targetT} 交易日
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-white mt-2 leading-snug">
                        【为什么操盘？】{whyStatement}
                      </h4>
                    </div>
                  </div>

                  <div className="shrink-0 flex md:flex-col items-center md:items-end justify-between gap-1 p-3 rounded-2xl bg-slate-950/80 border border-slate-800 font-mono">
                    <span className="text-[11px] text-slate-400">建议分配资金:</span>
                    <span className="text-lg font-black text-emerald-300">${calculatedMetrics.allocatedAmount}</span>
                    <span className="text-[10px] text-slate-400">约 {calculatedMetrics.suggestedShares} 股</span>
                  </div>
                </div>

                {/* 4 维量化执行参数栏 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-800/80">
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                    <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                      <Target className="w-3.5 h-3.5 text-cyan-400" />
                      <span>建议挂单建仓区间 (Entry Zone)</span>
                    </div>
                    <div className="mt-1 text-sm font-black text-cyan-300 font-mono">
                      ${calculatedMetrics.entryZone.min} ~ ${calculatedMetrics.entryZone.max}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">控制开盘冲高滑点成本</div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                    <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                      <span>目标止盈价 (+{targetG}%)</span>
                    </div>
                    <div className="mt-1 text-sm font-black text-emerald-300 font-mono">
                      ${calculatedMetrics.tpPrice} (+${calculatedMetrics.expectedPnL})
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">达成概率: {calculatedMetrics.goalProb}%</div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                    <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                      <span>严格硬止损价 (-{maxD}%)</span>
                    </div>
                    <div className="mt-1 text-sm font-black text-rose-300 font-mono">
                      ${calculatedMetrics.slPrice} (-${calculatedMetrics.maxRisk})
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">安全存活率: {calculatedMetrics.survivalRate}%</div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                    <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-indigo-400" />
                      <span>时间止损纪律 (Time Stop)</span>
                    </div>
                    <div className="mt-1 text-sm font-black text-indigo-300 font-mono">
                      {targetT} 个交易日
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">到期未破目标无条件离场</div>
                  </div>
                </div>
              </div>

              {/* 2. 动态操盘参数互动求解器 (Interactive Sliders) */}
              <div className="p-5 rounded-3xl bg-slate-950/60 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-cyan-400" />
                    <span>目标驱动与资金空间交互式动态求解器</span>
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    赔率盈亏比: <strong className="text-cyan-300 font-bold">{calculatedMetrics.riskReward} : 1</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Slider 1: Target T */}
                  <div className="space-y-1.5 p-3 rounded-2xl bg-slate-900/60 border border-slate-800">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">时间跨度 (T):</span>
                      <strong className="text-white font-mono">{targetT} 交易日</strong>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={20}
                      step={1}
                      value={targetT}
                      onChange={(e) => setTargetT(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>1日(日内)</span>
                      <span>5日(波段)</span>
                      <span>20日(月度)</span>
                    </div>
                  </div>

                  {/* Slider 2: Target G */}
                  <div className="space-y-1.5 p-3 rounded-2xl bg-slate-900/60 border border-slate-800">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">盈利目标 (G%):</span>
                      <strong className="text-emerald-400 font-mono">+{targetG.toFixed(1)}%</strong>
                    </div>
                    <input
                      type="range"
                      min={1.0}
                      max={25.0}
                      step={0.5}
                      value={targetG}
                      onChange={(e) => setTargetG(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>+1%</span>
                      <span>+8%</span>
                      <span>+25%</span>
                    </div>
                  </div>

                  {/* Slider 3: Max Drawdown D */}
                  <div className="space-y-1.5 p-3 rounded-2xl bg-slate-900/60 border border-slate-800">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">止损红线 (D%):</span>
                      <strong className="text-rose-400 font-mono">-{maxD.toFixed(1)}%</strong>
                    </div>
                    <input
                      type="range"
                      min={1.0}
                      max={12.0}
                      step={0.5}
                      value={maxD}
                      onChange={(e) => setMaxD(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-400"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>-1%</span>
                      <span>-4%</span>
                      <span>-12%</span>
                    </div>
                  </div>

                  {/* Slider 4: Budget C */}
                  <div className="space-y-1.5 p-3 rounded-2xl bg-slate-900/60 border border-slate-800">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">动用预算 (C):</span>
                      <strong className="text-cyan-400 font-mono">${budgetC}</strong>
                    </div>
                    <input
                      type="range"
                      min={100}
                      max={availableCash || 10000}
                      step={100}
                      value={budgetC}
                      onChange={(e) => setBudgetC(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>$100</span>
                      <span>${((availableCash || 10000) / 2).toFixed(0)}</span>
                      <span>${availableCash || 10000}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: 5 大事实证据支柱 (5-Pillar Fact Evidence Grid) */}
          {/* ========================================================================= */}
          {activeMainTab === "evidence" && (
            <div className="space-y-5 animate-fade-in">
              <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800 text-xs">
                <button
                  onClick={() => setActiveEvidencePillar(1)}
                  className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                    activeEvidencePillar === 1 ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>支柱 1: 全网搜索与新闻 ({ev?.news?.length || item.latestNews?.length || 0})</span>
                </button>
                <button
                  onClick={() => setActiveEvidencePillar(2)}
                  className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                    activeEvidencePillar === 2 ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>支柱 2: 基本面与估值</span>
                </button>
                <button
                  onClick={() => setActiveEvidencePillar(3)}
                  className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                    activeEvidencePillar === 3 ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>支柱 3: 实盘持仓与资金流</span>
                </button>
                <button
                  onClick={() => setActiveEvidencePillar(4)}
                  className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                    activeEvidencePillar === 4 ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>支柱 4: TimeFM 时序动量</span>
                </button>
                <button
                  onClick={() => setActiveEvidencePillar(5)}
                  className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                    activeEvidencePillar === 5 ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>支柱 5: 过往预测实盘核验</span>
                </button>
              </div>

              {/* Pillar 1: News Evidence */}
              {activeEvidencePillar === 1 && (
                <div className="space-y-3">
                  <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
                    <span>SearXNG 权威分级资讯证据链:</span>
                    <span className="text-[11px] text-slate-400 font-normal">信源分级: Tier-1 (路透/彭博) · Tier-2 (华尔街日报/巴伦)</span>
                  </div>
                  {Array.isArray(item.latestNews) && item.latestNews.length > 0 ? (
                    <div className="space-y-2">
                      {item.latestNews.map((n: string, i: number) => (
                        <div key={i} className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                              Tier-1 权威信源
                            </span>
                            <span className="text-xs font-bold text-white">{n.slice(0, 60)}</span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed pl-1">{n}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-400 italic">
                      启动推演后将自动通过 SearXNG 抓取美股实时权威消歧重磅资讯。
                    </div>
                  )}
                </div>
              )}

              {/* Pillar 2: Fundamentals Evidence */}
              {activeEvidencePillar === 2 && (
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                  <div className="text-xs font-bold text-slate-300">财务基本面与估值水位事实:</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                      <div className="text-[10px] text-slate-400">市盈率 PE (TTM)</div>
                      <div className="text-base font-bold text-white font-mono mt-0.5">
                        {fund?.peRatio ?? item?.openDSnapshot?.peRatio ?? "--"}
                      </div>
                      <div className="text-[10px] text-emerald-400">
                        {fund?.peRatio || item?.openDSnapshot?.peRatio ? "动态估值" : "--"}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                      <div className="text-[10px] text-slate-400">营收同比增速</div>
                      <div className="text-base font-bold text-emerald-400 font-mono mt-0.5">
                        {fund?.revenueGrowthPct !== undefined ? `+${fund.revenueGrowthPct}%` : "--"}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {fund?.revenueGrowthPct !== undefined ? "财务基本面" : "--"}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                      <div className="text-[10px] text-slate-400">净利润率 Net Margin</div>
                      <div className="text-base font-bold text-cyan-300 font-mono mt-0.5">
                        {fund?.netMarginPct !== undefined ? `${fund.netMarginPct}%` : "--"}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {fund?.netMarginPct !== undefined ? "盈利能力" : "--"}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                      <div className="text-[10px] text-slate-400">下次财报日</div>
                      <div className="text-base font-bold text-amber-300 font-mono mt-0.5">
                        {fund?.nextEarningsDate || "待公告"}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {fund?.nextEarningsDate ? "财报窗口期" : "--"}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Pillar 3: Live Market & Flow */}
              {activeEvidencePillar === 3 && (
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                  <div className="text-xs font-bold text-slate-300">实盘持仓与盘口资金流向事实:</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                      <div className="text-[10px] text-slate-400">实盘持仓状态</div>
                      <div className="text-sm font-bold text-white font-mono mt-0.5">
                        {isHolding ? `${pos.shares} 股 @ $${pos.costBasis.toFixed(2)}` : "暂无底仓"}
                      </div>
                      <div className="text-[10px] text-slate-400">{isHolding ? `持仓市值: $${(pos.shares * curPrice).toFixed(2)}` : "观察建仓状态"}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                      <div className="text-[10px] text-slate-400">主力资金净流入流出</div>
                      <div className="text-sm font-bold text-emerald-400 font-mono mt-0.5">
                        {flow?.trend === "INFLOW" ? "🟢 机构大单净流入" : flow?.trend === "OUTFLOW" ? "🔴 机构大单净流出" : "⚪ 资金进出均衡"}
                      </div>
                      <div className="text-[10px] text-slate-400">{flow?.description || "盘口资金动向平稳"}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                      <div className="text-[10px] text-slate-400">日换手率 Turnover</div>
                      <div className="text-sm font-bold text-white font-mono mt-0.5">
                        {item?.openDSnapshot?.turnoverRate !== undefined ? `${item.openDSnapshot.turnoverRate.toFixed(2)}%` : "--"}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {item?.openDSnapshot?.turnoverRate !== undefined ? "交投活跃度" : "--"}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Pillar 4: TimeFM Forecast */}
              {activeEvidencePillar === 4 && (
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                  <div className="text-xs font-bold text-slate-300">Google TimeFM 零样本时序大模型走势预测:</div>
                  {tfm ? (
                    <div className="space-y-3">
                      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                        <div>
                          <div className="text-xs text-slate-400">次日预测方向与目标价格中枢:</div>
                          <div className="text-lg font-black text-cyan-300 font-mono mt-0.5">
                            {tfm.directionLabel} · ${tfm.predictedPrice} (
                            <span className={tfm.predictedChangeRate >= 0 ? "text-emerald-400" : "text-rose-400"}>
                              {tfm.predictedChangeRate >= 0 ? "+" : ""}{tfm.predictedChangeRate}%
                            </span>
                            )
                          </div>
                        </div>
                        <div className="text-right font-mono text-xs text-slate-400">
                          <div>90% 置信上界: <strong className="text-white">${tfm.confidenceHigh}</strong></div>
                          <div>10% 置信下界: <strong className="text-white">${tfm.confidenceLow}</strong></div>
                        </div>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/40 p-3 rounded-xl border border-slate-800">
                        <strong>时序动量推论:</strong> {tfm.momentumRationale}
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 italic">
                      该标的暂无足够长周期的K线样本，将在后续推演中结合多因子计算。
                    </div>
                  )}
                </div>
              )}

              {/* Pillar 5: Past Lessons & Verification */}
              {activeEvidencePillar === 5 && (
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="text-xs font-bold text-slate-300">历史实盘对账与三态归因反哺:</div>
                  {past.verificationOutcome ? (
                    <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold border ${
                          past.verificationOutcome === "EXPERIENCE"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                            : past.verificationOutcome === "LESSON"
                            ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                            : "bg-slate-800 text-slate-400 border-slate-700"
                        }`}>
                          {past.verificationOutcomeLabel || (past.verificationOutcome === "EXPERIENCE" ? "🟢 成功经验" : "🔴 失败教训")}
                        </span>
                        {past.actualNextClosePrice && (
                          <span className="text-xs font-mono text-slate-300">
                            实盘收盘价: ${past.actualNextClosePrice} ({past.actualNextChangeRate > 0 ? "+" : ""}{past.actualNextChangeRate}%)
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{past.verificationLesson}</p>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-xs text-slate-400 italic">
                      暂无该标的历史实盘核验记录，将在每日收盘后由对账引擎自动回填。
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: 历史演进时间轴 (Temporal Evolution Timeline) */}
          {/* ========================================================================= */}
          {activeMainTab === "timeline" && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
                <span className="font-bold text-slate-300">该标的随时间演进的历史推演快照 ({timelineHistory.length} 笔):</span>
                <span className="text-slate-400">不可篡改的实盘三态复盘对账历史</span>
              </div>

              {loadingHistory ? (
                <div className="p-8 text-center text-xs text-slate-400">正在载入历史演进时间轴...</div>
              ) : timelineHistory.length > 0 ? (
                <div className="relative border-l-2 border-slate-800 ml-4 space-y-6 py-2">
                  {timelineHistory.map((h, i) => (
                    <div key={h.id || i} className="relative pl-6">
                      <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-slate-950 border-2 border-cyan-400"></div>
                      <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-white">{h.deductionDate}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                              {h.actionTypeLabel}
                            </span>
                            {h.verificationOutcomeLabel && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 border border-slate-800 text-slate-300">
                                {h.verificationOutcomeLabel}
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-xs text-slate-400">
                            推演基准价: ${h.triggerPrice.toFixed(2)}
                            {h.actualNextClosePrice && ` → 实盘收盘: $${h.actualNextClosePrice.toFixed(2)}`}
                          </span>
                        </div>

                        <p className="text-xs text-slate-300 leading-relaxed">{h.whySummary}</p>

                        {h.verificationLesson && (
                          <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80 text-[11px] text-amber-300/90 font-medium">
                            {h.verificationLesson}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-slate-400 bg-slate-950 rounded-2xl border border-slate-800">
                  暂无既往历史推演快照，今日推演生成后将自动在此沉淀演进节点。
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: 长期认知原则库 (Consolidated Principles) */}
          {/* ========================================================================= */}
          {activeMainTab === "principles" && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
                <span className="font-bold text-slate-300">长周期聚类合并与时间衰减原则 ({principlesList.length} 条):</span>
                <span className="text-slate-400">天长日久自动合并同类教训，随时间衰减过时认知</span>
              </div>

              {principlesList.length > 0 ? (
                <div className="space-y-3">
                  {principlesList.map((p, i) => (
                    <div key={p.id || i} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                            {p.title}
                          </span>
                          <span className="text-xs font-bold text-white font-mono">
                            置信权重: {Math.round(p.confidenceWeight * 100)}%
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono">
                          合并样本数: {p.sampleCount} 次 · 最近强化: {p.lastReinforcedDate}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed font-medium">{p.distilledRule}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-slate-400 bg-slate-950 rounded-2xl border border-slate-800">
                  暂无聚合长周期原则。当系统积累多笔实盘教训后，记忆引擎将自动归纳合并为高阶操盘铁律。
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
