import React from "react";
import {
  TrendingUp,
  Activity,
  Search,
  Lock,
  RefreshCw,
  Bot,
  Eye,
  Cpu,
  CheckCircle2,
  Clock,
  Compass,
  Sparkles,
} from "lucide-react";

export type TimeTravelSimulationMode =
  | "REALTIME"
  | "SIMULATE_PRE_MARKET"
  | "SIMULATE_INTRADAY"
  | "SIMULATE_POST_MARKET"
  | "SIMULATE_WEEKEND";

interface HeaderBarProps {
  openDConnected: boolean;
  searxngConnected: boolean;
  ollamaStatus: {
    connected: boolean;
    models: string[];
    recommendedModel: string;
    hardware?: { summary: string };
    modelRecommendations?: Array<{ name: string; isRecommended: boolean; reason: string }>;
    message: string;
  };
  selectedOllamaModel: string;
  onSelectOllamaModel: (model: string) => void;
  isUnlocked: boolean;
  loading: boolean;
  onRefresh: () => void;
  onOpenUnlockModal: () => void;
  onOpenDeductionModal: () => void;
  hasDeductionData: boolean;
  marketSession?: {
    easternTimeStr: string;
    localTimeStr: string;
    isTradingDay: boolean;
    marketPhase: string;
    phaseLabel: string;
    phaseDescription: string;
    activeRoleName: string;
    timeToNextBellMinutes: number;
    countdownLabel: string;
    currentTradingDay: string;
    nextTradingDay: string;
    isSimulated?: boolean;
  } | null;
  simulationMode?: TimeTravelSimulationMode;
  onSelectSimulationMode?: (mode: TimeTravelSimulationMode) => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  openDConnected,
  searxngConnected,
  ollamaStatus,
  selectedOllamaModel,
  onSelectOllamaModel,
  isUnlocked,
  loading,
  onRefresh,
  onOpenUnlockModal,
  onOpenDeductionModal,
  hasDeductionData,
  marketSession,
  simulationMode = "REALTIME",
  onSelectSimulationMode,
}) => {
  // 根据时态获取视觉主题样式
  const getPhaseBadgeStyle = () => {
    if (!marketSession) {
      return "bg-slate-900 text-slate-400 border-slate-800";
    }
    switch (marketSession.marketPhase) {
      case "PRE_MARKET":
        return "bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-amber-500/10";
      case "INTRADAY":
        return "bg-emerald-500/15 text-emerald-300 border-emerald-500/40 shadow-emerald-500/10 animate-pulse";
      case "POST_MARKET":
        return "bg-indigo-500/15 text-indigo-300 border-indigo-500/40 shadow-indigo-500/10";
      case "OVERNIGHT_CLOSED":
        return "bg-purple-500/15 text-purple-300 border-purple-500/40";
      case "WEEKEND_OR_HOLIDAY":
      default:
        return "bg-slate-800/80 text-slate-300 border-slate-700";
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-8 py-3 transition-all">
      <div className="max-w-7xl mx-auto flex flex-col xl:flex-row items-center justify-between gap-3">
        {/* Title & Hardware Specs */}
        <div className="flex items-center gap-3 w-full xl:w-auto justify-between xl:justify-start">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 shadow-lg shadow-cyan-500/20">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">StockAgent Studio</h1>
                <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  全时态量化中枢
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                <span>{ollamaStatus.hardware?.summary || "检测系统硬件中..."}</span>
              </p>
            </div>
          </div>

          {/* 移动端紧凑型刷新按钮 */}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="xl:hidden p-2 rounded-xl bg-slate-900 text-slate-300 border border-slate-800 hover:text-white"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-cyan-400" : ""}`} />
          </button>
        </div>

        {/* 🌟 美股时空罗盘 (Market Session Compass) */}
        <div className="flex flex-wrap items-center gap-2.5 bg-slate-900/90 border border-slate-800 px-3.5 py-1.5 rounded-2xl shadow-inner text-xs">
          {/* 美东时间与状态徽章 */}
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-mono text-[11px]">美东 ET:</span>
                <span className="font-bold text-cyan-300 font-mono text-[12px]">
                  {marketSession?.easternTimeStr || "计算时钟中..."}
                </span>
              </div>
            </div>
          </div>

          {/* 动态时态 Badge */}
          {marketSession && (
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border shadow-sm ${getPhaseBadgeStyle()}`}
              title={`${marketSession.phaseDescription}\n大模型当前角色: 【${marketSession.activeRoleName}】`}
            >
              <span>{marketSession.phaseLabel}</span>
              <span className="text-[10px] opacity-80 hidden sm:inline">({marketSession.countdownLabel})</span>
            </div>
          )}

          {/* 🌟 时空穿梭演练器 (Simulation Time-Travel Selector) */}
          {onSelectSimulationMode && (
            <div className="flex items-center gap-1.5 border-l border-slate-800 pl-2.5">
              <Compass className="w-3.5 h-3.5 text-indigo-400" />
              <select
                value={simulationMode}
                onChange={(e) => onSelectSimulationMode(e.target.value as TimeTravelSimulationMode)}
                className="bg-slate-950 border border-indigo-500/40 text-indigo-300 text-[11px] font-semibold rounded-lg px-2 py-0.5 focus:outline-none focus:border-indigo-400 cursor-pointer"
                title="时空穿梭演练模式：即使在非交易时段，也可一键模拟真实盘前/盘中/盘后推演流程"
              >
                <option value="REALTIME" className="bg-slate-950 text-white">🔴 实盘跟随 (真实时钟)</option>
                <option value="SIMULATE_PRE_MARKET" className="bg-slate-950 text-amber-300">🟡 强制模拟: 盘前推演 (08:30 ET)</option>
                <option value="SIMULATE_INTRADAY" className="bg-slate-950 text-emerald-300">🟢 强制模拟: 盘中监控 (14:00 ET)</option>
                <option value="SIMULATE_POST_MARKET" className="bg-slate-950 text-indigo-300">🔵 强制模拟: 盘后复盘 (17:30 ET)</option>
                <option value="SIMULATE_WEEKEND" className="bg-slate-950 text-slate-300">⚪ 强制模拟: 周末研判</option>
              </select>
            </div>
          )}
        </div>

        {/* Status Badges & Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* MooMoo OpenD Status */}
          <button
            onClick={onRefresh}
            title="点击检测 MooMoo OpenD 连通状态 (127.0.0.1:11111)"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border cursor-pointer transition-all hover:scale-105 ${
              openDConnected
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                : "bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
            }`}
          >
            <div className="relative flex h-2 w-2">
              {openDConnected ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              )}
            </div>
            <Activity className="w-3.5 h-3.5" />
            <span>{openDConnected ? "OpenD 已连通" : "OpenD 离线 (11111)"}</span>
          </button>

          {/* SearXNG Status */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border ${
              searxngConnected
                ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/30"
                : "bg-slate-900 text-slate-400 border-slate-800"
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>{searxngConnected ? "SearXNG 已就绪" : "SearXNG 离线"}</span>
          </div>

          {/* Ollama Status & Hardware Model Selector */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-900 text-slate-300 border border-slate-800">
            <Bot className="w-3.5 h-3.5 text-cyan-400" />
            <span>模型:</span>
            {ollamaStatus.models.length > 0 ? (
              <select
                value={selectedOllamaModel}
                onChange={(e) => onSelectOllamaModel(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-cyan-300 text-xs rounded px-2 py-0.5 focus:outline-none focus:border-cyan-400 font-semibold"
              >
                {ollamaStatus.models
                  .slice()
                  .sort((a, b) => {
                    if (a === ollamaStatus.recommendedModel) return -1;
                    if (b === ollamaStatus.recommendedModel) return 1;
                    return a.localeCompare(b);
                  })
                  .map((m) => {
                    const isRec = m === ollamaStatus.recommendedModel;
                    return (
                      <option key={m} value={m}>
                        {isRec ? `⭐ [硬件推荐] ${m}` : m}
                      </option>
                    );
                  })}
              </select>
            ) : (
              <span className="text-amber-400 font-semibold">未检测到模型</span>
            )}
          </div>

          {/* Visual Deduction Context Inspector Button */}
          {hasDeductionData && (
            <button
              onClick={onOpenDeductionModal}
              title="查看 Ollama 融合推演全量 Prompt Payload 与 JSON 输出"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-500/30 text-xs font-semibold transition-all hover:scale-105"
            >
              <Eye className="w-3.5 h-3.5 text-cyan-400" />
              <span>推演 Context</span>
            </button>
          )}

          {/* Unlock Trade Button (Dynamic status awareness) */}
          <button
            onClick={isUnlocked ? undefined : onOpenUnlockModal}
            disabled={isUnlocked || !openDConnected}
            title={
              !openDConnected
                ? "MooMoo OpenD 处于离线状态，连接后方可解锁交易"
                : isUnlocked
                ? "MooMoo 交易权限已解锁，可进行订单操作"
                : "点击输入 6 位交易密码解锁 MooMoo 交易权限"
            }
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              !openDConnected
                ? "bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed opacity-70"
                : isUnlocked
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 opacity-90 cursor-default"
                : "bg-amber-600/20 text-amber-300 border border-amber-500/40 hover:bg-amber-600/30 hover:scale-105 cursor-pointer shadow-lg shadow-amber-500/10"
            }`}
          >
            {isUnlocked ? (
              <>
                <div className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </div>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>交易已解锁</span>
              </>
            ) : !openDConnected ? (
              <>
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                <span>未解锁 (需连接)</span>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>解锁交易</span>
              </>
            )}
          </button>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="hidden xl:block p-2 rounded-xl bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700 hover:text-white transition-all disabled:opacity-50"
            title="刷新数据"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-cyan-400" : ""}`} />
          </button>
        </div>
      </div>
    </header>
  );
};
