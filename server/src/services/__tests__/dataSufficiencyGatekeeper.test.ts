import { describe, it, expect } from "vitest";
import {
  DataSufficiencyGatekeeper,
  DEFAULT_SUFFICIENCY_CONFIG,
} from "../dataSufficiencyGatekeeper";
import { OpenDSnapshotItem, StockFundamentals, StockKnowledgeGraphItem } from "../../types/stockTypes";

describe("DataSufficiencyGatekeeper Unit Tests", () => {
  const validSnapshot: OpenDSnapshotItem = {
    symbol: "NVDA",
    name: "NVIDIA Corp",
    lastPrice: 125.5,
    peRatio: 42.0,
    mainCapitalInflow: 5000000,
    capitalInflow: 8000000,
    turnoverRate: 2.5,
  };

  const validFundamentals: StockFundamentals = {
    symbol: "NVDA",
    companyName: "NVIDIA Corp",
    peRatio: 42.0,
    revenueGrowthPct: 122.0,
    netMarginPct: 55.0,
  };

  const validKnowledgeGraph: StockKnowledgeGraphItem = {
    symbol: "NVDA",
    companyName: "NVIDIA Corp",
    positionCategory: "NEW_DISCOVERY",
    industrySector: "Semiconductors",
    actionAdvice: "BUY",
    guidanceText: "AI 算力领军企业",
    newsCatalysts: [],
    nodes: [
      { id: "NVDA", name: "英伟达", type: "ROOT_STOCK" },
      { id: "TSM", name: "台积电", type: "SUPPLIER" },
      { id: "MSFT", name: "微软", type: "CLIENT" },
    ],
    edges: [
      { source: "TSM", target: "NVDA", relation: "代工制造", relationType: "UPSTREAM_SUPPLIER", exposurePct: 0.6, elasticity: 0.8, impact: "POSITIVE" },
      { source: "NVDA", target: "MSFT", relation: "算力采购", relationType: "DOWNSTREAM_CLIENT", exposurePct: 0.2, elasticity: 0.5, impact: "POSITIVE" },
    ],
  };

  const validNews = [
    "英伟达发布最新 Blackwell 芯片订单需求超预期",
    "华尔街大行上调目标价至 $150，重申买入评级",
  ];

  it("1. 应当在全要素完备时判定为通过 (isSufficient = true, score = 100)", () => {
    const report = DataSufficiencyGatekeeper.evaluateSymbol({
      symbol: "NVDA",
      companyName: "NVIDIA Corp",
      snapshot: validSnapshot,
      news: validNews,
      fundamentals: validFundamentals,
      knowledgeGraph: validKnowledgeGraph,
    });

    expect(report.isSufficient).toBe(true);
    expect(report.completenessScore).toBe(100);
    expect(report.criticalMissingCount).toBe(0);
    expect(report.missingItems.length).toBe(0);
    expect(report.abortReason).toBeUndefined();
  });

  it("2. 应当在实盘价格缺失 (<=0 或 null) 时精准拦截并输出排障指引", () => {
    const brokenSnapshot = { ...validSnapshot, lastPrice: 0 };
    const report = DataSufficiencyGatekeeper.evaluateSymbol({
      symbol: "NVDA",
      snapshot: brokenSnapshot,
      news: validNews,
      fundamentals: validFundamentals,
      knowledgeGraph: validKnowledgeGraph,
    });

    expect(report.isSufficient).toBe(false);
    expect(report.criticalMissingCount).toBeGreaterThanOrEqual(1);
    const priceDiag = report.missingItems.find((m) => m.field === "lastPrice");
    expect(priceDiag).toBeDefined();
    expect(priceDiag?.severity).toBe("CRITICAL");
    expect(priceDiag?.remedyAction).toBeDefined();
  });

  it("3. 应当在资讯为空时主动熔断", () => {
    const report = DataSufficiencyGatekeeper.evaluateSymbol({
      symbol: "NVDA",
      snapshot: validSnapshot,
      news: [], // 空新闻
      fundamentals: validFundamentals,
      knowledgeGraph: validKnowledgeGraph,
    });

    expect(report.isSufficient).toBe(false);
    const newsDiag = report.missingItems.find((m) => m.category === "NEWS_SEARCH");
    expect(newsDiag).toBeDefined();
    expect(newsDiag?.remedyAction).toBeDefined();
  });

  it("4. 应当在产业链图谱缺失或单节点孤岛时拦截", () => {
    const isolatedGraph: StockKnowledgeGraphItem = {
      symbol: "NVDA",
      companyName: "NVIDIA Corp",
      positionCategory: "NEW_DISCOVERY",
      industrySector: "Semiconductors",
      actionAdvice: "BUY",
      guidanceText: "孤岛节点",
      newsCatalysts: [],
      nodes: [{ id: "NVDA", name: "英伟达", type: "ROOT_STOCK" }],
      edges: [],
    };

    const report = DataSufficiencyGatekeeper.evaluateSymbol({
      symbol: "NVDA",
      snapshot: validSnapshot,
      news: validNews,
      fundamentals: validFundamentals,
      knowledgeGraph: isolatedGraph,
    });

    expect(report.isSufficient).toBe(false);
    const kgDiag = report.missingItems.find((m) => m.category === "KNOWLEDGE_GRAPH");
    expect(kgDiag).toBeDefined();
    expect(kgDiag?.description).toContain("节点数过少");
  });

  it("5. 应当支持动态自定义配置覆盖 (例如关闭新闻必填项)", () => {
    const report = DataSufficiencyGatekeeper.evaluateSymbol(
      {
        symbol: "NVDA",
        snapshot: validSnapshot,
        news: [], // 虽为空，但配置关闭了校验
        fundamentals: validFundamentals,
        knowledgeGraph: validKnowledgeGraph,
      },
      {
        requireNewsCoverage: false,
      }
    );

    expect(report.isSufficient).toBe(true);
  });

  it("6. 生成的 INSUFFICIENT_DATA_ABORT ActionItem 应当资金置零且包含诊断内容", () => {
    const report = DataSufficiencyGatekeeper.evaluateSymbol({
      symbol: "NVDA",
      snapshot: undefined,
      news: [],
    });

    const action = DataSufficiencyGatekeeper.buildInsufficientDataAction({
      symbol: "NVDA",
      companyName: "NVIDIA Corp",
      currentPrice: 125.5,
      report,
    });

    expect(action.actionType).toBe("INSUFFICIENT_DATA_ABORT");
    expect(action.suggestedShares).toBe(0);
    expect(action.capitalAllocationAmount).toBe(0);
    expect(action.whySummary).toContain("信息维度不足");
    expect(action.rationale).toContain("修复建议");
    expect(action.dataSufficiencyReport?.isSufficient).toBe(false);
  });
});
