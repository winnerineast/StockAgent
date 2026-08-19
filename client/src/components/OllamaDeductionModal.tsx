import React, { useState, useMemo } from "react";
import {
  X,
  Bot,
  Layers,
  Search,
  FileText,
  Terminal,
  Copy,
  Check,
  CheckCircle2,
  Sparkles,
  PieChart,
  History,
  Clock,
  Zap,
  Activity,
  AlertCircle,
} from "lucide-react";
import { AgentLLMTraceItem, DeductionPipelineData } from "../types/stockTypes";

interface OllamaDeductionModalProps {
  isOpen: boolean;
  onClose: () => void;
  pipelineData: DeductionPipelineData | null;
  strategyHistory?: any[];
  initialSelectedSymbol?: string;
}

const safeString = (val: any, fallback: string = ""): string => {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "string") return val;
  try {
    return JSON.stringify(val, null, 2);
  } catch {
    return String(val);
  }
};

export const OllamaDeductionModal: React.FC<OllamaDeductionModalProps> = ({
  isOpen,
  onClose,
  pipelineData,
  strategyHistory = [],
  initialSelectedSymbol,
}) => {
  const [activeTab, setActiveTab] = useState<
    "prompt" | "output" | "kg" | "news" | "positions"
  >("prompt");
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState<number>(-1);
  const [selectedTraceId, setSelectedTraceId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copied, setCopied] = useState(false);

  // 严格过滤仅保留符合 AgentLLMTraceItem 规范的历史记录
  const validHistory = useMemo(() => {
    if (!Array.isArray(strategyHistory)) return [];
    return strategyHistory.filter((h) =>
      h &&
      h.deductionPipeline &&
      Array.isArray(h.deductionPipeline.traces) &&
      h.deductionPipeline.traces.length > 0
    );
  }, [strategyHistory]);

  const selectedHistory = selectedHistoryIndex >= 0 && validHistory[selectedHistoryIndex]
    ? validHistory[selectedHistoryIndex]
    : null;

  const rawPipeline = (selectedHistory && selectedHistory.deductionPipeline)
    ? selectedHistory.deductionPipeline
    : (pipelineData || null);

  const activePipeline: DeductionPipelineData = useMemo(() => {
    if (rawPipeline && typeof rawPipeline === "object") {
      return {
        modelUsed: rawPipeline.modelUsed || "Ollama",
        totalDurationMs: typeof rawPipeline.totalDurationMs === "number" ? rawPipeline.totalDurationMs : 0,
        totalTokensEstimated: typeof rawPipeline.totalTokensEstimated === "number" ? rawPipeline.totalTokensEstimated : 0,
        traces: Array.isArray(rawPipeline.traces) ? rawPipeline.traces : [],
        promptContextText: safeString(rawPipeline.promptContextText),
        knowledgeGraphContext: safeString(rawPipeline.knowledgeGraphContext),
        searxngNewsContext: safeString(rawPipeline.searxngNewsContext),
        positionsContext: safeString(rawPipeline.positionsContext),
        lessonsContext: safeString(rawPipeline.lessonsContext),
        rawOllamaOutput: safeString(rawPipeline.rawOllamaOutput),
      };
    }
    return {
      modelUsed: "Ollama",
      totalDurationMs: 0,
      totalTokensEstimated: 0,
      traces: [],
      promptContextText: "",
      knowledgeGraphContext: "",
      searxngNewsContext: "",
      positionsContext: "",
      lessonsContext: "",
      rawOllamaOutput: "",
    };
  }, [rawPipeline]);

  // 纯粹、合规的 Trace 列表
  const traces: AgentLLMTraceItem[] = activePipeline.traces || [];

  // 搜索过滤 Trace
  const filteredTraces = useMemo(() => {
    if (!searchQuery.trim()) return traces;
    const q = searchQuery.trim().toUpperCase();
    return traces.filter((t) =>
      (t.symbol && t.symbol.toUpperCase().includes(q)) ||
      (t.agentLabel && t.agentLabel.toUpperCase().includes(q)) ||
      (t.companyName && t.companyName.toUpperCase().includes(q))
    );
  }, [traces, searchQuery]);

  // 当前选中的 Trace
  const currentTrace: AgentLLMTraceItem | null = useMemo(() => {
    if (selectedTraceId) {
      const found = traces.find((t) => t.id === selectedTraceId);
      if (found) return found;
    }
    if (initialSelectedSymbol) {
      const found = traces.find((t) => t.symbol?.toUpperCase() === initialSelectedSymbol.toUpperCase());
      if (found) return found;
    }
    return traces.length > 0 ? traces[0] : null;
  }, [traces, selectedTraceId, initialSelectedSymbol]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getActiveText = (): string => {
    if (!currentTrace) {
      return "// 尚未选定或生成真实 Agent 推演 Trace，请在主界面点击【启动推演】开始";
    }

    switch (activeTab) {
      case "prompt": {
        let text = "";
        if (currentTrace.systemPrompt) {
          text += `🛡️ 【System Prompt】:\n${currentTrace.systemPrompt}\n\n------------------------------------------------------------\n\n`;
        }
        text += `👤 【User Prompt】:\n${safeString(currentTrace.userPrompt, "// 该 Agent 暂无 userPrompt 内容")}`;
        return text;
      }
      case "output": {
        const raw = currentTrace.rawResponseText;
        const thinking = currentTrace.thinkingText;
        let out = "";
        if (thinking && thinking.trim().length > 0) {
          out += `🧠 【大模型深度思考推理过程 (Chain-of-Thought)】:\n${thinking}\n\n------------------------------------------------------------\n\n`;
        }
        if (typeof raw === "string" && raw.trim().length > 0 && raw !== "无模型返回内容") {
          out += `📦 【Ollama 原始返回 (Raw Output / JSON)】:\n${raw}`;
          return out;
        }
        if (currentTrace.parsedOutput) {
          out += `📦 【结构化对齐输出 (Parsed Action)】:\n${safeString(currentTrace.parsedOutput)}`;
          return out;
        }
        return out || "// 该 Agent 暂无原始模型输出内容";
      }
      case "kg":
        return Array.isArray(currentTrace.knowledgeGraphTriplets) && currentTrace.knowledgeGraphTriplets.length > 0
          ? currentTrace.knowledgeGraphTriplets.join("\n")
          : safeString(activePipeline.knowledgeGraphContext, "// 该标的无额外扩展知识图谱三元组");
      case "news":
        return Array.isArray(currentTrace.searxngNewsSnippets) && currentTrace.searxngNewsSnippets.length > 0
          ? currentTrace.searxngNewsSnippets.join("\n\n")
          : safeString(activePipeline.searxngNewsContext, "// 暂无专属消歧新闻");
      case "positions":
        return safeString(activePipeline.positionsContext, "// 暂无实盘持仓明细");
      default:
        return "";
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="glass-card w-full max-w-7xl h-[92vh] flex flex-col border-slate-800 p-5 space-y-3 shadow-2xl overflow-hidden bg-slate-950/90">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-3 gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 shadow-lg shadow-cyan-500/20">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base md:text-lg font-bold text-white">大模型推演全要素真实追溯与 Context 检视舱</h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  模型: {activePipeline.modelUsed || "Ollama"}
                </span>
                {activePipeline.totalDurationMs > 0 && (
                  <span className="px-2 py-0.5 text-xs font-mono rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-cyan-400" />
                    总耗时: {(activePipeline.totalDurationMs / 1000).toFixed(1)}s
                  </span>
                )}
                {Boolean(activePipeline.totalTokensEstimated) && (
                  <span className="px-2 py-0.5 text-xs font-mono rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-purple-400" />
                    预估 Token: ~{Number(activePipeline.totalTokensEstimated).toLocaleString()}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                100% 真实还原每个 Agent 喂给大模型的真实 Prompt Payload、知识图谱三元组与大模型 Raw 输出 (严禁虚假占位)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* History Selector Dropdown (仅展示有真实 Trace 的合规推演记录) */}
            {validHistory.length > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                <History className="w-3.5 h-3.5 text-cyan-400" />
                <select
                  value={selectedHistoryIndex}
                  onChange={(e) => {
                    setSelectedHistoryIndex(Number(e.target.value));
                    setSelectedTraceId("");
                  }}
                  className="bg-slate-950 border border-slate-700 text-cyan-300 text-xs rounded px-2 py-0.5 focus:outline-none font-semibold"
                >
                  <option value={-1}>🔥 [实时] 当前轮次推演 ({traces.length} 条 Trace)</option>
                  {validHistory.map((h: any, idx: number) => (
                    <option key={h?.id || idx} value={idx}>
                      📅 {h?.strategyDate} 推演 ({h?.deductionPipeline?.traces?.length || 0} 个 Agent · {h?.deductionPipeline?.modelUsed || "Ollama"})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main 2-Pane Body */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-3 min-h-0 overflow-hidden">
          {/* Left Pane: Agent Invocation List */}
          <div className="md:col-span-4 lg:col-span-3 flex flex-col bg-slate-900/80 rounded-xl border border-slate-800 p-3 space-y-2 overflow-hidden">
            <div className="flex items-center justify-between pb-1 border-b border-slate-800">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                Agent 真实调用链路 ({filteredTraces.length})
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="搜索股票代码或 Agent..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            {/* Trace List */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {filteredTraces.length === 0 ? (
                <div className="text-center py-12 px-4 text-xs text-slate-500 space-y-3">
                  <Bot className="w-8 h-8 text-slate-600 mx-auto opacity-40" />
                  <p className="font-medium text-slate-400">尚未生成真实 Agent 推演 Trace</p>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    请在主界面点击【启动推演】或【一键推演】，系统将实时捕获并流式展示每个 Agent 的真实调用链路。
                  </p>
                </div>
              ) : (
                filteredTraces.map((t) => {
                  const isSelected = currentTrace?.id === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTraceId(t.id)}
                      className={`w-full text-left p-2.5 rounded-lg border transition-all flex flex-col gap-1 ${
                        isSelected
                          ? "bg-cyan-500/15 border-cyan-500/50 shadow-md shadow-cyan-500/10"
                          : "bg-slate-950/60 border-slate-800/80 hover:bg-slate-900 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-white truncate">
                          {t.symbol ? `[${t.symbol}] ${t.companyName || ""}` : t.agentLabel}
                        </span>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                            t.status === "SUCCESS"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          }`}
                        >
                          {t.durationMs || 0}ms
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="truncate">{t.agentLabel}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {t.status === "SUCCESS" ? "🟢 成功" : "🟡 降级"}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Pane: Context & Payload Details */}
          <div className="md:col-span-8 lg:col-span-9 flex flex-col bg-slate-900/60 rounded-xl border border-slate-800 p-4 space-y-3 overflow-hidden">
            {/* Active Trace Telemetry Header */}
            {currentTrace && (
              <div className="flex flex-wrap items-center justify-between bg-slate-950/80 border border-slate-800/80 px-3 py-2 rounded-lg gap-2 shrink-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-white">
                    {currentTrace.symbol ? `标的: ${currentTrace.symbol} (${currentTrace.companyName || ""})` : currentTrace.agentLabel}
                  </span>
                  <span className="text-xs text-cyan-400 font-medium">
                    {currentTrace.agentLabel}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                  <span>⏱️ 耗时: <strong className="text-cyan-300">{currentTrace.durationMs || 0}ms</strong></span>
                  <span>🤖 模型: <strong className="text-slate-200">{currentTrace.modelName || activePipeline.modelUsed}</strong></span>
                </div>
              </div>
            )}

            {/* Tab Buttons */}
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 shrink-0">
              <div className="flex items-center gap-2 overflow-x-auto">
                {[
                  { id: "prompt", label: "📄 真实完整 Prompt Payload", icon: FileText },
                  { id: "output", label: "🤖 Ollama 原始输出 (Raw Output)", icon: Terminal },
                  { id: "kg", label: "🧩 知识图谱三元组 Context", icon: Layers },
                  { id: "news", label: "📰 SearXNG 权威资讯", icon: Search },
                  { id: "positions", label: "💼 实盘持仓与预算", icon: PieChart },
                ].map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                        activeTab === tab.id
                          ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                          : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {currentTrace && (
                <button
                  onClick={() => handleCopy(getActiveText())}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-white transition-all text-xs shrink-0"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? "已复制" : "复制当前 Payload"}</span>
                </button>
              )}
            </div>

            {/* Code / Content Area */}
            <div className="flex-1 bg-slate-950 p-4 rounded-xl border border-slate-800/90 overflow-y-auto font-mono text-xs text-slate-200 leading-relaxed whitespace-pre-wrap selection:bg-cyan-500/30 selection:text-cyan-200">
              {getActiveText()}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-2 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between shrink-0">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>100% 真实本地 Ollama 模型推理链路 · 绝无虚假占位符</span>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 text-white font-semibold hover:bg-slate-700 transition-all text-xs"
          >
            关闭面板
          </button>
        </div>
      </div>
    </div>
  );
};
