import { Router, Request, Response } from "express";
import { openDaemonManager } from "../services/openDaemonManager";
import { moomooAdapter } from "../services/moomooAdapter";
import { searxngSearchService } from "../services/searxngSearchService";
import { ollamaService } from "../services/ollamaService";
import { dailyStrategyDirector } from "../services/dailyStrategyDirector";
import { stockKnowledgeGraphStoreService } from "../services/stockKnowledgeGraphStore";
import { macroSnapshotStoreService } from "../services/macroSnapshotStore";
import { prisma } from "../db/prisma";

export const stockRouter = Router();

// 1. 查询 OpenD、SearXNG 与 Ollama 连通状态
stockRouter.get("/status", async (_req: Request, res: Response) => {
  const openDConnected = await openDaemonManager.checkOpenDAlive();
  const searxngStatus = await searxngSearchService.getStatus();
  const ollamaStatus = await ollamaService.getStatus();
  const unlockStatus = await moomooAdapter.checkTradeUnlockedStatus();

  return res.json({
    success: true,
    data: {
      openD: {
        connected: openDConnected,
        message: openDConnected ? "🟢 OpenD 端口 11111 已连通" : "🔴 OpenD 离线 (端口 11111)",
      },
      searxng: searxngStatus,
      ollama: ollamaStatus,
      isUnlocked: unlockStatus.unlocked,
    },
  });
});

// 1.5 获取 Ollama 模型列表
stockRouter.get("/ollama/models", async (_req: Request, res: Response) => {
  const status = await ollamaService.getStatus();
  return res.json({ success: true, data: status });
});

// 2. 从 OpenD / DB 获取持仓与资产概览
stockRouter.get("/portfolio", async (_req: Request, res: Response) => {
  try {
    const openDData = await moomooAdapter.fetchPortfolioFromOpenD();
    let portfolio = await prisma.stockPortfolio.findFirst({
      include: { positions: true },
    });

    if (!portfolio) {
      portfolio = await prisma.stockPortfolio.create({
        data: {
          id: "default-portfolio",
          name: "MooMoo 美股主仓位",
          cashBalance: openDData.cashBalance ?? 0.0,
          totalBudget: 1000.0,
          positions: {
            create: openDData.positions.map((p) => ({
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
    } else if (openDData.fromOpenD && Array.isArray(openDData.positions) && openDData.positions.length > 0) {
      // 动态同步实盘 OpenD 持仓与资金至 SQLite 数据库
      await prisma.stockPortfolio.update({
        where: { id: "default-portfolio" },
        data: { cashBalance: openDData.cashBalance },
      });

      await prisma.stockPosition.deleteMany({
        where: { portfolioId: "default-portfolio" },
      });

      await prisma.stockPosition.createMany({
        data: openDData.positions.map((p) => ({
          portfolioId: "default-portfolio",
          symbol: p.symbol,
          companyName: p.companyName || p.symbol,
          shares: p.shares,
          costBasis: p.costBasis,
          marketPrice: p.marketPrice || p.costBasis,
        })),
      });

      portfolio = await prisma.stockPortfolio.findFirst({
        include: { positions: true },
      });
    }

    if (!portfolio) {
      throw new Error("Portfolio not found");
    }

    const positionSymbols = portfolio.positions.map((p) => p.symbol);
    const realQuotes = await moomooAdapter.fetchMarketQuotes(positionSymbols);
    const quotesMap = new Map<string, number>();
    realQuotes.forEach((q) => quotesMap.set(q.symbol.toUpperCase(), q.price));

    const enrichedPositions = portfolio.positions.map((p) => {
      const curPrice = quotesMap.get(p.symbol.toUpperCase()) || p.marketPrice || p.costBasis;
      const marketVal = p.shares * curPrice;
      const costVal = p.shares * p.costBasis;
      const pnl = marketVal - costVal;
      const pnlPct = costVal > 0 ? (pnl / costVal) * 100 : 0;
      return {
        ...p,
        marketPrice: curPrice,
        marketValue: Number(marketVal.toFixed(2)),
        pnl: Number(pnl.toFixed(2)),
        pnlPct: Number(pnlPct.toFixed(2)),
      };
    });

    const totalMarketValue = enrichedPositions.reduce((acc, cur) => acc + cur.marketValue, 0);
    const totalCostBasis = enrichedPositions.reduce((acc, cur) => acc + cur.shares * cur.costBasis, 0);
    const totalPnL = totalMarketValue - totalCostBasis;
    const totalPnLPct = totalCostBasis > 0 ? (totalPnL / totalCostBasis) * 100 : 0;
    const netAssets = totalMarketValue + portfolio.cashBalance;

    const activeSymbols = new Set(enrichedPositions.map((p) => p.symbol.toUpperCase()));
    const recentlyClearedPositions = enrichedPositions.filter((p) => p.shares === 0);

    return res.json({
      success: true,
      data: {
        portfolioId: portfolio.id,
        name: portfolio.name,
        cashBalance: portfolio.cashBalance,
        totalBudget: portfolio.totalBudget,
        riskPreference: portfolio.riskPreference,
        netAssets: Number(netAssets.toFixed(2)),
        totalMarketValue: Number(totalMarketValue.toFixed(2)),
        totalCostBasis: Number(totalCostBasis.toFixed(2)),
        totalPnL: Number(totalPnL.toFixed(2)),
        totalPnLPct: Number(totalPnLPct.toFixed(2)),
        positions: enrichedPositions,
        recentlyClearedPositions,
        fromOpenD: openDData.fromOpenD,
        rawMessage: openDData.rawMessage,
      },
    });

  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || err });
  }
});

// 3. MooMoo 交易密码解锁
stockRouter.post("/unlock-trade", async (req: Request, res: Response) => {
  const { passwordMD5 } = req.body;
  const result = await moomooAdapter.unlockTrade(passwordMD5);
  return res.json(result);
});

// 4. 获取 OpenD 自选股列表
stockRouter.get("/watchlist", async (_req: Request, res: Response) => {
  const watchlist = await moomooAdapter.fetchWatchlistFromOpenD();
  const symbols = watchlist.map((w) => w.symbol);
  const quotes = await moomooAdapter.fetchMarketQuotes(symbols);
  const quotesMap = new Map<string, { price: number; changePercent: number }>();
  quotes.forEach((q) => quotesMap.set(q.symbol.toUpperCase(), { price: q.price, changePercent: q.changePercent }));

  const data = watchlist.map((w) => {
    const q = quotesMap.get(w.symbol.toUpperCase());
    return {
      symbol: w.symbol,
      companyName: w.companyName,
      price: q ? q.price : 0.0,
      changePercent: q ? q.changePercent : 0.0,
    };
  });

  return res.json({ success: true, data });
});

// 5. 获取当前后台真实推演阶段及实时 Context 上下文
stockRouter.get("/strategy/stage", (_req: Request, res: Response) => {
  return res.json({
    success: true,
    data: {
      stage: dailyStrategyDirector.currentActiveStage,
      liveDeductionPipeline: dailyStrategyDirector.liveDeductionPipeline,
      liveStageData: dailyStrategyDirector.liveStageData,
    },
  });
});

// 5.5 调用 Ollama 模型 / 规则引擎生成开盘调仓指南与复盘经验
stockRouter.post("/strategy/generate", async (req: Request, res: Response) => {
  const {
    customBudget,
    ollamaModel,
    targetProfitGoalPct,
    targetTimeHorizonDays,
    maxDrawdownPct,
  } = req.body;
  try {
    const result = await dailyStrategyDirector.generateDailyStrategy(
      "default-portfolio",
      customBudget ? Number(customBudget) : undefined,
      ollamaModel,
      undefined,
      targetProfitGoalPct !== undefined ? Number(targetProfitGoalPct) : 8.0,
      targetTimeHorizonDays !== undefined ? Number(targetTimeHorizonDays) : 5,
      maxDrawdownPct !== undefined ? Number(maxDrawdownPct) : 4.0
    );
    return res.json({ success: true, data: result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || err });
  }
});

// 6. 获取历史建议列表 (包含历史模型 Context 算力与推理记录)
stockRouter.get("/strategy/history", async (_req: Request, res: Response) => {
  const history = await prisma.dailyStrategy.findMany({
    orderBy: { createdAt: "desc" },
    take: 15,
  });

  const parsed = history.map((h) => {
    let deductionPipeline = null;
    if (h.deductionPipelineJson) {
      try { deductionPipeline = JSON.parse(h.deductionPipelineJson); } catch (e) {}
    }
    return {
      ...h,
      actions: JSON.parse(h.actionsJson || "[]"),
      riskAlerts: JSON.parse(h.riskAlertsJson || "[]"),
      deductionPipeline,
    };
  });

  return res.json({ success: true, data: parsed });
});

// 7. 获取历史复盘与经验总结列表 (时间序列)
stockRouter.get("/retrospective/history", async (_req: Request, res: Response) => {
  const history = await prisma.strategyRetrospective.findMany({
    orderBy: { createdAt: "desc" },
    take: 15,
  });

  const parsed = history.map((h) => ({
    ...h,
    lessonsLearned: JSON.parse(h.lessonsLearnedJson || "[]"),
  }));

  return res.json({ success: true, data: parsed });
});

// 8. 获取单只股票图谱
stockRouter.get("/knowledge-graph/:symbol", async (req: Request, res: Response) => {
  const { symbol } = req.params;
  const kg = await stockKnowledgeGraphStoreService.getKnowledgeGraph("default-portfolio", symbol);
  return res.json({ success: true, data: kg });
});

// 9. 为单只股票图谱手动添加节点/关系
stockRouter.post("/knowledge-graph/:symbol/node", async (req: Request, res: Response) => {
  const { symbol } = req.params;
  const { node, edge } = req.body;
  const updated = await stockKnowledgeGraphStoreService.addCustomEntityToDb(
    "default-portfolio",
    symbol,
    node,
    edge
  );
  return res.json({ success: true, data: updated });
});

// 10. 批量获取实时 Quotes
stockRouter.get("/quotes", async (req: Request, res: Response) => {
  const symbolsParam = req.query.symbols as string;
  const symbols = symbolsParam ? symbolsParam.split(",") : [];
  const quotes = await moomooAdapter.fetchMarketQuotes(symbols);
  return res.json({ success: true, data: quotes });
});

// 11. 获取最新宏观与板块量化快照 (供前端 0 延迟秒级回显)
stockRouter.get("/macro/latest", async (_req: Request, res: Response) => {
  const latest = await macroSnapshotStoreService.getLatestSnapshot();
  return res.json({ success: true, data: latest });
});

// 12. 获取历史宏观演进轨迹 (过去 N 天快照)
stockRouter.get("/macro/history", async (req: Request, res: Response) => {
  const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;
  const history = await macroSnapshotStoreService.getHistoricalSnapshots(days);
  return res.json({ success: true, data: history });
});

// 13. 直接拉取 OpenD 11 大行业板块实时行情与资金流
stockRouter.get("/macro/sectors", async (_req: Request, res: Response) => {
  const sectorsData = await moomooAdapter.fetchMacroSectorsFromOpenD();
  return res.json({ success: true, data: sectorsData });
});
