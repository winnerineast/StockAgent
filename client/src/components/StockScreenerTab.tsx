import React, { useState } from "react";
import {
  Search,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Flame,
  ShieldCheck,
  Zap,
  BookOpen,
  PlusCircle,
  ExternalLink,
  Layers,
} from "lucide-react";

interface ActionItem {
  action: "BUY" | "SELL" | "HOLD" | "TRIM";
  symbol: string;
  companyName?: string;
  suggestedShares: number;
  estimatedPrice: number;
  estimatedAmount: number;
  rationale: string;
  urgency: "HIGH" | "MEDIUM" | "LOW";
  targetPrice?: number;
  stopLossPrice?: number;
  riskRewardRatio?: number;
  strategyCategory?: string;
  strategyCategoryLabel?: string;
  strategyCategoryReason?: string;
}

interface WatchlistItem {
  symbol: string;
  companyName: string;
  price: number;
  changePercent: number;
}

interface StockScreenerTabProps {
  watchlist: WatchlistItem[];
  screenerActions: ActionItem[];
  marketOverview: string;
  searxngConnected: boolean;
  onOpenKnowledgeGraph: (symbol: string) => void;
  onAddToPositionManager: (symbol: string) => void;
  onTriggerSearch: (query: string) => void;
}

export const StockScreenerTab: React.FC<StockScreenerTabProps> = ({
  watchlist,
  screenerActions,
  marketOverview,
  searxngConnected,
  onOpenKnowledgeGraph,
  onAddToPositionManager,
  onTriggerSearch,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAction, setFilterAction] = useState<string>("ALL");

  const filteredActions = screenerActions.filter((a) => {
    const matchesSearch =
      a.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.companyName && a.companyName.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesFilter = filterAction === "ALL" || a.action === filterAction;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      {/* SearXNG & Market Overview Banner */}
      <div className="glass-card p-6 border-slate-800 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-cyan-950/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">SearXNG 盘前智能选股引擎</h2>
              <p className="text-xs text-slate-400">实时整合 MooMoo OpenD 行情与 SearXNG 本地 Docker 容器搜索催化剂</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                searxngConnected
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/30"
              }`}
            >
              {searxngConnected ? "SearXNG 已就绪 (http://127.0.0.1:8088)" : "SearXNG 规则引擎模式"}
            </span>
          </div>
        </div>

        <p className="text-sm text-slate-300 bg-slate-950/50 p-4 rounded-xl border border-slate-800/80 leading-relaxed font-normal">
          {marketOverview || "正在通过 SearXNG 抓取美股盘前全网宏观、Fed 利率政策及个股动向..."}
        </p>
      </div>

      {/* Watchlist & Screener Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Search Bar */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="搜索代码 (如 AAPL, NVDA)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-all"
          />
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {["ALL", "BUY", "TRIM", "HOLD", "SELL"].map((type) => (
            <button
              key={type}
              onClick={() => setFilterAction(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterAction === type
                  ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                  : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              {type === "ALL" ? "全部" : type === "BUY" ? "买入建仓" : type === "TRIM" ? "减仓止盈" : type === "HOLD" ? "观望持有" : "卖出"}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Recommended Stock Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredActions.map((action, idx) => {
          const isBuy = action.action === "BUY";
          const isTrim = action.action === "TRIM";
          const isHold = action.action === "HOLD";

          return (
            <div
              key={idx}
              className="glass-card glass-card-hover p-5 border-slate-800/80 flex flex-col justify-between space-y-4"
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-lg font-bold text-white tracking-wide">{action.symbol}</span>
                    {action.strategyCategoryLabel && (
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                        {action.strategyCategoryLabel}
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                        isBuy
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : isTrim
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                      }`}
                    >
                      {action.action}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{action.companyName || action.symbol}</p>
                  {action.strategyCategoryReason && (
                    <p className="text-[11px] text-cyan-200/90 font-medium mt-1">
                      💡 {action.strategyCategoryReason}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => onOpenKnowledgeGraph(action.symbol)}
                  className="p-1.5 rounded-lg bg-slate-900/80 text-cyan-400 hover:bg-cyan-500/10 border border-slate-800 transition-all text-xs flex items-center gap-1"
                  title="查看该股票专属知识图谱"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>知识图谱</span>
                </button>
              </div>

              {/* Price & Target KPIs */}
              <div className="grid grid-cols-3 gap-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800/60 text-center">
                <div>
                  <span className="text-[10px] text-slate-500 block">当前预估价</span>
                  <span className="text-sm font-semibold text-white">${action.estimatedPrice}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">目标止盈价</span>
                  <span className="text-sm font-semibold text-emerald-400">
                    ${action.targetPrice || (action.estimatedPrice * 1.12).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">止损触发价</span>
                  <span className="text-sm font-semibold text-rose-400">
                    ${action.stopLossPrice || (action.estimatedPrice * 0.92).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Rationale */}
              <div className="text-xs text-slate-300 bg-slate-900/40 p-3 rounded-xl border border-slate-800/40 leading-relaxed">
                {action.rationale}
              </div>

              {/* Action Sizing & Urgency */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  <span>盈亏比: <strong className="text-white">{action.riskRewardRatio || 2.2}:1</strong></span>
                </div>

                <button
                  onClick={() => onAddToPositionManager(action.symbol)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/20 transition-all font-medium"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>调仓关注</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* MooMoo Watchlist Bar */}
      <div className="glass-card p-5 border-slate-800">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-cyan-400" />
          <span>MooMoo OpenD 同步自选股热榜 ({watchlist.length} 标的)</span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {watchlist.map((item, i) => {
            const isUp = item.changePercent >= 0;
            return (
              <div
                key={i}
                onClick={() => onOpenKnowledgeGraph(item.symbol)}
                className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 hover:border-cyan-500/40 cursor-pointer transition-all flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-xs">{item.symbol}</span>
                  <span className={`text-[10px] font-semibold flex items-center ${isUp ? "text-emerald-400" : "text-rose-400"}`}>
                    {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {Math.abs(item.changePercent).toFixed(1)}%
                  </span>
                </div>
                <div className="mt-2 text-xs font-semibold text-slate-300">${item.price.toFixed(2)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
