import React, { useState } from "react";
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
} from "lucide-react";

interface PipelineData {
  modelUsed: string;
  promptContextText: string;
  knowledgeGraphContext: string;
  searxngNewsContext: string;
  positionsContext: string;
  lessonsContext: string;
  rawOllamaOutput?: string;
}

interface OllamaDeductionModalProps {
  isOpen: boolean;
  onClose: () => void;
  pipelineData: PipelineData | null;
}

export const OllamaDeductionModal: React.FC<OllamaDeductionModalProps> = ({
  isOpen,
  onClose,
  pipelineData,
}) => {
  const [activeTab, setActiveTab] = useState<
    "prompt" | "kg" | "news" | "positions" | "output"
  >("prompt");
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const activeData = pipelineData || {
    modelUsed: "Ollama",
    promptContextText: "==== Ollama 上下文 Prompt 正在组装中 ====\n(包含：单股票操盘知识图谱 + SearXNG 盘前新闻 + MooMoo 持仓与资金 + 历史走势复盘)",
    knowledgeGraphContext: "知识图谱上下文装载中...",
    searxngNewsContext: "SearXNG 实时新闻抓取中...",
    positionsContext: "MooMoo 持仓明细同步中...",
    lessonsContext: "历史风控教训加载中...",
    rawOllamaOutput: "等待 Ollama 大模型响应生成...",
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getActiveText = () => {
    switch (activeTab) {
      case "prompt":
        return activeData.promptContextText || "// 正在组装完整 Prompt 上下文 Payload...";
      case "kg":
        return activeData.knowledgeGraphContext || "// 暂无单股票知识图谱 Context 节点数据";
      case "news":
        return activeData.searxngNewsContext || "// 暂无 SearXNG 盘前新闻资讯数据";
      case "positions":
        return activeData.positionsContext || "// 暂无实盘持仓与预算数据";
      case "output":
        return activeData.rawOllamaOutput || "// 暂无原始生成输出结果";
      default:
        return "";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="glass-card w-full max-w-5xl max-h-[90vh] flex flex-col border-slate-800 p-6 space-y-4 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 shadow-lg shadow-cyan-500/20">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Ollama 大模型推演过程全景可视化</h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  模型: {activeData.modelUsed}
                </span>
              </div>
              <p className="text-xs text-slate-400">检视输入 Ollama 上下文窗口的全量 Context (知识图谱 + SearXNG + 持仓) 与原始生成结果</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto">
            {[
              { id: "prompt", label: "完整 Prompt 上下文", icon: FileText },
              { id: "kg", label: "单股票知识图谱 Context", icon: Layers },
              { id: "news", label: "SearXNG 盘前新闻", icon: Search },
              { id: "positions", label: "实盘持仓与预算", icon: PieChart },
              { id: "output", label: "Ollama 原始 JSON 输出", icon: Terminal },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === tab.id
                      ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                      : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => handleCopy(getActiveText())}
            className="flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-all text-xs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "已复制" : "复制 Payload"}</span>
          </button>
        </div>

        {/* Code View Area */}
        <div className="flex-1 bg-slate-950 p-4 rounded-xl border border-slate-800 overflow-y-auto font-mono text-xs text-slate-200 leading-relaxed whitespace-pre-wrap selection:bg-cyan-500/30 selection:text-cyan-200">
          {getActiveText() || "// 暂无文本内容"}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between shrink-0">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>完全基于本地 Ollama 模型与 100% 隐私安全推演</span>
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
