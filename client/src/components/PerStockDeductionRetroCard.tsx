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
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

interface KnowledgeNode {
  id: string;
  name: string;
  type: string;
  description?: string;
}

interface KnowledgeEdge {
  source: string;
  target: string;
  relation: string;
  impact: string;
}

interface PerStockDeductionRetroCardProps {
  item: {
    symbol: string;
    companyName?: string;
    knowledgeGraph: {
      nodes: KnowledgeNode[];
      edges: KnowledgeEdge[];
      newsCatalysts: string[];
      guidanceText?: string;
    };
    latestNews: string[];
    communitySentiment?: {
      score: number;
      mood: "BULLISH" | "BEARISH" | "NEUTRAL";
      keyTopics: string[];
    };
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
  const [subTab, setSubTab] = useState<"kg" | "news" | "community" | "position" | "retro">("retro");

  const rec = item.currentRecommendation;
  const pos = item.position;
  const past = item.pastRetro;
  const sentiment = item.communitySentiment;
  const isBuy = rec?.action === "BUY";
  const isTrim = rec?.action === "TRIM" || rec?.action === "SELL";

  const pnl = pos ? (pos.marketPrice - pos.costBasis) * pos.shares : 0;
  const pnlPct = pos && pos.costBasis > 0 ? (((pos.marketPrice - pos.costBasis) / pos.costBasis) * 100).toFixed(1) : "0";

  return (
    <div className="glass-card border-slate-800 hover:border-cyan-500/30 transition-all overflow-hidden">
      {/* Stock Banner Header */}
      <div className="p-4 bg-slate-900/80 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 font-bold text-white text-base">
            {item.symbol}
          </div>
          <div>
            <div className="font-bold text-white text-sm flex items-center gap-2">
              <span>{item.companyName || item.symbol}</span>
              {pos && pos.shares > 0 ? (
                <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  持仓中 ({pos.shares}股)
                </span>
              ) : pos && pos.shares === 0 ? (
                <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  已清仓/平仓 (历史标的)
                </span>
              ) : (
                <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-slate-800 text-slate-400 border border-slate-700">
                  观察区标的
                </span>
              )}
            </div>

            {/* Key Position KPIs (持仓数、买入价、现值、浮盈亏) */}
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
            ) : pos && pos.shares === 0 ? (
              <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-300 mt-1.5">
                <div className="flex items-center gap-1 bg-slate-950 px-2.5 py-1 rounded-lg border border-amber-900/40 text-amber-300 font-semibold">
                  <span>持仓状态:</span>
                  <strong>0 股 (已清仓平仓)</strong>
                </div>
                <div className="flex items-center gap-1 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                  <span className="text-slate-400">历史基准价:</span>
                  <strong className="text-white">${pos.costBasis.toFixed(2)}</strong>
                </div>
                <div className="flex items-center gap-1 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                  <span className="text-slate-400">当前现价:</span>
                  <strong className="text-white">${pos.marketPrice.toFixed(2)}</strong>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400 flex items-center gap-2 mt-1">
                <span>现价: ${pos ? pos.marketPrice.toFixed(2) : (rec?.estimatedPrice || 100).toFixed(2)}</span>
                <span className="text-slate-500 italic">(暂未建立实盘持仓)</span>
              </div>
            )}
          </div>
        </div>

        {/* Current Recommendation Badge */}
        {rec && (
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
              <span>今日建议: {rec.action} ({rec.suggestedShares}股)</span>
            </div>
            <button
              onClick={() => onOpenKnowledgeGraph(item.symbol)}
              className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-cyan-400 hover:bg-cyan-500/10 text-xs transition-all"
            >
              操盘图谱
            </button>
          </div>
        )}
      </div>

      {/* 5 Elements Tab Header */}
      <div className="px-4 py-2 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs py-1">
          <button
            onClick={() => setSubTab("kg")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold transition-all ${
              subTab === "kg"
                ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                : "text-slate-400 hover:text-white bg-slate-900 border border-slate-800"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>1. 知识图谱</span>
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
            <span>2. SearXNG 盘前新闻</span>
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
            <span>3. 社区讨论与情绪</span>
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
            <span>4. MooMoo 持仓</span>
          </button>

          <button
            onClick={() => setSubTab("retro")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold transition-all ${
              subTab === "retro"
                ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                : "text-slate-400 hover:text-white bg-slate-900 border border-slate-800"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>5. 历史复盘教训</span>
          </button>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="text-slate-400 hover:text-white p-1 rounded"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Tab Body */}
      {expanded && (
        <div className="p-4 space-y-3 bg-slate-900/40 text-xs">
          {/* SubTab 4: 之前推演这只股票以及实际盘面变化的复盘 */}
          {subTab === "retro" && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <History className="w-4 h-4 text-cyan-400" />
                    <span>历史推演与走势复盘对齐 ({past.lastStrategyDate || "历史策略记录"})</span>
                  </span>
                  <span className="text-emerald-400 font-bold">
                    准确率: {past.accuracyScore !== undefined ? `${past.accuracyScore}%` : "暂无历史推演数据"}
                  </span>
                </div>
                <p className="text-slate-300 leading-relaxed bg-slate-900 p-2.5 rounded-lg border border-slate-800/80">
                  {past.actualPriceAction || "首次载入标的，等待大模型结合知识图谱推演。"}
                </p>
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span>前次建议: <strong className="text-cyan-300">{past.lastAction || "无"}</strong></span>
                  <span>
                    目标止盈价: {past.lastTargetPrice ? `$${past.lastTargetPrice.toFixed(2)}` : "未设定"} | 止损线: {past.lastStopLossPrice ? `$${past.lastStopLossPrice.toFixed(2)}` : "未设定"}
                  </span>
                </div>
              </div>

              {past.distilledLesson && (
                <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/30 text-cyan-200 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-xs text-cyan-300">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>该股票蒸馏出的操盘风控纪律 (Distilled Discipline):</span>
                  </div>
                  <p className="text-slate-300">{past.distilledLesson}</p>
                </div>
              )}
            </div>
          )}

          {/* SubTab 3: 社区讨论与情绪指数 */}
          {subTab === "community" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 font-bold text-sm">
                    情绪指数: {sentiment?.score !== undefined ? `${sentiment.score}/100` : "暂无"}
                  </div>
                  <div>
                    <div className="font-bold text-white text-xs">
                      散户与机构社区倾向: <span className="text-emerald-400 font-bold">{sentiment?.mood || "未知/等待抓取"}</span>
                    </div>
                    <div className="text-[11px] text-slate-400">基于 SearXNG 全网实时科技社区与资讯分析</div>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
                <div className="font-semibold text-slate-300 text-[11px]">社区热议焦点与消息面讨论:</div>
                <div className="flex flex-wrap gap-1.5">
                  {(sentiment?.keyTopics && sentiment.keyTopics.length > 0
                    ? sentiment.keyTopics
                    : item.latestNews.length > 0
                    ? item.latestNews
                    : ["未检索到该标的公开社区讨论焦点"]
                  ).map((t, idx) => (
                    <span key={idx} className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-cyan-300 text-[11px]">
                      • {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SubTab 1: 知识图谱 */}
          {subTab === "kg" && (
            <div className="space-y-2">
              <div className="font-semibold text-slate-300 flex items-center justify-between">
                <span>实体节点 ({item.knowledgeGraph.nodes.length} 个) & 关系关联边:</span>
                <button
                  onClick={() => onOpenKnowledgeGraph(item.symbol)}
                  className="text-cyan-400 hover:underline"
                >
                  打开完整图形视窗 ↗
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {item.knowledgeGraph.nodes.slice(0, 4).map((node, idx) => (
                  <div key={idx} className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                    <div className="font-bold text-cyan-300">[{node.type}] {node.name}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{node.description || "无描述"}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SubTab 2: SearXNG 新闻 */}
          {subTab === "news" && (
            <div className="space-y-2">
              <div className="font-semibold text-slate-300">SearXNG 盘前全网抓取资讯:</div>
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
                <div className="text-slate-500 italic p-2">实时搜索结果已包含入全量大盘催化剂中</div>
              )}
            </div>
          )}

          {/* SubTab 3: 持仓 */}
          {subTab === "position" && (
            <div className="space-y-2">
              {pos ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div>
                    <span className="text-slate-400 block text-[11px]">持有数量</span>
                    <span className="font-bold text-white">{pos.shares} 股</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">买入成本价</span>
                    <span className="font-bold text-white">${pos.costBasis.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">持仓现值</span>
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
                <div className="text-slate-400 p-2">当前未有实盘持仓 (为潜在备选建仓标的)</div>
              )}
            </div>
          )}

          {/* Current Deduction Rationale Footer */}
          {rec && (
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-slate-400">
              <div className="flex items-center gap-3">
                <Target className="w-4 h-4 text-cyan-400" />
                <span>建议目标价: <strong className="text-emerald-400">${rec.targetPrice?.toFixed(2) || "-"}</strong></span>
                <span>建议止损价: <strong className="text-rose-400">${rec.stopLossPrice?.toFixed(2) || "-"}</strong></span>
              </div>
              <span className="text-[11px] text-slate-400 max-w-md truncate" title={rec.rationale}>
                理由: {rec.rationale}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
