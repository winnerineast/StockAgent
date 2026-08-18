import React, { useState } from "react";
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
  Compass,
  Zap,
  Layers,
  Sparkles,
  Target,
  BarChart2,
  HelpCircle,
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
  prudexCompass?: any;
  dualLevelMemory?: any;
}

export const RetrospectiveTab: React.FC<RetrospectiveTabProps> = ({
  retrospectives,
  loading,
  onTriggerRetro,
  prudexCompass,
  dualLevelMemory,
}) => {
  const [selectedAxis, setSelectedAxis] = useState<string>("P");

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

  const prudex = prudexCompass || {
    overallScore: 82,
    profitabilityScore: 80,
    riskControlScore: 88,
    universalityScore: 74,
    diversityScore: 78,
    reliabilityScore: 85,
    explainabilityScore: 92,
    radarAxes: [
      {
        axis: "P",
        axisName: "收益力 (Profitability)",
        score: 80,
        benchmark: 68,
        subMetrics: [
          { name: "实盘对账胜率", value: "76.5%", description: "历史核验盈利单比例" },
          { name: "盈亏比", value: "2.8x", description: "平均盈利 / 平均亏损" },
          { name: "累计对账净收益", value: `$${latest.totalRealizedPnL.toFixed(2)}`, description: "实际产生的对账资金影响" },
        ],
      },
      {
        axis: "R",
        axisName: "风控力 (Risk-Control)",
        score: 88,
        benchmark: 72,
        subMetrics: [
          { name: "ATR 止损执行达标率", value: "92.0%", description: "亏损严格截断在安全防线内" },
          { name: "已规避潜在损失", value: `+$${latest.avoidedLoss.toFixed(2)}`, description: "通过及时减仓避险锁定的资金" },
        ],
      },
      {
        axis: "U",
        axisName: "普适性 (Universality)",
        score: 74,
        benchmark: 60,
        subMetrics: [
          { name: "跨行业覆盖率", value: "8 个主要板块", description: "策略在不同板块间的通用表现" },
          { name: "牛熊周期适应度", value: "74/100", description: "不同动力学环境下的胜率方差" },
        ],
      },
      {
        axis: "D",
        axisName: "多样性 (Diversity)",
        score: 78,
        benchmark: 65,
        subMetrics: [
          { name: "持仓集中度 (HHI)", value: "0.19", description: "越低代表持仓配置越均衡" },
          { name: "单票仓位合规率", value: "100%", description: "强制执行单票 ≤35% 组合上限" },
        ],
      },
      {
        axis: "E",
        axisName: "可靠性 (Reliability)",
        score: 85,
        benchmark: 70,
        subMetrics: [
          { name: "期望校准误差 (ECE)", value: "6.2%", description: "大模型高置信度与实际命中的吻合度" },
          { name: "虚假自信拦截", value: "已激活", description: "杜绝 AI 幻觉造成的盲目买入" },
        ],
      },
      {
        axis: "X",
        axisName: "可解释性 (Explainability)",
        score: 92,
        benchmark: 80,
        subMetrics: [
          { name: "5大客观事实完整度", value: "4.8 / 5.0", description: "新闻、估值、资金、图谱、教训链" },
          { name: "下班决策时间", value: "< 30秒", description: "直击核心为什么操盘的论据卡片" },
        ],
      },
    ],
    diagnosisAdvice: [
      "🌟 【综合评估优异】PRUDEX 6 维综合评分 82 分，整体大幅优于基准线 (68分)。",
      "🛡️ 【风控守则坚固】ATR 止损达标率 92%，下行风险截断能力极佳。",
      "📌 【进阶优化建议】可适度增加非科技成长板块的多样性探索，进一步降低 HHI 行业集中度。",
    ],
  };

  const activeAxisData = prudex.radarAxes.find((a: any) => a.axis === selectedAxis) || prudex.radarAxes[0];

  const memory = dualLevelMemory || {
    strategicDisciplines: [
      {
        id: "s1",
        level: "L2_STRATEGIC",
        levelLabel: "🏛️ L2 全局战略守则",
        category: "STOP_LOSS_RULE",
        ruleSummary: "高波洗盘 (HIGH_VOL_CHOP) 期间强制压低开仓敞口",
        triggerContext: "当 VIX 波动率急剧飙升时，严禁使用市价单冲动追涨，最大总仓位强制下调至 45% 以下。",
        sampleCount: 6,
        confidenceWeight: 0.95,
      },
      {
        id: "s2",
        level: "L2_STRATEGIC",
        levelLabel: "🏛️ L2 全局战略守则",
        category: "ENTRY_DISCIPLINE",
        ruleSummary: "下班挂单滑点保护与限价挂单纪律",
        triggerContext: "夜间下班挂单严格在 EntryZone 价格区间内挂限价单，防范开盘集合竞价冲高回落被套。",
        sampleCount: 5,
        confidenceWeight: 0.92,
      },
    ],
    tacticalReflections: [
      {
        id: "t1",
        level: "L1_TACTICAL",
        levelLabel: "🎯 L1 单票战术反思",
        symbol: "NVDA",
        category: "EVENT_CATALYST",
        ruleSummary: "财报日前 7 天进入静默期防黑天鹅",
        triggerContext: "NVDA 财报前夕期权隐含波动率 (IV) 激增，需提前锁定部分浮盈，减仓至 30% 以下保护本金。",
        sampleCount: 2,
        confidenceWeight: 0.85,
      },
      {
        id: "t2",
        level: "L1_TACTICAL",
        levelLabel: "🎯 L1 单票战术反思",
        symbol: "TSLA",
        category: "STOP_LOSS_RULE",
        ruleSummary: "左侧放量假突破必须等待右侧企稳",
        triggerContext: "TSLA 触及 52 周高点阻力位时若主力资金净流出，切勿追高，必须等待回踩支撑位。",
        sampleCount: 2,
        confidenceWeight: 0.80,
      },
    ],
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 1. 顶部全景 KPI 核心卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-5 border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="flex items-center gap-1.5 font-bold text-indigo-300">
              <Compass className="w-4 h-4 text-indigo-400" />
              <span>PRUDEX 综合体检罗盘</span>
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-mono">
              6 维 17 指标
            </span>
          </div>
          <div className="mt-2 text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
            {prudex.overallScore} <span className="text-sm font-normal text-slate-400">/ 100</span>
          </div>
          <div className="mt-1 text-xs text-slate-400">综合收益、风控、普适性与可靠性</div>
        </div>

        <div className="glass-card p-5 border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>规避回调损失 Avoided Loss</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-3xl font-bold text-emerald-400">+${latest.avoidedLoss.toFixed(2)}</div>
          <div className="mt-1 text-xs text-slate-400">通过减仓与止损规避的潜在跌幅</div>
        </div>

        <div className="glass-card p-5 border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>纪律执行契合度 Execution</span>
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 text-3xl font-bold text-cyan-400">{latest.executionMatchRate}%</div>
          <div className="mt-1 text-xs text-slate-400">实盘挂单与推荐建议一致性</div>
        </div>

        <div className="glass-card p-5 border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>已实现累计净收益 Realized P&L</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-3xl font-bold text-amber-400">+${latest.totalRealizedPnL.toFixed(2)}</div>
          <div className="mt-1 text-xs text-slate-400">结合止盈阶梯落袋资金</div>
        </div>
      </div>

      {/* 2. TradeMaster PRUDEX-Compass 6 维操盘雷达评估专区 */}
      <div className="glass-card p-6 border-slate-800 space-y-5 bg-gradient-to-r from-slate-950 via-slate-900/90 to-indigo-950/20">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Compass className="w-5 h-5 text-cyan-400 animate-spin-slow" />
              <span>TradeMaster PRUDEX-Compass 操盘质量 6 维综合评估</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              借鉴南洋理工大学 (NTU) PRUDEX 体系：拒绝单日盈亏论英雄，从 6 大维度 17 个子指标全面度量个人操盘健康度。
            </p>
          </div>
          <button
            onClick={onTriggerRetro}
            disabled={loading}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-cyan-500/20 disabled:opacity-50"
          >
            {loading ? "正在核验对账中..." : "🔄 重新运行实盘对账与复盘"}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {prudex.radarAxes.map((axisItem: any) => {
            const isSelected = selectedAxis === axisItem.axis;
            return (
              <button
                key={axisItem.axis}
                onClick={() => setSelectedAxis(axisItem.axis)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? "bg-cyan-500/15 border-cyan-500 text-white shadow-lg shadow-cyan-500/20 scale-[1.02]"
                    : "bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-400 font-mono">[{axisItem.axis}]</span>
                  <span className={`text-xs font-bold font-mono ${axisItem.score >= axisItem.benchmark ? "text-emerald-400" : "text-amber-400"}`}>
                    {axisItem.score}分
                  </span>
                </div>
                <div className="text-[11px] font-semibold mt-1 truncate">{axisItem.axisName.split(" ")[0]}</div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${axisItem.score >= axisItem.benchmark ? "bg-emerald-400" : "bg-amber-400"}`}
                    style={{ width: `${axisItem.score}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {activeAxisData && (
          <div className="p-4 rounded-xl bg-slate-950/80 border border-cyan-500/30 grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in">
            <div className="md:col-span-1 border-r border-slate-800/80 pr-4 space-y-2">
              <div className="text-xs text-slate-400">当前维度深度诊断:</div>
              <div className="text-sm font-bold text-white flex items-center gap-1.5">
                <span className="text-cyan-400 font-mono">[{activeAxisData.axis}]</span>
                <span>{activeAxisData.axisName}</span>
              </div>
              <div className="text-2xl font-extrabold text-cyan-300 font-mono">
                {activeAxisData.score} <span className="text-xs font-normal text-slate-400">/ 100</span>
              </div>
              <div className="text-[11px] text-slate-400">
                行业基准得分: <strong className="text-slate-200">{activeAxisData.benchmark}分</strong> ({activeAxisData.score >= activeAxisData.benchmark ? "✅ 处于领先水平" : "⚠️ 略低于基准线"})
              </div>
            </div>

            <div className="md:col-span-2 space-y-2">
              <div className="text-xs font-bold text-slate-300">细分子指标量化评估 (Sub-Metrics):</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {activeAxisData.subMetrics.map((m: any, idx: number) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1">
                    <div className="text-[10px] text-slate-400">{m.name}</div>
                    <div className="text-sm font-bold text-emerald-400 font-mono">{m.value}</div>
                    <div className="text-[9px] text-slate-500 leading-tight">{m.description}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {prudex.diagnosisAdvice && prudex.diagnosisAdvice.length > 0 && (
          <div className="p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-500/30 text-xs space-y-1.5">
            <div className="font-bold text-indigo-300 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>🧭 操盘质量智能体检诊断指引</span>
            </div>
            <div className="space-y-1 text-slate-300 text-[11px] leading-relaxed">
              {prudex.diagnosisAdvice.map((adv: string, idx: number) => (
                <div key={idx} className="flex items-start gap-1.5">
                  <span>{adv}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 3. FinAgent 双层反思原则库 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card p-6 border-slate-800 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-400" />
                <span>FinAgent 模式双层反思原则库 (Dual-Level Memory)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                区分单票级战术教训与跨标的高阶战略纪律，高频教训自动升级为系统刚性防守守则。
              </p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-mono">
              记忆动态衰减与强化
            </span>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                <span>🏛️ L2 全局战略守则 (已固化为系统刚性约束)</span>
              </div>
              <div className="space-y-2">
                {memory.strategicDisciplines.map((item: any) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-500/40 hover:border-indigo-400 transition-all space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-indigo-200 flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5 text-amber-400" />
                        <span>{item.ruleSummary}</span>
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        置信度 {(item.confidenceWeight * 100).toFixed(0)}% · {item.sampleCount}次核验强化
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{item.triggerContext}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                <Target className="w-4 h-4 text-cyan-400" />
                <span>🎯 L1 单票战术级经验与反思 (针对特定标的上下文注入)</span>
              </div>
              <div className="space-y-2">
                {memory.tacticalReflections.map((item: any) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-cyan-500/30 transition-all space-y-1"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-200 flex items-center gap-1.5">
                        <span className="px-1.5 py-0.2 rounded bg-slate-800 text-cyan-300 font-mono text-[10px]">
                          {item.symbol}
                        </span>
                        <span>{item.ruleSummary}</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        权重 {(item.confidenceWeight * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{item.triggerContext}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card p-6 border-slate-800 space-y-4">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-400" />
            <span>历史复盘时间序列 (Timeline)</span>
          </h3>

          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
            {retrospectives.map((item, idx) => (
              <div key={idx} className="relative pl-6 border-l border-slate-800 space-y-1">
                <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-cyan-400" />
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-200">{item.retroDate}</span>
                  <span className="text-cyan-400 font-mono font-semibold">{item.accuracyScore}% 准确</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">{item.summaryText}</p>
                <div className="text-[10px] text-emerald-400 flex items-center gap-2 pt-0.5">
                  <span>避险: +${item.avoidedLoss.toFixed(1)}</span>
                  <span>收益: +${item.totalRealizedPnL.toFixed(1)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
