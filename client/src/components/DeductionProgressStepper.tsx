import React from "react";
import {
  Activity,
  Search,
  Layers,
  History,
  Bot,
  CheckCircle2,
  Sparkles,
  Loader2,
} from "lucide-react";

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
  onOpenPipelineModal: () => void;
}

export const STAGES_LIST: Array<{
  step: number;
  stageId: string;
  title: string;
  icon: any;
}> = [
  { step: 1, stageId: "OPEND_CONNECT", title: "MooMoo OpenD 持仓", icon: Activity },
  { step: 2, stageId: "NEWS_SEARCH", title: "SearXNG 全网资讯", icon: Search },
  { step: 3, stageId: "CONTEXT_ASSEMBLE", title: "单股票知识图谱", icon: Layers },
  { step: 4, stageId: "GUARDRAIL_CALIBRATE", title: "前次推演与走势复盘", icon: History },
  { step: 5, stageId: "AI_DEDUCTION", title: "Ollama LLM 推理", icon: Bot },
  { step: 6, stageId: "FINISHED", title: "精确定量指南生成", icon: Sparkles },
];

export const DeductionProgressStepper: React.FC<DeductionProgressStepperProps> = ({
  currentStage,
  loading,
  onOpenPipelineModal,
}) => {
  if (!loading && !currentStage) return null;

  const currentStep = currentStage?.step || 1;
  const progressPct = currentStage?.progressPercent || 20;

  return (
    <div className="glass-card p-5 border-cyan-500/30 bg-slate-900/90 shadow-xl space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
            <Loader2 className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">
                {loading ? "Ollama 大模型融合推演进行中..." : "推演与复盘计算完成"}
              </h3>
              <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                进度: {progressPct}%
              </span>
            </div>
            <p className="text-xs text-slate-400">{currentStage?.detail || "正在处理..."}</p>
          </div>
        </div>

        <button
          onClick={onOpenPipelineModal}
          className="px-3 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 text-xs font-semibold transition-all flex items-center gap-1.5"
        >
          <Bot className="w-3.5 h-3.5" />
          <span>查看 Ollama 输入/输出 Context</span>
        </button>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
        <div
          className="bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Step Badges */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        {STAGES_LIST.map((stage) => {
          const Icon = stage.icon;
          const isDone = currentStep > stage.step || progressPct === 100;
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
    </div>
  );
};
