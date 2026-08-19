import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ollamaService } from "../ollamaService";
import { AgentLLMTraceItem } from "../../types/stockTypes";

describe("Agent LLM Call Real-Time Tracing (大模型推演真实调用链路追踪体系)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("/api/chat")) {
        return {
          ok: true,
          json: async () => ({
            message: {
              content: JSON.stringify({
                actionType: "OPEN_POSITION",
                action: "BUY",
                symbol: "NVDA",
                companyName: "NVIDIA Corp",
                whySummary: "5大客观事实强劲支撑建仓",
                bullThesis: "Blackwell 算力爆发，需求强劲",
                bearishRiskPoint: "下破止损防线时严格止损",
                bullBearVerdict: "多方概率占优",
                entryZoneMin: 124.0,
                entryZoneMax: 126.5,
                rationale: "确定性动量向上",
                urgency: "HIGH",
                suggestedShares: 15,
              }),
            },
          }),
        };
      }
      return { ok: false };
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("宏观总结调用能生成真实的 AgentLLMTraceItem 并记录耗时与 Prompt", async () => {
    const res = await ollamaService.generateMacroSummaryWithOllama(
      "qwen3.8:latest",
      "美联储最新纪要显示降息周期预期增强，标普500期货盘前走高。"
    );

    expect(res).toBeDefined();
    expect(res.summary).toBeDefined();
    expect(res.trace).toBeDefined();
    expect(res.trace.agentRole).toBe("MACRO_ANALYST");
    expect(res.trace.userPrompt).toContain("你是一名华尔街顶级宏观策略首席分析师");
    expect(res.trace.rawResponseText).toBeDefined();
    expect(res.trace.durationMs).toBeGreaterThanOrEqual(0);
    expect(res.trace.timestamp).toBeDefined();
  });

  it("单股多空博弈推演能捕获送入模型的真实 Prompt、新闻切片与知识图谱三元组", async () => {
    const res = await ollamaService.deduceSingleStockWithOllama("qwen3.8:latest", {
      symbol: "NVDA",
      companyName: "NVIDIA Corp",
      currentPrice: 125.5,
      intel: {
        symbol: "NVDA",
        latestNews: ["NVIDIA 发布全新 Blackwell 架构芯片，算力需求激增"],
        communitySentiment: { mood: "BULLISH", keyTopics: ["Blackwell", "AI"] },
        capitalFlow: { trend: "INFLOW", description: "主力大单逆势净买入 $1.2B" },
      },
      fundamentals: {
        symbol: "NVDA",
        companyName: "NVIDIA Corp",
        peRatio: 45.2,
        revenueGrowthPct: 122.5,
      },
      lessonsLearned: ["严格遵守止损纪律"],
      userBudget: 2000,
    });

    expect(res.trace).toBeDefined();
    expect(res.trace.symbol).toBe("NVDA");
    expect(res.trace.agentRole).toBe("STOCK_BULL_BEAR_DEBATER");
    expect(res.trace.userPrompt).toContain("NVDA");
    expect(res.trace.userPrompt).toContain("Blackwell");
    expect(res.trace.userPrompt).toContain("PE: 45.2");
    expect(res.trace.fundamentalsSnippet).toContain("45.2");
    expect(res.trace.searxngNewsSnippets).toContain("NVIDIA 发布全新 Blackwell 架构芯片，算力需求激增");
    expect(res.trace.durationMs).toBeGreaterThanOrEqual(0);
    expect(res.action).toBeDefined();
    expect(res.action?.symbol).toBe("NVDA");
    expect(res.action?.action).toBe("BUY");
  });

  it("多标的推演能够实时触发 onTraceGenerated 回调并汇总全部 Trace", async () => {
    const streamedTraces: AgentLLMTraceItem[] = [];

    vi.spyOn(ollamaService, "getStatus").mockResolvedValueOnce({
      connected: true,
      ollamaUrl: "http://127.0.0.1:11434",
      models: ["qwen3.8:latest"],
      recommendedModel: "qwen3.8:latest",
      hardware: { totalRamGb: 32, cpuCores: 16, summary: "PC" },
      modelRecommendations: [],
      message: "Ready",
    });

    const result = await ollamaService.generateStrategyWithOllama("qwen3.8:latest", {
      positions: [],
      candidateSymbols: ["AAPL", "AMD"],
      candidateStockIntels: new Map(),
      quotesMap: new Map([["AAPL", 220], ["AMD", 145]]),
      searxngNewsText: "科技巨头齐聚财报季",
      knowledgeGraphs: [],
      lessonsLearned: [],
      totalBudget: 1000,
      cashBalance: 1000,
      riskPreference: "BALANCED",
      onTraceGenerated: (t) => {
        streamedTraces.push(t);
      },
    });

    expect(result.traces.length).toBe(3); // 1 宏观 + 2 股票
    expect(streamedTraces.length).toBe(3);
    expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
    expect(result.totalTokensEstimated).toBeGreaterThan(0);
    expect(result.promptText).not.toContain("[Map-Reduce Chunked Pipeline Execute");
  });
});
