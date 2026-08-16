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
} from "lucide-react";

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
  const [activeSubTab, setActiveSubTab] = useState<
    "overview" | "flow" | "community" | "fundamentals" | "kg" | "news" | "retro"
  >("overview");

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

  // 当 item 切换时同步默认参数
  useEffect(() => {
    if (item?.currentRecommendation) {
      if (typeof item.currentRecommendation.targetTimeHorizonDays === "number") {
        setTargetT(item.currentRecommendation.targetTimeHorizonDays);
      }
      if (typeof item.currentRecommendation.targetProfitGoalPct === "number") {
        setTargetG(item.currentRecommendation.targetProfitGoalPct);
      }
    }
  }, [item]);

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

  // ---------------------------------------------------------------------------
  // 客户端实时对数正态波动锥与达成概率快速模拟测算 (响应用户实时滑块交互)
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

    const spillover = typeof kg?.spilloverAlphaScore === "number" ? kg.spilloverAlphaScore : 0;
    if (spillover !== 0) dailyDrift += (spillover / 100) * 0.005;

    const targetReturnLog = Math.log(Math.max(0.001, 1.0 + validG / 100));
    const meanT = (dailyDrift - 0.5 * dailyVol * dailyVol) * validT;
    const zGoal = horizonVol > 0 ? (meanT - targetReturnLog) / horizonVol : 0;
    const rawGoalProb = stdNormalCDF(zGoal);
    const goalProb = isNaN(rawGoalProb) ? 50 : Math.min(95, Math.max(15, Math.round(rawGoalProb * 100)));

    // 确定性得分 (Certainty Score)
    let certainty = 50 + (goalProb - 50) * 0.5;
    const confirmations: string[] = [];

    if (flow?.trend === "INFLOW" || (item?.openDSnapshot?.mainCapitalInflow && item.openDSnapshot.mainCapitalInflow > 0)) {
      certainty += 12;
      confirmations.push("主力大资金沉淀净流入");
    }
    if (tfm?.direction === "UP") {
      certainty += 10;
      confirmations.push(`Google TimeFM 时序主升 (置信度 ${tfm.confidenceScore || 80}%)`);
    }
    if (spillover > 15) {
      certainty += 8;
      confirmations.push("产业链因果拓扑正向溢出");
    }
    if (item?.strategyCategory === "OVERSOLD_BUY" || item?.strategyCategory === "FUNDAMENTAL_BUY") {
      certainty += 10;
      confirmations.push("深度安全边际估值支撑");
    }

    const finalCertainty = Math.min(98, Math.max(25, Math.round(certainty)));

    // 精确挂单区间与交易路径
    const entryMin = Number((curPrice * 0.992).toFixed(2));
    const entryMax = Number((curPrice * 1.006).toFixed(2));
    const targetPrice = Number((curPrice * (1.0 + validG / 100)).toFixed(2));
    const stopLossPrice = Number((curPrice * (1.0 - validD / 100)).toFixed(2));

    // 资金头寸计算
    const suggestedShares = curPrice > 0 ? Math.max(1, Math.floor(validB / curPrice)) : 10;
    const allocatedAmount = Number((suggestedShares * curPrice).toFixed(2));
    const expectedPnL = Number((suggestedShares * (targetPrice - curPrice)).toFixed(2));
    const maxRisk = Number((suggestedShares * Math.max(0.1, curPrice - stopLossPrice)).toFixed(2));
    const riskReward = maxRisk > 0 ? (expectedPnL / maxRisk).toFixed(2) : "2.0";

    return {
      dailyVol,
      horizonVol,
      goalProb,
      finalCertainty,
      confirmations,
      entryMin,
      entryMax,
      targetPrice,
      stopLossPrice,
      suggestedShares,
      allocatedAmount,
      expectedPnL,
      maxRisk,
      riskReward,
    };
  }, [curPrice, targetT, targetG, maxD, budgetC, tfm, flow, kg, item]);

  // 所有 Hooks 必须在任何 early return 之前执行完毕
  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-xl flex flex-col justify-start items-center animate-fade-in p-2 sm:p-4 md:p-6">
      {/* Container Card */}
      <div className="w-full max-w-6xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto border-cyan-500/30">
        {/* Top Header & Navigation */}
        <div className="px-6 py-4 bg-slate-950/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-semibold transition-all shadow-sm cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-cyan-400" />
              <span>返回主看板</span>
            </button>

            <div className="h-5 w-[1px] bg-slate-800 hidden sm:block"></div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xl font-extrabold text-white tracking-wide">{item.symbol}</span>
                <span className="text-xs px-2.5 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 font-bold border border-cyan-500/30 font-mono">
                  ${typeof curPrice === "number" ? curPrice.toFixed(2) : curPrice}
                </span>
              </div>
              <span className="text-sm text-slate-300 font-medium hidden md:inline">
                {item.companyName || item.symbol}
              </span>
              {item.strategyCategoryLabel && (
                <span className="px-2.5 py-0.5 text-xs font-bold rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                  {item.strategyCategoryLabel}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onOpenKnowledgeGraph(item.symbol)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10 text-xs font-semibold transition-all cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>产业链因果图谱 ↗</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-all cursor-pointer"
              title="关闭 (ESC)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Main Body */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {/* SECTION 1: 目标驱动量化操盘控制舱 (Quant Pilot Console) */}
          <div className="glass-card p-5 border-cyan-500/30 bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-cyan-950/20 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>目标驱动量化操盘控制舱</span>
                    <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                      动态参数秒级演算
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    围绕手头可调用资金数目，针对限定交易日时间跨度与盈利目标，实时消除走势迷茫度
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">账户闲置现金:</span>
                <strong className="text-emerald-400 font-mono">${availableCash.toLocaleString()}</strong>
              </div>
            </div>

            {/* 4 Interactive Parameters Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. 可调用操盘预算 */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                    <span>手头可动用资金:</span>
                  </span>
                  <span className="font-bold text-emerald-300 font-mono">${budgetC}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {[1000, 2000, 5000].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setBudgetC(amt)}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                        budgetC === amt
                          ? "bg-emerald-500 text-slate-950 font-bold"
                          : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                      }`}
                    >
                      ${amt}
                    </button>
                  ))}
                  <input
                    type="number"
                    value={budgetC}
                    onChange={(e) => setBudgetC(Math.max(100, Number(e.target.value) || 100))}
                    className="w-16 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-[11px] text-white text-right focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
              </div>

              {/* 2. 限定交易日跨度 T */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    <span>限定时间跨度 T:</span>
                  </span>
                  <span className="font-bold text-cyan-300 font-mono">{targetT} 交易日</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {[3, 5, 10, 20].map((days) => (
                    <button
                      key={days}
                      onClick={() => setTargetT(days)}
                      className={`flex-1 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                        targetT === days
                          ? "bg-cyan-500 text-slate-950 font-bold shadow-sm shadow-cyan-500/30"
                          : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                      }`}
                    >
                      {days}日
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. 盈利目标 G% */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                    <span>盈利目标 (G%):</span>
                  </span>
                  <span className="font-bold text-indigo-300 font-mono">+{targetG}%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {[5.0, 8.0, 12.0, 15.0].map((g) => (
                    <button
                      key={g}
                      onClick={() => setTargetG(g)}
                      className={`flex-1 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                        targetG === g
                          ? "bg-indigo-500 text-white font-bold"
                          : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                      }`}
                    >
                      +{g}%
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. 最大回撤预算 D% */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                    <span>最大回撤防线 (D%):</span>
                  </span>
                  <span className="font-bold text-rose-300 font-mono">-{maxD}%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {[3.0, 4.0, 6.0, 8.0].map((d) => (
                    <button
                      key={d}
                      onClick={() => setMaxD(d)}
                      className={`flex-1 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                        maxD === d
                          ? "bg-rose-500 text-white font-bold"
                          : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                      }`}
                    >
                      -{d}%
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: 核心指标大屏看板 (Certainty, Capital Space & Attainment Probability) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: 确定性指数 / 消除迷茫度 (Certainty Score) */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>确定性指数 (消除迷茫度)</span>
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    calculatedMetrics.finalCertainty >= 80
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      : calculatedMetrics.finalCertainty >= 65
                      ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                      : "bg-slate-800 text-slate-400 border-slate-700"
                  }`}
                >
                  {calculatedMetrics.finalCertainty >= 80
                    ? "极高确定性"
                    : calculatedMetrics.finalCertainty >= 65
                    ? "中高确定性"
                    : "低确定性/噪音"}
                </span>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-amber-400 font-mono tracking-tight">
                  {calculatedMetrics.finalCertainty}
                </span>
                <span className="text-xs text-slate-500 font-mono">/ 100 分</span>
              </div>

              <div className="space-y-1 text-[11px] text-slate-400">
                <div className="font-semibold text-slate-300">闭环确认印证因子:</div>
                <div className="flex flex-wrap gap-1">
                  {calculatedMetrics.confirmations.length > 0 ? (
                    calculatedMetrics.confirmations.map((c, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-300 text-[10px]">
                        ✓ {c}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-500 text-[10px]">根据均线与波动基础测算</span>
                  )}
                </div>
              </div>
            </div>

            {/* Card 2: T 日目标达成概率与时序波动锥 */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-cyan-400" />
                  <span>{targetT} 日目标达成概率 P(Hit Goal)</span>
                </span>
                <span className="text-xs font-mono font-bold text-cyan-300">
                  {calculatedMetrics.goalProb}%
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>达成 +{targetG}% 期望概率:</span>
                  <strong className="text-white font-mono">{calculatedMetrics.goalProb}%</strong>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div
                    className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${calculatedMetrics.goalProb}%` }}
                  ></div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 border-t border-slate-800/80 pt-2 font-mono">
                <div>
                  日波动率: <strong className="text-slate-200">{(calculatedMetrics.dailyVol * 100).toFixed(1)}%</strong>
                </div>
                <div>
                  {targetT}日扩散锥: <strong className="text-slate-200">{(calculatedMetrics.horizonVol * 100).toFixed(1)}%</strong>
                </div>
              </div>
            </div>

            {/* Card 3: 资金空间分配与风险敞口 */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <PieChart className="w-4 h-4 text-emerald-400" />
                  <span>头寸分配与盈亏期望</span>
                </span>
                <span className="text-xs font-mono font-bold text-emerald-300">
                  ${calculatedMetrics.allocatedAmount} ({calculatedMetrics.suggestedShares}股)
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-emerald-950/20 border border-emerald-500/30">
                  <div className="text-[10px] text-emerald-400">预期盈利 (Reward)</div>
                  <div className="font-bold text-emerald-300 text-sm font-mono">+${calculatedMetrics.expectedPnL}</div>
                </div>
                <div className="p-2 rounded-lg bg-rose-950/20 border border-rose-500/30">
                  <div className="text-[10px] text-rose-400">最大承受风险 (Risk)</div>
                  <div className="font-bold text-rose-300 text-sm font-mono">-${calculatedMetrics.maxRisk}</div>
                </div>
              </div>

              <div className="flex justify-between items-center text-[11px] text-slate-400 border-t border-slate-800/80 pt-1.5">
                <span>赔率 / 盈亏比 (R:R):</span>
                <strong className="text-cyan-300 font-mono font-bold">{calculatedMetrics.riskReward} : 1</strong>
              </div>
            </div>
          </div>

          {/* SECTION 3: 精确挂单区间与严格时间止损纪律标牌 */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/30 border border-cyan-500/40 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/50">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>【{item.symbol}】精确定量操作指令矩阵</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      建议买入建仓
                    </span>
                  </h4>
                  <p className="text-xs text-slate-400">
                    拒绝无脑追高与模糊建议，在成本限制下精准设定委托区间与纪律防线
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-[10px] text-slate-400">建议建仓股数</div>
                  <div className="text-base font-extrabold text-white font-mono">
                    {calculatedMetrics.suggestedShares} 股 <span className="text-xs font-normal text-slate-400">(约 ${calculatedMetrics.allocatedAmount})</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Boundaries 4-column cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/40">
                <span className="text-cyan-400 block text-[11px] font-bold">🎯 精准挂单买入区间</span>
                <span className="text-base font-extrabold text-white font-mono mt-1 block">
                  ${calculatedMetrics.entryMin} ~ ${calculatedMetrics.entryMax}
                </span>
                <span className="text-[10px] text-slate-400">以限价单挂单，控制滑点入场</span>
              </div>

              <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/40">
                <span className="text-emerald-400 block text-[11px] font-bold">🎯 目标止盈价 (+{targetG}%)</span>
                <span className="text-base font-extrabold text-emerald-300 font-mono mt-1 block">
                  ${calculatedMetrics.targetPrice}
                </span>
                <span className="text-[10px] text-slate-400">触及目标价分批锁定波段利润</span>
              </div>

              <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/40">
                <span className="text-rose-400 block text-[11px] font-bold">🛑 硬止损防线 (-{maxD}%)</span>
                <span className="text-base font-extrabold text-rose-300 font-mono mt-1 block">
                  ${calculatedMetrics.stopLossPrice}
                </span>
                <span className="text-[10px] text-slate-400">下破防线坚决离场，截断亏损</span>
              </div>

              <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/40">
                <span className="text-amber-400 block text-[11px] font-bold">⏳ 观察时间窗口</span>
                <span className="text-base font-extrabold text-amber-300 font-mono mt-1 block">
                  限定 {targetT} 交易日
                </span>
                <span className="text-[10px] text-slate-400">第 {targetT} 日未突破强制平仓</span>
              </div>
            </div>

            {/* Time Stop Discipline Banner */}
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <strong className="text-amber-300 font-bold">【严格 T 日时间止损纪律】:</strong>
                <p className="text-[11px] leading-relaxed text-amber-200/90">
                  建仓后持有观察窗口限定为 <strong>{targetT} 个交易日</strong>。若在第 {targetT} 个交易日收盘前未能有效向上突破或涨幅不足 {Math.max(2, Math.floor(targetG * 0.4))}%，执行无条件平仓或重评，消除时间机会成本，释放资金回流资金池。
                </p>
              </div>
            </div>

            {/* Goal-driven Rationale Banner */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-1.5">
              <div className="text-slate-300 font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>消除迷茫度因果逻辑深度归因:</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed font-normal">
                [{item.symbol}] 围绕手头资金分配 ${calculatedMetrics.allocatedAmount} ({calculatedMetrics.suggestedShares}股)。在限定 {targetT} 交易日内达成 +{targetG}% 目标的测算概率为 {calculatedMetrics.goalProb}% (确定性得分 {calculatedMetrics.finalCertainty}/100)。分类为 [{item.strategyCategoryLabel || "精选建仓"}]，以挂单区间 ${calculatedMetrics.entryMin}~${calculatedMetrics.entryMax} 控制入场成本，下设 ${calculatedMetrics.stopLossPrice} (-{maxD}%) 硬止损。
              </p>
            </div>
          </div>

          {/* SECTION 4: 7 大维度深度推演情报与历史实盘三态复盘 */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span>7 大维度全要素深度推演情报与实盘记忆库</span>
              </div>
            </div>

            {/* SubTab Navigation */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {[
                { id: "overview", label: "1. 走势复盘 & TimeFM", icon: Clock },
                { id: "flow", label: "2. 主力机构资金", icon: DollarSign },
                { id: "community", label: "3. 散户情绪", icon: Sparkles },
                { id: "fundamentals", label: "4. 财报基本面", icon: BookOpen },
                { id: "kg", label: "5. 产业链图谱", icon: Layers },
                { id: "news", label: "6. 消歧重磅新闻", icon: Search },
                { id: "retro", label: "7. 历史实盘三态检验", icon: Award },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = activeSubTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveSubTab(tab.id as any)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition-all shrink-0 cursor-pointer ${
                      active
                        ? "bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20"
                        : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* SubTab Contents */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-xs">
              {/* Tab 1: TimeFM 时序大模型预测 */}
              {activeSubTab === "overview" && (
                <div className="space-y-3">
                  {tfm ? (
                    <div className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-500/30 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white flex items-center gap-1.5">
                          <Zap className="w-4 h-4 text-indigo-400" />
                          <span>Google TimeFM 时序大模型 · 零样本自回归预测</span>
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                          {tfm.directionLabel || "时序动量"}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                        <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                          <div className="text-slate-400">预测目标价</div>
                          <div className="font-bold text-white text-sm">${tfm.predictedPrice || curPrice}</div>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                          <div className="text-slate-400">预测涨跌幅</div>
                          <div className={`font-bold text-sm ${typeof tfm.predictedChangeRate === "number" && tfm.predictedChangeRate >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            {typeof tfm.predictedChangeRate === "number" && tfm.predictedChangeRate >= 0 ? "+" : ""}{tfm.predictedChangeRate || 0}%
                          </div>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                          <div className="text-slate-400">10%~90% 置信带</div>
                          <div className="font-bold text-cyan-300">${tfm.confidenceLow || curPrice} ~ ${tfm.confidenceHigh || curPrice}</div>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                          <div className="text-slate-400">模型置信得分</div>
                          <div className="font-bold text-amber-400">{tfm.confidenceScore || 70}分</div>
                        </div>
                      </div>
                      {tfm.momentumRationale && (
                        <p className="text-[11px] text-slate-300 font-normal">💡 {tfm.momentumRationale}</p>
                      )}
                    </div>
                  ) : (
                    <div className="text-slate-400 italic p-3 bg-slate-950 rounded-lg border border-slate-800">
                      暂无 Google TimeFM 时序数据，启动“重新推演”后将调用大模型自动生成。
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: 主力资金流 */}
              {activeSubTab === "flow" && (
                <div className="space-y-2">
                  <div className="font-semibold text-slate-300">OpenD 盘面主力与机构大资金走向:</div>
                  {flow ? (
                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          flow.trend === "INFLOW"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                            : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                        }`}>
                          {flow.trend === "INFLOW" ? "🟢 净流入沉淀" : "🔴 资金离场净流出"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 mt-1">{flow.description || "盘面主力资金走向稳定"}</p>
                    </div>
                  ) : (
                    <div className="text-slate-400 italic p-3 bg-slate-950 rounded-lg border border-slate-800">
                      资金流向数据载入中，启动推演后将自动对接 OpenD 深度流水。
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: 散户情绪 */}
              {activeSubTab === "community" && (
                <div className="space-y-2">
                  <div className="font-semibold text-slate-300">社区与散户多空情绪:</div>
                  {sentiment ? (
                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                      <div className="text-xs text-slate-300">情绪偏向: <strong className="text-cyan-300">{sentiment.mood || "中性"}</strong></div>
                      {Array.isArray(sentiment.keyTopics) && sentiment.keyTopics.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {sentiment.keyTopics.map((t: string, idx: number) => (
                            <span key={idx} className="px-2 py-0.5 rounded bg-slate-900 text-slate-400 text-[10px]">
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-slate-400 italic p-3 bg-slate-950 rounded-lg border border-slate-800">
                      社区散户情绪偏中性，暂无恐慌或狂热异动。
                    </div>
                  )}
                </div>
              )}

              {/* Tab 4: 财报基本面 */}
              {activeSubTab === "fundamentals" && (
                <div className="space-y-2">
                  <div className="font-semibold text-slate-300">核心财务指标与盈利质量:</div>
                  {fund ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="p-2 rounded bg-slate-950 border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">市盈率 (P/E)</span>
                        <strong className="text-white text-xs font-mono">{fund.peRatio || "N/A"}</strong>
                      </div>
                      <div className="p-2 rounded bg-slate-950 border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">营收同比增速</span>
                        <strong className="text-emerald-400 text-xs font-mono">{fund.revenueGrowthPct ? `+${fund.revenueGrowthPct}%` : "N/A"}</strong>
                      </div>
                      <div className="p-2 rounded bg-slate-950 border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">净利润率</span>
                        <strong className="text-cyan-300 text-xs font-mono">{fund.netMarginPct ? `${fund.netMarginPct}%` : "N/A"}</strong>
                      </div>
                      <div className="p-2 rounded bg-slate-950 border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">下次财报日</span>
                        <strong className="text-slate-300 text-xs">{fund.nextEarningsDate || "未公布"}</strong>
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-400 italic p-3 bg-slate-950 rounded-lg border border-slate-800">
                      基本面数据载入中，市盈率与财务健康度将在推演时自动整合。
                    </div>
                  )}
                </div>
              )}

              {/* Tab 5: 产业链知识图谱 */}
              {activeSubTab === "kg" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-300">产业链上下游因果网络:</span>
                    <button
                      onClick={() => onOpenKnowledgeGraph(item.symbol)}
                      className="text-cyan-400 hover:text-cyan-300 text-[11px] underline cursor-pointer"
                    >
                      打开完整拓扑图谱 ↗
                    </button>
                  </div>
                  {Array.isArray(kg.edges) && kg.edges.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {kg.edges.slice(0, 4).map((e: any, idx: number) => (
                        <div key={idx} className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-[11px]">
                          <div className="flex justify-between font-bold text-cyan-300">
                            <span>{e.source} → {e.target}</span>
                            <span className={e.impact === "POSITIVE" ? "text-emerald-400" : "text-rose-400"}>
                              {e.impact === "POSITIVE" ? "利多" : "利空"}
                            </span>
                          </div>
                          <p className="text-slate-400 mt-1 line-clamp-1">{e.relation}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-slate-400 italic p-3 bg-slate-950 rounded-lg border border-slate-800">
                      暂无产业链扩展边，点击上方“产业链因果图谱”可查看实体节点。
                    </div>
                  )}
                </div>
              )}

              {/* Tab 6: 消歧新闻 */}
              {activeSubTab === "news" && (
                <div className="space-y-2">
                  <div className="font-semibold text-slate-300">SearXNG 消歧检索重磅资讯:</div>
                  {Array.isArray(item.latestNews) && item.latestNews.length > 0 ? (
                    <ul className="space-y-1.5">
                      {item.latestNews.map((n: string, i: number) => (
                        <li key={i} className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 text-[11px] flex items-start gap-2">
                          <span className="text-cyan-400 font-bold">•</span>
                          <span>{n}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-slate-400 italic p-3 bg-slate-950 rounded-lg border border-slate-800">
                      启动推演后将自动调用 SearXNG 抓取权威时态消歧重磅资讯。
                    </div>
                  )}
                </div>
              )}

              {/* Tab 7: 历史实盘三态复盘检验 */}
              {activeSubTab === "retro" && (
                <div className="space-y-2">
                  <div className="font-semibold text-slate-300">该标的历史实盘三态检验记忆库:</div>
                  {past.verificationOutcome ? (
                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          past.verificationOutcome === "EXPERIENCE"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                            : past.verificationOutcome === "LESSON"
                            ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                            : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                        }`}>
                          {past.verificationOutcomeLabel || (past.verificationOutcome === "EXPERIENCE" ? "🟢 成功经验" : "🔴 失败教训")}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 mt-1">{past.verificationLesson}</p>
                    </div>
                  ) : (
                    <div className="text-slate-400 p-3 bg-slate-950 rounded-lg border border-slate-800 text-[11px]">
                      暂无历史实盘反哺教训，该标的将按当前多因子与 TimeFM 时序动量推演。
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
