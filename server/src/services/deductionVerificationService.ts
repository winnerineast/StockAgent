import { prisma } from "../db/prisma";
import {
  StockDeductionRetroItem,
  StockActionVerdict,
  TemporalEvolutionItem,
  Evidence5Pillars,
  PastLessonEvidence,
} from "../types/stockTypes";
import { memoryConsolidationService } from "./memoryConsolidationService";

export class DeductionVerificationService {
  private static instance: DeductionVerificationService;

  public static getInstance(): DeductionVerificationService {
    if (!DeductionVerificationService.instance) {
      DeductionVerificationService.instance = new DeductionVerificationService();
    }
    return DeductionVerificationService.instance;
  }

  /**
   * 实盘三态闭环检验引擎 (Outcome Verifier)
   * 对历史未核验的推演记录进行实盘对账，打标为 成功经验 (EXPERIENCE) / 失败教训 (LESSON) / 随机噪音 (RANDOM_NOISE)
   * 并即时触发长期原则库的聚类合并与记忆强化 (memoryConsolidationService)
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
    const lessonsToConsolidateBySymbol = new Map<string, PastLessonEvidence[]>();

    for (const log of unverifiedLogs) {
      const symUpper = log.symbol.toUpperCase();
      const curPrice = liveQuotesMap.get(symUpper);
      if (!curPrice || curPrice <= 0) continue;

      const trigPrice = log.triggerPrice || curPrice;
      const changeRate = Number((((curPrice - trigPrice) / trigPrice) * 100).toFixed(2));
      const shares = log.suggestedShares || 10;
      const actionType = log.actionType || (log.action === "BUY" ? "OPEN_POSITION" : log.action === "SELL" || log.action === "TRIM" ? "TRIM_POSITION" : "HOLD_AND_WATCH");

      let outcome: "EXPERIENCE" | "LESSON" | "RANDOM_NOISE" = "RANDOM_NOISE";
      let outcomeLabel = "🎲 随机噪音";
      let lessonText = "";
      let pnlImpact = 0;

      // 1. 成功经验判定 (EXPERIENCE)
      if ((actionType === "OPEN_POSITION" || actionType === "ADD_POSITION" || log.action === "BUY" || log.timefmDirection === "UP") && changeRate >= 0.6) {
        outcome = "EXPERIENCE";
        outcomeLabel = "🟢 成功经验";
        pnlImpact = Number(((curPrice - trigPrice) * shares).toFixed(2));
        lessonText = `[成功经验] 预测 [${log.symbol}] 看多/${actionType === "ADD_POSITION" ? "加仓" : "建仓"}，实盘验证上涨 +${changeRate}%，实现浮盈 $${pnlImpact}`;
        expCount++;
      } else if ((actionType === "TRIM_POSITION" || actionType === "CLOSE_POSITION" || log.action === "TRIM" || log.action === "SELL") && changeRate <= -0.6) {
        outcome = "EXPERIENCE";
        outcomeLabel = "🟢 成功经验";
        pnlImpact = Number(((trigPrice - curPrice) * shares).toFixed(2));
        lessonText = `[成功经验] 预测 [${log.symbol}] 触及防线并执行减仓/清仓避险，实盘随后下跌 ${changeRate}%，成功规避 $${pnlImpact} 回调损失`;
        expCount++;
      }
      // 2. 失败教训判定 (LESSON)
      else if ((actionType === "OPEN_POSITION" || actionType === "ADD_POSITION" || log.action === "BUY" || log.timefmDirection === "UP") && changeRate <= -0.8) {
        outcome = "LESSON";
        outcomeLabel = "🔴 失败教训";
        pnlImpact = Number(((curPrice - trigPrice) * shares).toFixed(2));
        lessonText = `[失败教训] 预测 [${log.symbol}] 建仓后股价回调 ${changeRate}%，触及短期止损线，提示需强化支撑位右侧确认并警惕假突破`;
        lesCount++;
      } else if ((actionType === "TRIM_POSITION" || actionType === "CLOSE_POSITION" || log.action === "TRIM" || log.action === "SELL") && changeRate >= 1.5) {
        outcome = "LESSON";
        outcomeLabel = "🔴 失败教训";
        pnlImpact = 0;
        lessonText = `[失败教训] 对 [${log.symbol}] 减仓后股价逆势大涨 +${changeRate}% 存在卖飞，提示需放宽主线强势标的的移动止盈空间`;
        lesCount++;
      }
      // 3. 随机噪音 (RANDOM_NOISE)
      else {
        outcome = "RANDOM_NOISE";
        outcomeLabel = "🎲 随机噪音";
        lessonText = `[随机噪音] [${log.symbol}] 日内窄幅波动 ${changeRate > 0 ? "+" : ""}${changeRate}%，属于常态化震荡，不归咎为系统性预测偏差`;
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

      if (outcome !== "RANDOM_NOISE") {
        if (!lessonsToConsolidateBySymbol.has(symUpper)) {
          lessonsToConsolidateBySymbol.set(symUpper, []);
        }
        lessonsToConsolidateBySymbol.get(symUpper)!.push({
          id: log.id,
          date: log.deductionDate,
          action: actionType,
          outcome,
          outcomeLabel,
          lessonText,
          pnlImpactAmount: pnlImpact,
        });
      }
    }

    // 触发长周期认知记忆库的聚类合并、遗忘衰减与重组
    for (const [sym, lessons] of lessonsToConsolidateBySymbol.entries()) {
      await memoryConsolidationService.consolidateAndDistill(portfolioId, sym, lessons);
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
   * 获取某标的随时间演进的完整历史推演时间轴 (Temporal Evolution Timeline)
   */
  public async getSymbolTemporalEvolution(
    portfolioId: string = "default-portfolio",
    symbol: string
  ): Promise<TemporalEvolutionItem[]> {
    const symbolUpper = symbol.toUpperCase();
    const records = await prisma.stockDeductionLog.findMany({
      where: {
        portfolioId,
        symbol: symbolUpper,
      },
      orderBy: { deductionDate: "desc" },
      take: 30,
    });

    return records.map((r) => {
      let parsedNews = [];
      let parsedFundamentals = undefined;
      let parsedLiveMarket = undefined;
      let parsedTimeFm = undefined;
      let parsedPastLessons = [];

      try { parsedNews = JSON.parse(r.evidenceNewsJson || r.searxngNewsJson || "[]"); } catch (e) {}
      try { parsedFundamentals = JSON.parse(r.evidenceFundamentalsJson || r.fundamentalsJson || "{}"); } catch (e) {}
      try { parsedLiveMarket = JSON.parse(r.evidenceLiveMarketJson || "{}"); } catch (e) {}
      try { parsedTimeFm = JSON.parse(r.evidenceTimeFmJson || "{}"); } catch (e) {}
      try { parsedPastLessons = JSON.parse(r.evidencePastLessonsJson || "[]"); } catch (e) {}

      const actionVerdict: StockActionVerdict = (r.actionType as any) || (r.action === "BUY" ? "OPEN_POSITION" : r.action === "SELL" || r.action === "TRIM" ? "TRIM_POSITION" : "HOLD_AND_WATCH");
      const actionLabelMap: Record<StockActionVerdict, string> = {
        OPEN_POSITION: "🟢 建议建仓",
        ADD_POSITION: "🟢 建议加仓",
        TRIM_POSITION: "🟡 建议减仓",
        CLOSE_POSITION: "🔴 建议清仓",
        HOLD_AND_WATCH: "⚪ 保持观望",
        INSUFFICIENT_DATA_ABORT: "⚠️ 信息不足·熔断推演",
      };

      const outcome = (r.verificationOutcome as any) || (r.isVerified ? "RANDOM_NOISE" : undefined);
      const outcomeLabel =
        outcome === "EXPERIENCE"
          ? "🟢 成功经验"
          : outcome === "LESSON"
          ? "🔴 失败教训"
          : outcome === "RANDOM_NOISE"
          ? "🎲 随机噪音"
          : "⏳ 正在检验";

      return {
        id: r.id,
        deductionDate: r.deductionDate,
        actionType: actionVerdict,
        actionTypeLabel: actionLabelMap[actionVerdict] || r.action,
        whySummary: r.whySummary || r.rationale,
        triggerPrice: r.triggerPrice,
        targetPrice: r.targetPrice ?? undefined,
        stopLossPrice: r.stopLossPrice ?? undefined,
        entryZone: r.entryZoneMin && r.entryZoneMax ? { min: r.entryZoneMin, max: r.entryZoneMax } : undefined,
        timeStopDays: r.timeStopDays ?? 5,
        certaintyScore: r.certaintyScore ?? 50,
        goalAttainmentProbability: r.goalAttainmentProbability ?? 50,
        isVerified: r.isVerified,
        actualNextClosePrice: r.actualNextClosePrice ?? undefined,
        actualNextChangeRate: r.actualNextChangeRate ?? undefined,
        verificationOutcome: outcome,
        verificationOutcomeLabel: outcomeLabel,
        verificationLesson: r.verificationLesson ?? undefined,
        pnlImpactAmount: r.pnlImpactAmount ?? undefined,
        evidence: {
          news: Array.isArray(parsedNews) ? parsedNews : [],
          fundamentals: parsedFundamentals,
          liveMarket: parsedLiveMarket || { curPrice: r.triggerPrice },
          timefm: parsedTimeFm || (r.timefmDirection ? {
            direction: r.timefmDirection as any,
            predictedPrice: r.timefmPredictedPrice || r.triggerPrice,
            predictedChangePct: r.timefmPredictedChange || 0,
            confidenceLow: r.timefmConfidenceLow || 0,
            confidenceHigh: r.timefmConfidenceHigh || 0,
            targetAttainmentProbability: 50,
          } : undefined),
          pastLessons: Array.isArray(parsedPastLessons) ? parsedPastLessons : [],
        },
      };
    });
  }

  /**
   * 提取单只标的的历史实盘核验记忆库与长期原则 (供反哺 Ollama Prompt 与前端展示)
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

    const activePrinciples = await memoryConsolidationService.getActivePrinciples(portfolioId, symbolUpper);
    const principlesText = memoryConsolidationService.formatPrinciplesForPrompt(activePrinciples);

    const verifiedOnly = historyLogs.filter((h) => h.verificationOutcome !== "PENDING");
    const recentEpisodicText =
      verifiedOnly.length > 0
        ? `【该标的最近实盘对账情景记忆】:\n` +
          verifiedOnly
            .slice(0, 3)
            .map((h) => `• [${h.deductionDate}] ${h.verificationOutcomeLabel}: ${h.verificationLesson}`)
            .join("\n")
        : "";

    const combinedPrompt = [principlesText, recentEpisodicText].filter(Boolean).join("\n\n") ||
      `【该标的既往实盘复盘检验记忆库】: 暂无历史实盘验证教训，按标准多因子推演。`;

    return {
      historyLogs,
      promptMemoryContext: combinedPrompt,
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

      const ev = item.evidence5Pillars;
      const actionVerdict: StockActionVerdict = rec?.actionType || (rec?.action === "BUY" ? "OPEN_POSITION" : rec?.action === "SELL" || rec?.action === "TRIM" ? "TRIM_POSITION" : "HOLD_AND_WATCH");

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
            action: rec?.action || "HOLD",
            actionType: actionVerdict,
            whySummary: rec?.whySummary || rec?.goalDrivenRationale || rec?.rationale,
            strategyCategory: item.strategyCategory,
            suggestedShares: rec?.suggestedShares || 0,
            triggerPrice: curPrice,
            targetPrice: rec?.targetPrice,
            stopLossPrice: rec?.stopLossPrice,
            entryZoneMin: rec?.entryZone?.min,
            entryZoneMax: rec?.entryZone?.max,
            timeStopDays: rec?.targetTimeHorizonDays || 5,
            certaintyScore: rec?.certaintyScore || 50,
            goalAttainmentProbability: rec?.goalAttainmentProbability || 50,
            rationale: rec?.rationale || "基于全要素推演",
            
            // 5 大事实支柱结构化快照
            evidenceNewsJson: JSON.stringify(ev?.news || item.credibleNews || []),
            evidenceFundamentalsJson: JSON.stringify(ev?.fundamentals || item.fundamentals || {}),
            evidenceLiveMarketJson: JSON.stringify(ev?.liveMarket || {
              curPrice,
              shares: item.position?.shares,
              costBasis: item.position?.costBasis,
              mainCapitalInflow: item.openDSnapshot?.mainCapitalInflow,
              turnoverRate: item.openDSnapshot?.turnoverRate,
            }),
            evidenceTimeFmJson: JSON.stringify(ev?.timefm || (tfm ? {
              direction: tfm.direction,
              predictedPrice: tfm.predictedPrice,
              predictedChangePct: tfm.predictedChangeRate,
              confidenceLow: tfm.confidenceLow,
              confidenceHigh: tfm.confidenceHigh,
              targetAttainmentProbability: rec?.goalAttainmentProbability || 50,
            } : {})),
            evidencePastLessonsJson: JSON.stringify(ev?.pastLessons || (item.pastRetro as any)?.historyLogs || []),

            // 兼容老字段
            searxngNewsJson: JSON.stringify(item.latestNews || []),
            knowledgeGraphJson: JSON.stringify(item.knowledgeGraph || {}),
            fundamentalsJson: JSON.stringify(item.fundamentals || {}),
            timefmDirection: tfm?.direction,
            timefmPredictedPrice: tfm?.predictedPrice,
            timefmPredictedChange: tfm?.predictedChangeRate,
            timefmConfidenceLow: tfm?.confidenceLow,
            timefmConfidenceHigh: tfm?.confidenceHigh,
            isVerified: false,
          },
          update: {
            strategyId,
            companyName: item.companyName || symUpper,
            action: rec?.action || "HOLD",
            actionType: actionVerdict,
            whySummary: rec?.whySummary || rec?.goalDrivenRationale || rec?.rationale,
            strategyCategory: item.strategyCategory,
            suggestedShares: rec?.suggestedShares || 0,
            triggerPrice: curPrice,
            targetPrice: rec?.targetPrice,
            stopLossPrice: rec?.stopLossPrice,
            entryZoneMin: rec?.entryZone?.min,
            entryZoneMax: rec?.entryZone?.max,
            timeStopDays: rec?.targetTimeHorizonDays || 5,
            certaintyScore: rec?.certaintyScore || 50,
            goalAttainmentProbability: rec?.goalAttainmentProbability || 50,
            rationale: rec?.rationale || "基于全要素推演",
            evidenceNewsJson: JSON.stringify(ev?.news || item.credibleNews || []),
            evidenceFundamentalsJson: JSON.stringify(ev?.fundamentals || item.fundamentals || {}),
            evidenceLiveMarketJson: JSON.stringify(ev?.liveMarket || {
              curPrice,
              shares: item.position?.shares,
              costBasis: item.position?.costBasis,
              mainCapitalInflow: item.openDSnapshot?.mainCapitalInflow,
              turnoverRate: item.openDSnapshot?.turnoverRate,
            }),
            evidenceTimeFmJson: JSON.stringify(ev?.timefm || (tfm ? {
              direction: tfm.direction,
              predictedPrice: tfm.predictedPrice,
              predictedChangePct: tfm.predictedChangeRate,
              confidenceLow: tfm.confidenceLow,
              confidenceHigh: tfm.confidenceHigh,
              targetAttainmentProbability: rec?.goalAttainmentProbability || 50,
            } : {})),
            evidencePastLessonsJson: JSON.stringify(ev?.pastLessons || (item.pastRetro as any)?.historyLogs || []),
          },
        });
      } catch (e) {}
    }
  }
}

export const deductionVerificationService = DeductionVerificationService.getInstance();
