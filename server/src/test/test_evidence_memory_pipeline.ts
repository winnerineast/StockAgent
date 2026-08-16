import { memoryConsolidationService } from "../services/memoryConsolidationService";
import { deductionVerificationService } from "../services/deductionVerificationService";
import { prisma } from "../db/prisma";
import { StockDeductionRetroItem, StockActionVerdict, PastLessonEvidence } from "../types/stockTypes";

async function runEvidenceAndMemoryPipelineTests() {
  console.log("======================================================================");
  console.log("🚀 开始个股动作聚焦、5大事实证据支柱与认知记忆长周期演进自动化测试");
  console.log("======================================================================\n");

  let totalTests = 0;
  let passedTests = 0;

  const assert = (condition: boolean, msg: string) => {
    totalTests++;
    if (condition) {
      console.log(`  ✅ [PASS] ${msg}`);
      passedTests++;
    } else {
      console.error(`  ❌ [FAIL] ${msg}`);
      throw new Error(`Assertion failed: ${msg}`);
    }
  };

  const testPortfolioId = `test-evidence-${Date.now()}`;
  const testSymbol = "NVDA";

  // =========================================================================
  // 1. TIER 1: 艾宾浩斯时间衰减数学模型与遗忘曲线验证
  // =========================================================================
  console.log("📌 [Tier 1] 艾宾浩斯时间衰减数学模型与遗忘曲线验证:");

  const nowStr = "2026-08-16T12:00:00Z";
  const date7DaysAgo = "2026-08-09T12:00:00Z";
  const date14DaysAgo = "2026-08-02T12:00:00Z";
  const date30DaysAgo = "2026-07-17T12:00:00Z";
  const date90DaysAgo = "2026-05-18T12:00:00Z";

  const w7 = memoryConsolidationService.calculateDecayWeight(date7DaysAgo, nowStr);
  const w14 = memoryConsolidationService.calculateDecayWeight(date14DaysAgo, nowStr);
  const w30 = memoryConsolidationService.calculateDecayWeight(date30DaysAgo, nowStr);
  const w90 = memoryConsolidationService.calculateDecayWeight(date90DaysAgo, nowStr);

  console.log(`  • 7天权重: ${w7} (预期 1.0)`);
  assert(w7 === 1.0, "7 天内工作记忆权重严格为 1.0");

  console.log(`  • 14天权重: ${w14} (预期 1.0)`);
  assert(w14 === 1.0, "14 天黄金工作记忆权重严格为 1.0");

  console.log(`  • 30天权重: ${w30} (预期约 0.69)`);
  assert(w30 >= 0.65 && w30 <= 0.75, "30 天记忆衰减至 0.69 左右");

  console.log(`  • 90天权重: ${w90} (预期 < 0.20)`);
  assert(w90 < 0.20, "90 天以上未强化记忆权重低于 0.20 并触发冷归档");

  // =========================================================================
  // 2. TIER 2: 长期认知记忆库聚类合并与去重蒸馏验证
  // =========================================================================
  console.log("\n📌 [Tier 2] 长期认知记忆库聚类合并与去重蒸馏验证:");

  const sampleLessons: PastLessonEvidence[] = [
    {
      id: "log-1",
      date: "2026-08-01",
      action: "OPEN_POSITION",
      outcome: "LESSON",
      outcomeLabel: "🔴 失败教训",
      lessonText: "预测 NVDA 假突破追高建仓后股价回调 -2.4%，提示需强化支撑位右侧确认",
      pnlImpactAmount: -50,
    },
    {
      id: "log-2",
      date: "2026-08-05",
      action: "ADD_POSITION",
      outcome: "LESSON",
      outcomeLabel: "🔴 失败教训",
      lessonText: "加仓后跌破止损线，提示左侧假突破风险较高，需设定硬止损",
      pnlImpactAmount: -80,
    },
  ];

  const consolidated = await memoryConsolidationService.consolidateAndDistill(
    testPortfolioId,
    testSymbol,
    sampleLessons
  );

  console.log(`  • 聚合提炼出 ${consolidated.length} 条高阶原则: "${consolidated[0]?.distilledRule?.slice(0, 50)}..."`);
  assert(consolidated.length > 0, "成功聚类合并生成高阶认知原则");
  assert(consolidated[0].sampleCount === 2, "聚类样本数量正确累加为 2 次");
  assert(consolidated[0].distilledRule.includes("严控防守原则") || consolidated[0].distilledRule.includes("止损"), "高阶原则包含针对性的纪律约束");

  const promptPrinciples = memoryConsolidationService.formatPrinciplesForPrompt(consolidated);
  assert(promptPrinciples.includes("置信度") && promptPrinciples.includes("样本量: 2次"), "Prompt 格式化文本包含置信度与样本量");

  // =========================================================================
  // 3. TIER 3: 5 大事实证据支柱结构化落库与实盘三态核验
  // =========================================================================
  console.log("\n📌 [Tier 3] 5 大事实证据支柱结构化落库与实盘三态核验:");

  const mockItem: StockDeductionRetroItem = {
    symbol: testSymbol,
    companyName: "英伟达",
    candidateCategory: "EXISTING_HOLDING",
    strategyCategory: "FUNDAMENTAL_BUY",
    strategyCategoryLabel: "基本面亮眼建仓",
    knowledgeGraph: {
      symbol: testSymbol,
      companyName: "英伟达",
      positionCategory: "EXISTING",
      industrySector: "AI 算力",
      nodes: [],
      edges: [],
      newsCatalysts: [],
      actionAdvice: "BUY",
      guidanceText: "持仓",
    },
    latestNews: [
      "NVIDIA 发布下一代 AI 算力芯片架构，全球主要云厂商追加订单",
      "华尔街知名投行上调 NVDA 目标价至 $160",
    ],
    position: {
      symbol: testSymbol,
      shares: 10,
      costBasis: 120.0,
      marketPrice: 125.0,
    },
    openDSnapshot: {
      symbol: testSymbol,
      name: "英伟达",
      lastPrice: 125.0,
      peRatio: 35.0,
      mainCapitalInflow: 45000000,
      turnoverRate: 2.1,
    },
    timefmForecast: {
      direction: "UP",
      directionLabel: "📈 强劲向上动量",
      predictedPrice: 132.0,
      predictedChangeRate: 5.6,
      confidenceLow: 124.0,
      confidenceHigh: 138.0,
      confidenceScore: 85,
      momentumRationale: "放量突破前期平台中枢，时序均线发散向上",
    },
    pastRetro: {
      actualPriceAction: "持有中",
      verificationOutcome: "EXPERIENCE",
      verificationOutcomeLabel: "🟢 成功经验",
      verificationLesson: "支撑位低吸获利",
    },
    currentRecommendation: {
      action: "BUY",
      actionType: "ADD_POSITION",
      whySummary: "[NVDA] 基本面营收增速 +45%，主力大单净流入 $45M，TimeFM 动量向上，建议回踩 $124.0~$125.8 挂单加仓 5 股。",
      symbol: testSymbol,
      suggestedShares: 5,
      estimatedPrice: 125.0,
      estimatedAmount: 625.0,
      rationale: "全要素量化推演",
      urgency: "HIGH",
      targetPrice: 135.0,
      stopLossPrice: 120.0,
      entryZone: { min: 124.0, max: 125.8 },
      targetTimeHorizonDays: 5,
      certaintyScore: 88,
      goalAttainmentProbability: 72,
    },
    evidence5Pillars: {
      news: [
        {
          title: "NVIDIA 发布下一代芯片架构",
          summary: "云厂商追加订单",
          sourceName: "SearXNG 权威资讯",
          tier: 1,
          tierLabel: "Tier-1 核心资讯",
          sentiment: "BULLISH",
          url: "https://example.com/nvda",
        }
      ],
      fundamentals: {
        peRatio: 35.0,
        revenueGrowthPct: 45.0,
        netMarginPct: 32.0,
        valuationScore: 75,
        valuationStatus: "成长溢价",
      },
      liveMarket: {
        curPrice: 125.0,
        costBasis: 120.0,
        shares: 10,
        pnlAmount: 50.0,
        pnlPct: 4.17,
        mainCapitalInflow: 45000000,
        flowTrend: "INFLOW",
      },
      timefm: {
        direction: "UP",
        predictedPrice: 132.0,
        predictedChangePct: 5.6,
        confidenceLow: 124.0,
        confidenceHigh: 138.0,
        targetAttainmentProbability: 72,
        momentumRationale: "时序均线多头排列",
      },
      pastLessons: sampleLessons,
    },
  };

  const yesterdayDate = "2026-08-15";
  await deductionVerificationService.saveDeductionLogsBatch(
    testPortfolioId,
    "strat-001",
    yesterdayDate,
    [mockItem]
  );

  console.log("  • 模拟 T+1 实盘真实收盘行情: NVDA 实际收盘价 $131.25 (上涨 +5.0%)");
  const liveQuotes = new Map<string, number>([[testSymbol, 131.25]]);
  const verResult = await deductionVerificationService.verifyPastPredictions(testPortfolioId, liveQuotes);

  console.log(`  • 实盘核验结果: ${verResult.summaryText}`);
  assert(verResult.verifiedCount === 1, "成功核验 1 笔昨日推演");
  assert(verResult.experiencesCount === 1, "精准打标为 🟢 成功经验 (EXPERIENCE)");
  assert(verResult.totalPnLImpact > 0, "正确计算实盘浮盈贡献金额");

  // =========================================================================
  // 4. TIER 4: 历史演进时间轴 API 契约与快照回溯验证
  // =========================================================================
  console.log("\n📌 [Tier 4] 历史演进时间轴与快照回溯验证:");

  const evolutionTimeline = await deductionVerificationService.getSymbolTemporalEvolution(
    testPortfolioId,
    testSymbol
  );

  console.log(`  • 提取到 ${evolutionTimeline.length} 笔演进时间轴快照`);
  assert(evolutionTimeline.length === 1, "演进时间轴成功吐出快照");
  assert(evolutionTimeline[0].actionType === "ADD_POSITION", "操盘动作正确记录为 ADD_POSITION");
  assert(evolutionTimeline[0].whySummary.includes("基本面营收增速"), "核心决策因果论据完整保存");
  assert(evolutionTimeline[0].evidence?.news?.length === 1, "支柱 1 (新闻证据) 结构体完整");
  assert(evolutionTimeline[0].evidence?.fundamentals?.peRatio === 35.0, "支柱 2 (基本面) 结构体完整");
  assert(evolutionTimeline[0].evidence?.liveMarket?.curPrice === 125.0, "支柱 3 (实盘数据) 结构体完整");
  assert(evolutionTimeline[0].evidence?.timefm?.predictedPrice === 132.0, "支柱 4 (TimeFM 预测) 结构体完整");
  assert(evolutionTimeline[0].verificationOutcome === "EXPERIENCE", "实盘对账三态核验结果与实际收盘价已回填");

  // 清理测试数据
  await prisma.stockDeductionLog.deleteMany({ where: { portfolioId: testPortfolioId } });
  await prisma.stockTradingMemoryStore.deleteMany({ where: { portfolioId: testPortfolioId } });

  console.log("\n======================================================================");
  console.log(`🎉 全部测试通过！测试项统计: ${passedTests}/${totalTests} 通过 (100% 成功率)`);
  console.log("======================================================================");
}

runEvidenceAndMemoryPipelineTests().catch((err) => {
  console.error("💥 测试失败:", err);
  process.exit(1);
});
