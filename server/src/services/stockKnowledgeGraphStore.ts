import { prisma } from "../db/prisma";
import {
  StockKnowledgeGraphItem,
  KnowledgeGraphEntityNode,
  KnowledgeGraphRelationEdge,
  StockFundamentals,
} from "../types/stockTypes";
import {
  REAL_STOCK_ECOSYSTEM_REGISTRY,
  buildDynamicEcosystemForSymbol,
} from "./stockKnowledgeBaseData";
import { graphQuantitativeEngine } from "./graphQuantitativeEngine";
import { marketDataGateway } from "./marketDataGateway";

export class StockKnowledgeGraphStoreService {
  /**
   * 从数据库获取特定股票基本面/财报指标 (自动通过统一 MarketDataGateway 兜底补齐)
   */
  public async getFundamentals(symbol: string): Promise<StockFundamentals | null> {
    const symbolUpper = symbol.toUpperCase();
    try {
      const record = await prisma.stockFundamentalsStore.findUnique({
        where: { symbol: symbolUpper },
      });
      if (record && (record.peRatio || record.revenueGrowthPct)) {
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

    // 🌟 多源降级容灾：若本地 SQLite 暂无该标的基本面，统一从 MarketDataGateway 抓取并缓存入库
    try {
      const unifiedFund = await marketDataGateway.fetchFundamentals(symbolUpper);
      if (unifiedFund) {
        await this.upsertFundamentals(unifiedFund);
        return unifiedFund;
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
   * 从数据库获取特定股票代码 (Symbol) 的专属操盘知识图谱，执行时效衰减并计算量化图因子
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

    // 如果历史库中节点为空或属于旧版占位符，自动使用高保真知识库重新装载
    if (nodes.length === 0 || nodes.some((n) => n.id.endsWith("_SUPPLIER") && !n.sector)) {
      const freshDefault = this.buildDefaultKnowledgeGraph(symbolUpper);
      nodes = freshDefault.nodes;
      edges = freshDefault.edges;
    }

    // 计算时效衰减 (Recency Weighting)
    const decayedNodes = this.applyRecencyDecayToNodes(nodes);
    const decayedEdges = this.applyRecencyDecayToEdges(edges);

    const kgItem: StockKnowledgeGraphItem = {
      symbol: symbolUpper,
      companyName: symbolUpper,
      positionCategory: "EXISTING",
      industrySector: record.guidanceText ? record.guidanceText.split(":")[0] : "产业链因果网络",
      nodes: decayedNodes,
      edges: decayedEdges,
      newsCatalysts,
      actionAdvice: "HOLD",
      guidanceText: record.guidanceText || `已装载 ${symbolUpper} 工业级产业链与量化图谱`,
      compressedSummary: record.compressedSummary ?? undefined,
    };

    // 注入量化图因子计算 (Spillover Alpha & Network Risk)
    kgItem.spilloverAlphaScore = graphQuantitativeEngine.calculateSpilloverAlpha(kgItem);
    kgItem.networkRiskScore = graphQuantitativeEngine.calculateNetworkRisk(kgItem);
    kgItem.structuredTriplets = graphQuantitativeEngine.generateStructuredTriplets(kgItem);

    return kgItem;
  }

  /**
   * 时效衰减计算 (最新信息 1.0 > 7天 0.85 > 30天 0.6 > 90天 0.2)
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
      else if (daysDiff > 7) recencyWeight = 0.85;

      const baseHebbian = e.hebbianWeight ?? (e.exposurePct ? Math.min(1.0, e.exposurePct * 0.8 + 0.15) : 0.35);
      const decayedHebbian = Number((baseHebbian * Math.exp(-0.02 * daysDiff)).toFixed(4));
      const semantic =
        e.relationSemantic ||
        (e.relationType === "COMPETITOR" || e.impact === "NEGATIVE"
          ? "COMPETE"
          : decayedHebbian >= 0.5
          ? "SUPPORT"
          : "RELATED");

      return {
        ...e,
        recencyWeight: Number(recencyWeight.toFixed(2)),
        hebbianWeight: decayedHebbian,
        relationSemantic: semantic,
      };
    });
  }

  /**
   * 采用真实产业知识库构建高保真知识图谱，并计算初始量化图因子
   */
  public buildDefaultKnowledgeGraph(symbol: string, companyName?: string): StockKnowledgeGraphItem {
    const s = symbol.toUpperCase();
    const ecosystem =
      REAL_STOCK_ECOSYSTEM_REGISTRY[s] ||
      buildDynamicEcosystemForSymbol(s, companyName);

    const kgItem: StockKnowledgeGraphItem = {
      symbol: s,
      companyName: ecosystem.companyName,
      positionCategory: "EXISTING",
      industrySector: ecosystem.sector,
      nodes: ecosystem.nodes,
      edges: ecosystem.edges,
      newsCatalysts: [],
      actionAdvice: "HOLD",
      guidanceText: `${ecosystem.sector} · ${ecosystem.rootDescription}`,
    };

    // 运行图量化引擎计算因子
    kgItem.spilloverAlphaScore = graphQuantitativeEngine.calculateSpilloverAlpha(kgItem);
    kgItem.networkRiskScore = graphQuantitativeEngine.calculateNetworkRisk(kgItem);
    kgItem.structuredTriplets = graphQuantitativeEngine.generateStructuredTriplets(kgItem);

    return kgItem;
  }

  /**
   * 图谱记忆遗忘与压缩提纯机制 (Compress and Decay Memory)
   * 将旧事件蒸馏为长期实体记忆摘要
   */
  public async compressAndDecayGraphMemory(portfolioId: string, symbol: string): Promise<void> {
    const symbolUpper = symbol.toUpperCase();
    const kg = await this.getKnowledgeGraph(portfolioId, symbolUpper);
    if (!kg) return;

    const freshCatalysts = kg.newsCatalysts || [];
    if (freshCatalysts.length > 4) {
      const olderItems = freshCatalysts.slice(0, freshCatalysts.length - 3);
      const recentItems = freshCatalysts.slice(freshCatalysts.length - 3);
      const distilledSummary = `[历史产业链事件提纯]: ${olderItems.join("; ").slice(0, 240)}`;

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
   * 保存或更新单只股票图谱，并完整保留用户手动添加的 CUSTOM 实体与边
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

    // 触发记忆压缩检查
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

    // 重新计算图因子
    item.spilloverAlphaScore = graphQuantitativeEngine.calculateSpilloverAlpha(item);
    item.networkRiskScore = graphQuantitativeEngine.calculateNetworkRisk(item);
    item.structuredTriplets = graphQuantitativeEngine.generateStructuredTriplets(item);

    await this.upsertKnowledgeGraph(portfolioId, item);
    return item;
  }

  /**
   * 后台异步并发为入选候选池的每一只股票更新高保真图谱与大资金节点
   */
  public async asyncBatchSyncGraphs(
    portfolioId: string,
    candidateItems: Array<{
      symbol: string;
      companyName?: string;
      latestNews?: string[];
      strategyCategoryLabel?: string;
      strategyCategoryReason?: string;
      capitalFlow?: { trend: string; description: string };
      actionAdvice?: "BUY" | "SELL" | "HOLD" | "TRIM";
    }>
  ): Promise<void> {
    Promise.resolve().then(async () => {
      try {
        for (const item of candidateItems) {
          const symUpper = item.symbol.toUpperCase();
          let kg = await this.getKnowledgeGraph(portfolioId, symUpper);
          if (!kg) {
            kg = this.buildDefaultKnowledgeGraph(symUpper, item.companyName);
          }

          // 注入最新催化剂新闻
          if (item.latestNews && item.latestNews.length > 0) {
            const cleanNews = item.latestNews.slice(0, 5);
            kg.newsCatalysts = Array.from(new Set([...(kg.newsCatalysts || []), ...cleanNews]));
          }

          if (item.strategyCategoryLabel) {
            kg.guidanceText = `${item.strategyCategoryLabel}: ${item.strategyCategoryReason || ""}`;
          }

          if (item.actionAdvice) {
            kg.actionAdvice = item.actionAdvice;
          }

          // 注入大资金流向关联节点
          if (item.capitalFlow && item.capitalFlow.trend === "INFLOW") {
            const flowNodeId = `${symUpper}_SMART_MONEY`;
            if (!kg.nodes.some((n) => n.id === flowNodeId)) {
              kg.nodes.push({
                id: flowNodeId,
                name: "机构主力大资金异动",
                type: "CONCEPT",
                sector: "资金流向",
                beta: 1.0,
                recentSignalScore: 0.85,
                description: item.capitalFlow.description || "OpenD 官方监测机构持续净流入",
                recencyWeight: 1.0,
                createdAt: new Date().toISOString(),
              });
              kg.edges.push({
                source: flowNodeId,
                target: symUpper,
                relation: "主力资金净流入支撑估值与流动性溢价",
                relationType: "CONCEPT_THEME",
                exposurePct: 0.4,
                elasticity: 0.9,
                timeLagDays: 1,
                impact: "POSITIVE",
                recencyWeight: 1.0,
                createdAt: new Date().toISOString(),
              });
            }
          }

          // 重新计算图因子
          kg.spilloverAlphaScore = graphQuantitativeEngine.calculateSpilloverAlpha(kg);
          kg.networkRiskScore = graphQuantitativeEngine.calculateNetworkRisk(kg);
          kg.structuredTriplets = graphQuantitativeEngine.generateStructuredTriplets(kg);

          await this.upsertKnowledgeGraph(portfolioId, kg);
        }
      } catch (err: any) {
        console.warn("[StockKnowledgeGraphStoreService] 后台异步同步图谱异常:", err.message || err);
      }
    });
  }
}

export const stockKnowledgeGraphStoreService = new StockKnowledgeGraphStoreService();
