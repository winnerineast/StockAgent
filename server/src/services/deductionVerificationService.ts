import { prisma } from "../db/prisma";
import { StockDeductionRetroItem, TimeFmForecastItem } from "../types/stockTypes";

export class DeductionVerificationService {
  /**
   * 实盘三态闭环检验引擎 (Outcome Verifier)
   * 在下一次启动推演时，自动对历史未核验的推演记录进行实盘复盘，打标为 成功经验 (EXPERIENCE) / 失败教训 (LESSON) / 随机噪音 (RANDOM_NOISE)
   */
  public async verifyPastPredictions(
    portfolioId: string = "default-portfolio",
    liveQuotesMap: Map<string, number>
  ): Promise<{
    verifiedCount: number;
    experiencesCount: number;
    lessonsCount: number;
    randomNoiseCount: number;
    totalPnLImpact: number;
    summaryText: string;
  }> {
    const todayStr = new Date().toISOString().split("T")[0];
    
    // 查询所有未核验的历史记录 (日期早于今日)
    const unverifiedLogs = await prisma.stockDeductionLog.findMany({
      where: {
        portfolioId,
        isVerified: false,
        deductionDate: { lt: todayStr },
      },
    });

    if (unverifiedLogs.length === 0) {
      return {
        verifiedCount: 0,
        experiencesCount: 0,
        lessonsCount: 0,
        randomNoiseCount: 0,
        totalPnLImpact: 0,
        summaryText: "所有既往推演记录已完成实盘核验，暂无待检验项。",
      };
    }

    let expCount = 0;
    let lesCount = 0;
    let noiseCount = 0;
    let totalPnLImpact = 0;

    for (const log of unverifiedLogs) {
      const symUpper = log.symbol.toUpperCase();
      const curPrice = liveQuotesMap.get(symUpper);
      if (!curPrice || curPrice <= 0) continue;

      const trigPrice = log.triggerPrice || curPrice;
      const changeRate = Number((((curPrice - trigPrice) / trigPrice) * 100).toFixed(2));
      const shares = log.suggestedShares || 10;
      
      let outcome: "EXPERIENCE" | "LESSON" | "RANDOM_NOISE" = "RANDOM_NOISE";
      let lessonText = "";
      let pnlImpact = 0;

      // 1. 成功经验判定 (EXPERIENCE)
      if ((log.action === "BUY" || log.timefmDirection === "UP") && changeRate >= 0.6) {
        outcome = "EXPERIENCE";
        pnlImpact = Number(((curPrice - trigPrice) * shares).toFixed(2));
        lessonText = `[成功经验] 预测 [${log.symbol}] 看多/建仓，实盘验证上涨 +${changeRate}%，带来浮盈收益 $${pnlImpact}`;
        expCount++;
      } else if ((log.action === "TRIM" || log.action === "SELL") && changeRate <= -0.6) {
        outcome = "EXPERIENCE";
        pnlImpact = Number(((trigPrice - curPrice) * shares).toFixed(2));
        lessonText = `[成功经验] 预测 [${log.symbol}] 触及防线并执行减仓避险，实盘随后下跌 ${changeRate}%，成功规避 $${pnlImpact} 回调损失`;
        expCount++;
      }
      // 2. 失败教训判定 (LESSON)
      else if ((log.action === "BUY" || log.timefmDirection === "UP") && changeRate <= -0.8) {
        outcome = "LESSON";
        pnlImpact = Number(((curPrice - trigPrice) * shares).toFixed(2));
        lessonText = `[失败教训] 预测 [${log.symbol}] 建仓后股价回调 ${changeRate}%，触及短期止损线，提示需强化支撑位右侧确认并警惕假突破`;
        lesCount++;
      } else if ((log.action === "TRIM" || log.action === "SELL") && changeRate >= 1.5) {
        outcome = "LESSON";
        pnlImpact = 0;
        lessonText = `[失败教训] 对 [${log.symbol}] 减仓后股价逆势大涨 +${changeRate}% 存在卖飞，提示需放宽主线强势标的的移动止盈空间`;
        lesCount++;
      }
      // 3. 无法判断的随机噪音 (RANDOM_NOISE)
      else {
        outcome = "RANDOM_NOISE";
        lessonText = `[随机噪音] [${log.symbol}] 日内窄幅波动 ${changeRate > 0 ? "+" : ""}${changeRate}%，属于缺乏明确催化剂的常态化横盘，不归咎为系统性预测偏差`;
        noiseCount++;
      }

      totalPnLImpact += pnlImpact;

      await prisma.stockDeductionLog.update({
        where: { id: log.id },
        data: {
          isVerified: true,
          verifiedAt: new Date(),
          actualNextClosePrice: curPrice,
          actualNextChangeRate: changeRate,
          verificationOutcome: outcome,
          verificationLesson: lessonText,
          pnlImpactAmount: pnlImpact,
        },
      });
    }

    const summaryText = `完成 ${unverifiedLogs.length} 笔历史推演实盘闭环核验：成功经验 ${expCount} 笔、失败教训 ${lesCount} 笔、随机噪音 ${noiseCount} 笔，累计量化归因收益/避险 $${totalPnLImpact.toFixed(2)}`;

    return {
      verifiedCount: unverifiedLogs.length,
      experiencesCount: expCount,
      lessonsCount: lesCount,
      randomNoiseCount: noiseCount,
      totalPnLImpact,
      summaryText,
    };
  }

  /**
   * 提取单只标的的历史实盘核验记忆库 (供反哺 Ollama Prompt 与前端卡片展示)
   */
  public async getStockVerifiedHistory(
    portfolioId: string,
    symbol: string
  ): Promise<{
    historyLogs: Array<{
      deductionDate: string;
      action: string;
      timefmDirection?: string;
      timefmPredictedPrice?: number;
      actualClosePrice?: number;
      actualChangeRate?: number;
      verificationOutcome: "EXPERIENCE" | "LESSON" | "RANDOM_NOISE" | "PENDING";
      verificationOutcomeLabel: string;
      verificationLesson: string;
      pnlImpactAmount?: number;
    }>;
    promptMemoryContext: string;
  }> {
    const symbolUpper = symbol.toUpperCase();
    const records = await prisma.stockDeductionLog.findMany({
      where: {
        portfolioId,
        symbol: symbolUpper,
      },
      orderBy: { deductionDate: "desc" },
      take: 10,
    });

    const historyLogs = records.map((r) => {
      const outcome = (r.verificationOutcome as any) || "PENDING";
      const outcomeLabel =
        outcome === "EXPERIENCE"
          ? "🟢 成功经验"
          : outcome === "LESSON"
          ? "🔴 失败教训"
          : outcome === "RANDOM_NOISE"
          ? "🎲 随机噪音"
          : "⏳ 实盘检验中";

      return {
        deductionDate: r.deductionDate,
        action: r.action,
        timefmDirection: r.timefmDirection ?? undefined,
        timefmPredictedPrice: r.timefmPredictedPrice ?? undefined,
        actualClosePrice: r.actualNextClosePrice ?? undefined,
        actualChangeRate: r.actualNextChangeRate ?? undefined,
        verificationOutcome: outcome,
        verificationOutcomeLabel: outcomeLabel,
        verificationLesson: r.verificationLesson || `[${r.deductionDate}] 建议 ${r.action}，等待实盘验证`,
        pnlImpactAmount: r.pnlImpactAmount ?? undefined,
      };
    });

    const verifiedOnly = historyLogs.filter((h) => h.verificationOutcome !== "PENDING");
    const promptMemoryContext =
      verifiedOnly.length > 0
        ? `【该标的既往实盘复盘检验记忆库】:\n` +
          verifiedOnly
            .slice(0, 3)
            .map((h) => `• [${h.deductionDate}] ${h.verificationOutcomeLabel}: ${h.verificationLesson}`)
            .join("\n")
        : `【该标的既往实盘复盘检验记忆库】: 暂无历史实盘验证教训，按标准因子推演。`;

    return {
      historyLogs,
      promptMemoryContext,
    };
  }

  /**
   * 异步高密度保存单只或批量标的今日推演全要素快照 (供次日闭环复盘核验)
   */
  public async saveDeductionLogsBatch(
    portfolioId: string,
    strategyId: string,
    deductionDate: string,
    items: StockDeductionRetroItem[]
  ): Promise<void> {
    for (const item of items) {
      const symUpper = item.symbol.toUpperCase();
      const rec = item.currentRecommendation;
      const tfm = item.timefmForecast;
      const curPrice =
        item.openDSnapshot?.lastPrice ||
        item.position?.marketPrice ||
        rec?.estimatedPrice ||
        1.0;

      try {
        await prisma.stockDeductionLog.upsert({
          where: {
            portfolioId_deductionDate_symbol: {
              portfolioId,
              deductionDate,
              symbol: symUpper,
            },
          },
          create: {
            portfolioId,
            strategyId,
            deductionDate,
            symbol: symUpper,
            companyName: item.companyName || symUpper,
            searxngNewsJson: JSON.stringify(item.latestNews || []),
            knowledgeGraphJson: JSON.stringify(item.knowledgeGraph || {}),
            fundamentalsJson: JSON.stringify(item.fundamentals || {}),
            timefmDirection: tfm?.direction,
            timefmPredictedPrice: tfm?.predictedPrice,
            timefmPredictedChange: tfm?.predictedChangeRate,
            timefmConfidenceLow: tfm?.confidenceLow,
            timefmConfidenceHigh: tfm?.confidenceHigh,
            action: rec?.action || "HOLD",
            strategyCategory: item.strategyCategory,
            suggestedShares: rec?.suggestedShares || 0,
            triggerPrice: curPrice,
            targetPrice: rec?.targetPrice,
            stopLossPrice: rec?.stopLossPrice,
            rationale: rec?.rationale || "基于全要素推演",
            isVerified: false,
          },
          update: {
            strategyId,
            companyName: item.companyName || symUpper,
            searxngNewsJson: JSON.stringify(item.latestNews || []),
            knowledgeGraphJson: JSON.stringify(item.knowledgeGraph || {}),
            fundamentalsJson: JSON.stringify(item.fundamentals || {}),
            timefmDirection: tfm?.direction,
            timefmPredictedPrice: tfm?.predictedPrice,
            timefmPredictedChange: tfm?.predictedChangeRate,
            timefmConfidenceLow: tfm?.confidenceLow,
            timefmConfidenceHigh: tfm?.confidenceHigh,
            action: rec?.action || "HOLD",
            strategyCategory: item.strategyCategory,
            suggestedShares: rec?.suggestedShares || 0,
            triggerPrice: curPrice,
            targetPrice: rec?.targetPrice,
            stopLossPrice: rec?.stopLossPrice,
            rationale: rec?.rationale || "基于全要素推演",
          },
        });
      } catch (e) {}
    }
  }
}

export const deductionVerificationService = new DeductionVerificationService();
