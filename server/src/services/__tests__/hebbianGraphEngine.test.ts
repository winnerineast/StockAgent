import { describe, it, expect, beforeEach } from "vitest";
import { HebbianGraphEngine, hebbianGraphEngine } from "../hebbianGraphEngine";
import { KnowledgeGraphRelationEdge, KnowledgeGraphEntityNode } from "../../types/stockTypes";

describe("HebbianGraphEngine (Holistic Context Primitive: Living Connections & Hebbian Dynamics)", () => {
  let engine: HebbianGraphEngine;

  beforeEach(() => {
    engine = HebbianGraphEngine.getInstance();
  });

  describe("赫布强化与空闲衰减动力学 (Formula 3 & 4)", () => {
    it("从初始种子权重 0.15 出发，每日连续共激活在第 7 天平稳突破 0.50 活边门禁", () => {
      let w = engine.SEED_WEIGHT; // 0.15
      const trajectory: number[] = [w];

      for (let day = 1; day <= 10; day++) {
        // 赫布强化 step: w = w + 0.10 * (1.0 - w)
        w = engine.calculateHebbianReinforcement(w, 0.10, 1.0);
        // 一天后的微幅自然衰减
        w = engine.calculateIdleDecay(w, 1, 0.02);
        trajectory.push(w);
      }

      // 在第 6~7 天附近突破 0.50 门禁
      expect(trajectory[0]).toBe(0.15);
      expect(trajectory[3]).toBeLessThan(0.50);
      expect(trajectory[7]).toBeGreaterThanOrEqual(0.50);
      // 10 天后趋向稳态 (约 0.83)
      expect(trajectory[10]).toBeGreaterThan(0.60);
    });

    it("长期处于空闲状态时，边权重平滑指数衰减且不跌破 0", () => {
      const initialWeight = 0.80;
      const decayed30d = engine.calculateIdleDecay(initialWeight, 30, 0.02);
      const decayed90d = engine.calculateIdleDecay(initialWeight, 90, 0.02);

      expect(decayed30d).toBeCloseTo(0.80 * Math.exp(-0.02 * 30), 2);
      expect(decayed90d).toBeCloseTo(0.80 * Math.exp(-0.02 * 90), 2);
      expect(decayed90d).toBeLessThan(decayed30d);
      expect(decayed90d).toBeGreaterThan(0);
    });
  });

  describe("4 类金融语义拓扑与活边多跳扩展 (Multi-hop Living Edge Expansion)", () => {
    it("基于半导体产业链真实拓扑 (NVDA -> TSM -> ASML)，活边支持多跳动量溢出计算", () => {
      const nodes: KnowledgeGraphEntityNode[] = [
        { id: "NVDA", name: "NVIDIA", type: "ROOT_STOCK" },
        { id: "TSM", name: "台积电", type: "SUPPLIER" },
        { id: "ASML", name: "阿斯麦", type: "SUPPLIER" },
        { id: "INTC", name: "英特尔", type: "COMPETITOR" },
      ];

      const edges: KnowledgeGraphRelationEdge[] = [
        // NVDA -> TSM (活边: w=0.75, SUPPORT)
        {
          source: "NVDA",
          target: "TSM",
          relation: "先进代工 CoWoS",
          impact: "POSITIVE",
          hebbianWeight: 0.75,
          exposurePct: 0.40,
        },
        // TSM -> ASML (活边: w=0.65, SUPPORT)
        {
          source: "TSM",
          target: "ASML",
          relation: "EUV 光刻机独家供应",
          impact: "POSITIVE",
          hebbianWeight: 0.65,
          exposurePct: 0.35,
        },
        // NVDA -> INTC (竞争对手: COMPETE, 权重 0.20)
        {
          source: "NVDA",
          target: "INTC",
          relation: "AI 算力与数据中心竞争",
          impact: "NEGATIVE",
          relationType: "COMPETITOR",
          hebbianWeight: 0.20,
        },
      ];

      // 从 NVDA 出发进行 2 跳活边扩散
      const expansion = engine.expandMultiHopNeighbors("NVDA", nodes, edges, 2, 0.50);

      // 活边路径 NVDA -> TSM (Hop 1) -> ASML (Hop 2) 可达
      expect(expansion.reachableNodeIds).toContain("NVDA");
      expect(expansion.reachableNodeIds).toContain("TSM");
      expect(expansion.reachableNodeIds).toContain("ASML");
      // INTC 因非活边 (0.20 < 0.50) 不被纳入多跳主力扩散链
      expect(expansion.reachableNodeIds).not.toContain("INTC");
      // 动量溢出为正向强化
      expect(expansion.aggregateAlphaBoost).toBeGreaterThan(0);
    });
  });
});
