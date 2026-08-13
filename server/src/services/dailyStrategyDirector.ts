import { prisma } from "../db/prisma";
import { openDaemonManager } from "./openDaemonManager";
import { moomooAdapter } from "./moomooAdapter";
import { searxngSearchService } from "./searxngSearchService";
import { stockKnowledgeGraphStoreService } from "./stockKnowledgeGraphStore";
import { stockEngine } from "./stockEngine";
import { ollamaService } from "./ollamaService";
import { computeTotalPnL, computeRetroPnL, savePortfolioSnapshot } from "./stockMemoryManager";
import {
  DailyAllocationOutput,
  StockPositionItem,
  StrategyProgressStage,
  StockDeductionRetroItem,
  SingleStockIntel,
  ActionItem,
} from "../types/stockTypes";

export class DailyStrategyDirector {
  public currentActiveStage: StrategyProgressStage | null = null;
  public liveDeductionPipeline: {
    modelUsed: string;
    promptContextText: string;
    knowledgeGraphContext: string;
    searxngNewsContext: string;
    positionsContext: string;
    lessonsContext: string;
    rawOllamaOutput?: string;
  } | null = null;

  public async generateDailyStrategy(
    portfolioId: string = "default-portfolio",
    customBudget?: number,
    ollamaModel?: string,
    onProgress?: (stage: StrategyProgressStage) => void
  ): Promise<{
    strategyId: string;
    strategyDate: string;
    openDStatus: { connected: boolean; message: string };
    searxngStatus: { connected: boolean; message: string };
    ollamaStatus: { connected: boolean; message: string };
    deductionPipeline: {
      modelUsed: string;
      promptContextText: string;
      knowledgeGraphContext: string;
      searxngNewsContext: string;
      positionsContext: string;
      lessonsContext: string;
      rawOllamaOutput?: string;
    };
    output: DailyAllocationOutput;
    retroPnL: object;
  }> {
    const notifyStage = (
      step: number,
      stageId: StrategyProgressStage["stageId"],
      title: string,
      detail: string,
      progressPercent: number
    ) => {
      const stg: StrategyProgressStage = {
        step,
        totalSteps: 6,
        stageId,
        title,
        detail,
        progressPercent,
        timestamp: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
      };
      this.currentActiveStage = stg;
      if (onProgress) {
        onProgress(stg);
      }
    };

    // STEP 1: 确保 OpenD 通道 (OPEND_CONNECT)
    notifyStage(1, "OPEND_CONNECT", "MooMoo OpenD 持仓连通", "测试 127.0.0.1:11111 TCP 原生通道拉取真实持仓...", 15);
    const openDCheck = await openDaemonManager.ensureOpenDRunning();

    const openDPortfolio = await moomooAdapter.fetchPortfolioFromOpenD();
    const watchlistItems = await moomooAdapter.fetchWatchlistFromOpenD();

    const openDPositions: StockPositionItem[] = openDPortfolio.positions ?? [];
    const openDCash = openDPortfolio.cashBalance ?? 0;

    let portfolio = await prisma.stockPortfolio.findUnique({
      where: { id: portfolioId },
      include: { positions: true },
    });

    if (!portfolio) {
      portfolio = await prisma.stockPortfolio.create({
        data: {
          id: portfolioId,
          name: "MooMoo 美股主仓位",
          cashBalance: openDCash,
          totalBudget: customBudget ?? 1000.0,
          riskPreference: "BALANCED",
          positions: {
            create: openDPositions.map((p) => ({
              symbol: p.symbol,
              companyName: p.companyName,
              shares: p.shares,
              costBasis: p.costBasis,
              marketPrice: p.marketPrice,
            })),
          },
        },
        include: { positions: true },
      });
    } else if (openDPortfolio.fromOpenD && openDPositions.length > 0) {
      await prisma.stockPortfolio.update({
        where: { id: portfolioId },
        data: { cashBalance: openDCash },
      });

      await prisma.stockPosition.deleteMany({
        where: { portfolioId },
      });

      await prisma.stockPosition.createMany({
        data: openDPositions.map((p) => ({
          portfolioId,
          symbol: p.symbol,
          companyName: p.companyName || p.symbol,
          shares: p.shares,
          costBasis: p.costBasis,
          marketPrice: p.marketPrice || p.costBasis,
        })),
      });

      portfolio = await prisma.stockPortfolio.findUnique({
        where: { id: portfolioId },
        include: { positions: true },
      });
    }

    if (!portfolio) {
      throw new Error("Portfolio not found");
    }

    // STEP 2: Phase 1 搜刮美股大盘走向、热点情绪与主流财经媒体 (MACRO_SEARCH)
    notifyStage(2, "MACRO_SEARCH", "SearXNG 全网宏观与明星板块", "正在从 Bloomberg/CNBC/Reuters 搜刮大盘走向与热点...", 30);
    const macroRes = await searxngSearchService.searchMacroAndSectorNews();

    // STEP 3: 合成候选股票池 Candidate Stock Pool (CANDIDATE_ASSEMBLE)
    notifyStage(3, "CANDIDATE_ASSEMBLE", "合成候选股票池", "融合实盘持仓 + 自选股 + 宏观热门推荐...", 45);
    const holdingSymbols = portfolio.positions.map((p) => p.symbol.toUpperCase());
    const watchlistSymbols = watchlistItems.map((w) => w.symbol.toUpperCase());

    const candidateSymbols = Array.from(
      new Set([...holdingSymbols, ...watchlistSymbols])
    );

    const realQuotes = await moomooAdapter.fetchMarketQuotes(candidateSymbols);
    const quotesMap = new Map<string, number>();
    realQuotes.forEach((q) => quotesMap.set(q.symbol.toUpperCase(), q.price));

    const budgetToUse = customBudget !== undefined ? customBudget : portfolio.totalBudget;
    const currentPositions: StockPositionItem[] = portfolio.positions.map((p) => ({
      symbol: p.symbol,
      companyName: p.companyName || p.symbol,
      shares: p.shares,
      costBasis: p.costBasis,
      marketPrice: quotesMap.get(p.symbol.toUpperCase()) || p.marketPrice,
    }));

    // STEP 4: 逐标的消歧深度搜刮 (新闻 + 社区情绪 + 大资金动向 + 基本面) (STOCK_DEEP_SEARCH)
    notifyStage(4, "STOCK_DEEP_SEARCH", "单标的多维独立挖掘", `针对 ${candidateSymbols.length} 只候选标的单独抓取重磅新闻、社区情绪与主力资金...`, 60);

    const candidateStockIntels = new Map<string, SingleStockIntel>();
    const knowledgeGraphList = [];
    const perStockDeductionRetroList: StockDeductionRetroItem[] = [];

    // 读取前期策略核验对齐
    const prevStrategy = await prisma.dailyStrategy.findFirst({
      where: { portfolioId },
      orderBy: { createdAt: "desc" },
    });

    let prevActionsMap = new Map<string, any>();
    if (prevStrategy && prevStrategy.actionsJson) {
      try {
        const parsed = JSON.parse(prevStrategy.actionsJson);
        if (Array.isArray(parsed)) {
          parsed.forEach((a: any) => prevActionsMap.set(a.symbol.toUpperCase(), a));
        }
      } catch (e) {}
    }

    let symbolIndex = 0;
    for (const sym of candidateSymbols) {
      symbolIndex++;
      notifyStage(
        4,
        "STOCK_DEEP_SEARCH",
        "单标的多维独立挖掘",
        `正在对 [${sym}] 执行多义词消歧搜索与大资金/社区情绪抓取 (${symbolIndex}/${candidateSymbols.length})...`,
        60 + Math.floor((symbolIndex / candidateSymbols.length) * 20)
      );

      const pos = currentPositions.find((p) => p.symbol.toUpperCase() === sym);
      const companyName = pos?.companyName || watchlistItems.find((w) => w.symbol.toUpperCase() === sym)?.companyName || sym;

      const intel = await searxngSearchService.searchSingleStockIntel(sym, companyName);
      candidateStockIntels.set(sym, intel);

      let kgItem = await stockKnowledgeGraphStoreService.getKnowledgeGraph(portfolioId, sym);
      if (!kgItem) {
        kgItem = stockKnowledgeGraphStoreService.buildDefaultKnowledgeGraph(sym);
      }
      await stockKnowledgeGraphStoreService.upsertKnowledgeGraph(portfolioId, kgItem);
      knowledgeGraphList.push(kgItem);

      const fundamentals = await stockKnowledgeGraphStoreService.getFundamentals(sym);
      const isClearedPos = !pos || pos.shares <= 0;
      const prevAction = prevActionsMap.get(sym);
      const currentPrice = quotesMap.get(sym) || pos?.marketPrice || 0;

      let pastRetroText = prevAction
        ? `针对上次建议 (${prevAction.action}) 对照：当前现价 $${currentPrice.toFixed(2)}。`
        : isClearedPos
        ? `[${sym}] 既往已平仓离场，现价 $${currentPrice.toFixed(2)}。`
        : `[${sym}] 首次纳入候选推演，暂无前期历史基准。`;

      const candidateCategory: StockDeductionRetroItem["candidateCategory"] = holdingSymbols.includes(sym)
        ? "EXISTING_HOLDING"
        : watchlistSymbols.includes(sym)
        ? "WATCHLIST"
        : "MACRO_CANDIDATE";

      perStockDeductionRetroList.push({
        symbol: sym,
        companyName,
        isCleared: isClearedPos,
        candidateCategory,
        knowledgeGraph: kgItem,
        latestNews: intel.latestNews,
        communitySentiment: intel.communitySentiment,
        capitalFlow: intel.capitalFlow,
        fundamentals: fundamentals ?? undefined,
        position: pos
          ? { ...pos, isCleared: isClearedPos }
          : { symbol: sym, companyName, shares: 0, costBasis: currentPrice, marketPrice: currentPrice, isCleared: true },
        pastRetro: {
          lastStrategyDate: prevStrategy?.strategyDate,
          lastAction: prevAction?.action || (isClearedPos ? "SELL" : "HOLD"),
          lastTargetPrice: prevAction?.targetPrice,
          lastStopLossPrice: prevAction?.stopLossPrice,
          actualPriceAction: pastRetroText,
          pnlImpact: pos ? (currentPrice - pos.costBasis) * pos.shares : 0,
        },
      });
    }

    const retroPnL = await computeRetroPnL(portfolioId, prevStrategy?.id, quotesMap);

    // STEP 5: Map-Reduce 多阶段 LLM 推理 (MAP_REDUCE_DEDUCTION)
    notifyStage(5, "MAP_REDUCE_DEDUCTION", "Map-Reduce 分段大模型推理", "执行 Stage A (宏观) -> Stage B (单标的 Map) 分段推理...", 85);
    const ollamaCheck = await ollamaService.getStatus();

    let screenerRes: {
      actions: ActionItem[];
      oversoldOpportunities?: ActionItem[];
      riskAlerts: any[];
      marketOverview: string;
    };

    let deductionPipeline = {
      modelUsed: ollamaModel || "Ollama / Map-Reduce Engine",
      promptContextText: `[Candidate Pool Size: ${candidateSymbols.length}]`,
      knowledgeGraphContext: `${knowledgeGraphList.length} 标的图谱已装载`,
      searxngNewsContext: macroRes.rawNewsText,
      positionsContext: `${currentPositions.length} 笔实盘持仓`,
      lessonsContext: `${retroPnL.lessonsLearned.length} 条反思教训`,
      rawOllamaOutput: "",
    };

    if (ollamaCheck.connected && ollamaCheck.models.length > 0) {
      const modelToUse = ollamaModel || ollamaCheck.recommendedModel || ollamaCheck.models[0];
      try {
        console.log(`[DailyStrategyDirector] 执行 Map-Reduce 分段推理 (${modelToUse})...`);
        const ollamaRes = await ollamaService.generateStrategyWithOllama(modelToUse, {
          positions: currentPositions,
          candidateSymbols,
          candidateStockIntels,
          quotesMap,
          searxngNewsText: macroRes.rawNewsText,
          knowledgeGraphs: knowledgeGraphList,
          lessonsLearned: retroPnL.lessonsLearned,
          totalBudget: budgetToUse,
          cashBalance: portfolio.cashBalance,
          riskPreference: portfolio.riskPreference,
        });

        screenerRes = {
          actions: ollamaRes.actions,
          riskAlerts: ollamaRes.riskAlerts,
          marketOverview: ollamaRes.marketOverview,
          oversoldOpportunities: ollamaRes.actions.filter((a) => a.action === "BUY"),
        };

        deductionPipeline = {
          modelUsed: ollamaRes.modelUsed,
          promptContextText: ollamaRes.promptText,
          knowledgeGraphContext: ollamaRes.knowledgeGraphContext,
          searxngNewsContext: ollamaRes.searxngNewsContext,
          positionsContext: ollamaRes.positionsContext,
          lessonsContext: ollamaRes.lessonsContext,
          rawOllamaOutput: ollamaRes.rawOllamaResponse || "",
        };
      } catch (err: any) {
        console.warn(`[DailyStrategyDirector] Ollama 推理降级至量化规则引擎:`, err.message);
        screenerRes = stockEngine.generateStockScreenerRecommendations(
          currentPositions,
          watchlistItems,
          quotesMap,
          macroRes.rawNewsText,
          budgetToUse,
          portfolio.riskPreference
        );
        deductionPipeline.modelUsed = `量化规则引擎 (Fallback: ${err.message})`;
        deductionPipeline.rawOllamaOutput = JSON.stringify(screenerRes, null, 2);
      }
    } else {
      screenerRes = stockEngine.generateStockScreenerRecommendations(
        currentPositions,
        watchlistItems,
        quotesMap,
        macroRes.rawNewsText,
        budgetToUse,
        portfolio.riskPreference
      );
      deductionPipeline.modelUsed = "量化规则引擎 (Ollama 离线)";
      deductionPipeline.rawOllamaOutput = JSON.stringify(screenerRes, null, 2);
    }

    // 将推演建议动作绑回列表
    screenerRes.actions.forEach((act) => {
      const target = perStockDeductionRetroList.find((item) => item.symbol.toUpperCase() === act.symbol.toUpperCase());
      if (target) {
        target.currentRecommendation = act;
      }
    });

    this.liveDeductionPipeline = deductionPipeline;

    // STEP 6: 时间序列快照落库与终态落库 (FINISHED)
    notifyStage(6, "FINISHED", "策略落库与全要素构建完毕", "完成 2 阶段搜刮、候选池分段推演与复盘核验", 100);
    const todayStr = new Date().toISOString().split("T")[0];
    const totalPnLState = computeTotalPnL(currentPositions, portfolio.cashBalance);
    await savePortfolioSnapshot(portfolioId, todayStr, totalPnLState);

    const strategyRecord = await prisma.dailyStrategy.create({
      data: {
        portfolioId,
        strategyDate: todayStr,
        marketOverview: screenerRes.marketOverview,
        existingGuidance: "基于 SearXNG 消歧搜刮与 Map-Reduce 分段推理的开盘指南",
        newGuidance: "严格遵从止盈止损防线分批建仓",
        actionsJson: JSON.stringify(screenerRes.actions),
        riskAlertsJson: JSON.stringify(screenerRes.riskAlerts),
        deductionPipelineJson: JSON.stringify(deductionPipeline),
        retroPnLScore: retroPnL.accuracyScore,
      },
    });

    await prisma.strategyRetrospective.create({
      data: {
        portfolioId,
        strategyId: strategyRecord.id,
        retroDate: todayStr,
        accuracyScore: retroPnL.accuracyScore ?? 0,
        executionMatchRate: retroPnL.executionMatchRate ?? 100,
        avoidedLoss: retroPnL.avoidedLoss,
        totalRealizedPnL: retroPnL.totalRealizedPnL,
        summaryText: retroPnL.summaryText,
        lessonsLearnedJson: JSON.stringify(retroPnL.lessonsLearned),
      },
    });

    const searxngCheck = await searxngSearchService.getStatus();

    return {
      strategyId: strategyRecord.id,
      strategyDate: todayStr,
      openDStatus: { connected: openDCheck.success, message: openDCheck.message },
      searxngStatus: { connected: searxngCheck.connected, message: searxngCheck.message },
      ollamaStatus: { connected: ollamaCheck.connected, message: ollamaCheck.message },
      deductionPipeline,
      output: {
        marketOverview: screenerRes.marketOverview,
        existingPositionGuidance: "严格执行盘前风控止损与阶梯止盈防线",
        newPositionGuidance: "结合大资金走向与 SearXNG 消歧新闻择优建仓",
        actions: screenerRes.actions,
        riskAlerts: screenerRes.riskAlerts,
        knowledgeGraph: knowledgeGraphList,
        perStockDeductionRetro: perStockDeductionRetroList,
        narrativeReport: `### 操盘分析报告 (${todayStr})\n\n${screenerRes.marketOverview}`,
      },
      retroPnL,
    };
  }
}

export const dailyStrategyDirector = new DailyStrategyDirector();
