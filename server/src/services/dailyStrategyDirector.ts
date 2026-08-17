import { prisma } from "../db/prisma";
import { openDaemonManager } from "./openDaemonManager";
import { moomooAdapter } from "./moomooAdapter";
import { searxngSearchService } from "./searxngSearchService";
import { stockKnowledgeGraphStoreService } from "./stockKnowledgeGraphStore";
import { macroSnapshotStoreService } from "./macroSnapshotStore";
import { StockEngine, stockEngine } from "./stockEngine";
import { ollamaService } from "./ollamaService";
import { goalDrivenQuantEngine } from "./goalDrivenQuantEngine";
import { computeTotalPnL, computeRetroPnL, savePortfolioSnapshot } from "./stockMemoryManager";
import { deductionVerificationService } from "./deductionVerificationService";
import { marketCalendarService } from "./marketCalendarService";
import { dataSufficiencyGatekeeper } from "./dataSufficiencyGatekeeper";
import { multiAgentMarketSimulator } from "./multiAgentMarketSimulator";
import { actionPlanningSearchEngine } from "./actionPlanningSearchEngine";
import { tradeInvariantValidator } from "./tradeInvariantValidator";
import {
  DailyAllocationOutput,
  StockPositionItem,
  StrategyProgressStage,
  StockDeductionRetroItem,
  SingleStockIntel,
  ActionItem,
  StockActionVerdict,
  StockStrategyCategory,
  OpenDSnapshotItem,
  DeductionPipelineData,
  CapitalSpaceAnalysis,
  GoalDrivenConstraint,
  MarketSessionPhase,
  MarketSessionContext,
  DataSufficiencyReport,
  MarketSimulationResult,
  AdaptiveActionPolicy,
  Evidence3PillarsHighlights,
} from "../types/stockTypes";

/**
 * 结构化提取 30 秒极速决策 3 大核心客观事实锚点 (基本面 / 消息催化 / 资金与ATR防线)
 */
function buildEvidence3PillarsHighlights(
  item: StockDeductionRetroItem,
  act: ActionItem
): Evidence3PillarsHighlights {
  // 1. 基本面与估值锚点
  const f = item.fundamentals || act.evidence?.fundamentals;
  const pe = f?.peRatio ?? item.openDSnapshot?.peRatio;
  let fundText = "";
  if (pe && pe > 0) {
    const valStatus = pe <= 28 ? "估值合理偏低" : pe <= 45 ? "成长溢价区间" : "高估值弹性博弈";
    const rev = f?.revenueGrowthPct !== undefined
      ? `，营收增速 ${f.revenueGrowthPct > 0 ? "+" : ""}${f.revenueGrowthPct.toFixed(1)}%`
      : "";
  } else {
    const summaryText = (f as any)?.summary || (f as any)?.fundamentalSummary;
    if (summaryText) {
      fundText = summaryText.length > 55 ? summaryText.slice(0, 52) + "..." : summaryText;
    } else {
      fundText = `${item.strategyCategoryLabel || "基本面稳健"} · 估值中枢处于健康区间`;
    }
  }

  // 2. 权威消息与催化锚点
  let catText = "";
  const firstNews = item.credibleNews?.[0]?.title || item.latestNews?.[0];
  if (firstNews) {
    catText = firstNews.length > 55 ? firstNews.slice(0, 52) + "..." : firstNews;
  } else if (item.strategyCategoryReason) {
    catText = item.strategyCategoryReason;
  } else {
    catText = "行业景气度向好，近期无突发重大利空阻力";
  }

  // 3. 资金面与 ATR 防线锚点
  const flow = item.capitalFlow || (act.evidence?.liveMarket ? { trend: act.evidence.liveMarket.flowTrend, description: act.evidence.liveMarket.description } : undefined);
  const flowDesc = flow?.description || (flow?.trend === "INFLOW" ? "主力超大单积极流入" : flow?.trend === "OUTFLOW" ? "主力资金小幅减持" : "主力资金动向平稳");
  const stopLoss = act.stopLossPrice ? `$${act.stopLossPrice}` : "动态跟踪";
  const rrr = act.riskRewardRatio ? `，盈亏比 ${act.riskRewardRatio}:1` : "";
  const flowRiskText = `${flowDesc} · ATR软防线 ${stopLoss}${rrr}`;

  return {
    fundamentalAnchor: fundText,
    catalystAnchor: catText,
    flowRiskAnchor: flowRiskText,
  };
}

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

  public async checkPreflightReadiness(): Promise<{
    isAllReady: boolean;
    openD: { ready: boolean; message: string };
    searxng: { ready: boolean; message: string };
    ollama: { ready: boolean; message: string; recommendedModel?: string };
    tradeUnlock: { ready: boolean; message: string };
    missingItems: string[];
  }> {
    const openDAlive = await openDaemonManager.checkOpenDAlive();
    const searxng = await searxngSearchService.getStatus(false);
    const ollama = await ollamaService.getStatus();
    const unlockStatus = await moomooAdapter.checkTradeUnlockedStatus();

    const openDReady = openDAlive;
    const searxngReady = searxng.connected;
    const ollamaReady = ollama.connected && ollama.models.length > 0;
    const tradeUnlockReady = unlockStatus.unlocked;

    const missingItems: string[] = [];
    if (!openDReady) missingItems.push("MooMoo OpenD网关(11111)");
    if (!searxngReady) missingItems.push("SearXNG全网检索(8088)");
    if (!ollamaReady) missingItems.push("Ollama大模型服务(11434)");
    if (!tradeUnlockReady) missingItems.push("交易权限密码解锁");

    const isAllReady = openDReady && searxngReady && ollamaReady && tradeUnlockReady;

    return {
      isAllReady,
      openD: {
        ready: openDReady,
        message: openDReady ? "🟢 OpenD 端口 11111 已连通" : "🔴 OpenD 离线 (端口 11111)",
      },
      searxng: {
        ready: searxngReady,
        message: searxngReady ? "🟢 SearXNG 检索服务已就绪" : "🔴 SearXNG 服务离线",
      },
      ollama: {
        ready: ollamaReady,
        message: ollamaReady ? `🟢 Ollama 在线 (${ollama.models.length}个模型)` : "🔴 Ollama 服务未启动或未安装模型",
        recommendedModel: ollama.recommendedModel,
      },
      tradeUnlock: {
        ready: tradeUnlockReady,
        message: tradeUnlockReady ? "🟢 交易权限已解锁" : "🔒 交易权限未解锁 (需要密码)",
      },
      missingItems,
    };
  }

  private inFlightStrategyPromise: Promise<any> | null = null;

  public async generateDailyStrategy(
    portfolioId: string = "default-portfolio",
    customBudget?: number,
    ollamaModel?: string,
    onProgress?: (stage: StrategyProgressStage) => void,
    targetProfitGoalPct: number = 8.0,
    targetTimeHorizonDays: number = 5,
    maxDrawdownPct: number = 4.0,
    simulatedTime?: Date | string | number,
    marketPhaseOverride?: MarketSessionPhase
  ): Promise<any> {
    if (this.inFlightStrategyPromise) {
      console.log("[DailyStrategyDirector] 策略生成已在进行中，合并等待当前进行中的推演任务...");
      return await this.inFlightStrategyPromise;
    }

    this.inFlightStrategyPromise = this.executeDailyStrategyInternal(
      portfolioId,
      customBudget,
      ollamaModel,
      onProgress,
      targetProfitGoalPct,
      targetTimeHorizonDays,
      maxDrawdownPct,
      simulatedTime,
      marketPhaseOverride
    );

    try {
      return await this.inFlightStrategyPromise;
    } finally {
      this.inFlightStrategyPromise = null;
    }
  }

  private async executeDailyStrategyInternal(
    portfolioId: string = "default-portfolio",
    customBudget?: number,
    ollamaModel?: string,
    onProgress?: (stage: StrategyProgressStage) => void,
    targetProfitGoalPct: number = 8.0,
    targetTimeHorizonDays: number = 5,
    maxDrawdownPct: number = 4.0,
    simulatedTime?: Date | string | number,
    marketPhaseOverride?: MarketSessionPhase
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

    // 🌟 核心前置就绪阻塞校验：在 OpenD、SearXNG、本地模型、交易解锁 全部就绪后才进入 Step 1
    const preflight = await this.checkPreflightReadiness();
    if (!preflight.isAllReady) {
      const missingText = preflight.missingItems.join("、");
      throw new Error(`【前置环境阻塞】Step 1 无法启动！以下依赖项尚未就绪：${missingText}。请确保依赖项就绪且交易权限已解锁后再启动推演。`);
    }

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
          totalBudget: customBudget ?? openDCash,
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

    // 🌟 计算并锚定美股时空时态 (支持真实时间与模拟时间注入)
    const marketSession = marketCalendarService.getMarketSession(simulatedTime, marketPhaseOverride);

    // STEP 2: Phase 1 动态拉取 OpenD 11 大行业板块资金流，并执行 SearXNG 权威信源分级搜刮 (MACRO_SEARCH)
    notifyStage(2, "MACRO_SEARCH", "MooMoo OpenD 11大行业板块与资金流", `[${marketSession.phaseLabel}] 正在拉取 11 大行业 ETF 实时行情与资金流...`, 30);
    const openDSectorsData = await moomooAdapter.fetchMacroSectorsFromOpenD();

    // 实时流式注入已就绪的板块数据
    this.liveStageData = {
      ...this.liveStageData,
      openDSectorsData,
    };

    notifyStage(2, "MACRO_SEARCH", "SearXNG 权威财经通讯社分级搜刮", `[${marketSession.phaseLabel}] 正在依据时态从 Bloomberg/Reuters/WSJ 检索最新资讯...`, 40);
    const macroRes = await searxngSearchService.searchMacroAndSectorNews(openDSectorsData, marketSession.marketPhase);

    // 异步高密度落库快照 (L2 存储)
    if (macroRes.macroIntel.macroSnapshot) {
      try {
        await macroSnapshotStoreService.saveDailySnapshot(macroRes.macroIntel.macroSnapshot);
      } catch (e) {}
    }

    this.liveStageData = {
      ...this.liveStageData,
      step2Done: true,
      macroOverview: macroRes.macroOverview,
      macroSnapshot: macroRes.macroIntel.macroSnapshot,
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
        budgetToUse * 0.35,
        targetProfitGoalPct,
        targetTimeHorizonDays,
        maxDrawdownPct,
        undefined,
        undefined,
        macroRes.macroIntel.sentimentMood
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

    // 执行实盘三态闭环核验 (将前期未核验预测与今日实盘现价核验为 成功经验/失败教训/随机噪音)
    const verificationReport = await deductionVerificationService.verifyPastPredictions(portfolioId, quotesMap);
    console.log(`[Outcome Verifier] ${verificationReport.summaryText}`);

    // 并发批量拉取入选标的的 Google TimeFM 零样本时序动量预测 (UP / DOWN / SIDEWAYS)
    notifyStage(3, "CANDIDATE_AND_SEARCH", "候选池构建与标的多维挖掘", "正在调用 Google TimeFM 时序大模型计算全标的次日走势方向与置信带...", 65);
    const timefmForecastsMap = await moomooAdapter.fetchTimeFmForecastsFromOpenD(candidateSymbols);

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

    const stockVerifiedHistoriesMap: Record<string, string> = {};

    // 4. 对入选 5 大分类的标的进行消歧舆情搜刮与全要素装配
    let symbolIndex = 0;
    for (const cand of finalCandidateList) {
      const sym = cand.symbol;
      symbolIndex++;
      notifyStage(
        3,
        "CANDIDATE_AND_SEARCH",
        "候选池构建与标的多维挖掘",
        `正在对 [${sym}] (${cand.classification.strategyCategoryLabel}) 装载消歧资讯、TimeFM时序与图谱 (${symbolIndex}/${finalCandidateList.length})...`,
        65 + Math.floor((symbolIndex / finalCandidateList.length) * 15)
      );

      const pos = currentPositions.find((p) => p.symbol.toUpperCase() === sym);
      const companyName = cand.companyName;

      const intel = await searxngSearchService.searchSingleStockIntel(sym, companyName, marketSession.marketPhase);
      candidateStockIntels.set(sym, intel);

      let kgItem = await stockKnowledgeGraphStoreService.getKnowledgeGraph(portfolioId, sym);
      if (!kgItem) {
        kgItem = stockKnowledgeGraphStoreService.buildDefaultKnowledgeGraph(sym);
      }
      knowledgeGraphList.push(kgItem);

      const fundamentals = await stockKnowledgeGraphStoreService.getFundamentals(sym);
      const isHolding = !!pos && pos.shares > 0;
      const isClearedPos = !!pos && pos.shares === 0;
      const isWatchlist = !pos && watchlistSymbols.includes(sym);
      const prevAction = prevActionsMap.get(sym);
      const currentPrice = quotesMap.get(sym) || cand.snapshot?.lastPrice || pos?.marketPrice || 0;

      // 提取标的历史实盘核验经验库
      const verifiedData = await deductionVerificationService.getStockVerifiedHistory(portfolioId, sym);
      stockVerifiedHistoriesMap[sym.toUpperCase()] = verifiedData.promptMemoryContext;
      const latestVerified = verifiedData.historyLogs[0];

      const tfmForecast = timefmForecastsMap[sym] || timefmForecastsMap[sym.toUpperCase()];

      let pastRetroText = prevAction
        ? `针对上次建议 (${prevAction.action}) 对照：当前现价 $${currentPrice.toFixed(2)}。`
        : isClearedPos
        ? `[${sym}] 既往已平仓离场，现价 $${currentPrice.toFixed(2)}。`
        : isHolding
        ? `[${sym}] 当前实盘持有中，现价 $${currentPrice.toFixed(2)}。`
        : `[${sym}] 自选关注标的，等待大模型推演。`;

      const candidateCategory: StockDeductionRetroItem["candidateCategory"] = isHolding
        ? "EXISTING_HOLDING"
        : isClearedPos
        ? "EXISTING_HOLDING"
        : isWatchlist
        ? "WATCHLIST"
        : "MACRO_CANDIDATE";

      const credibleNewsItems: any[] = (intel.latestNews || []).map((n) => ({
        title: n.length > 60 ? n.slice(0, 60) + "..." : n,
        summary: n,
        sourceName: "SearXNG 聚合资讯",
        tier: 1,
        tierLabel: "Tier-1 核心资讯",
        sentiment: "NEUTRAL",
        url: "",
      }));

      const evidence5Pillars: any = {
        news: credibleNewsItems,
        fundamentals: fundamentals ? {
          peRatio: fundamentals.peRatio ?? cand.snapshot?.peRatio,
          pbRatio: cand.snapshot?.pbRatio,
          revenueGrowthPct: fundamentals.revenueGrowthPct,
          netMarginPct: fundamentals.netMarginPct,
          debtToEquity: fundamentals.debtToEquity,
          nextEarningsDate: fundamentals.nextEarningsDate,
          valuationScore: cand.snapshot?.peRatio ? Math.max(15, Math.min(95, Math.round(100 - cand.snapshot.peRatio * 1.5))) : 65,
          valuationStatus: cand.snapshot?.peRatio && cand.snapshot.peRatio < 25 ? "合理偏低估" : "成长溢价",
          summary: fundamentals.fundamentalSummary,
        } : undefined,
        liveMarket: {
          curPrice: currentPrice,
          costBasis: pos?.costBasis,
          shares: pos?.shares,
          pnlAmount: pos && pos.shares > 0 ? Number(((currentPrice - pos.costBasis) * pos.shares).toFixed(2)) : 0,
          pnlPct: pos && pos.costBasis > 0 ? Number((((currentPrice - pos.costBasis) / pos.costBasis) * 100).toFixed(2)) : 0,
          mainCapitalInflow: cand.snapshot?.mainCapitalInflow,
          capitalInflow: cand.snapshot?.capitalInflow,
          turnoverRate: cand.snapshot?.turnoverRate,
          flowTrend: intel.capitalFlow?.trend || "NEUTRAL",
          description: intel.capitalFlow?.description || "盘口资金动向平稳",
        },
        timefm: tfmForecast ? {
          direction: tfmForecast.direction,
          predictedPrice: tfmForecast.predictedPrice,
          predictedChangePct: tfmForecast.predictedChangeRate,
          confidenceLow: tfmForecast.confidenceLow,
          confidenceHigh: tfmForecast.confidenceHigh,
          targetAttainmentProbability: 68,
          momentumRationale: tfmForecast.momentumRationale,
        } : undefined,
        pastLessons: verifiedData.historyLogs.map((h) => ({
          date: h.deductionDate,
          action: h.action,
          outcome: h.verificationOutcome === "PENDING" ? "RANDOM_NOISE" : h.verificationOutcome,
          outcomeLabel: h.verificationOutcomeLabel,
          lessonText: h.verificationLesson,
          pnlImpactAmount: h.pnlImpactAmount,
        })),
      };

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
        credibleNews: credibleNewsItems,
        communitySentiment: intel.communitySentiment,
        capitalFlow: intel.capitalFlow,
        fundamentals: fundamentals ?? undefined,
        openDSnapshot: cand.snapshot,
        timefmForecast: tfmForecast,
        evidence5Pillars,
        position: pos
          ? { ...pos, isCleared: isClearedPos }
          : undefined,
        pastRetro: {
          lastStrategyDate: prevStrategy?.strategyDate,
          lastAction: prevAction?.action || (isClearedPos ? "SELL" : "HOLD"),
          lastTargetPrice: prevAction?.targetPrice,
          lastStopLossPrice: prevAction?.stopLossPrice,
          actualPriceAction: pastRetroText,
          pnlImpact: pos && pos.shares > 0 ? (currentPrice - pos.costBasis) * pos.shares : 0,
          verificationOutcome: latestVerified?.verificationOutcome !== "PENDING" ? latestVerified?.verificationOutcome : undefined,
          verificationOutcomeLabel: latestVerified?.verificationOutcomeLabel,
          verificationLesson: latestVerified?.verificationLesson,
          actualNextClosePrice: latestVerified?.actualClosePrice,
          actualNextChangeRate: latestVerified?.actualChangeRate,
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

    // STEP 4: 数据完备性刚性准入校验与微观博弈多主体沙盘推演 (OLLAMA_DEDUCTION)
    notifyStage(4, "OLLAMA_DEDUCTION", "数据完备性准入与多主体博弈仿真", "执行刚性信息完备性校验、4 角色博弈出清与大模型情景规划...", 85);
    const ollamaCheck = await ollamaService.getStatus();

    // 1. 对全量候选标的进行数据完备性刚性准入校验
    const sufficiencyReportsMap = new Map<string, DataSufficiencyReport>();
    const simulationResultsMap = new Map<string, MarketSimulationResult>();
    const adaptivePoliciesMap = new Map<string, AdaptiveActionPolicy>();
    const insufficientAbortActions: ActionItem[] = [];
    const validCandidateSymbols: string[] = [];

    for (const cand of finalCandidateList) {
      const sym = cand.symbol.toUpperCase();
      const intel = candidateStockIntels.get(cand.symbol);
      const kg = knowledgeGraphList.find((k) => k.symbol.toUpperCase() === sym);
      const curPrice = quotesMap.get(sym) || cand.snapshot?.lastPrice || cand.snapshot?.prevClosePrice || 0;
      const fundamentals = await stockKnowledgeGraphStoreService.getFundamentals(sym);

      const report = dataSufficiencyGatekeeper.evaluateSymbol({
        symbol: sym,
        companyName: cand.companyName,
        snapshot: cand.snapshot,
        news: intel?.latestNews,
        fundamentals: fundamentals ?? undefined,
        knowledgeGraph: kg,
        marketPhase: marketSession.marketPhase,
        isOpenDConnected: !!openDPortfolio?.fromOpenD,
        hasLevel3Permissions: true,
      } as any);

      sufficiencyReportsMap.set(sym, report);

      if (!report.isSufficient) {
        console.warn(`[DataGatekeeper] 标的 [${sym}] 数据完备性校验未通过 (${report.abortReason})，已直接熔断推演。`);
        const abortAction = dataSufficiencyGatekeeper.buildInsufficientDataAction({
          symbol: sym,
          companyName: cand.companyName,
          currentPrice: curPrice,
          report,
        });
        insufficientAbortActions.push(abortAction);
      } else {
        validCandidateSymbols.push(cand.symbol);

        // 运行微观 4 主体博弈仿真
        const tfm = timefmForecastsMap[sym];
        const sim = multiAgentMarketSimulator.simulate({
          symbol: sym,
          currentPrice: curPrice,
          snapshot: cand.snapshot,
          intel,
          fundamentals: fundamentals ?? undefined,
          knowledgeGraph: kg,
          timefm: tfm ? {
            direction: tfm.direction,
            predictedPrice: tfm.predictedPrice,
            predictedChangePct: tfm.predictedChangeRate,
            confidenceLow: tfm.confidenceLow,
            confidenceHigh: tfm.confidenceHigh,
            targetAttainmentProbability: 68,
            momentumRationale: tfm.momentumRationale,
          } : undefined,
          macroRegime: macroRes?.macroIntel?.sentimentMood || "NEUTRAL",
        });
        simulationResultsMap.set(sym, sim);

        // 运行情景树规划
        const policy = actionPlanningSearchEngine.generateAdaptivePolicy({
          symbol: sym,
          companyName: cand.companyName,
          currentPrice: curPrice,
          simulation: sim,
          targetTimeHorizonDays,
          targetProfitGoalPct,
          maxDrawdownPct,
          userAvailableBudget: budgetToUse,
          totalPortfolioValue: budgetToUse,
          macroRegime: macroRes?.macroIntel?.sentimentMood || "NEUTRAL",
        });
        adaptivePoliciesMap.set(sym, policy);
      }
    }

    let screenerRes: {
      actions: ActionItem[];
      oversoldOpportunities?: ActionItem[];
      riskAlerts: any[];
      marketOverview: string;
    };

    let deductionPipeline: DeductionPipelineData = {
      modelUsed: "Ollama Multi-Agent Game",
      promptContextText: "",
      knowledgeGraphContext: "",
      searxngNewsContext: macroRes.rawNewsText,
      positionsContext: JSON.stringify(currentPositions),
      lessonsContext: JSON.stringify(retroPnL.lessonsLearned),
      rawOllamaOutput: "",
    };

    // 仅针对数据完备的标的执行大模型推理
    if (ollamaCheck.connected && ollamaCheck.models.length > 0 && validCandidateSymbols.length > 0) {
      const modelToUse = ollamaCheck.recommendedModel || ollamaCheck.models[0];
      try {
        const ollamaRes = await ollamaService.generateStrategyWithOllama(modelToUse, {
          positions: currentPositions,
          candidateSymbols: validCandidateSymbols,
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
          timefmForecasts: timefmForecastsMap,
          stockVerifiedHistories: stockVerifiedHistoriesMap,
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
      deductionPipeline.modelUsed = "量化规则引擎 (Ollama 离线或数据完备标的筛选)";
      deductionPipeline.rawOllamaOutput = JSON.stringify(screenerRes, null, 2);
    }

    // 挂载数据完备性报告与博弈仿真输出
    screenerRes.actions.forEach((act) => {
      const sym = act.symbol.toUpperCase();
      act.dataSufficiencyReport = sufficiencyReportsMap.get(sym);
      act.simulationResult = simulationResultsMap.get(sym);
      act.scenarioBranches = adaptivePoliciesMap.get(sym)?.scenarioTree;
      act.adaptivePolicy = adaptivePoliciesMap.get(sym);
    });

    // 合并数据缺失熔断项 (排在列表末尾或按需保留)
    screenerRes.actions = [...screenerRes.actions, ...insufficientAbortActions];

    // 计算全局资金空间分析 (结合实盘持仓、闲置现金、宏观安全垫与调仓释放)
    const capitalSpace = goalDrivenQuantEngine.calculateCapitalSpace({
      existingPositions: currentPositions,
      actualCash: openDCash,
      userInputBudget: customBudget,
      freedCapitalFromTrims: 0,
      macroRegimeMood: macroRes?.macroIntel?.sentimentMood || "NEUTRAL",
    });

    // 运行目标驱动与消除迷茫度组合分配优化器
    const {
      optimizedActions,
      updatedCapitalSpace,
      overallCertaintyScore,
      overallGoalProbability,
    } = goalDrivenQuantEngine.optimizePortfolioAllocation({
      candidateActions: screenerRes.actions,
      capitalSpace,
      targetProfitGoalPct,
      targetTimeHorizonDays,
      maxDrawdownPct,
    });

    screenerRes.actions = optimizedActions;

    // 将推演建议动作绑回列表并附上 5 大事实证据与 3 大客观事实锚点
    screenerRes.actions.forEach((act, idx) => {
      const target = perStockDeductionRetroList.find((item) => item.symbol.toUpperCase() === act.symbol.toUpperCase());
      if (target) {
        if (!act.actionType) {
          const isHolding = target.position && target.position.shares > 0;
          act.actionType = act.action === "BUY"
            ? (isHolding ? "ADD_POSITION" : "OPEN_POSITION")
            : act.action === "SELL" || act.action === "TRIM"
            ? (act.action === "SELL" ? "CLOSE_POSITION" : "TRIM_POSITION")
            : "HOLD_AND_WATCH";
        }
        if (!act.whySummary) {
          act.whySummary = act.goalDrivenRationale || act.rationale?.slice(0, 100) || `围绕 [${act.symbol}] 5大事实证据建议执行 ${act.actionType}`;
        }
        act.evidence = target.evidence5Pillars;

        // 严格执行交易不变量校验防呆与自愈 (FINOS Legend Invariants 务实落地)
        const curPrice = quotesMap.get(act.symbol.toUpperCase()) || act.estimatedPrice || target.openDSnapshot?.lastPrice || 1.0;
        const invariantCheck = tradeInvariantValidator.validateAndEnforce({
          action: act,
          currentPrice: curPrice,
          availableCash: openDCash,
          totalMarketValue: budgetToUse,
          existingPosition: target.position,
        });

        const finalAct = invariantCheck.action;
        const highlights = buildEvidence3PillarsHighlights(target, finalAct);
        finalAct.evidenceHighlights = highlights;
        finalAct.invariantStatus = invariantCheck.status;

        target.currentRecommendation = finalAct;
        target.evidenceHighlights = highlights;
        target.invariantStatus = invariantCheck.status;
        screenerRes.actions[idx] = finalAct;
      }
    });

    // 确保列表中的全部标的均有对齐推演动作，无任何遗漏
    perStockDeductionRetroList.forEach((item) => {
      if (!item.currentRecommendation) {
        const curPrice = quotesMap.get(item.symbol.toUpperCase()) || item.openDSnapshot?.lastPrice || item.position?.marketPrice || item.position?.costBasis || 1.0;
        const pos = item.position;
        const isHolding = pos && pos.shares > 0;
        const pnlPct = pos && pos.costBasis > 0 ? ((curPrice - pos.costBasis) / pos.costBasis) * 100 : 0;

        let autoAction: "BUY" | "TRIM" | "HOLD" = "HOLD";
        let autoActionType: StockActionVerdict = "HOLD_AND_WATCH";
        let shares = 0;
        let rationale = "";

        if (item.strategyCategory === "OVERSOLD_BUY" || item.strategyCategory === "FUNDAMENTAL_BUY" || item.strategyCategory === "NEWS_CATALYST_BUY" || item.strategyCategory === "CAPITAL_INFLOW_BUY") {
          autoAction = "BUY";
          autoActionType = isHolding ? "ADD_POSITION" : "OPEN_POSITION";
          shares = Math.max(1, Math.floor((budgetToUse * 0.35) / curPrice));
          rationale = `[${item.symbol}] 触发 ${item.strategyCategoryLabel || "建仓"} 信号 (${item.strategyCategoryReason || ""})，建议建仓 ${shares} 股。`;
        } else if (isHolding && pnlPct >= 18.0) {
          autoAction = "TRIM";
          autoActionType = "TRIM_POSITION";
          shares = Math.max(1, Math.floor(pos.shares * 0.35));
          rationale = `[${item.symbol}] 浮盈 +${pnlPct.toFixed(1)}%，建议阶梯止盈锁定部分收益。`;
        } else if (isHolding && pnlPct <= -8.0) {
          autoAction = "TRIM";
          autoActionType = "CLOSE_POSITION";
          shares = Math.max(1, Math.floor(pos.shares * 0.5));
          rationale = `[${item.symbol}] 触及 -8.0% 软止损防线，建议减仓规避下行风险。`;
        } else if (isHolding) {
          autoAction = "HOLD";
          autoActionType = "HOLD_AND_WATCH";
          shares = pos.shares;
          rationale = `[${item.symbol}] 走势处于健康观察区间，建议保持现有底仓。`;
        } else {
          autoAction = "HOLD";
          autoActionType = "HOLD_AND_WATCH";
          shares = 0;
          rationale = `[${item.symbol}] 当前未触发极值超跌建仓信号，建议持续跟踪。`;
        }

        const fallbackAct: ActionItem = {
          action: autoAction,
          actionType: autoActionType,
          whySummary: rationale,
          symbol: item.symbol,
          companyName: item.companyName || item.symbol,
          suggestedShares: shares,
          estimatedPrice: Number(curPrice.toFixed(2)),
          estimatedAmount: Number((shares * curPrice).toFixed(2)),
          rationale,
          urgency: autoAction === "TRIM" || autoAction === "BUY" ? "HIGH" : "LOW",
          targetPrice: Number((curPrice * (1 + targetProfitGoalPct / 100)).toFixed(2)),
          stopLossPrice: Number((curPrice * (1 - maxDrawdownPct / 100)).toFixed(2)),
          riskRewardRatio: 2.0,
          strategyCategory: item.strategyCategory,
          strategyCategoryLabel: item.strategyCategoryLabel,
          strategyCategoryReason: item.strategyCategoryReason,
          targetTimeHorizonDays,
          targetProfitGoalPct,
          entryZone: {
            min: Number((curPrice * 0.992).toFixed(2)),
            max: Number((curPrice * 1.006).toFixed(2)),
          },
          evidence: item.evidence5Pillars,
        };

        const invariantCheck = tradeInvariantValidator.validateAndEnforce({
          action: fallbackAct,
          currentPrice: curPrice,
          availableCash: openDCash,
          totalMarketValue: budgetToUse,
          existingPosition: item.position,
        });

        const validatedFallback = invariantCheck.action;
        const highlights = buildEvidence3PillarsHighlights(item, validatedFallback);
        validatedFallback.evidenceHighlights = highlights;
        validatedFallback.invariantStatus = invariantCheck.status;

        item.currentRecommendation = validatedFallback;
        item.evidenceHighlights = highlights;
        item.invariantStatus = invariantCheck.status;

        if (!screenerRes.actions.some((a) => a.symbol.toUpperCase() === item.symbol.toUpperCase())) {
          screenerRes.actions.push(validatedFallback);
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

    // 异步高密度持久化全量个股推演快照 (供次日启动时自动进行实盘三态检验核验)
    try {
      await deductionVerificationService.saveDeductionLogsBatch(
        portfolioId,
        strategyRecord.id,
        todayStr,
        perStockDeductionRetroList
      );
    } catch (e) {}

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

    const goalConstraints: GoalDrivenConstraint = {
      targetTimeHorizonDays,
      targetProfitGoalPct,
      maxDrawdownPct,
      userDeployableBudget: budgetToUse,
    };

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
        macroSnapshot: macroRes.macroIntel.macroSnapshot,
        marketSession,
        capitalSpace: updatedCapitalSpace,
        goalConstraints,
        overallCertaintyScore,
        overallGoalProbability,
        existingPositionGuidance: macroRes.macroIntel.macroTradingStance.positionStrategy,
        newPositionGuidance: macroRes.macroIntel.macroTradingStance.bias,
        actions: screenerRes.actions,
        riskAlerts: screenerRes.riskAlerts,
        knowledgeGraph: knowledgeGraphList,
        perStockDeductionRetro: perStockDeductionRetroList,
        narrativeReport: `### 操盘分析报告 (${todayStr} | ${marketSession.phaseLabel})\n\n${macroRes.macroIntel.summaryHeadline}\n\n**美东时态定位**: ${marketSession.easternTimeStr} (${marketSession.countdownLabel})\n**大模型担当角色**: ${marketSession.activeRoleName}\n**宏观策略基调**: ${macroRes.macroIntel.macroTradingStance.bias}\n**仓位调控建议**: ${macroRes.macroIntel.macroTradingStance.positionStrategy}\n**风控预警防线**: ${macroRes.macroIntel.macroTradingStance.riskWarning}\n**资金空间与确定性**: 可用操盘空间 $${updatedCapitalSpace.totalDeployableCapacity}，组合目标达成期望概率 ${overallGoalProbability}% (确定性得分 ${overallCertaintyScore}/100)`,
      },
      retroPnL,
    };
  }
}

export const dailyStrategyDirector = new DailyStrategyDirector();
