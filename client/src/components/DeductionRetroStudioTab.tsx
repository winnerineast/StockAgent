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
  onOpenPipelineModal,
}) => {
  const [customBudget, setCustomBudget] = useState<number>(1000);
  const [riskPreference, setRiskPreference] = useState<string>("BALANCED");
  const [filterCategory, setFilterCategory] = useState<"ALL" | "HOLDING" | "CLEARED">("ALL");

  // 选股与超跌建仓搜索/动作筛选
  const [screenerSearchQuery, setScreenerSearchQuery] = useState<string>("");
  const [screenerActionFilter, setScreenerActionFilter] = useState<string>("ALL");

  const latestRetro = retrospectives && retrospectives.length > 0 ? retrospectives[0] : null;

  const isPnLPos = totalPnL >= 0;

  const filteredItems = perStockItems.filter((item) => {
    if (filterCategory === "HOLDING") return item.position && item.position.shares > 0;
    if (filterCategory === "CLEARED") return item.isCleared || (item.position && item.position.shares === 0);
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

  return (
    <div className="space-y-6">
      {/* Live Stepper Indicator (Visually showing process status) */}
      <DeductionProgressStepper
        currentStage={currentStage}
        loading={loading}
        onOpenPipelineModal={onOpenPipelineModal}
      />

      {/* 1. 美股板块大盘动态与 SearXNG 消息面全景 */}
      <div className="glass-card p-5 border-slate-800 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-cyan-950/30">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">美股板块大盘动态 & SearXNG 消息面全景</h2>
              <p className="text-xs text-slate-400">基于 MooMoo OpenD 行情与 SearXNG Web 搜索全网捕捉消息面与基本面偏差</p>
            </div>
          </div>
        </div>
        <p className="text-xs text-slate-300 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 leading-relaxed font-normal">
          {marketOverview || "暂无大盘资讯解析，请点击【生成/刷新盘前推演】触发 SearXNG 全网实时抓取。"}
        </p>
      </div>

      {/* 2. 优质标的消息面超跌建仓池 & 智能选股 Studio (整合一站式选股与超跌建仓) */}
      <div className="glass-card p-5 border-slate-800 space-y-4 bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-emerald-950/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>优质标的消息面超跌建仓池 & 智能选股 Studio</span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  超跌强建仓 vs 自选股筛选
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                结合 SearXNG 消息误伤分析、MooMoo OpenD 实时盘面与全网智能选股
              </p>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-40 sm:w-52">
              <input
                type="text"
                placeholder="搜索代码 (如 AAPL, NVDA)..."
                value={screenerSearchQuery}
                onChange={(e) => setScreenerSearchQuery(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
            <div className="flex items-center gap-1">
              {[
                { id: "ALL", label: "全部" },
                { id: "BUY", label: "超跌建仓" },
                { id: "TRIM", label: "减仓/止盈" },
                { id: "HOLD", label: "观望" },
              ].map((type) => (
                <button
                  key={type.id}
                  onClick={() => setScreenerActionFilter(type.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                    screenerActionFilter === type.id
                      ? "bg-cyan-500 text-slate-950 font-bold"
                      : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* MooMoo OpenD 同步自选股 Quick Bar */}
        {watchlist && watchlist.length > 0 && (
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1.5">
            <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
                <span>MooMoo OpenD 同步自选股动向 ({watchlist.length} 标的)</span>
              </span>
              <span className="text-slate-500 text-[10px]">点击股票代码直接查看专属知识图谱</span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {watchlist.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => onOpenKnowledgeGraph(item.symbol)}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-cyan-500/40 text-xs flex items-center gap-2 shrink-0 transition-all"
                >
                  <span className="font-bold text-white">{item.symbol}</span>
                  {item.price && item.price > 0 ? (
                    <span className="text-slate-300 font-medium">${item.price.toFixed(2)}</span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Oversold Buy Opportunities & Screener Action Cards Grid */}
        {filteredScreenerItems && filteredScreenerItems.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredScreenerItems.map((opp, idx) => {
              const isBuy = opp.action === "BUY";
              const isTrim = opp.action === "TRIM" || opp.action === "SELL";
              return (
                <div
                  key={idx}
                  className={`p-4 rounded-xl bg-slate-950/90 space-y-2.5 transition-all border ${
                    isBuy
                      ? "border-emerald-500/40 hover:border-emerald-500/60"
                      : isTrim
                      ? "border-amber-500/30 hover:border-amber-500/50"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-1 rounded-lg font-bold text-sm border ${
                          isBuy
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                            : isTrim
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                            : "bg-slate-800 text-slate-300 border-slate-700"
                        }`}
                      >
                        {opp.symbol}
                      </span>
                      <span className="text-xs font-semibold text-white">{opp.companyName || opp.symbol}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onOpenKnowledgeGraph(opp.symbol)}
                        className="px-2 py-0.5 text-[11px] rounded bg-slate-900 border border-slate-800 text-cyan-400 hover:bg-cyan-500/10"
                      >
                        知识图谱 ↗
                      </button>
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          isBuy
                            ? "bg-emerald-500 text-slate-950"
                            : isTrim
                            ? "bg-amber-500 text-slate-950"
                            : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        {isBuy ? `建议建仓 ${opp.suggestedShares} 股` : isTrim ? `建议减仓 ${opp.suggestedShares} 股` : "观望"}
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-300 space-y-1">
                    <div className="font-semibold text-emerald-300 flex items-center justify-between">
                      <span>诊断与选股逻辑:</span>
                      {opp.fundamentalScore ? (
                        <span>基本面评分: <strong>{opp.fundamentalScore}/100</strong></span>
                      ) : null}
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">{opp.rationale || opp.oversoldReason}</p>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                    <span>预估价: <strong className="text-white">${opp.estimatedPrice}</strong></span>
                    <span>目标价: <strong className="text-emerald-400">${opp.targetPrice || "-"}</strong></span>
                    <span>止损防线: <strong className="text-rose-400">${opp.stopLossPrice || "-"}</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 italic text-center">
            盘面暂未发现触发买入/减仓防线的自选标的，将继续实时监测 SearXNG 催化消息。
          </div>
        )}
      </div>

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

      {/* Main Studio Grid: Left 2 Cols (Per-stock 5-item cards) + Right 1 Col (Position Sizer & Retro Discipline) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Per-Stock Unified Core Elements */}
        <div className="lg:col-span-2 space-y-4">
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
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                    filterCategory === "ALL" ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:text-white"
                  }`}
                >
                  全部标的 ({perStockItems.length})
                </button>
                <button
                  onClick={() => setFilterCategory("HOLDING")}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                    filterCategory === "HOLDING" ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:text-white"
                  }`}
                >
                  当前持仓
                </button>
                <button
                  onClick={() => setFilterCategory("CLEARED")}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                    filterCategory === "CLEARED" ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:text-white"
                  }`}
                >
                  既往清仓
                </button>
              </div>

              <button
                onClick={onOpenPipelineModal}
                className="text-xs text-cyan-400 hover:underline flex items-center gap-1 font-semibold"
              >
                <Bot className="w-3.5 h-3.5" />
                <span>Context 上下文 ↗</span>
              </button>
            </div>
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
