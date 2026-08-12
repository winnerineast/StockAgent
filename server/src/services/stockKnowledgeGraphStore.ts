import { prisma } from "../db/prisma";
import { StockKnowledgeGraphItem, KnowledgeGraphEntityNode, KnowledgeGraphRelationEdge } from "../types/stockTypes";

export class StockKnowledgeGraphStoreService {
  /**
   * 从数据库获取特定股票代码 (Symbol) 的专属操盘知识图谱
   */
  public async getKnowledgeGraph(portfolioId: string, symbol: string): Promise<StockKnowledgeGraphItem | null> {
    const symbolUpper = symbol.toUpperCase();
    const record = await prisma.stockKnowledgeGraphStore.findUnique({
      where: {
        portfolioId_symbol: {
          portfolioId,
          symbol: symbolUpper,
        },
      },
    });

    if (!record) {
      return this.buildDefaultKnowledgeGraph(symbolUpper);
    }

    let nodes: KnowledgeGraphEntityNode[] = [];
    let edges: KnowledgeGraphRelationEdge[] = [];
    let newsCatalysts: string[] = [];

    try { nodes = JSON.parse(record.nodesJson || "[]"); } catch (e) {}
    try { edges = JSON.parse(record.edgesJson || "[]"); } catch (e) {}
    try { newsCatalysts = JSON.parse(record.newsCatalystsJson || "[]"); } catch (e) {}

    return {
      symbol: symbolUpper,
      companyName: symbolUpper,
      positionCategory: "EXISTING",
      industrySector: "股票知识图谱实体网络",
      nodes,
      edges,
      newsCatalysts,
      actionAdvice: "HOLD",
      guidanceText: record.guidanceText || `已加载 ${symbolUpper} 专属操盘知识图谱`,
    };
  }

  /**
   * 生成默认股票图谱节点（包含 Root, Supplier, Competitor, Macro 节点）
   */
  public buildDefaultKnowledgeGraph(symbol: string): StockKnowledgeGraphItem {
    const s = symbol.toUpperCase();
    const nodes: KnowledgeGraphEntityNode[] = [
      { id: s, name: `${s} 主主体`, type: "ROOT_STOCK", marketSymbol: s, description: "核心美股标的资产" },
      { id: `${s}_SUPPLIER`, name: `${s} 关键供应链`, type: "SUPPLIER", description: "主要上游芯片/软硬件及材料供应商" },
      { id: `${s}_COMPETITOR`, name: `${s} 行业竞品`, type: "COMPETITOR", description: "主要同业竞争品牌与替代品" },
      { id: "FED_POLICY", name: "美联储利率决议", type: "MACRO", description: "Macro 利率环境与流动性影响" },
      { id: "AI_CATALYST", name: "AI 资本开支与算力需求", type: "CONCEPT", description: "行业核心概念与估值驱动力" },
    ];

    const edges: KnowledgeGraphRelationEdge[] = [
      { source: `${s}_SUPPLIER`, target: s, relation: "供应关键核心零部件", impact: "POSITIVE" },
      { source: `${s}_COMPETITOR`, target: s, relation: "产品同质化争夺市场份额", impact: "NEGATIVE" },
      { source: "FED_POLICY", target: s, relation: "降息预期提升估值中枢", impact: "POSITIVE" },
      { source: "AI_CATALYST", target: s, relation: "拉动业绩与 PE 乘数放大", impact: "POSITIVE" },
    ];

    return {
      symbol: s,
      companyName: s,
      positionCategory: "EXISTING",
      industrySector: "科技与半导体",
      nodes,
      edges,
      newsCatalysts: [`${s} 发布最新季度财报及指引`, `SearXNG 搜索到的最新行业催化剂`],
      actionAdvice: "HOLD",
      guidanceText: `${s} 知识图谱已构建，包含供应链、竞品、宏观与风险节点`,
    };
  }

  /**
   * 保存或更新单只股票图谱，并合并用户自定义节点
   */
  public async upsertKnowledgeGraph(portfolioId: string, item: StockKnowledgeGraphItem): Promise<void> {
    const symbolUpper = item.symbol.toUpperCase();
    const existing = await prisma.stockKnowledgeGraphStore.findUnique({
      where: { portfolioId_symbol: { portfolioId, symbol: symbolUpper } },
    });

    let mergedNodes = item.nodes || [];
    let mergedEdges = item.edges || [];

    if (existing) {
      try {
        const existingNodes: KnowledgeGraphEntityNode[] = JSON.parse(existing.nodesJson || "[]");
        const existingEdges: KnowledgeGraphRelationEdge[] = JSON.parse(existing.edgesJson || "[]");

        const customNodes = existingNodes.filter((n) => n.id.startsWith("CUSTOM_"));
        const customEdges = existingEdges.filter((e) => e.target.startsWith("CUSTOM_") || e.source.startsWith("CUSTOM_"));

        customNodes.forEach((cn) => {
          if (!mergedNodes.some((n) => n.id === cn.id)) mergedNodes.push(cn);
        });
        customEdges.forEach((ce) => {
          if (!mergedEdges.some((e) => e.source === ce.source && e.target === ce.target)) mergedEdges.push(ce);
        });
      } catch (e) {}
    }

    await prisma.stockKnowledgeGraphStore.upsert({
      where: {
        portfolioId_symbol: {
          portfolioId,
          symbol: symbolUpper,
        },
      },
      create: {
        portfolioId,
        symbol: symbolUpper,
        nodesJson: JSON.stringify(mergedNodes),
        edgesJson: JSON.stringify(mergedEdges),
        newsCatalystsJson: JSON.stringify(item.newsCatalysts || []),
        guidanceText: item.guidanceText,
      },
      update: {
        nodesJson: JSON.stringify(mergedNodes),
        edgesJson: JSON.stringify(mergedEdges),
        newsCatalystsJson: JSON.stringify(item.newsCatalysts || []),
        guidanceText: item.guidanceText,
      },
    });
  }

  /**
   * 手动添加用户自定义实体与关联边
   */
  public async addCustomEntityToDb(
    portfolioId: string,
    symbol: string,
    newNode: KnowledgeGraphEntityNode,
    newEdge: KnowledgeGraphRelationEdge
  ): Promise<StockKnowledgeGraphItem> {
    const symbolUpper = symbol.toUpperCase();
    const existingRecord = await this.getKnowledgeGraph(portfolioId, symbolUpper);
    const item = existingRecord || this.buildDefaultKnowledgeGraph(symbolUpper);

    if (!item.nodes.some((n) => n.id === newNode.id)) {
      item.nodes.push(newNode);
    }
    if (!item.edges.some((e) => e.source === newEdge.source && e.target === newEdge.target)) {
      item.edges.push(newEdge);
    }

    await this.upsertKnowledgeGraph(portfolioId, item);
    return item;
  }
}

export const stockKnowledgeGraphStoreService = new StockKnowledgeGraphStoreService();
