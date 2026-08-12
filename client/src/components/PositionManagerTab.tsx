import React, { useState } from "react";
import {
  DollarSign,
  PieChart,
  TrendingUp,
  ShieldAlert,
  Sliders,
  RefreshCw,
} from "lucide-react";

interface PositionItem {
  id?: string;
  symbol: string;
  companyName?: string;
  shares: number;
  costBasis: number;
  marketPrice: number;
  marketValue?: number;
  pnl?: number;
  pnlPct?: number;
}

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
}

interface PositionManagerTabProps {
  netAssets: number;
  cashBalance: number;
  totalMarketValue: number;
  totalPnL: number;
  totalPnLPct: number;
  positions: PositionItem[];
  rebalanceActions: ActionItem[];
  isUnlocked: boolean;
  loading: boolean;
  onOpenKnowledgeGraph: (symbol: string) => void;
  onOpenUnlockModal: () => void;
  onExecuteRebalance: (budget: number, risk: string) => void;
}

export const PositionManagerTab: React.FC<PositionManagerTabProps> = ({
  netAssets,
  cashBalance,
  totalMarketValue,
  totalPnL,
  totalPnLPct,
  positions,
  rebalanceActions,
  isUnlocked,
  loading,
  onOpenKnowledgeGraph,
  onOpenUnlockModal,
  onExecuteRebalance,
}) => {
  const [customBudget, setCustomBudget] = useState<number>(1000);
  const [riskPreference, setRiskPreference] = useState<string>("BALANCED");
  const [selectedTicket, setSelectedTicket] = useState<ActionItem | null>(null);

  // 模拟调仓后的预计变化
  const totalProjectedAmount = rebalanceActions.reduce((acc, a) => {
    if (a.action === "BUY") return acc + a.estimatedAmount;
    if (a.action === "TRIM" || a.action === "SELL") return acc - a.estimatedAmount;
    return acc;
  }, 0);

  const projectedCash = Math.max(0, cashBalance - totalProjectedAmount);
  const isPnLPos = totalPnL >= 0;

  return (
    <div className="space-y-6">
      {/* Asset KPI Cards Banner */}
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

        {/* Total Market Value */}
        <div className="glass-card p-5 border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>持仓市值 Market Value</span>
            <PieChart className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white tracking-tight">${totalMarketValue.toFixed(2)}</div>
          <div className="mt-1 text-xs text-slate-400">可用现金: ${cashBalance.toFixed(2)}</div>
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

        {/* Risk Warning */}
        <div className="glass-card p-5 border-slate-800 flex flex-col justify-between bg-slate-900/50">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>交易权限 Trade Status</span>
            <ShieldAlert className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className={`text-sm font-semibold ${isUnlocked ? "text-emerald-400" : "text-amber-400"}`}>
              {isUnlocked ? "MooMoo 已解锁" : "未解锁交易密码"}
            </span>
          </div>
          <button
            onClick={onOpenUnlockModal}
            className="mt-2 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all text-center"
          >
            {isUnlocked ? "重置权限" : "点击解锁密码"}
          </button>
        </div>
      </div>

      {/* Main Grid: Position Table + Position Sizing Calculator */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: MooMoo Holding Table */}
        <div className="lg:col-span-2 glass-card p-6 border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <PieChart className="w-5 h-5 text-cyan-400" />
              <span>MooMoo 实盘持仓分布与集中度</span>
            </h3>
            <span className="text-xs text-slate-400">共 {positions.length} 笔持有资产</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-3">代码 / 名称</th>
                  <th className="py-3 px-3">持有股数</th>
                  <th className="py-3 px-3">摊薄成本</th>
                  <th className="py-3 px-3">当前现价</th>
                  <th className="py-3 px-3">浮动盈亏</th>
                  <th className="py-3 px-3">集中度</th>
                  <th className="py-3 px-3 text-right">操盘图谱</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {positions.map((p, idx) => {
                  const pnl = p.pnl || 0;
                  const pnlPct = p.pnlPct || 0;
                  const isUp = pnl >= 0;
                  const concentration = netAssets > 0 ? (((p.marketValue || p.shares * p.marketPrice) / netAssets) * 100).toFixed(1) : "0";

                  return (
                    <tr key={idx} className="hover:bg-slate-900/50 transition-all">
                      <td className="py-3.5 px-3">
                        <div className="font-bold text-white text-sm">{p.symbol}</div>
                        <div className="text-[11px] text-slate-400">{p.companyName || p.symbol}</div>
                      </td>
                      <td className="py-3.5 px-3 font-semibold text-slate-200">{p.shares} 股</td>
                      <td className="py-3.5 px-3 text-slate-300">${p.costBasis.toFixed(2)}</td>
                      <td className="py-3.5 px-3 font-semibold text-white">${p.marketPrice.toFixed(2)}</td>
                      <td className={`py-3.5 px-3 font-bold ${isUp ? "text-emerald-400" : "text-rose-400"}`}>
                        {isUp ? "+" : ""}${pnl.toFixed(2)} ({isUp ? "+" : ""}{pnlPct.toFixed(1)}%)
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-cyan-500 h-full rounded-full"
                              style={{ width: `${Math.min(100, Number(concentration))}%` }}
                            />
                          </div>
                          <span className="text-slate-300 font-semibold text-[11px]">{concentration}%</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <button
                          onClick={() => onOpenKnowledgeGraph(p.symbol)}
                          className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-cyan-400 hover:bg-cyan-500/10 transition-all text-[11px]"
                        >
                          图谱
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Col: 仓位加减控制器 (Position Sizing Calculator) */}
        <div className="glass-card p-6 border-slate-800 flex flex-col justify-between space-y-5">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-cyan-400" />
                <span>仓位加减控制器 (Sizer)</span>
              </h3>
            </div>

            {/* Budget Slider */}
            <div className="space-y-2 mb-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>调仓预算 (Budget)</span>
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
            <div className="space-y-2 mb-4">
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

            {/* Calculate Button with Loading State */}
            <button
              onClick={() => onExecuteRebalance(customBudget, riskPreference)}
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all mb-4 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                  <span>正在调用 Ollama 大模型推演中...</span>
                </>
              ) : (
                <span>重新推演开盘加减仓参数</span>
              )}
            </button>

            {/* Recommendations List */}
            <div className="space-y-3">
              <span className="text-xs font-semibold text-slate-400 block">开盘调仓建议 (Action Tickets)</span>
              {rebalanceActions.slice(0, 4).map((item, idx) => {
                const isBuy = item.action === "BUY";
                const isTrim = item.action === "TRIM" || item.action === "SELL";

                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedTicket(item)}
                    className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-cyan-500/40 cursor-pointer transition-all flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg text-xs font-bold ${
                          isBuy
                            ? "bg-emerald-500/20 text-emerald-400"
                            : isTrim
                            ? "bg-rose-500/20 text-rose-400"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {item.action}
                      </div>
                      <div>
                        <div className="font-bold text-white text-xs">{item.symbol}</div>
                        <div className="text-[10px] text-slate-400">
                          {isBuy ? `建议加仓 ${item.suggestedShares}股` : isTrim ? `建议减仓 ${item.suggestedShares}股` : "继续观察"}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-slate-200">${item.estimatedAmount}</div>
                      <div className="text-[10px] text-slate-400">现价 ${item.estimatedPrice}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Simulator Preview Bar */}
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span>调仓后预计现金:</span>
              <span className="font-bold text-white">${projectedCash.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>调仓资金变动净额:</span>
              <span className={`font-bold ${totalProjectedAmount >= 0 ? "text-emerald-400" : "text-amber-400"}`}>
                {totalProjectedAmount >= 0 ? "+" : ""}${totalProjectedAmount.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
