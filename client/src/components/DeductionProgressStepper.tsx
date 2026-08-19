import React from "react";
import {
  Activity,
  Search,
  Layers,
  Bot,
  CheckCircle2,
  Sparkles,
  Loader2,
  Clock,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { DeductionPipelineData, AgentLLMTraceItem } from "../types/stockTypes";

export interface StageStep {
  step: number;
  stageId: string;
  title: string;
  detail: string;
  progressPercent: number;
}

interface DeductionProgressStepperProps {
  currentStage: StageStep | null;
  loading: boolean;
  liveDeductionPipeline?: DeductionPipelineData | null;
  onOpenDeductionModal?: (symbol?: string) => void;
}

const STAGES_LIST: Array<{
  step: number;
  stageId: string;
  title: string;
  icon: any;
}> = [
  { step: 1, stageId: "OPEND_CONNECT", title: "OpenD 持仓自选连通", icon: Activity },
  { step: 2, stageId: "MACRO_SEARCH", title: "全网宏观板块搜刮", icon: Search },
  { step: 3, stageId: "CANDIDATE_AND_SEARCH", title: "候选池与标的多维挖掘", icon: Layers },
  { step: 4, stageId: "OLLAMA_DEDUCTION", title: "Ollama 大模型融合推演", icon: Bot },
  { step: 5, stageId: "FINISHED", title: "精确定量指南生成", icon: Sparkles },
];

export const DeductionProgressStepper: React.FC<DeductionProgressStepperProps> = ({
  currentStage,
  loading,
  liveDeductionPipeline,
  onOpenDeductionModal,
}) => {
  const traces = liveDeductionPipeline?.traces || [];
  // 🌟 如果推演已结束 (!loading)，状态条和步骤应该完整展现 100% 完成态
  const isAllFinished = !loading && (currentStage?.step === 5 || currentStage?.progressPercent === 100 || traces.length > 0);
  const currentStep = isAllFinished ? 5 : (currentStage?.step || (loading ? 1 : 0));
  const progressPct = isAllFinished ? 100 : (currentStage?.progressPercent || (loading ? 20 : 0));

  const getHeaderTitle = () => {
    if (loading) {
      return `${currentStage?.title || "Ollama 大模型融合推演"}进行中...`;
    }
    if (isAllFinished || progressPct >= 100) {
      return "全流程推演与复盘计算已完成";
    }
    if (currentStage) {
      return `${currentStage.title}就绪`;
    }
    return "Ollama 大模型融合推演中枢";
  };

  const getHeaderDetail = () => {
    if (loading) {
      return currentStage?.detail || "正在调用底层量化算法与大模型分段推理...";
    }
    if (isAllFinished || progressPct >= 100) {
      return "全网搜刮、候选挖掘、大模型博弈与精确定量指南均已就绪，随时可复盘查看。";
    }
    if (currentStage) {
      return currentStage.detail || "推演数据已更新，随时可复盘查看。";
    }
    return "严格按执行顺序推进：OpenD连通 → 宏观搜刮 → 标的挖掘 → 大模型推演 → 定量指南生成。";
  };

  return (
    <div className="glass-card p-5 border-cyan-500/30 bg-slate-900/90 shadow-xl space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl border ${
            loading
              ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/40"
              : isAllFinished || progressPct >= 100
              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
              : "bg-slate-800/60 text-slate-400 border-slate-700/60"
          }`}>
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isAllFinished || progressPct >= 100 ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <Bot className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-white">
                {getHeaderTitle()}
              </h3>
              <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border ${
                loading
                  ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/30 animate-pulse"
                  : isAllFinished || progressPct >= 100
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : "bg-slate-800 text-slate-400 border-slate-700"
              }`}>
                {loading ? `进度: ${progressPct}%` : isAllFinished || progressPct >= 100 ? "已完成: 100%" : "等待就绪启动"}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{getHeaderDetail()}</p>
          </div>
        </div>

        {/* Action button to open deduction context */}
        {onOpenDeductionModal && (
          <button
            onClick={() => onOpenDeductionModal()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-cyan-400 hover:text-white hover:border-cyan-500/50 hover:bg-slate-900 transition-all text-xs font-semibold shrink-0"
          >
            <Bot className="w-3.5 h-3.5" />
            <span>推演 Context 检视舱 ({traces.length} 条 Trace)</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${
            isAllFinished || progressPct >= 100
              ? "bg-emerald-500"
              : "bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500"
          }`}
          style={{ width: `${Math.max(progressPct, loading ? 10 : 0)}%` }}
        />
      </div>

      {/* Step Badges */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {STAGES_LIST.map((stage) => {
          const Icon = stage.icon;
          const isDone = isAllFinished || currentStep > stage.step || progressPct === 100;
          const isCurrent = currentStep === stage.step && loading;

          return (
            <div
              key={stage.step}
              className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between ${
                isDone
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : isCurrent
                  ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-md shadow-cyan-500/20 animate-pulse"
                  : "bg-slate-950/60 border-slate-800/80 text-slate-500"
              }`}
            >
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-mono">Step {stage.step}</span>
                {isDone ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : isCurrent ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                ) : (
                  <Icon className="w-3.5 h-3.5" />
                )}
              </div>
              <div className="mt-1 font-semibold text-xs truncate">{stage.title}</div>
            </div>
          );
        })}
      </div>

      {/* Live Agent Trace Stream Pills (when traces are available) */}
      {traces.length > 0 && (
        <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto text-xs pb-1">
          <span className="text-[11px] text-slate-400 shrink-0 flex items-center gap-1">
            <Clock className="w-3 h-3 text-cyan-400" />
            已完成 Agent ({traces.length}):
          </span>
          {traces.slice(-8).map((t: AgentLLMTraceItem) => (
            <button
              key={t.id}
              onClick={() => onOpenDeductionModal && onOpenDeductionModal(t.symbol)}
              className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 hover:border-cyan-500/60 text-slate-300 hover:text-white text-[11px] flex items-center gap-1.5 shrink-0 transition-all font-mono"
            >
              <span>{t.symbol ? `[${t.symbol}]` : "🌐 宏观"}</span>
              <span className="text-emerald-400 text-[10px]">{t.durationMs}ms</span>
            </button>
          ))}
          {traces.length > 8 && (
            <span className="text-[10px] text-slate-500 shrink-0">+{traces.length - 8} 更多</span>
          )}
        </div>
      )}
    </div>
  );
};
