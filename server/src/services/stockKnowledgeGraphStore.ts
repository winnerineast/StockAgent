import { prisma } from "../db/prisma";
import {
  StockKnowledgeGraphItem,
  KnowledgeGraphEntityNode,
  KnowledgeGraphRelationEdge,
  StockFundamentals,
} from "../types/stockTypes";

export class StockKnowledgeGraphStoreService {
  /**
   * 从数据库获取特定股票基本面/财报指标
   */
  public async getFundamentals(symbol: string): Promise<StockFundamentals | null> {
    const symbolUpper = symbol.toUpperCase();
    try {
      const record = await prisma.stockFundamentalsStore.findUnique({
        where: { symbol: symbolUpper },
      });
      if (record) {
        return {
          symbol: record.symbol,
          companyName: record.companyName || record.symbol,
          peRatio: record.peRatio ?? undefined,
          revenueGrowthPct: record.revenueGrowthPct ?? undefined,
          netMarginPct: record.netMarginPct ?? undefined,
          debtToEquity: record.debtToEquity ?? undefined,
          nextEarningsDate: record.nextEarningsDate ?? undefined,
          fundamentalSummary: record.fundamentalSummary ?? undefined,
        };
      }
    } catch (e) {}
    return null;
  }

  /**
   * 落库/更新特定股票的基本面财报数据
   */
  public async upsertFundamentals(fundamentals: StockFundamentals): Promise<void> {
    const symbolUpper = fundamentals.symbol.toUpperCase();
    try {
      await prisma.stockFundamentalsStore.upsert({
        where: { symbol: symbolUpper },
        create: {
          symbol: symbolUpper,
          companyName: fundamentals.companyName || symbolUpper,
          peRatio: fundamentals.peRatio,
          revenueGrowthPct: fundamentals.revenueGrowthPct,
          netMarginPct: fundamentals.netMarginPct,
          debtToEquity: fundamentals.debtToEquity,
          nextEarningsDate: fundamentals.nextEarningsDate,
          fundamentalSummary: fundamentals.fundamentalSummary,
        },
        update: {
          companyName: fundamentals.companyName || symbolUpper,
          peRatio: fundamentals.peRatio,
          revenueGrowthPct: fundamentals.revenueGrowthPct,
          netMarginPct: fundamentals.netMarginPct,
          debtToEquity: fundamentals.debtToEquity,
          nextEarningsDate: fundamentals.nextEarningsDate,
          fundamentalSummary: fundamentals.fundamentalSummary,
        },
      });
    } catch (e) {}
  }

  /**
   * 从数据库获取特定股票代码 (Symbol) 的专属操盘知识图谱，并执行时效衰减计算
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

    // 计算时效衰减 (Recency Weighting)
    const decayedNodes = this.applyRecencyDecayToNodes(nodes);
    const decayedEdges = this.applyRecencyDecayToEdges(edges);

    return {
      symbol: symbolUpper,
      companyName: symbolUpper,
      positionCategory: "EXISTING",
      industrySector: "股票知识图谱实体网络",
      nodes: decayedNodes,
      edges: decayedEdges,
      newsCatalysts,
      actionAdvice: "HOLD",
      guidanceText: record.guidanceText || `已加载 ${symbolUpper} 专属操盘知识图谱`,
      compressedSummary: record.compressedSummary ?? undefined,
    };
  }

  /**
   * 时效衰减计算 (最新信息 1.0 > 30天 0.6 > 90天 0.2)
   */
  private applyRecencyDecayToNodes(nodes: KnowledgeGraphEntityNode[]): KnowledgeGraphEntityNode[] {
    const now = Date.now();
    return nodes.map((n) => {
      const createdTime = n.createdAt ? new Date(n.createdAt).getTime() : now;
      const daysDiff = Math.max(0, (now - createdTime) / (1000 * 60 * 60 * 24));
      let recencyWeight = 1.0;
      if (daysDiff > 90) recencyWeight = 0.2;
      else if (daysDiff > 30) recencyWeight = 0.6;
      else if (daysDiff > 7) recencyWeight = 0.85;

      return {
        ...n,
        recencyWeight: Number(recencyWeight.toFixed(2)),
      };
    });
  }

  private applyRecencyDecayToEdges(edges: KnowledgeGraphRelationEdge[]): KnowledgeGraphRelationEdge[] {
    const now = Date.now();
    return edges.map((e) => {
      const createdTime = e.createdAt ? new Date(e.createdAt).getTime() : now;
      const daysDiff = Math.max(0, (now - createdTime) / (1000 * 60 * 60 * 24));
      let recencyWeight = 1.0;
      if (daysDiff > 90) recencyWeight = 0.2;
      else if (daysDiff > 30) recencyWeight = 0.6;

      return {
        ...e,
        recencyWeight: Number(recencyWeight.toFixed(2)),
      };
    });
  }

  /**
   * 生成默认股票图谱节点（包含 Root, Supplier, Competitor, Macro 节点，带真实 timestamp）
   */
  public buildDefaultKnowledgeGraph(symbol: string): StockKnowledgeGraphItem {
    const s = symbol.toUpperCase();
    const nowIso = new Date().toISOString();
    const nodes: KnowledgeGraphEntityNode[] = [
      { id: s, name: `${s} 主主体`, type: "ROOT_STOCK", marketSymbol: s, description: "核心美股标的资产", recencyWeight: 1.0, createdAt: nowIso },
      { id: `${s}_SUPPLIER`, name: `${s} 关键供应链`, type: "SUPPLIER", description: "主要上游芯片/软硬件及材料供应商", recencyWeight: 1.0, createdAt: nowIso },
      { id: `${s}_COMPETITOR`, name: `${s} 行业竞品`, type: "COMPETITOR", description: "主要同业竞争品牌与替代品", recencyWeight: 1.0, createdAt: nowIso },
      { id: "FED_POLICY", name: "美联储利率决议", type: "MACRO", description: "Macro 利率环境与流动性影响", recencyWeight: 1.0, createdAt: nowIso },
      { id: "AI_CATALYST", name: "AI 资本开支与算力需求", type: "CONCEPT", description: "行业核心概念与估值驱动力", recencyWeight: 1.0, createdAt: nowIso },
    ];

    const edges: KnowledgeGraphRelationEdge[] = [
      { source: `${s}_SUPPLIER`, target: s, relation: "供应关键核心零部件", impact: "POSITIVE", recencyWeight: 1.0, createdAt: nowIso },
      { source: `${s}_COMPETITOR`, target: s, relation: "产品同质化争夺市场份额", impact: "NEGATIVE", recencyWeight: 1.0, createdAt: nowIso },
      { source: "FED_POLICY", target: s, relation: "降息预期提升估值中枢", impact: "POSITIVE", recencyWeight: 1.0, createdAt: nowIso },
      { source: "AI_CATALYST", target: s, relation: "拉动业绩与 PE 乘数放大", impact: "POSITIVE", recencyWeight: 1.0, createdAt: nowIso },
    ];

    return {
      symbol: s,
      companyName: s,
      positionCategory: "EXISTING",
      industrySector: "科技与半导体",
      nodes,
      edges,
      newsCatalysts: [],
      actionAdvice: "HOLD",
      guidanceText: `${s} 知识图谱已动态生成`,
    };
  }

  /**
   * 图谱记忆遗忘与压缩提纯机制 (Compress and Decay Memory)
   * 当催化剂新闻多于 5 条或边缘数过多时，蒸馏旧消息为长期实体描述 `compressedSummary`
   */
  public async compressAndDecayGraphMemory(portfolioId: string, symbol: string): Promise<void> {
    const symbolUpper = symbol.toUpperCase();
    const kg = await this.getKnowledgeGraph(portfolioId, symbolUpper);
    if (!kg) return;

    const freshCatalysts = kg.newsCatalysts || [];
    if (freshCatalysts.length > 4) {
      const olderItems = freshCatalysts.slice(0, freshCatalysts.length - 3);
      const recentItems = freshCatalysts.slice(freshCatalysts.length - 3);
      const distilledSummary = `[历史事件记忆提纯]: ${olderItems.join("; ").slice(0, 200)}`;

      await prisma.stockKnowledgeGraphStore.update({
        where: { portfolioId_symbol: { portfolioId, symbol: symbolUpper } },
        data: {
          newsCatalystsJson: JSON.stringify(recentItems),
          compressedSummary: distilledSummary,
          lastCompressedAt: new Date(),
        },
      });
    }
  }

  /**
   * 保存或更新单只股票图谱，并合并自定义节点
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
        compressedSummary: item.compressedSummary,
      },
      update: {
        nodesJson: JSON.stringify(mergedNodes),
        edgesJson: JSON.stringify(mergedEdges),
        newsCatalystsJson: JSON.stringify(item.newsCatalysts || []),
        guidanceText: item.guidanceText,
        compressedSummary: item.compressedSummary,
      },
    });

    // 触发概率性/阈值记忆压缩
    await this.compressAndDecayGraphMemory(portfolioId, symbolUpper);
  }

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
