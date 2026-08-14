import React, { useState } from "react";
import {
  X,
  Layers,
  Plus,
  Network,
  ArrowRight,
  Sparkles,
  Building2,
  Cpu,
  Globe,
  TrendingUp,
  ShieldAlert,
  Zap,
  Activity,
  GitBranch,
} from "lucide-react";

interface NodeItem {
  id: string;
  name: string;
  type: string;
  description?: string;
  sector?: string;
  beta?: number;
  marketCap?: string;
  recentSignalScore?: number;
}

interface EdgeItem {
  source: string;
  target: string;
  relation: string;
  relationType?: string;
  exposurePct?: number;
  elasticity?: number;
  timeLagDays?: number;
  impact: string;
}

interface TripletItem {
  subject: string;
  relation: string;
  relationType?: string;
  object: string;
  impact: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
  exposurePct?: number;
  timeLagDays?: number;
  elasticity?: number;
  signalScore?: number;
  note?: string;
}

interface StockKnowledgeGraphItem {
  symbol: string;
  companyName: string;
  industrySector: string;
  nodes: NodeItem[];
  edges: EdgeItem[];
  newsCatalysts: string[];
  guidanceText: string;
  compressedSummary?: string;
  spilloverAlphaScore?: number;
  networkRiskScore?: number;
  structuredTriplets?: TripletItem[];
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
  const [exposureVal, setExposureVal] = useState("30");
  const [lagDays, setLagDays] = useState("5");

  if (!symbol || !graphData) return null;

  const spilloverAlpha = graphData.spilloverAlphaScore ?? 0;
  const networkRisk = graphData.networkRiskScore ?? 35;

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityName || !relationText) return;

    const customId = `CUSTOM_${Date.now()}`;
    const expFraction = Math.max(0.05, Math.min(1.0, parseFloat(exposureVal) / 100 || 0.3));
    const lag = parseInt(lagDays) || 5;

    const newNode: NodeItem = {
      id: customId,
      name: entityName,
      type: entityType,
      sector: "用户自定义实体",
      recentSignalScore: 0.6,
      description: "用户人工录入的专属产业链节点",
    };

    const newEdge: EdgeItem = {
      source: customId,
      target: symbol.toUpperCase(),
      relation: relationText,
      relationType:
        entityType === "SUPPLIER"
          ? "UPSTREAM_SUPPLIER"
          : entityType === "CLIENT"
          ? "DOWNSTREAM_CLIENT"
          : entityType === "COMPETITOR"
          ? "COMPETITOR"
          : "CONCEPT_THEME",
      exposurePct: expFraction,
      elasticity: 0.8,
      timeLagDays: lag,
      impact: entityType === "COMPETITOR" ? "NEGATIVE" : "POSITIVE",
    };

    onAddCustomNode(symbol, newNode, newEdge);
    setEntityName("");
    setRelationText("");
    setShowAddForm(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="glass-card w-full max-w-5xl max-h-[92vh] overflow-y-auto border-slate-800 p-6 space-y-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <Network className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">
                  [{symbol.toUpperCase()}] 工业级量化产业链知识图谱
                </h2>
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                  {graphData.industrySector}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                上下游因果拓扑 · 动量溢出计算 · 细粒度敞口 · 集中度风险防线
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quant Factors Top Banner */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Spillover Alpha Score Card */}
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span>产业链动量溢出 (Spillover Alpha)</span>
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span
                  className={`text-2xl font-black ${
                    spilloverAlpha > 15
                      ? "text-emerald-400"
                      : spilloverAlpha < -15
                      ? "text-rose-400"
                      : "text-amber-300"
                  }`}
                >
                  {spilloverAlpha >= 0 ? `+${spilloverAlpha}` : spilloverAlpha}
                </span>
                <span className="text-[11px] text-slate-400">/ 100</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {spilloverAlpha > 15
                  ? "上下游产业链共振走强，利多超额动量"
                  : spilloverAlpha < -15
                  ? "上游承压或同业恶性竞争，利空拖累"
                  : "产业链整体供需平衡，平稳传导"}
              </p>
            </div>
            <div
              className={`p-3 rounded-xl border ${
                spilloverAlpha >= 0
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : "bg-rose-500/10 text-rose-400 border-rose-500/30"
              }`}
            >
              <Zap className="w-5 h-5" />
            </div>
          </div>

          {/* Network Risk Score Card */}
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                <span>供应链集中度风险 (Network Risk)</span>
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span
                  className={`text-2xl font-black ${
                    networkRisk > 55
                      ? "text-rose-400"
                      : networkRisk > 35
                      ? "text-amber-400"
                      : "text-cyan-400"
                  }`}
                >
                  {networkRisk}
                </span>
                <span className="text-[11px] text-slate-400">/ 100</span>
              </div>
              <div className="w-36 h-1.5 bg-slate-800 rounded-full mt-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    networkRisk > 55 ? "bg-rose-500" : networkRisk > 35 ? "bg-amber-500" : "bg-cyan-500"
                  }`}
                  style={{ width: `${Math.min(100, networkRisk)}%` }}
                />
              </div>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
              <Activity className="w-5 h-5" />
            </div>
          </div>

          {/* Strategy Guidance Info */}
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
            <span className="text-xs font-semibold text-cyan-400 flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5" />
              <span>拓扑图谱指引</span>
            </span>
            <p className="text-xs text-slate-300 line-clamp-3 mt-1">
              {graphData.guidanceText}
            </p>
            {graphData.compressedSummary && (
              <p className="text-[10px] text-amber-300/90 mt-1 truncate">
                {graphData.compressedSummary}
              </p>
            )}
          </div>
        </div>

        {/* Causal Transmission Edges Stream (GraphRAG Triplet Stream) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-cyan-400" />
              <span>因果拓扑与传导关系链 ({graphData.edges.length} 条有效边)</span>
            </h3>

            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/20 text-xs font-semibold transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>添加产业链节点/关系</span>
            </button>
          </div>

          {/* Add Custom Node Form */}
          {showAddForm && (
            <form
              onSubmit={handleAddSubmit}
              className="p-4 rounded-xl bg-slate-900 border border-cyan-500/40 space-y-3 animate-fade-in"
            >
              <h4 className="text-xs font-bold text-cyan-300">
                向 [{symbol.toUpperCase()}] 注入自定义产业链实体与量化边
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
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
                  <option value="SUPPLIER">上游供应商 (Supplier)</option>
                  <option value="CLIENT">下游大客户 (Client)</option>
                  <option value="COMPETITOR">同业竞品 (Competitor)</option>
                  <option value="CONCEPT">行业核心概念 (Concept)</option>
                  <option value="MACRO">宏观政策/利率 (Macro)</option>
                </select>
                <input
                  type="text"
                  placeholder="关系描述 (如 晶圆代工核心保供)..."
                  value={relationText}
                  onChange={(e) => setRelationText(e.target.value)}
                  className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                  required
                />
                <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg px-2">
                  <span className="text-[11px] text-slate-400 shrink-0">敞口:</span>
                  <input
                    type="number"
                    min="5"
                    max="100"
                    value={exposureVal}
                    onChange={(e) => setExposureVal(e.target.value)}
                    className="w-full bg-transparent text-xs text-white py-2 focus:outline-none"
                  />
                  <span className="text-[11px] text-slate-400">%</span>
                </div>
                <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg px-2">
                  <span className="text-[11px] text-slate-400 shrink-0">时延:</span>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={lagDays}
                    onChange={(e) => setLagDays(e.target.value)}
                    className="w-full bg-transparent text-xs text-white py-2 focus:outline-none"
                  />
                  <span className="text-[11px] text-slate-400">天</span>
                </div>
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400 transition-all"
              >
                确认录入数据库并重新计算图因子
              </button>
            </form>
          )}

          {/* Relation Edges List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {graphData.edges.map((edge, idx) => {
              const isPositive = edge.impact === "POSITIVE";
              const isNegative = edge.impact === "NEGATIVE";

              return (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-white">
                      <span className="text-cyan-400">{edge.source}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-white">{edge.target}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {edge.relationType && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                          {edge.relationType}
                        </span>
                      )}
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                          isPositive
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : isNegative
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {isPositive ? "利多 ↑" : isNegative ? "利空 ↓" : "中性"}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300">{edge.relation}</p>

                  <div className="flex items-center gap-3 pt-1 border-t border-slate-800/80 text-[11px] text-slate-400">
                    {edge.exposurePct !== undefined && (
                      <span>
                        敞口占比:{" "}
                        <strong className="text-cyan-300">
                          {Math.round(edge.exposurePct * 100)}%
                        </strong>
                      </span>
                    )}
                    {edge.timeLagDays !== undefined && (
                      <span>
                        传导滞后:{" "}
                        <strong className="text-amber-300">
                          {edge.timeLagDays} 天
                        </strong>
                      </span>
                    )}
                    {edge.elasticity !== undefined && (
                      <span>
                        传导弹性:{" "}
                        <strong className="text-slate-200">
                          {edge.elasticity}
                        </strong>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Entity Nodes Matrix */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span>核心实体节点属性 ({graphData.nodes.length} 个节点)</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {graphData.nodes.map((node, i) => (
              <div
                key={i}
                className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start gap-3"
              >
                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
                  {node.type === "ROOT_STOCK" ? (
                    <Building2 className="w-4 h-4" />
                  ) : node.type === "SUPPLIER" ? (
                    <Cpu className="w-4 h-4" />
                  ) : (
                    <Globe className="w-4 h-4" />
                  )}
                </div>
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white text-xs truncate">
                      {node.name}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 shrink-0">
                      {node.type}
                    </span>
                  </div>
                  {node.sector && (
                    <p className="text-[10px] text-cyan-300/80">{node.sector}</p>
                  )}
                  <p className="text-[11px] text-slate-400 line-clamp-2">
                    {node.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Catalysts & News */}
        {graphData.newsCatalysts && graphData.newsCatalysts.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>实时催化剂与产业链动态事件</span>
            </h3>
            <div className="space-y-2">
              {graphData.newsCatalysts.map((cat, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300"
                >
                  {cat}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
