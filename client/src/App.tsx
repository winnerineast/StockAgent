import React, { useState, useEffect, useRef } from "react";
import { HeaderBar } from "./components/HeaderBar";
import { DeductionRetroStudioTab } from "./components/DeductionRetroStudioTab";
import { StockKnowledgeGraphModal } from "./components/StockKnowledgeGraphModal";
import { TradeUnlockModal } from "./components/TradeUnlockModal";
import { OllamaDeductionModal } from "./components/OllamaDeductionModal";
import { StageStep } from "./components/DeductionProgressStepper";

export default function App() {
  const [loading, setLoading] = useState<boolean>(false);
  const [currentStage, setCurrentStage] = useState<StageStep | null>(null);

  // Statuses
  const [openDConnected, setOpenDConnected] = useState<boolean>(false);
  const [searxngConnected, setSearxngConnected] = useState<boolean>(false);
  const [ollamaStatus, setOllamaStatus] = useState<any>({ connected: false, models: [], recommendedModel: "", message: "" });
  const [selectedOllamaModel, setSelectedOllamaModel] = useState<string>("");
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const prevOpenDConnectedRef = useRef<boolean>(false);

  // Data
  const [portfolioData, setPortfolioData] = useState<any>({
    netAssets: 0,
    cashBalance: 0,
    totalMarketValue: 0,
    totalPnL: 0,
    totalPnLPct: 0,
    positions: [],
  });
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [screenerActions, setScreenerActions] = useState<any[]>([]);
  const [marketOverview, setMarketOverview] = useState<string>("");
  const [perStockItems, setPerStockItems] = useState<any[]>([]);
  const [retrospectives, setRetrospectives] = useState<any[]>([]);
  const [deductionPipeline, setDeductionPipeline] = useState<any>(null);

  // Modals
  const [unlockModalOpen, setUnlockModalOpen] = useState<boolean>(false);
  const [deductionModalOpen, setDeductionModalOpen] = useState<boolean>(false);
  const [selectedKgSymbol, setSelectedKgSymbol] = useState<string | null>(null);
  const [kgData, setKgData] = useState<any>(null);

  // Check statuses and fetch initial portfolio
  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/stock/status");
      const json = await res.json();
      if (json.success) {
        const isNowConnected = !!json.data.openD.connected;
        const newlyConnected = !prevOpenDConnectedRef.current && isNowConnected;
        prevOpenDConnectedRef.current = isNowConnected;

        setOpenDConnected(isNowConnected);
        setSearxngConnected(json.data.searxng.connected);
        setOllamaStatus(json.data.ollama || { connected: false, models: [], recommendedModel: "" });
        setIsUnlocked(json.data.isUnlocked);

        if (json.data.ollama && json.data.ollama.models.length > 0) {
          const recModel = json.data.ollama.recommendedModel || json.data.ollama.models[0];
          setSelectedOllamaModel((prev) => (prev && json.data.ollama.models.includes(prev) ? prev : recModel));
        }

        // 当 OpenD 从离线变为连通时，自动抓取 OpenD 原生实盘持仓
        if (newlyConnected) {
          console.log("[SPA] MooMoo OpenD 已连通，自动拉取最新实盘持仓与自选股...");
          fetchPortfolio();
          fetchWatchlist();
        }
      }
    } catch (e) {}
  };

  const fetchPortfolio = async () => {
    try {
      const res = await fetch("/api/stock/portfolio");
      const json = await res.json();
      if (json.success && json.data) {
        setPortfolioData(json.data);

        if (Array.isArray(json.data.positions) && json.data.positions.length > 0) {
          setPerStockItems((prev) => {
            if (prev && prev.length > 0) return prev;
            return json.data.positions.map((p: any) => {
              const curP = p.marketPrice || p.costBasis;
              return {
                symbol: p.symbol,
                companyName: p.companyName || p.symbol,
                knowledgeGraph: {
                  symbol: p.symbol,
                  companyName: p.companyName || p.symbol,
                  positionCategory: "EXISTING",
                  industrySector: "股票知识图谱实体网络",
                  nodes: [],
                  edges: [],
                  newsCatalysts: [],
                  actionAdvice: "HOLD",
                  guidanceText: "知识图谱载入中...",
                },
                latestNews: [],
                position: {
                  shares: p.shares,
                  costBasis: p.costBasis,
                  marketPrice: curP,
                },
                pastRetro: {
                  lastStrategyDate: undefined,
                  lastAction: undefined,
                  lastTargetPrice: undefined,
                  lastStopLossPrice: undefined,
                  actualPriceAction: "首次载入持仓，等待 Map-Reduce 推演...",
                  accuracyScore: undefined,
                  distilledLesson: undefined,
                },
              };
            });
          });
        }
      }
    } catch (e) {}
  };

  const fetchWatchlist = async () => {
    try {
      const res = await fetch("/api/stock/watchlist");
      const json = await res.json();
      if (json.success && json.data) {
        setWatchlist(json.data);
        if (Array.isArray(json.data) && json.data.length > 0) {
          setPerStockItems((prev) => {
            if (!prev) prev = [];
            const existingSymbols = new Set(prev.map((item: any) => item.symbol.toUpperCase()));
            const newWatchItems = json.data
              .filter((w: any) => !existingSymbols.has(w.symbol.toUpperCase()))
              .map((w: any) => ({
                symbol: w.symbol,
                companyName: w.companyName || w.symbol,
                isCleared: false,
                candidateCategory: "WATCHLIST",
                strategyCategory: "WATCH_AND_WAIT",
                strategyCategoryLabel: "👀 可以观望",
                strategyCategoryReason: "OpenD 官方实时自选股关注标的",
                knowledgeGraph: {
                  symbol: w.symbol,
                  companyName: w.companyName || w.symbol,
                  positionCategory: "WATCHLIST",
                  industrySector: "自选股标的池",
                  nodes: [],
                  edges: [],
                  newsCatalysts: [],
                  actionAdvice: "HOLD",
                  guidanceText: "知识图谱载入中...",
                },
                latestNews: [],
                position: undefined,
                pastRetro: {
                  lastStrategyDate: undefined,
                  lastAction: undefined,
                  actualPriceAction: "MooMoo 自选股标的，等待推演...",
                },
              }));
            return [...prev, ...newWatchItems];
          });
        }
      }
    } catch (e) {}
  };

  const fetchRetrospectives = async () => {
    try {
      const res = await fetch("/api/stock/retrospective/history");
      const json = await res.json();
      if (json.success && json.data) {
        setRetrospectives(json.data);
      }
    } catch (e) {}
  };

  const [strategyHistory, setStrategyHistory] = useState<any[]>([]);

  const fetchStrategyHistory = async () => {
    try {
      const res = await fetch("/api/stock/strategy/history");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setStrategyHistory(json.data);
        if (json.data.length > 0 && json.data[0].deductionPipeline) {
          setDeductionPipeline(json.data[0].deductionPipeline);
        }
      }
    } catch (e) {}
  };

  const handleGenerateStrategy = async (overrideBudget?: number, overrideModel?: string) => {
    setLoading(true);
    const modelUsed = overrideModel || selectedOllamaModel || ollamaStatus.recommendedModel || "Ollama";

    // 步骤 1: 初始设置 OpenD 连接
    setCurrentStage({
      step: 1,
      stageId: "OPEND_CONNECT",
      title: "MooMoo OpenD 持仓自选连通",
      detail: "正在连接 127.0.0.1:11111 TCP 原生通道拉取真实持仓与自选股...",
      progressPercent: 20,
    });

    // 开启后台真实执行 Stage 与实时模型 Context 轮询 (300ms 间隔)
    let hasSyncedStep1 = false;
    const stagePollInterval = setInterval(async () => {
      try {
        const res = await fetch("/api/stock/strategy/stage");
        const json = await res.json();
        if (json.success && json.data) {
          if (json.data.stage) {
            setCurrentStage(json.data.stage);
            // 阶段 1 完毕后立即拉取更新后的实盘持仓与自选股
            if (json.data.stage.step > 1 && !hasSyncedStep1) {
              hasSyncedStep1 = true;
              fetchPortfolio();
              fetchWatchlist();
            }
          }
          if (json.data.liveDeductionPipeline) {
            setDeductionPipeline(json.data.liveDeductionPipeline);
          }
          if (json.data.liveStageData) {
            if (json.data.liveStageData.macroOverview) {
              setMarketOverview(json.data.liveStageData.macroOverview);
            }
            if (json.data.liveStageData.perStockItems && json.data.liveStageData.perStockItems.length > 0) {
              setPerStockItems(json.data.liveStageData.perStockItems);
            }
            if (json.data.liveStageData.screenerActions && json.data.liveStageData.screenerActions.length > 0) {
              setScreenerActions(json.data.liveStageData.screenerActions);
            }
          }
        }
      } catch (e) {}
    }, 300);

    try {
      const budgetToUse = overrideBudget !== undefined ? overrideBudget : (portfolioData.totalBudget || 1000);
      const res = await fetch("/api/stock/strategy/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customBudget: budgetToUse,
          ollamaModel: modelUsed,
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setScreenerActions(json.data.output.actions || []);
        setMarketOverview(json.data.output.marketOverview || "");
        setPerStockItems(json.data.output.perStockDeductionRetro || []);
        if (json.data.deductionPipeline) setDeductionPipeline(json.data.deductionPipeline);
        await fetchPortfolio();
        await fetchRetrospectives();
        await fetchStrategyHistory();

        setCurrentStage({
          step: 5,
          stageId: "FINISHED",
          title: "精确定量指南与策略复盘生成完毕",
          detail: "推演与复盘全脉络完成，大模型及知识图谱响应就绪",
          progressPercent: 100,
        });
      }
    } catch (e) {
      console.warn("Failed to generate strategy:", e);
    } finally {
      clearInterval(stagePollInterval);
      setLoading(false);
    }
  };

  const handleOpenKnowledgeGraph = async (symbol: string) => {
    setSelectedKgSymbol(symbol);
    try {
      const res = await fetch(`/api/stock/knowledge-graph/${symbol}`);
      const json = await res.json();
      if (json.success) {
        setKgData(json.data);
      }
    } catch (e) {}
  };

  const handleAddCustomNode = async (symbol: string, node: any, edge: any) => {
    try {
      const res = await fetch(`/api/stock/knowledge-graph/${symbol}/node`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ node, edge }),
      });
      const json = await res.json();
      if (json.success) {
        setKgData(json.data);
      }
    } catch (e) {}
  };

  const handleUnlockTrade = async (passwordMD5: string) => {
    try {
      const res = await fetch("/api/stock/unlock-trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passwordMD5 }),
      });
      const json = await res.json();
      if (json.success) {
        setIsUnlocked(true);
        await fetchStatus();
        await fetchPortfolio();
      }
    } catch (e) {}
  };

  const handleExecuteRebalance = async (budget: number, risk: string) => {
    await handleGenerateStrategy(budget);
  };

  useEffect(() => {
    fetchStatus();
    fetchPortfolio();
    fetchWatchlist();
    fetchRetrospectives();
    fetchStrategyHistory();
    handleGenerateStrategy();

    // 3 秒定时轻量轮询连通状态 (MooMoo OpenD, SearXNG, Ollama)
    const statusInterval = setInterval(() => {
      fetchStatus();
    }, 3000);

    // 页面重新获焦时立即触发检测
    const handleFocus = () => {
      fetchStatus();
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(statusInterval);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header Bar */}
      <HeaderBar
        openDConnected={openDConnected}
        searxngConnected={searxngConnected}
        ollamaStatus={ollamaStatus}
        selectedOllamaModel={selectedOllamaModel}
        onSelectOllamaModel={(m) => {
          setSelectedOllamaModel(m);
        }}
        isUnlocked={isUnlocked}
        loading={loading}
        onRefresh={() => {
          fetchStatus();
          fetchPortfolio();
          fetchWatchlist();
        }}
        onOpenUnlockModal={() => setUnlockModalOpen(true)}
        onOpenDeductionModal={() => setDeductionModalOpen(true)}
        hasDeductionData={!!deductionPipeline}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6 space-y-6">
        {/* Unified Studio Workspace */}
        <DeductionRetroStudioTab
          netAssets={portfolioData.netAssets || 0}
          cashBalance={portfolioData.cashBalance || 0}
          totalMarketValue={portfolioData.totalMarketValue || 0}
          totalPnL={portfolioData.totalPnL || 0}
          totalPnLPct={portfolioData.totalPnLPct || 0}
          positions={portfolioData.positions || []}
          rebalanceActions={screenerActions}
          perStockItems={perStockItems}
          retrospectives={retrospectives}
          marketOverview={marketOverview}
          watchlist={watchlist}
          screenerActions={screenerActions}
          oversoldOpportunities={screenerActions.filter(
            (a) => a.isOversoldOpportunity || (a.action === "BUY" && a.fundamentalScore && a.fundamentalScore >= 85)
          )}
          isUnlocked={isUnlocked}
          loading={loading}
          currentStage={currentStage}
          onOpenKnowledgeGraph={handleOpenKnowledgeGraph}
          onOpenUnlockModal={() => setUnlockModalOpen(true)}
          onExecuteRebalance={handleExecuteRebalance}
        />
      </main>

      {/* Modals */}
      <TradeUnlockModal
        isOpen={unlockModalOpen}
        onClose={() => setUnlockModalOpen(false)}
        onUnlock={handleUnlockTrade}
      />

      <StockKnowledgeGraphModal
        symbol={selectedKgSymbol}
        graphData={kgData}
        onClose={() => setSelectedKgSymbol(null)}
        onAddCustomNode={handleAddCustomNode}
      />

      <OllamaDeductionModal
        isOpen={deductionModalOpen}
        onClose={() => setDeductionModalOpen(false)}
        pipelineData={deductionPipeline}
        strategyHistory={strategyHistory}
      />
    </div>
  );
}
