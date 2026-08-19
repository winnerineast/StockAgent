import {
  KnowledgeGraphEntityNode,
  KnowledgeGraphRelationEdge,
  GraphRelationSemanticType,
  StockKnowledgeGraphItem,
} from "../types/stockTypes";

export interface HebbianUpdateOptions {
  alpha?: number;        // 赫布学习率 (论文默认 α=0.10)
  lambda?: number;       // 日衰减率 (论文默认 λ=0.02/天)
  livingThreshold?: number; // 活边激活门禁 (论文默认 0.50)
  seedWeight?: number;   // 新边初始先验权重 (论文默认 0.15)
}

export class HebbianGraphEngine {
  private static instance: HebbianGraphEngine;

  public static getInstance(): HebbianGraphEngine {
    if (!HebbianGraphEngine.instance) {
      HebbianGraphEngine.instance = new HebbianGraphEngine();
    }
    return HebbianGraphEngine.instance;
  }

  public readonly DEFAULT_ALPHA = 0.10;
  public readonly DEFAULT_LAMBDA = 0.02;
  public readonly LIVING_THRESHOLD = 0.50;
  public readonly SEED_WEIGHT = 0.15;

  /**
   * 论文公式 3: 赫布共现强化更新
   * w_ij+ = w_ij + α * (w_max - w_ij)
   */
  public calculateHebbianReinforcement(
    currentWeight: number = this.SEED_WEIGHT,
    alpha: number = this.DEFAULT_ALPHA,
    wMax: number = 1.0
  ): number {
    const w = Math.max(0.0, Math.min(wMax, currentWeight));
    const newWeight = w + alpha * (wMax - w);
    return Number(Math.min(wMax, newWeight).toFixed(4));
  }

  /**
   * 论文公式 4: 艾宾浩斯被动空闲时间衰减
   * w_ij(t + Δt) = w_ij+ * exp(-λ * Δt)
   */
  public calculateIdleDecay(
    weight: number,
    daysElapsed: number,
    lambda: number = this.DEFAULT_LAMBDA
  ): number {
    if (daysElapsed <= 0) return weight;
    const decayed = weight * Math.exp(-lambda * daysElapsed);
    return Number(Math.max(0.0, Math.min(1.0, decayed)).toFixed(4));
  }

  /**
   * 对图谱中的关系边执行赫布共现与时间衰减状态机维护
   */
  public updateEdgeDynamics(
    edge: KnowledgeGraphRelationEdge,
    isCoActivated: boolean,
    currentDateStr: string = new Date().toISOString().split("T")[0],
    options?: HebbianUpdateOptions
  ): KnowledgeGraphRelationEdge {
    const alpha = options?.alpha ?? this.DEFAULT_ALPHA;
    const lambda = options?.lambda ?? this.DEFAULT_LAMBDA;
    const livingThreshold = options?.livingThreshold ?? this.LIVING_THRESHOLD;
    const seed = options?.seedWeight ?? this.SEED_WEIGHT;

    let baseWeight = edge.hebbianWeight ?? seed;
    const lastActive = edge.lastCoActivatedAt || edge.createdAt || currentDateStr;
    const daysDiff = Math.max(
      0,
      (new Date(currentDateStr).getTime() - new Date(lastActive).getTime()) / (1000 * 60 * 60 * 24)
    );

    // 1. 先进行空闲天数的时间衰减
    if (daysDiff > 0) {
      baseWeight = this.calculateIdleDecay(baseWeight, daysDiff, lambda);
    }

    let coCount = edge.coActivationCount ?? 1;

    // 2. 若本次发生共检索/共激活，执行赫布强化
    if (isCoActivated) {
      baseWeight = this.calculateHebbianReinforcement(baseWeight, alpha, 1.0);
      coCount += 1;
    }

    // 3. 自动更新 4-Type 语义关系
    let semantic: GraphRelationSemanticType = edge.relationSemantic || "RELATED";
    if (edge.relationType === "COMPETITOR" || edge.impact === "NEGATIVE") {
      semantic = "COMPETE";
    } else if (baseWeight >= livingThreshold) {
      semantic = "SUPPORT";
    } else if (semantic !== "SUPERSEDE" && semantic !== "COMPETE") {
      semantic = "RELATED";
    }

    return {
      ...edge,
      hebbianWeight: baseWeight,
      lastCoActivatedAt: isCoActivated ? currentDateStr : edge.lastCoActivatedAt || currentDateStr,
      coActivationCount: coCount,
      relationSemantic: semantic,
      recencyWeight: baseWeight >= livingThreshold ? 1.0 : Number(baseWeight.toFixed(2)),
    };
  }

  /**
   * 提取当前图谱中的 Living Connections (活边：w >= 0.50)
   */
  public getLivingEdges(
    edges: KnowledgeGraphRelationEdge[],
    threshold: number = this.LIVING_THRESHOLD
  ): KnowledgeGraphRelationEdge[] {
    return edges.filter((e) => (e.hebbianWeight ?? this.SEED_WEIGHT) >= threshold);
  }

  /**
   * 基于活边进行多跳产业链扩散检索 (Multi-hop Living Edge Expansion)
   * 沿着高权重 Living Connections 寻找关联催化节点，支持最大跳数与权重门禁
   */
  public expandMultiHopNeighbors(
    seedEntityId: string,
    nodes: KnowledgeGraphEntityNode[],
    edges: KnowledgeGraphRelationEdge[],
    maxHops: number = 2,
    livingThreshold: number = this.LIVING_THRESHOLD
  ): {
    reachableNodeIds: string[];
    traversedEdges: KnowledgeGraphRelationEdge[];
    aggregateAlphaBoost: number;
  } {
    const visited = new Set<string>([seedEntityId.toUpperCase()]);
    let currentLevel = [seedEntityId.toUpperCase()];
    const traversedEdges: KnowledgeGraphRelationEdge[] = [];
    let totalBoost = 0.0;

    for (let hop = 1; hop <= maxHops; hop++) {
      const nextLevel: string[] = [];

      for (const curr of currentLevel) {
        // 查找所有以 curr 为起点或终点的高权重活边
        const activeEdges = edges.filter(
          (e) =>
            (e.hebbianWeight ?? this.SEED_WEIGHT) >= livingThreshold &&
            (e.source.toUpperCase() === curr || e.target.toUpperCase() === curr)
        );

        for (const edge of activeEdges) {
          const neighbor =
            edge.source.toUpperCase() === curr
              ? edge.target.toUpperCase()
              : edge.source.toUpperCase();

          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            nextLevel.push(neighbor);
            traversedEdges.push(edge);

            // 计算多跳传导的动量与风险溢出贡献
            const decayFactor = 1.0 / hop;
            const weight = edge.hebbianWeight ?? livingThreshold;
            const exposure = edge.exposurePct ?? 0.3;
            totalBoost += weight * exposure * decayFactor * (edge.impact === "POSITIVE" ? 1.0 : -0.8);
          }
        }
      }

      currentLevel = nextLevel;
      if (currentLevel.length === 0) break;
    }

    return {
      reachableNodeIds: Array.from(visited),
      traversedEdges,
      aggregateAlphaBoost: Number(totalBoost.toFixed(3)),
    };
  }

  /**
   * 将实盘核验 (EXPERIENCE) 结果回哺到图谱，强化当天有盈利贡献的产业链传导链路
   */
  public reinforceGraphFromVerification(
    graphItem: StockKnowledgeGraphItem,
    coActivatedSymbols: string[],
    isSuccessfulTrade: boolean,
    currentDateStr?: string
  ): StockKnowledgeGraphItem {
    const today = currentDateStr || new Date().toISOString().split("T")[0];
    const upperList = new Set(coActivatedSymbols.map((s) => s.toUpperCase()));

    const updatedEdges = graphItem.edges.map((edge) => {
      const isHit = upperList.has(edge.source.toUpperCase()) || upperList.has(edge.target.toUpperCase());
      if (isHit && isSuccessfulTrade) {
        return this.updateEdgeDynamics(edge, true, today);
      } else {
        return this.updateEdgeDynamics(edge, false, today);
      }
    });

    return {
      ...graphItem,
      edges: updatedEdges,
    };
  }
}

export const hebbianGraphEngine = HebbianGraphEngine.getInstance();
