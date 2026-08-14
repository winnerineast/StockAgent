import {
  StockKnowledgeGraphItem,
  KnowledgeGraphEntityNode,
  KnowledgeGraphRelationEdge,
  KnowledgeGraphTripletItem,
} from "../types/stockTypes";

export class GraphQuantitativeEngine {
  /**
   * 计算产业链动量溢出阿尔法因子 (Lead-Lag Spillover Alpha Score)
   * 取值范围: -100 到 +100
   * 
   * 公式:
   *   SpilloverScore = \sum_{e \in Edges( \cdot \to Target)} ( Signal(Source) \times Exposure \times Elasticity \times TimeLagDecay \times RecencyDecay \times ImpactSign )
   */
  public calculateSpilloverAlpha(kgItem: StockKnowledgeGraphItem): number {
    if (!kgItem.edges || kgItem.edges.length === 0) {
      return 0;
    }

    const nodeMap = new Map<string, KnowledgeGraphEntityNode>();
    (kgItem.nodes || []).forEach((n) => nodeMap.set(n.id, n));

    const rootSym = kgItem.symbol.toUpperCase();
    let weightedSum = 0;
    let totalWeight = 0;

    for (const edge of kgItem.edges) {
      // 关注指向标的主体 (Target === rootSym) 或者标的主动关联的边
      const isTarget = edge.target.toUpperCase() === rootSym;
      const isSource = edge.source.toUpperCase() === rootSym;
      if (!isTarget && !isSource) continue;

      const otherNodeId = isTarget ? edge.source : edge.target;
      const otherNode = nodeMap.get(otherNodeId);

      // 提取关联节点的信号分 (-1.0 到 1.0)
      let signal = otherNode?.recentSignalScore ?? 0.5;

      // 敞口百分比 (默认 0.3)
      const exposure = edge.exposurePct ?? 0.35;

      // 传导弹性 Beta (默认 0.7)
      const elasticity = Math.abs(edge.elasticity ?? 0.75);

      // 时间衰减 (时效性衰减 0.0 - 1.0)
      const recency = edge.recencyWeight ?? otherNode?.recencyWeight ?? 1.0;

      // 时滞折扣因子: 越长期的传导，短期动量冲击越平滑
      const lagDays = edge.timeLagDays ?? 5;
      const lagDecay = 1.0 / (1.0 + lagDays * 0.08);

      // 正负影响方向
      let impactMultiplier = 1.0;
      if (edge.impact === "NEGATIVE" || edge.relationType === "COMPETITOR") {
        impactMultiplier = -1.0;
      }

      const edgeWeight = exposure * elasticity * recency * lagDecay;
      const edgeContribution = signal * edgeWeight * impactMultiplier;

      weightedSum += edgeContribution;
      totalWeight += edgeWeight;
    }

    if (totalWeight <= 0) return 0;

    // 归一化到 [-100, +100] 区间
    const normalizedRaw = (weightedSum / totalWeight) * 100;
    const finalScore = Math.max(-100, Math.min(100, Math.round(normalizedRaw * 10) / 10));

    return finalScore;
  }

  /**
   * 计算网络集中度与供应链传染风险因子 (Network Contagion & Concentration Risk)
   * 取值范围: 0 到 100
   */
  public calculateNetworkRisk(kgItem: StockKnowledgeGraphItem): number {
    if (!kgItem.edges || kgItem.edges.length === 0) {
      return 25; // 默认基准风险
    }

    let maxSupplierExposure = 0;
    let competitorPressure = 0;
    let macroSensitivity = 0;

    for (const edge of kgItem.edges) {
      const exp = edge.exposurePct ?? 0.3;
      if (edge.relationType === "UPSTREAM_SUPPLIER") {
        if (exp > maxSupplierExposure) maxSupplierExposure = exp;
      } else if (edge.relationType === "COMPETITOR" || edge.impact === "NEGATIVE") {
        competitorPressure += exp * 20;
      } else if (edge.relationType === "MACRO_DRIVER") {
        macroSensitivity += exp * 15;
      }
    }

    // 供应商单一依赖度瓶颈打分 (如单一供应商敞口 > 70% 计高风险)
    const bottleneckRisk = Math.min(50, maxSupplierExposure * 60);

    const totalRisk = bottleneckRisk + Math.min(30, competitorPressure) + Math.min(20, macroSensitivity);
    return Math.max(5, Math.min(100, Math.round(totalRisk)));
  }

  /**
   * 生成高信噪比结构化图三元组列表
   */
  public generateStructuredTriplets(kgItem: StockKnowledgeGraphItem): KnowledgeGraphTripletItem[] {
    const nodeMap = new Map<string, KnowledgeGraphEntityNode>();
    (kgItem.nodes || []).forEach((n) => nodeMap.set(n.id, n));

    const triplets: KnowledgeGraphTripletItem[] = [];

    for (const edge of kgItem.edges || []) {
      const srcNode = nodeMap.get(edge.source);
      const tgtNode = nodeMap.get(edge.target);

      const srcLabel = srcNode ? srcNode.name : edge.source;
      const tgtLabel = tgtNode ? tgtNode.name : edge.target;

      triplets.push({
        subject: srcLabel,
        relation: edge.relation,
        relationType: edge.relationType,
        object: tgtLabel,
        impact: edge.impact,
        exposurePct: edge.exposurePct ? Math.round(edge.exposurePct * 100) : undefined,
        timeLagDays: edge.timeLagDays,
        elasticity: edge.elasticity,
        signalScore: srcNode?.recentSignalScore,
        note: srcNode?.description,
      });
    }

    return triplets;
  }

  /**
   * 格式化用于大模型 Prompt 的 GraphRAG 因果上下文描述
   */
  public formatTripletsForPrompt(kgItem: StockKnowledgeGraphItem): string {
    const spillover = this.calculateSpilloverAlpha(kgItem);
    const networkRisk = this.calculateNetworkRisk(kgItem);
    const triplets = this.generateStructuredTriplets(kgItem);

    const spilloverText =
      spillover > 20
        ? `+${spillover} (🔥 产业链上下游强共振看多)`
        : spillover < -20
        ? `${spillover} (⚠️ 产业链上下游承压看空)`
        : `${spillover >= 0 ? "+" : ""}${spillover} (中性平稳动向)`;

    const riskLevelText =
      networkRisk > 60
        ? `${networkRisk}/100 (高集中度/单点瓶颈风险)`
        : networkRisk > 35
        ? `${networkRisk}/100 (中等健康敞口)`
        : `${networkRisk}/100 (分散抗风险型)`;

    const formattedEdges = triplets.slice(0, 6).map((t, idx) => {
      const typeTag = t.relationType ? `[${t.relationType}]` : "";
      const exposureText = t.exposurePct ? `, 敞口 ${t.exposurePct}%` : "";
      const lagText = t.timeLagDays ? `, 传导滞后 ${t.timeLagDays}天` : "";
      const impactSign = t.impact === "POSITIVE" ? "利多 ↑" : t.impact === "NEGATIVE" ? "利空 ↓" : "中性";

      return `  ${idx + 1}. ${typeTag} (${t.subject}) --[${t.relation}${exposureText}${lagText}]--> (${t.object}) 【${impactSign}】`;
    });

    const lines: string[] = [
      `【产业链因果图谱与量化特征】:`,
      `- 产业链溢出动量分 (Spillover Alpha): ${spilloverText}`,
      `- 供应链集中度与网络风险 (Network Risk): ${riskLevelText}`,
      `- 核心因果拓扑传导链 (${triplets.length} 条关系):`,
      ...formattedEdges,
    ];

    if (kgItem.compressedSummary) {
      lines.push(`- 历史深度事件提纯记忆: ${kgItem.compressedSummary}`);
    }

    return lines.join("\n");
  }
}

export const graphQuantitativeEngine = new GraphQuantitativeEngine();
