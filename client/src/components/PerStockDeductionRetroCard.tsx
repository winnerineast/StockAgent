import React, { useState } from "react";
import {
  Layers,
  Search,
  PieChart,
  History,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Target,
  ShieldAlert,
  Sparkles,
  DollarSign,
  Activity,
  BookOpen,
} from "lucide-react";
interface CapitalFlowItem {
  trend: "INFLOW" | "OUTFLOW" | "NEUTRAL";
  description: string;
  netInflowAmount?: string;
}

interface CommunitySentimentItem {
  score?: number;
  mood: "BULLISH" | "BEARISH" | "NEUTRAL" | "UNKNOWN";
  keyTopics: string[];
}

interface StockFundamentals {
  symbol: string;
  companyName?: string;
  peRatio?: number;
  revenueGrowthPct?: number;
  netMarginPct?: number;
  debtToEquity?: number;
  nextEarningsDate?: string;
  fundamentalSummary?: string;
}

interface KnowledgeNode {
  id: string;
  name: string;
  type: string;
  description?: string;
  recencyWeight?: number;
}

interface KnowledgeEdge {
  source: string;
  target: string;
  relation: string;
  impact: string;
  recencyWeight?: number;
}

interface PerStockDeductionRetroCardProps {
  item: {
    symbol: string;
    companyName?: string;
    candidateCategory?: "EXISTING_HOLDING" | "WATCHLIST" | "MACRO_CANDIDATE";
    strategyCategory?: "OVERSOLD_BUY" | "FUNDAMENTAL_BUY" | "NEWS_CATALYST_BUY" | "CAPITAL_INFLOW_BUY" | "WATCH_AND_WAIT";
    strategyCategoryLabel?: string;
    strategyCategoryReason?: string;
    knowledgeGraph: {
      nodes: KnowledgeNode[];
      edges: KnowledgeEdge[];
      newsCatalysts: string[];
      guidanceText?: string;
      compressedSummary?: string;
    };
    latestNews: string[];
    communitySentiment?: CommunitySentimentItem;
    capitalFlow?: CapitalFlowItem;
    fundamentals?: StockFundamentals;
    position?: {
      shares: number;
      costBasis: number;
      marketPrice: number;
    };
    pastRetro: {
      lastStrategyDate?: string;
      lastAction?: string;
      lastTargetPrice?: number;
      lastStopLossPrice?: number;
      actualPriceAction?: string;
      pnlImpact?: number;
      accuracyScore?: number;
      distilledLesson?: string;
    };
    currentRecommendation?: {
      action: "BUY" | "SELL" | "HOLD" | "TRIM";
      suggestedShares: number;
      estimatedPrice: number;
      estimatedAmount: number;
      rationale: string;
      targetPrice?: number;
      stopLossPrice?: number;
      riskRewardRatio?: number;
    };
  };
  onOpenKnowledgeGraph: (symbol: string) => void;
}

export const PerStockDeductionRetroCard: React.FC<PerStockDeductionRetroCardProps> = ({
  item,
  onOpenKnowledgeGraph,
}) => {
  const [expanded, setExpanded] = useState<boolean>(true);
  const [subTab, setSubTab] = useState<"retro" | "capitalFlow" | "community" | "fundamentals" | "kg" | "news" | "position">("retro");

  const rec = item.currentRecommendation;
  const pos = item.position;
  const past = item.pastRetro;
  const sentiment = item.communitySentiment;
  const flow = item.capitalFlow;
  const fund = item.fundamentals;
  const isBuy = rec?.action === "BUY";
  const isTrim = rec?.action === "TRIM" || rec?.action === "SELL";

  const pnl = pos ? (pos.marketPrice - pos.costBasis) * pos.shares : 0;
  const pnlPct = pos && pos.costBasis > 0 ? (((pos.marketPrice - pos.costBasis) / pos.costBasis) * 100).toFixed(1) : "0";

  const categoryLabel = item.candidateCategory === "EXISTING_HOLDING"
    ? "实盘持仓"
    : item.candidateCategory === "WATCHLIST"
    ? "MooMoo 自选"
    : "宏观选股";

  return (
    <div className="glass-card border-slate-800 hover:border-cyan-500/30 transition-all overflow-hidden">
      {/* Stock Banner Header */}
      <div className="p-4 bg-slate-900/80 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 font-bold text-white text-base flex items-center gap-2">
            <span>{item.symbol}</span>
            <span className="text-[10px] font-normal px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              {categoryLabel}
            </span>
          </div>
          <div>
            <div className="font-bold text-white text-sm flex items-center gap-2 flex-wrap">
              <span>{item.companyName || item.symbol}</span>
              {item.strategyCategoryLabel && (
                <span className={`px-2 py-0.5 text-[11px] font-bold rounded-md border ${
                  item.strategyCategory === "OVERSOLD_BUY"
                    ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                    : item.strategyCategory === "FUNDAMENTAL_BUY"
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    : item.strategyCategory === "NEWS_CATALYST_BUY"
                    ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
                    : item.strategyCategory === "CAPITAL_INFLOW_BUY"
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    : "bg-slate-800 text-slate-300 border-slate-700"
                }`}>
                  {item.strategyCategoryLabel}
                </span>
              )}
              {pos && pos.shares > 0 ? (
                <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  持仓中 ({pos.shares}股)
                </span>
              ) : pos && pos.shares === 0 ? (
                <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  已平仓 (0股)
                </span>
              ) : (
                <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-slate-800 text-slate-400 border border-slate-700">
                  全美股精选
                </span>
              )}
            </div>
            {item.strategyCategoryReason && (
              <p className="text-[11px] text-cyan-200/90 font-medium mt-1 leading-snug">
                💡 {item.strategyCategoryReason}
              </p>
            )}

            {pos && pos.shares > 0 ? (
              <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-300 mt-1.5">
                <div className="flex items-center gap-1 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                  <span className="text-slate-400">持仓:</span>
                  <strong className="text-white">{pos.shares} 股</strong>
                </div>
                <div className="flex items-center gap-1 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                  <span className="text-slate-400">买入成本:</span>
                  <strong className="text-white">${pos.costBasis.toFixed(2)}</strong>
                </div>
                <div className="flex items-center gap-1 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                  <span className="text-slate-400">当前现价:</span>
                  <strong className="text-white">${pos.marketPrice.toFixed(2)}</strong>
                </div>
                <div className="flex items-center gap-1 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                  <span className="text-slate-400">持仓现值:</span>
                  <strong className="text-cyan-300 font-bold">${(pos.shares * pos.marketPrice).toFixed(2)}</strong>
                </div>
                <div
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold border ${
                    pnl >= 0
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                  }`}
                >
                  <span>浮盈亏:</span>
                  <span>
                    {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} ({pnl >= 0 ? "+" : ""}{pnlPct}%)
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400 flex items-center gap-2 mt-1">
                <span>现价: ${pos ? pos.marketPrice.toFixed(2) : (rec?.estimatedPrice || 0).toFixed(2)}</span>
                <span className="text-slate-500 italic">(暂未建立实盘持仓)</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div
            className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
              isBuy
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                : isTrim
                ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                : "bg-slate-800 text-slate-300 border border-slate-700"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>
              今日建议: {rec ? `${rec.action} (${rec.suggestedShares}股)` : "HOLD (0股)"}
            </span>
          </div>
          <button
            onClick={() => onOpenKnowledgeGraph(item.symbol)}
            className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-cyan-400 hover:bg-cyan-500/10 text-xs transition-all"
          >
            操盘图谱
          </button>
        </div>
      </div>

      {/* SubTab Header */}
      <div className="px-4 py-2 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs py-1">
          <button
            onClick={() => setSubTab("retro")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold transition-all ${
              subTab === "retro"
                ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                : "text-slate-400 hover:text-white bg-slate-900 border border-slate-800"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>1. 4维走势复盘</span>
          </button>

          <button
            onClick={() => setSubTab("capitalFlow")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold transition-all ${
              subTab === "capitalFlow"
                ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                : "text-slate-400 hover:text-white bg-slate-900 border border-slate-800"
            }`}
          >
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            <span>2. 大资金/机构动向</span>
          </button>

          <button
            onClick={() => setSubTab("community")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold transition-all ${
              subTab === "community"
                ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                : "text-slate-400 hover:text-white bg-slate-900 border border-slate-800"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>3. 散户/社区情绪</span>
          </button>

          <button
            onClick={() => setSubTab("fundamentals")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold transition-all ${
              subTab === "fundamentals"
                ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                : "text-slate-400 hover:text-white bg-slate-900 border border-slate-800"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>4. 基本面与财报</span>
          </button>

          <button
            onClick={() => setSubTab("kg")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold transition-all ${
              subTab === "kg"
                ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                : "text-slate-400 hover:text-white bg-slate-900 border border-slate-800"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>5. 知识图谱与衰减</span>
          </button>

          <button
            onClick={() => setSubTab("news")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold transition-all ${
              subTab === "news"
                ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                : "text-slate-400 hover:text-white bg-slate-900 border border-slate-800"
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>6. 消歧重磅新闻</span>
          </button>

          <button
            onClick={() => setSubTab("position")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold transition-all ${
              subTab === "position"
                ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                : "text-slate-400 hover:text-white bg-slate-900 border border-slate-800"
            }`}
          >
            <PieChart className="w-3.5 h-3.5" />
            <span>7. MooMoo 盘面明细</span>
          </button>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="text-slate-400 hover:text-white p-1 rounded"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* SubTab Content */}
      {expanded && (
        <div className="p-4 space-y-3 bg-slate-900/40 text-xs">
          {/* SubTab 1: 4维走势复盘 */}
          {subTab === "retro" && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <History className="w-4 h-4 text-cyan-400" />
                    <span>前次推演与盘面核验对齐 ({past.lastStrategyDate || "无历史对比记录"})</span>
                  </span>
                  <span className="text-emerald-400 font-bold">
                    预测准确率: {past.accuracyScore !== undefined ? `${past.accuracyScore}%` : "未知/首日无数据"}
                  </span>
                </div>
                <p className="text-slate-300 leading-relaxed bg-slate-900 p-2.5 rounded-lg border border-slate-800/80">
                  {past.actualPriceAction || "未检测到历史推演基准，暂无盘面复盘对比数据。"}
                </p>
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span>前次建议: <strong className="text-cyan-300">{past.lastAction || "未知"}</strong></span>
                  <span>
                    止盈目标价: {past.lastTargetPrice ? `$${past.lastTargetPrice.toFixed(2)}` : "未知"} | 止损线: {past.lastStopLossPrice ? `$${past.lastStopLossPrice.toFixed(2)}` : "未知"}
                  </span>
                </div>
              </div>

              {past.distilledLesson && (
                <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/30 text-cyan-200 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-xs text-cyan-300">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>蒸馏交易纪律 (Distilled Lesson):</span>
                  </div>
                  <p className="text-slate-300">{past.distilledLesson}</p>
                </div>
              )}
            </div>
          )}

          {/* SubTab 2: 大资金/机构动向 */}
          {subTab === "capitalFlow" && (
            <div className="space-y-2">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <span>机构与主力大资金走向 (Institutional Capital Flow)</span>
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                      flow?.trend === "INFLOW"
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                        : flow?.trend === "OUTFLOW"
                        ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {flow?.trend === "INFLOW" ? "主力净流入 (INFLOW)" : flow?.trend === "OUTFLOW" ? "主力净流出 (OUTFLOW)" : "中性/未知"}
                  </span>
                </div>
                <p className="text-slate-300 leading-relaxed bg-slate-900 p-2.5 rounded-lg border border-slate-800/80">
                  {flow?.description || "暂未搜刮到显著主力大资金动向"}
                </p>
              </div>
            </div>
          )}

          {/* SubTab 3: 社区讨论与情绪 */}
          {subTab === "community" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 font-bold text-sm">
                    情绪得分: {sentiment?.score !== undefined ? `${sentiment.score}/100` : "未知"}
                  </div>
                  <div>
                    <div className="font-bold text-white text-xs">
                      社区散户与社交倾向: <span className="text-emerald-400 font-bold">{sentiment?.mood || "未知"}</span>
                    </div>
                    <div className="text-[11px] text-slate-400">基于 SearXNG 抓取 Reddit / StockTwits 搜刮解析</div>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
                <div className="font-semibold text-slate-300 text-[11px]">社区热议焦点:</div>
                <div className="flex flex-wrap gap-1.5">
                  {sentiment?.keyTopics && sentiment.keyTopics.length > 0 ? (
                    sentiment.keyTopics.map((t: string, idx: number) => (
                      <span key={idx} className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-cyan-300 text-[11px]">
                        • {t}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-500 italic text-[11px]">暂无搜刮到的社区讨论主题</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SubTab 4: 基本面与财报 */}
          {subTab === "fundamentals" && (
            <div className="space-y-2">
              {fund ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div>
                    <span className="text-slate-400 block text-[11px]">市盈率 PE Ratio</span>
                    <span className="font-bold text-white">{fund.peRatio !== undefined ? fund.peRatio : "未知"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">营收同比 Revenue Growth</span>
                    <span className="font-bold text-emerald-400">{fund.revenueGrowthPct !== undefined ? `${fund.revenueGrowthPct}%` : "未知"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">净利润率 Net Margin</span>
                    <span className="font-bold text-cyan-300">{fund.netMarginPct !== undefined ? `${fund.netMarginPct}%` : "未知"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">下次财报日 Next Earnings</span>
                    <span className="font-bold text-slate-200">{fund.nextEarningsDate || "未知"}</span>
                  </div>
                </div>
              ) : (
                <div className="text-slate-400 italic p-3 bg-slate-950 rounded-xl border border-slate-800">
                  暂未录入该标的详细财报指标
                </div>
              )}
            </div>
          )}

          {/* SubTab 5: 知识图谱 */}
          {subTab === "kg" && (
            <div className="space-y-2">
              <div className="font-semibold text-slate-300 flex items-center justify-between">
                <span>图谱节点 ({item.knowledgeGraph.nodes.length} 个) & 衰减记忆:</span>
                <button
                  onClick={() => onOpenKnowledgeGraph(item.symbol)}
                  className="text-cyan-400 hover:underline"
                >
                  查看图形视窗 ↗
                </button>
              </div>

              {item.knowledgeGraph.compressedSummary && (
                <div className="p-2.5 rounded-lg bg-indigo-950/30 border border-indigo-500/30 text-indigo-200 text-[11px]">
                  <strong>图谱提纯压缩记忆:</strong> {item.knowledgeGraph.compressedSummary}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {item.knowledgeGraph.nodes.slice(0, 4).map((node, idx) => (
                  <div key={idx} className="p-2 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-cyan-300">[{node.type}] {node.name}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{node.description || "无描述"}</div>
                    </div>
                    {node.recencyWeight !== undefined && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                        权重: {node.recencyWeight}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SubTab 6: 消歧重磅新闻 */}
          {subTab === "news" && (
            <div className="space-y-2">
              <div className="font-semibold text-slate-300">SearXNG 消歧检索重磅新闻:</div>
              {item.latestNews.length > 0 ? (
                <ul className="space-y-1.5">
                  {item.latestNews.map((n, i) => (
                    <li key={i} className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 flex items-start gap-2">
                      <span className="text-cyan-400 font-bold">•</span>
                      <span>{n}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-slate-500 italic p-2">暂无检索到的重磅个股新闻</div>
              )}
            </div>
          )}

          {/* SubTab 7: 持仓 */}
          {subTab === "position" && (
            <div className="space-y-2">
              {pos && pos.shares > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div>
                    <span className="text-slate-400 block text-[11px]">持有数量</span>
                    <span className="font-bold text-white">{pos.shares} 股</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">成本价</span>
                    <span className="font-bold text-white">${pos.costBasis.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">现值</span>
                    <span className="font-bold text-cyan-300">${(pos.shares * pos.marketPrice).toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">浮动盈亏</span>
                    <span className={`font-bold ${pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} ({pnl >= 0 ? "+" : ""}{pnlPct}%)
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-slate-400 italic p-2">暂未建立实盘持仓</div>
              )}
            </div>
          )}

          {/* Target Boundaries Footer */}
          {rec && (
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-slate-400">
              <div className="flex items-center gap-3">
                <Target className="w-4 h-4 text-cyan-400" />
                <span>止盈目标价: <strong className="text-emerald-400">${rec.targetPrice ? rec.targetPrice.toFixed(2) : "未知"}</strong></span>
                <span>止损防线价: <strong className="text-rose-400">${rec.stopLossPrice ? rec.stopLossPrice.toFixed(2) : "未知"}</strong></span>
              </div>
              <span className="text-[11px] text-slate-300 max-w-md truncate" title={rec.rationale}>
                理由: {rec.rationale}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
