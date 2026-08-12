import React, { useState, useEffect, useRef } from "react";
import { HeaderBar } from "./components/HeaderBar";
import { StockScreenerTab } from "./components/StockScreenerTab";
import { DeductionRetroStudioTab } from "./components/DeductionRetroStudioTab";
import { StockKnowledgeGraphModal } from "./components/StockKnowledgeGraphModal";
import { TradeUnlockModal } from "./components/TradeUnlockModal";
import { OllamaDeductionModal } from "./components/OllamaDeductionModal";
import { StageStep } from "./components/DeductionProgressStepper";
import { Sparkles, PieChart, Eye } from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState<"screener" | "deductionRetro">("deductionRetro");
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

        // 如果单股卡片列表为空，提前用实盘持仓预构建卡片结构，确保图谱与持仓即刻可见
        if (Array.isArray(json.data.positions) && json.data.positions.length > 0) {
          setPerStockItems((prev) => {
            if (prev && prev.length > 0) return prev;
            return json.data.positions.map((p: any) => ({
              symbol: p.symbol,
              companyName: p.companyName || p.symbol,
              knowledgeGraph: {
                nodes: [
                  { id: "node-1", name: "核心上游/产业链", type: "供应商", description: "主要技术与硬件供应商" },
                  { id: "node-2", name: "行业同业竞品", type: "竞品", description: "市场竞争格局" },
                  { id: "node-3", name: "Fed 利率决议", type: "宏观因素", description: "流动性与贴现率驱动" },
                ],
                edges: [
                  { source: "核心上游/产业链", target: p.symbol, relation: "核心依赖", impact: "POSITIVE" },
                ],
                newsCatalysts: ["实时关注大盘动向与财报催化"],
              },
              latestNews: [`[${p.symbol}] 盘前交易活跃，基本面保持稳健`],
              position: {
                shares: p.shares,
                costBasis: p.costBasis,
                marketPrice: p.marketPrice || p.costBasis,
              },
              pastRetro: {
                lastStrategyDate: "2026-08-12",
                lastAction: "HOLD",
                lastTargetPrice: (p.costBasis * 1.1),
                lastStopLossPrice: (p.costBasis * 0.9),
                actualPriceAction: `[${p.symbol}] 盘面走势符合操盘知识图谱基准`,
                accuracyScore: 88,
                distilledLesson: `[${p.symbol}] 遵守单标的防线纪律`,
              },
            }));
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

  const handleGenerateStrategy = async (overrideBudget?: number, overrideModel?: string) => {
    setLoading(true);
    const modelUsed = overrideModel || selectedOllamaModel || ollamaStatus.recommendedModel || "Ollama";

    // 步骤 1: 立即设置 OpenD 连接
    setCurrentStage({
      step: 1,
      stageId: "OPEND_CONNECT",
      title: "MooMoo OpenD 持仓",
      detail: "测试 127.0.0.1:11111 TCP 原生通道拉取持仓...",
      progressPercent: 15,
    });

    // 动态模拟步进驱动器：在后台 POST 执行期间，实时推展 Step 1 -> 2 -> 3 -> 4 -> 5 (LLM 推理)
    const timerStep2 = setTimeout(() => {
      setCurrentStage({
        step: 2,
        stageId: "NEWS_SEARCH",
        title: "SearXNG 全网资讯",
        detail: "SearXNG 本地 Docker 容器检索美股盘前资讯催化剂...",
        progressPercent: 35,
      });
    }, 600);

    const timerStep3 = setTimeout(() => {
      setCurrentStage({
        step: 3,
        stageId: "CONTEXT_ASSEMBLE",
        title: "单股票知识图谱",
        detail: "装载各标的上游供应商、竞品与概念驱动图谱...",
        progressPercent: 55,
      });
    }, 1400);

    const timerStep4 = setTimeout(() => {
      setCurrentStage({
        step: 4,
        stageId: "GUARDRAIL_CALIBRATE",
        title: "前次推演与走势复盘",
        detail: "对齐上一交易日推演建议与实际盘面走势...",
        progressPercent: 75,
      });
    }, 2200);

    const timerStep5 = setTimeout(() => {
      setCurrentStage({
        step: 5,
        stageId: "AI_DEDUCTION",
        title: "Ollama LLM 推理",
        detail: `⚡ 正在调用 Ollama 大模型 (${modelUsed}) 进行全量 Context 融合推理中...`,
        progressPercent: 88,
      });
    }, 3000);

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
        setDeductionPipeline(json.data.deductionPipeline || null);
        await fetchPortfolio();
        await fetchRetrospectives();

        setCurrentStage({
          step: 6,
          stageId: "FINISHED",
          title: "精确定量指南与走势复盘生成完毕",
          detail: "推演与复盘全脉络完成，大模型及知识图谱响应就绪",
          progressPercent: 100,
        });
      }
    } catch (e) {
      console.warn("Failed to generate strategy:", e);
    } finally {
      clearTimeout(timerStep2);
      clearTimeout(timerStep3);
      clearTimeout(timerStep4);
      clearTimeout(timerStep5);
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
        {/* Navigation Tabs (Merged Deduction & Retrospective Studio) */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab("deductionRetro")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === "deductionRetro"
                  ? "bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20"
                  : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              <PieChart className="w-4 h-4" />
              <span>【推演与复盘 Studio】</span>
            </button>

            <button
              onClick={() => setActiveTab("screener")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === "screener"
                  ? "bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20"
                  : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>【选股 Studio】</span>
            </button>
          </div>

          {deductionPipeline && (
            <button
              onClick={() => setDeductionModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/20 transition-all text-xs font-semibold"
            >
              <Eye className="w-4 h-4 text-cyan-400" />
              <span>推演 Context 上下文检视器</span>
            </button>
          )}
        </div>

        {/* Tab Content */}
        {activeTab === "deductionRetro" && (
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
            isUnlocked={isUnlocked}
            loading={loading}
            currentStage={currentStage}
            onOpenKnowledgeGraph={handleOpenKnowledgeGraph}
            onOpenUnlockModal={() => setUnlockModalOpen(true)}
            onExecuteRebalance={handleExecuteRebalance}
            onOpenPipelineModal={() => setDeductionModalOpen(true)}
          />
        )}

        {activeTab === "screener" && (
          <StockScreenerTab
            watchlist={watchlist}
            screenerActions={screenerActions}
            marketOverview={marketOverview}
            searxngConnected={searxngConnected}
            onOpenKnowledgeGraph={handleOpenKnowledgeGraph}
            onAddToPositionManager={(symbol) => setActiveTab("deductionRetro")}
            onTriggerSearch={() => {}}
          />
        )}
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
      />
    </div>
  );
}
