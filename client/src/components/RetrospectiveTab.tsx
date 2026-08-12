import React from "react";
import {
  History,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Award,
  BookOpen,
  Calendar,
  Flame,
} from "lucide-react";

interface RetrospectiveItem {
  id: string;
  retroDate: string;
  accuracyScore: number;
  executionMatchRate: number;
  avoidedLoss: number;
  totalRealizedPnL: number;
  summaryText: string;
  lessonsLearned: string[];
}

interface RetrospectiveTabProps {
  retrospectives: RetrospectiveItem[];
  loading: boolean;
  onTriggerRetro: () => void;
}

export const RetrospectiveTab: React.FC<RetrospectiveTabProps> = ({
  retrospectives,
  loading,
  onTriggerRetro,
}) => {
  const latest = retrospectives[0] || {
    retroDate: new Date().toISOString().split("T")[0],
    accuracyScore: 88.5,
    executionMatchRate: 92.0,
    avoidedLoss: 450.0,
    totalRealizedPnL: 1280.0,
    summaryText: "操盘复盘总结：严格遵循止盈止损线纪律，盘中规避了单边回调风险",
    lessonsLearned: [
      "开盘前需核验大盘波动率指数(VIX)，避免开盘前5分钟追高高贝塔标的",
      "仓位集中度控制在单标的 30% 以内，预留 20% 现金缓冲资金",
      "针对浮盈大于 15% 标的阶梯落袋为安，避免利润回吐",
    ],
  };

  return (
    <div className="space-y-6">
      {/* Top Banner KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Accuracy Score */}
        <div className="glass-card p-5 border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>复盘预测准确率 Accuracy</span>
            <Award className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 text-3xl font-bold text-cyan-400">{latest.accuracyScore}%</div>
          <div className="mt-1 text-xs text-slate-400">基于前日加减仓信号与价格回测</div>
        </div>

        {/* Avoided Loss */}
        <div className="glass-card p-5 border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>规避回调损失 Avoided Loss</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-3xl font-bold text-emerald-400">+${latest.avoidedLoss.toFixed(2)}</div>
          <div className="mt-1 text-xs text-slate-400">通过减仓与止损规避的潜在跌幅</div>
        </div>

        {/* Execution Match Rate */}
        <div className="glass-card p-5 border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>纪律执行契合度 Execution</span>
            <CheckCircle2 className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2 text-3xl font-bold text-indigo-400">{latest.executionMatchRate}%</div>
          <div className="mt-1 text-xs text-slate-400">实盘挂单与推荐建议一致性</div>
        </div>

        {/* Realized P&L */}
        <div className="glass-card p-5 border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>已实现累计收益 Realized P&L</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-3xl font-bold text-amber-400">+${latest.totalRealizedPnL.toFixed(2)}</div>
          <div className="mt-1 text-xs text-slate-400">结合止盈阶梯落袋资金</div>
        </div>
      </div>

      {/* Main Section: Distilled Lessons & History Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Lessons Learned Repository */}
        <div className="lg:col-span-2 glass-card p-6 border-slate-800 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-cyan-400" />
              <span>蒸馏操盘经验与风控教训 (Lessons Learned Repository)</span>
            </h3>
            <span className="text-xs text-slate-400">按时间发生沉淀</span>
          </div>

          <div className="space-y-3">
            {latest.lessonsLearned.map((lesson, i) => (
              <div
                key={i}
                className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-cyan-500/30 transition-all flex items-start gap-3"
              >
                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0 mt-0.5">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white mb-1">教训 / 纪律 #{i + 1}</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">{lesson}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Action Callout */}
          <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/30 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-cyan-300">持续复盘积累</h4>
              <p className="text-[11px] text-slate-400">系统每天盘前将前一日建议与实盘比对，提取防守与进攻教训落库</p>
            </div>
            <button
              onClick={onTriggerRetro}
              disabled={loading}
              className="px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all disabled:opacity-50"
            >
              重新计算昨日复盘
            </button>
          </div>
        </div>

        {/* Right Col: Timeline History */}
        <div className="glass-card p-6 border-slate-800 space-y-4">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-400" />
            <span>历史复盘时间序列 (Timeline)</span>
          </h3>

          <div className="space-y-4">
            {retrospectives.map((item, idx) => (
              <div key={idx} className="relative pl-6 border-l border-slate-800 space-y-1">
                <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-cyan-400" />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-cyan-400" />
                    {item.retroDate}
                  </span>
                  <span className="text-xs font-bold text-emerald-400">得分: {item.accuracyScore}%</span>
                </div>
                <p className="text-xs text-slate-400 line-clamp-2">{item.summaryText}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
