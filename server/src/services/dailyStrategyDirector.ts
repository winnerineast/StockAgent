import { prisma } from "../db/prisma";
import { openDaemonManager } from "./openDaemonManager";
import { moomooAdapter } from "./moomooAdapter";
import { searxngSearchService } from "./searxngSearchService";
import { stockKnowledgeGraphStoreService } from "./stockKnowledgeGraphStore";
import { StockEngine, stockEngine } from "./stockEngine";
import { ollamaService } from "./ollamaService";
import { computeTotalPnL, computeRetroPnL, savePortfolioSnapshot } from "./stockMemoryManager";
import {
  DailyAllocationOutput,
  StockPositionItem,
  StrategyProgressStage,
  StockDeductionRetroItem,
  SingleStockIntel,
  ActionItem,
  StockStrategyCategory,
  OpenDSnapshotItem,
  DeductionPipelineData,
} from "../types/stockTypes";

export class DailyStrategyDirector {
  public currentActiveStage: StrategyProgressStage | null = null;
  public liveStageData: any = {};
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
        totalSteps: 5,
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

    this.liveStageData = {};
    this.liveDeductionPipeline = null;

    // STEP 1: 确保 OpenD 通道与自选股连通 (OPEND_CONNECT)
    notifyStage(1, "OPEND_CONNECT", "MooMoo OpenD 持仓自选连通", "测试 127.0.0.1:11111 TCP 原生通道拉取真实持仓与自选股...", 20);
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

    this.liveStageData = {
      ...this.liveStageData,
      step1Done: true,
      openDPositions,
      watchlistItems,
    };

    // STEP 2: Phase 1 搜刮美股大盘走向、热点情绪与主流财经媒体 (MACRO_SEARCH)
    notifyStage(2, "MACRO_SEARCH", "SearXNG 全网宏观与明星板块", "正在从 Bloomberg/CNBC/Reuters 搜刮大盘走向与热点...", 40);
    const macroRes = await searxngSearchService.searchMacroAndSectorNews();

    this.liveStageData = {
      ...this.liveStageData,
      step2Done: true,
      macroOverview: macroRes.macroOverview,
    };

    // STEP 3: 候选池构建与标的多维消歧深度挖掘 (CANDIDATE_AND_SEARCH)
    notifyStage(3, "CANDIDATE_AND_SEARCH", "候选池构建与标的多维挖掘", "正在直连 OpenD 官方接口拉取全美股行情、52周高低点与资金流...", 50);
    const holdingSymbols = portfolio.positions.map((p) => p.symbol.toUpperCase());
    const watchlistSymbols = watchlistItems.map((w) => w.symbol.toUpperCase());

    // 1. 构建多优先级全美股扫描池 (全部从 OpenD 官方接口动态拉取，绝不硬编码任何股票代码)
    const universeMap = new Map<string, { symbol: string; companyName: string; priority: number }>();
    
    // Priority 1: OpenD 实盘真实持仓 (100% 纳入推演)
    portfolio.positions.forEach((p) => {
      universeMap.set(p.symbol.toUpperCase(), { symbol: p.symbol.toUpperCase(), companyName: p.companyName || p.symbol, priority: 1 });
    });

    // Priority 2: OpenD 官方自选股 (优先计算自选股)
    watchlistItems.forEach((w) => {
      if (!universeMap.has(w.symbol.toUpperCase())) {
        universeMap.set(w.symbol.toUpperCase(), { symbol: w.symbol.toUpperCase(), companyName: w.companyName || w.symbol, priority: 2 });
      }
    });

    // Priority 3: OpenD 官方全美股股票池 (直连 OpenD 动态拉取，纯美股股票，无期货)
    const openDMarketUniverse = await moomooAdapter.fetchMarketUniverseFromOpenD();
    openDMarketUniverse.forEach((u) => {
      if (!universeMap.has(u.symbol.toUpperCase())) {
        universeMap.set(u.symbol.toUpperCase(), { symbol: u.symbol.toUpperCase(), companyName: u.companyName || u.symbol, priority: 3 });
      }
    });

    const allUniverseList = Array.from(universeMap.values()).sort((a, b) => a.priority - b.priority);
    // 优先保障 P1 实盘持仓与 P2 自选股，同时动态扫描 OpenD 提供的全美股活跃标的
    const p1P2List = allUniverseList.filter((u) => u.priority <= 2);
    const p3ListToScan = allUniverseList.filter((u) => u.priority === 3).slice(0, 150);
    const scanUniverseList = [...p1P2List, ...p3ListToScan];
    const scanUniverseSymbols = scanUniverseList.map((u) => u.symbol);

    // 2. 直连 MooMoo OpenD 官方通道拉取快照 (52周高低点、PE、PB、EPS、换手率) 与 资金流
    const snapshotsList = await moomooAdapter.fetchMarketSnapshotsFromOpenD(scanUniverseSymbols);
    const snapshotsMap = new Map<string, OpenDSnapshotItem>();
    snapshotsList.forEach((s) => snapshotsMap.set(s.symbol.toUpperCase(), s));

    const openDFlows = await moomooAdapter.fetchCapitalFlowsFromOpenD(scanUniverseSymbols.slice(0, 30));

    const quotesMap = new Map<string, number>();
    snapshotsList.forEach((s) => {
      if (s.lastPrice > 0) quotesMap.set(s.symbol.toUpperCase(), s.lastPrice);
    });

    const budgetToUse = customBudget !== undefined ? customBudget : portfolio.totalBudget;
    const currentPositions: StockPositionItem[] = portfolio.positions.map((p) => ({
      symbol: p.symbol,
      companyName: p.companyName || p.symbol,
      shares: p.shares,
      costBasis: p.costBasis,
      marketPrice: quotesMap.get(p.symbol.toUpperCase()) || p.marketPrice,
    }));

    // 3. 执行 5 大策略分类多因子严格判定，其余不符合标准的股票直接略过 (Skip)
    const classifiedCandidateList: Array<{
      symbol: string;
      companyName: string;
      priority: number;
      snapshot?: OpenDSnapshotItem;
      classification: any;
    }> = [];

    for (const u of scanUniverseList) {
      const pos = currentPositions.find((p) => p.symbol.toUpperCase() === u.symbol);
      const snap = snapshotsMap.get(u.symbol);
      if (snap && openDFlows[u.symbol]) {
        snap.capitalInflow = openDFlows[u.symbol].inFlow;
        snap.mainCapitalInflow = openDFlows[u.symbol].mainInFlow;
      }

      const classified = stockEngine.classifyStockOpportunity(
        u.symbol,
        u.companyName,
        snap,
        undefined,
        pos,
        budgetToUse * 0.35
      );

      // 仅当符合 5 大分类之一时才入选候选推演列表，否则略过
      if (classified) {
        classifiedCandidateList.push({
          symbol: u.symbol,
          companyName: u.companyName,
          priority: u.priority,
          snapshot: snap,
          classification: classified,
        });
      }
    }

    console.log(`[OpenD Direct] Dynamic Universe: ${allUniverseList.length} symbols (Scanned: ${scanUniverseSymbols.length}), Snapshots: ${snapshotsList.length}, Classified: ${classifiedCandidateList.length}`);

    // 优先级严格保证：P1 实盘持仓全部纳入，P2 自选股全部纳入，P3 全美股雷达精选前 10 只优质机会
    const p1List = classifiedCandidateList.filter((c) => c.priority === 1);
    const p2List = classifiedCandidateList.filter((c) => c.priority === 2);
    const p3List = classifiedCandidateList.filter((c) => c.priority === 3).slice(0, 10);
    const finalCandidateList = [...p1List, ...p2List, ...p3List];

    const candidateSymbols = finalCandidateList.map((c) => c.symbol);
    const candidateCategoryMap = new Map<string, { category: StockStrategyCategory; label: string; reason: string }>();
    finalCandidateList.forEach((c) => {
      candidateCategoryMap.set(c.symbol, {
        category: c.classification.strategyCategory,
        label: c.classification.strategyCategoryLabel,
        reason: c.classification.strategyCategoryReason,
      });
    });

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

    // 4. 对入选 5 大分类的标的进行消歧舆情搜刮与全要素装配
    let symbolIndex = 0;
    for (const cand of finalCandidateList) {
      const sym = cand.symbol;
      symbolIndex++;
      notifyStage(
        3,
        "CANDIDATE_AND_SEARCH",
        "候选池构建与标的多维挖掘",
        `正在对 [${sym}] (${cand.classification.strategyCategoryLabel}) 挖掘消歧资讯与图谱装载 (${symbolIndex}/${finalCandidateList.length})...`,
        50 + Math.floor((symbolIndex / finalCandidateList.length) * 25)
      );

      const pos = currentPositions.find((p) => p.symbol.toUpperCase() === sym);
      const companyName = cand.companyName;

      const intel = await searxngSearchService.searchSingleStockIntel(sym, companyName);
      candidateStockIntels.set(sym, intel);

      let kgItem = await stockKnowledgeGraphStoreService.getKnowledgeGraph(portfolioId, sym);
      if (!kgItem) {
        kgItem = stockKnowledgeGraphStoreService.buildDefaultKnowledgeGraph(sym);
      }
      knowledgeGraphList.push(kgItem);

      const fundamentals = await stockKnowledgeGraphStoreService.getFundamentals(sym);
      const isClearedPos = !pos || pos.shares <= 0;
      const prevAction = prevActionsMap.get(sym);
      const currentPrice = quotesMap.get(sym) || cand.snapshot?.lastPrice || pos?.marketPrice || 0;

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
        strategyCategory: cand.classification.strategyCategory,
        strategyCategoryLabel: cand.classification.strategyCategoryLabel,
        strategyCategoryReason: cand.classification.strategyCategoryReason,
        knowledgeGraph: kgItem,
        latestNews: intel.latestNews,
        communitySentiment: intel.communitySentiment,
        capitalFlow: intel.capitalFlow,
        fundamentals: fundamentals ?? undefined,
        openDSnapshot: cand.snapshot,
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

    // 5. 后台异步并发为所有入选标的创建/更新操盘知识图谱
    stockKnowledgeGraphStoreService.asyncBatchSyncGraphs(
      portfolioId,
      perStockDeductionRetroList.map((item) => ({
        symbol: item.symbol,
        companyName: item.companyName,
        latestNews: item.latestNews,
        strategyCategoryLabel: item.strategyCategoryLabel,
        strategyCategoryReason: item.strategyCategoryReason,
        capitalFlow: item.capitalFlow ? { trend: item.capitalFlow.trend, description: item.capitalFlow.description } : undefined,
        actionAdvice: item.strategyCategory === "WATCH_AND_WAIT" ? "HOLD" : "BUY",
      }))
    );

    const retroPnL = await computeRetroPnL(portfolioId, prevStrategy?.id, quotesMap);

    this.liveStageData = {
      ...this.liveStageData,
      step3Done: true,
      candidateSymbols,
      perStockItems: perStockDeductionRetroList,
    };

    // STEP 4: Ollama 大模型融合推演 (OLLAMA_DEDUCTION)
    notifyStage(4, "OLLAMA_DEDUCTION", "Ollama 大模型融合推演", "执行 Map-Reduce 分段推理，结合 5 大分类与宏观约束生成定量调仓指南...", 85);
    const ollamaCheck = await ollamaService.getStatus();

    let screenerRes: {
      actions: ActionItem[];
      oversoldOpportunities?: ActionItem[];
      riskAlerts: any[];
      marketOverview: string;
    };

    let deductionPipeline: DeductionPipelineData = {
      modelUsed: "Ollama Map-Reduce",
      promptContextText: "",
      knowledgeGraphContext: "",
      searxngNewsContext: macroRes.rawNewsText,
      positionsContext: JSON.stringify(currentPositions),
      lessonsContext: JSON.stringify(retroPnL.lessonsLearned),
      rawOllamaOutput: "",
    };

    if (ollamaCheck.connected && ollamaCheck.models.length > 0) {
      const modelToUse = ollamaCheck.recommendedModel || ollamaCheck.models[0];
      try {
        const ollamaRes = await ollamaService.generateStrategyWithOllama(modelToUse, {
          positions: currentPositions,
          candidateSymbols,
          candidateStockIntels,
          quotesMap,
          searxngNewsText: macroRes.rawNewsText,
          macroPromptContext: macroRes.macroIntel.distilledPromptContext,
          candidateCategoryMap,
          knowledgeGraphs: knowledgeGraphList,
          lessonsLearned: retroPnL.lessonsLearned,
          totalBudget: budgetToUse,
          cashBalance: portfolio.cashBalance,
          riskPreference: portfolio.riskPreference,
        });

        screenerRes = {
          actions: ollamaRes.actions,
          riskAlerts: ollamaRes.riskAlerts,
          marketOverview: macroRes.macroOverview,
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
          macroRes.macroOverview,
          budgetToUse,
          portfolio.riskPreference,
          snapshotsMap,
          candidateStockIntels
        );
        deductionPipeline.modelUsed = `量化规则引擎 (Fallback: ${err.message})`;
        deductionPipeline.rawOllamaOutput = JSON.stringify(screenerRes, null, 2);
      }
    } else {
      screenerRes = stockEngine.generateStockScreenerRecommendations(
        currentPositions,
        watchlistItems,
        quotesMap,
        macroRes.macroOverview,
        budgetToUse,
        portfolio.riskPreference,
        snapshotsMap,
        candidateStockIntels
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

    // 确保列表中的全部标的均有对齐推演动作，无任何遗漏
    perStockDeductionRetroList.forEach((item) => {
      if (!item.currentRecommendation) {
        const curPrice = quotesMap.get(item.symbol.toUpperCase()) || item.position?.marketPrice || item.position?.costBasis || 100;
        const pos = item.position;
        const isHolding = pos && pos.shares > 0;
        const pnlPct = pos && pos.costBasis > 0 ? ((curPrice - pos.costBasis) / pos.costBasis) * 100 : 0;

        let autoAction: "BUY" | "TRIM" | "HOLD" = "HOLD";
        let shares = 0;
        let rationale = "";

        if (item.strategyCategory === "OVERSOLD_BUY" || item.strategyCategory === "FUNDAMENTAL_BUY" || item.strategyCategory === "NEWS_CATALYST_BUY" || item.strategyCategory === "CAPITAL_INFLOW_BUY") {
          autoAction = "BUY";
          shares = Math.max(1, Math.floor(Math.min(budgetToUse * 0.35, 1000) / curPrice));
          rationale = `[${item.symbol}] 触发 ${item.strategyCategoryLabel || "建仓"} 信号 (${item.strategyCategoryReason || ""})，建议建仓 ${shares} 股。`;
        } else if (isHolding && pnlPct >= 18.0) {
          autoAction = "TRIM";
          shares = Math.max(1, Math.floor(pos.shares * 0.35));
          rationale = `[${item.symbol}] 浮盈 +${pnlPct.toFixed(1)}%，建议阶梯止盈锁定部分收益。`;
        } else if (isHolding && pnlPct <= -8.0) {
          autoAction = "TRIM";
          shares = Math.max(1, Math.floor(pos.shares * 0.5));
          rationale = `[${item.symbol}] 触及 -8.0% 软止损防线，建议减仓规避下行风险。`;
        } else if (isHolding) {
          autoAction = "HOLD";
          shares = pos.shares;
          rationale = `[${item.symbol}] 走势处于健康观察区间，建议保持现有底仓。`;
        } else {
          autoAction = "HOLD";
          shares = 0;
          rationale = `[${item.symbol}] 当前未触发极值超跌建仓信号，建议持续跟踪。`;
        }

        const fallbackAct: ActionItem = {
          action: autoAction,
          symbol: item.symbol,
          companyName: item.companyName || item.symbol,
          suggestedShares: shares,
          estimatedPrice: Number(curPrice.toFixed(2)),
          estimatedAmount: Number((shares * curPrice).toFixed(2)),
          rationale,
          urgency: autoAction === "TRIM" || autoAction === "BUY" ? "HIGH" : "LOW",
          targetPrice: Number((curPrice * 1.15).toFixed(2)),
          stopLossPrice: Number((curPrice * 0.92).toFixed(2)),
          riskRewardRatio: 2.2,
          strategyCategory: item.strategyCategory,
          strategyCategoryLabel: item.strategyCategoryLabel,
          strategyCategoryReason: item.strategyCategoryReason,
          isOversoldOpportunity: item.strategyCategory === "OVERSOLD_BUY",
          oversoldReason: item.strategyCategoryReason,
        };

        item.currentRecommendation = fallbackAct;
        if (!screenerRes.actions.some((a) => a.symbol.toUpperCase() === item.symbol.toUpperCase())) {
          screenerRes.actions.push(fallbackAct);
        }
      }
    });

    this.liveDeductionPipeline = deductionPipeline;
    this.liveStageData = {
      ...this.liveStageData,
      step4Done: true,
      perStockItems: perStockDeductionRetroList,
      screenerActions: screenerRes.actions,
      marketOverview: screenerRes.marketOverview,
    };

    // STEP 5: 时间序列快照落库与终态落库 (FINISHED)
    notifyStage(5, "FINISHED", "精确定量指南生成与策略落库", "完成全网搜刮、候选池多维挖掘、大模型推理与策略复盘落库", 100);
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
        macroIntel: macroRes.macroIntel,
        existingPositionGuidance: macroRes.macroIntel.macroTradingStance.positionStrategy,
        newPositionGuidance: macroRes.macroIntel.macroTradingStance.bias,
        actions: screenerRes.actions,
        riskAlerts: screenerRes.riskAlerts,
        knowledgeGraph: knowledgeGraphList,
        perStockDeductionRetro: perStockDeductionRetroList,
        narrativeReport: `### 操盘分析报告 (${todayStr})\n\n${macroRes.macroIntel.summaryHeadline}\n\n**宏观策略基调**: ${macroRes.macroIntel.macroTradingStance.bias}\n**仓位调控建议**: ${macroRes.macroIntel.macroTradingStance.positionStrategy}\n**风控预警防线**: ${macroRes.macroIntel.macroTradingStance.riskWarning}`,
      },
      retroPnL,
    };
  }
}

export const dailyStrategyDirector = new DailyStrategyDirector();
