import React, { useState } from "react";
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
} from "lucide-react";
import { DeductionProgressStepper, StageStep } from "./DeductionProgressStepper";
import { PerStockDeductionRetroCard } from "./PerStockDeductionRetroCard";

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
  isUnlocked: boolean;
  loading: boolean;
  currentStage: StageStep | null;
  onOpenKnowledgeGraph: (symbol: string) => void;
  onOpenUnlockModal: () => void;
  onExecuteRebalance: (budget: number, risk: string) => void;
  onOpenPipelineModal: () => void;
}

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
  isUnlocked,
  loading,
  currentStage,
  onOpenKnowledgeGraph,
  onOpenUnlockModal,
  onExecuteRebalance,
  onOpenPipelineModal,
}) => {
  const [customBudget, setCustomBudget] = useState<number>(1000);
  const [riskPreference, setRiskPreference] = useState<string>("BALANCED");

  const latestRetro = retrospectives[0] || {
    accuracyScore: 88,
    executionMatchRate: 92,
    avoidedLoss: 450,
    lessonsLearned: ["严格遵守盘前知识图谱止损防线", "单标的集中度勿超 30%"],
  };

  const lessons: string[] = typeof latestRetro.lessonsLearnedJson === "string"
    ? JSON.parse(latestRetro.lessonsLearnedJson)
    : (latestRetro.lessonsLearned || []);

  const isPnLPos = totalPnL >= 0;

  return (
    <div className="space-y-6">
      {/* Live Stepper Indicator (Visually showing process status) */}
      <DeductionProgressStepper
        currentStage={currentStage}
        loading={loading}
        onOpenPipelineModal={onOpenPipelineModal}
      />

      {/* Asset KPIs & Historical Retro Summary Banner */}
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
            {latestRetro.accuracyScore || 88}%
          </div>
          <div className="mt-1 text-xs text-slate-400">规避回调损失: <strong className="text-emerald-400">${latestRetro.avoidedLoss || 450}</strong></div>
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

        {/* Portfolio Risk & Budget KPI Card (Replaces duplicate unlock card) */}
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

      {/* Main Studio Grid: Left 2 Cols (Per-stock 4-item cards) + Right 1 Col (Position Sizer & Retro Discipline) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Per-Stock 4 Unified Core Elements */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                <span>实盘持仓股票【知识图谱 + 新闻 + 持仓 + 走势复盘与风控纪律】全景卡片</span>
              </h3>
              {loading && (
                <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-xs font-semibold animate-pulse flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin text-cyan-400" />
                  Context 融合推理中...
                </span>
              )}
            </div>

            <button
              onClick={onOpenPipelineModal}
              className="text-xs text-cyan-400 hover:underline flex items-center gap-1 font-semibold"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>推演 Context 上下文检视 ↗</span>
            </button>
          </div>

          <div className="space-y-4">
            {perStockItems.length > 0 ? (
              perStockItems.map((item, idx) => (
                <PerStockDeductionRetroCard
                  key={idx}
                  item={item}
                  onOpenKnowledgeGraph={onOpenKnowledgeGraph}
                />
              ))
            ) : (
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <div key={i} className="glass-card p-6 border-slate-800 space-y-3 animate-pulse">
                    <div className="flex items-center justify-between">
                      <div className="h-6 bg-slate-800 rounded w-1/4"></div>
                      <div className="h-6 bg-slate-800 rounded w-1/3"></div>
                    </div>
                    <div className="h-4 bg-slate-900 rounded w-3/4"></div>
                    <div className="h-16 bg-slate-950 rounded w-full border border-slate-800"></div>
                  </div>
                ))}
              </div>
            )}
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
                    className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
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
              className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                  <span>⚡ 正在调用 Ollama 大模型推演...</span>
                </>
              ) : (
                <span>重新推演实盘持仓调仓决策</span>
              )}
            </button>
          </div>

          {/* Real-time Position Rebalance Matrix */}
          <div className="glass-card p-6 border-slate-800 space-y-4">
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
                  const rec = item.currentRecommendation;
                  const isBuy = rec?.action === "BUY";
                  const isTrim = rec?.action === "TRIM" || rec?.action === "SELL";
                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1.5 hover:border-slate-700 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white flex items-center gap-1.5">
                          <span>{item.symbol}</span>
                          <span className="text-[11px] font-normal text-slate-400 truncate max-w-[90px]">
                            {item.companyName}
                          </span>
                        </span>
                        {rec ? (
                          <span
                            className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                              isBuy
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                                : isTrim
                                ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                                : "bg-slate-800 text-slate-300 border border-slate-700"
                            }`}
                          >
                            {rec.action} ({rec.suggestedShares}股)
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">等待推演</span>
                        )}
                      </div>
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
  );
};
