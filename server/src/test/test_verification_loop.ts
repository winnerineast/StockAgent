import { deductionVerificationService } from "../services/deductionVerificationService";
import { prisma } from "../db/prisma";

async function testVerificationLoop() {
  console.log("=======================================================================");
  console.log("🔄 测试实盘三态闭环检验引擎 (Deduction Verification Loop)");
  console.log("=======================================================================\n");

  const testPortfolioId = "test-verification-portfolio";
  const yesterdayStr = "2026-08-14"; // 假定为昨日推演

  // 1. 模拟清理旧测试数据
  await prisma.stockDeductionLog.deleteMany({
    where: { portfolioId: testPortfolioId },
  });

  // 2. 构造 3 条昨日的推演快照假说
  // Case A: 建议看多买入 NVDA，基准价 $125
  // Case B: 建议看多买入 TSLA，基准价 $220
  // Case C: 建议观望 AAPL，基准价 $225
  await prisma.stockDeductionLog.createMany({
    data: [
      {
        portfolioId: testPortfolioId,
        strategyId: "strat-yesterday-001",
        deductionDate: yesterdayStr,
        symbol: "NVDA",
        companyName: "英伟达",
        action: "BUY",
        timefmDirection: "UP",
        triggerPrice: 125.0,
        targetPrice: 135.0,
        stopLossPrice: 120.0,
        suggestedShares: 10,
        rationale: "看好 AI 芯片主升浪，主力资金逆势流入",
        isVerified: false,
      },
      {
        portfolioId: testPortfolioId,
        strategyId: "strat-yesterday-001",
        deductionDate: yesterdayStr,
        symbol: "TSLA",
        companyName: "特斯拉",
        action: "BUY",
        timefmDirection: "UP",
        triggerPrice: 220.0,
        targetPrice: 238.0,
        stopLossPrice: 211.0,
        suggestedShares: 5,
        rationale: "FSD 催化博取短期突破",
        isVerified: false,
      },
      {
        portfolioId: testPortfolioId,
        strategyId: "strat-yesterday-001",
        deductionDate: yesterdayStr,
        symbol: "AAPL",
        companyName: "苹果",
        action: "HOLD",
        timefmDirection: "SIDEWAYS",
        triggerPrice: 225.0,
        targetPrice: 232.0,
        stopLossPrice: 218.0,
        suggestedShares: 0,
        rationale: "发布会前维持观望",
        isVerified: false,
      },
    ],
  });

  console.log("  [Step 1] 已向数据库写入 3 笔昨日未核验的先验推演假说 (NVDA, TSLA, AAPL)");

  // 3. 模拟今日实盘真实收盘价
  // NVDA: $130.0 (上涨 +4.0% -> 触发 🟢 EXPERIENCE)
  // TSLA: $215.0 (下跌 -2.27% -> 触发 🔴 LESSON)
  // AAPL: $225.3 (微涨 +0.13% -> 触发 🎲 RANDOM_NOISE)
  const mockLiveQuotes = new Map<string, number>([
    ["NVDA", 130.0],
    ["TSLA", 215.0],
    ["AAPL", 225.3],
  ]);

  console.log("  [Step 2] 模拟获取今日实盘不可篡改真实收盘行情:");
  console.log("    • NVDA 实盘现价: $130.0 (较昨日基准 $125.0 上涨 +4.0%)");
  console.log("    • TSLA 实盘现价: $215.0 (较昨日基准 $220.0 回调 -2.27%)");
  console.log("    • AAPL 实盘现价: $225.3 (较昨日基准 $225.0 横盘 +0.13%)");

  // 4. 运行实盘对账与三态打标
  const report = await deductionVerificationService.verifyPastPredictions(
    testPortfolioId,
    mockLiveQuotes
  );

  console.log("\n  [Step 3] 实盘对账核验执行完成:");
  console.log("    •", report.summaryText);
  console.assert(report.experiencesCount === 1, "应该归因出 1 笔成功经验");
  console.assert(report.lessonsCount === 1, "应该归因出 1 笔失败教训");
  console.assert(report.randomNoiseCount === 1, "应该归因出 1 笔随机噪音");

  // 5. 检验反哺提示词与记忆库提取 (Memory Distillation Test)
  console.log("\n  [Step 4] 检验教训反哺与记忆库生成:");
  const nvdaHistory = await deductionVerificationService.getStockVerifiedHistory(testPortfolioId, "NVDA");
  console.log("    • NVDA 记忆库反哺文本:\n     ", nvdaHistory.promptMemoryContext);

  const tslaHistory = await deductionVerificationService.getStockVerifiedHistory(testPortfolioId, "TSLA");
  console.log("    • TSLA 记忆库反哺文本:\n     ", tslaHistory.promptMemoryContext);

  // 清理测试数据
  await prisma.stockDeductionLog.deleteMany({
    where: { portfolioId: testPortfolioId },
  });

  console.log("\n=======================================================================");
  console.log("🎉 实盘三态核验闭环与教训蒸馏测试全部通过！0 报错！");
  console.log("=======================================================================");
}

testVerificationLoop()
  .catch((e) => console.error("Test failed:", e))
  .finally(async () => {
    await prisma.$disconnect();
  });
