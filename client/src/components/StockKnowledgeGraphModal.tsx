import React, { useState } from "react";
import {
  X,
  Layers,
  Plus,
  Network,
  BookOpen,
  ArrowRight,
  Sparkles,
  Building2,
  Cpu,
  Globe,
} from "lucide-react";

interface NodeItem {
  id: string;
  name: string;
  type: string;
  description?: string;
}

interface EdgeItem {
  source: string;
  target: string;
  relation: string;
  impact: string;
}

interface StockKnowledgeGraphItem {
  symbol: string;
  companyName: string;
  industrySector: string;
  nodes: NodeItem[];
  edges: EdgeItem[];
  newsCatalysts: string[];
  guidanceText: string;
}

interface StockKnowledgeGraphModalProps {
  symbol: string | null;
  graphData: StockKnowledgeGraphItem | null;
  onClose: () => void;
  onAddCustomNode: (symbol: string, node: NodeItem, edge: EdgeItem) => void;
}

export const StockKnowledgeGraphModal: React.FC<StockKnowledgeGraphModalProps> = ({
  symbol,
  graphData,
  onClose,
  onAddCustomNode,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [entityName, setEntityName] = useState("");
  const [entityType, setEntityType] = useState("SUPPLIER");
  const [relationText, setRelationText] = useState("");

  if (!symbol || !graphData) return null;

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityName || !relationText) return;

    const customId = `CUSTOM_${Date.now()}`;
    const newNode: NodeItem = {
      id: customId,
      name: entityName,
      type: entityType,
      description: "用户人工添加的专属图谱节点",
    };

    const newEdge: EdgeItem = {
      source: customId,
      target: symbol.toUpperCase(),
      relation: relationText,
      impact: "POSITIVE",
    };

    onAddCustomNode(symbol, newNode, newEdge);
    setEntityName("");
    setRelationText("");
    setShowAddForm(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="glass-card w-full max-w-4xl max-h-[90vh] overflow-y-auto border-slate-800 p-6 space-y-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <Network className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">[{symbol.toUpperCase()}] 单股票操盘知识图谱</h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  {graphData.industrySector}
                </span>
              </div>
              <p className="text-xs text-slate-400">上下游产业链 · 竞品博弈 · 宏观驱动力 · 专属风控教训</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Guidance Banner */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300">
          <span className="font-bold text-cyan-400 block mb-1">图谱概览:</span>
          {graphData.guidanceText}
        </div>

        {/* Entity Network Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>核心实体节点与关系链 ({graphData.nodes.length} 节点)</span>
            </h3>

            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/20 text-xs font-semibold transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>添加自定义节点</span>
            </button>
          </div>

          {/* Form */}
          {showAddForm && (
            <form onSubmit={handleAddSubmit} className="p-4 rounded-xl bg-slate-900 border border-cyan-500/40 space-y-3">
              <h4 className="text-xs font-bold text-cyan-300">添加自定义实体节点至 [{symbol}]</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="实体名称 (如 台积电, 降息预期)..."
                  value={entityName}
                  onChange={(e) => setEntityName(e.target.value)}
                  className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                  required
                />
                <select
                  value={entityType}
                  onChange={(e) => setEntityType(e.target.value)}
                  className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                >
                  <option value="SUPPLIER">供应商 (Supplier)</option>
                  <option value="CLIENT">客户 (Client)</option>
                  <option value="COMPETITOR">竞品 (Competitor)</option>
                  <option value="MACRO">宏观 (Macro)</option>
                  <option value="CONCEPT">概念 (Concept)</option>
                </select>
                <input
                  type="text"
                  placeholder="关联关系 (如 独家晶圆代工)..."
                  value={relationText}
                  onChange={(e) => setRelationText(e.target.value)}
                  className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                  required
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400 transition-all"
              >
                确认添加至数据库
              </button>
            </form>
          )}

          {/* Node Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {graphData.nodes.map((node, i) => (
              <div key={i} className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
                  {node.type === "ROOT_STOCK" ? (
                    <Building2 className="w-4 h-4" />
                  ) : node.type === "SUPPLIER" ? (
                    <Cpu className="w-4 h-4" />
                  ) : (
                    <Globe className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-xs">{node.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{node.type}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">{node.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Catalysts & News */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>SearXNG 抓取的最新催化剂新闻</span>
          </h3>
          <div className="space-y-2">
            {graphData.newsCatalysts.map((cat, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300">
                {cat}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
