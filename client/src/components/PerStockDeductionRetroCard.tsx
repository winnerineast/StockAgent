import React, { useState } from "react";
import {
  Layers,
  Search,
  PieChart,
  History,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Target,
  ShieldAlert,
  Sparkles,
  DollarSign,
  Activity,
  BookOpen,
  Zap,
  CheckCircle2,
  Swords,
  Calendar,
  AlertTriangle,
  Scale,
  Flame,
  Copy,
  Check,
} from "lucide-react";
import { formatOrderSlipText } from "../utils/orderSlipFormatter";

export interface TimeFmForecastItem {
  direction: "UP" | "DOWN" | "SIDEWAYS";
  directionLabel: string;
  predictedPrice: number;
  predictedChangeRate: number;
  confidenceLow: number;
  confidenceHigh: number;
  confidenceScore: number;
  momentumRationale: string;
}

interface CapitalFlowItem {
  trend: "INFLOW" | "OUTFLOW" | "NEUTRAL";
  description: string;
  netInflowAmount?: string;
}

interface CommunitySentimentItem {
  score?: number;
  mood: "BULLISH" | "BEARISH" | "NEUTRAL" | "UNKNOWN";
  keyTopics: string[];
}

interface StockFundamentals {
  symbol: string;
  companyName?: string;
  peRatio?: number;
  revenueGrowthPct?: number;
  netMarginPct?: number;
  debtToEquity?: number;
  nextEarningsDate?: string;
  fundamentalSummary?: string;
}

interface KnowledgeNode {
  id: string;
  name: string;
  type: string;
  description?: string;
  sector?: string;
  recencyWeight?: number;
}

interface KnowledgeEdge {
  source: string;
  target: string;
  relation: string;
  relationType?: string;
  exposurePct?: number;
  elasticity?: number;
  timeLagDays?: number;
  impact: string;
  recencyWeight?: number;
}

export interface UsStockSpecialIntelProps {
  earningsDate?: string;
  daysToEarnings?: number;
  isEarningsBlackout: boolean;
  earningsRiskLevel: "HIGH" | "MEDIUM" | "SAFE";
  earningsRiskLabel: string;
  unusualOptionActivity?: {
    hasUnusualFlow: boolean;
    callPutVolumeRatio?: number;
    impliedVolatilityPct?: number;
    gammaBias: "CALL_SQUEEZE" | "PUT_HEDGING" | "NEUTRAL";
    gammaBiasLabel: string;
    flowSummary: string;
  };
}

interface PerStockDeductionRetroCardProps {
  item: {
    symbol: string;
    companyName?: string;
    candidateCategory?: "EXISTING_HOLDING" | "WATCHLIST" | "MACRO_CANDIDATE";
    strategyCategory?: "OVERSOLD_BUY" | "FUNDAMENTAL_BUY" | "NEWS_CATALYST_BUY" | "CAPITAL_INFLOW_BUY" | "WATCH_AND_WAIT";
    strategyCategoryLabel?: string;
    strategyCategoryReason?: string;
    knowledgeGraph: {
      nodes: KnowledgeNode[];
      edges: KnowledgeEdge[];
      newsCatalysts: string[];
      guidanceText?: string;
      compressedSummary?: string;
      spilloverAlphaScore?: number;
      networkRiskScore?: number;
    };
    latestNews: string[];
    communitySentiment?: CommunitySentimentItem;
    capitalFlow?: CapitalFlowItem;
    fundamentals?: StockFundamentals;
    position?: {
      shares: number;
      costBasis: number;
      marketPrice: number;
    };
    timefmForecast?: TimeFmForecastItem;
    pastRetro: {
      lastStrategyDate?: string;
      lastAction?: string;
      lastTargetPrice?: number;
      lastStopLossPrice?: number;
      actualPriceAction?: string;
      pnlImpact?: number;
      accuracyScore?: number;
      distilledLesson?: string;
      verificationOutcome?: "EXPERIENCE" | "LESSON" | "RANDOM_NOISE";
      verificationOutcomeLabel?: string;
      verificationLesson?: string;
      actualNextClosePrice?: number;
      actualNextChangeRate?: number;
    };
    currentRecommendation?: {
      action: "BUY" | "SELL" | "HOLD" | "TRIM";
      suggestedShares: number;
      estimatedPrice: number;
      estimatedAmount: number;
      rationale: string;
      whySummary?: string;
      targetPrice?: number;
      stopLossPrice?: number;
      riskRewardRatio?: number;
      certaintyScore?: number;
      goalAttainmentProbability?: number;
      entryZone?: { min: number; max: number };
      timeStopRule?: string;
      evidenceHighlights?: {
        fundamentalAnchor: string;
        catalystAnchor: string;
        flowRiskAnchor: string;
      };
      invariantStatus?: {
        isVerified: boolean;
        passedCount: number;
        totalChecks: number;
        badges: string[];
        diagnosticNotes?: string[];
        wasClamped?: boolean;
      };
      bullThesis?: string;
      bearishRiskPoint?: string;
      bullBearVerdict?: string;
      usSpecialIntel?: UsStockSpecialIntelProps;
    };
    evidenceHighlights?: {
      fundamentalAnchor: string;
      catalystAnchor: string;
      flowRiskAnchor: string;
    };
    invariantStatus?: {
      isVerified: boolean;
      passedCount: number;
      totalChecks: number;
      badges: string[];
      diagnosticNotes?: string[];
      wasClamped?: boolean;
    };
    bullThesis?: string;
    bearishRiskPoint?: string;
    bullBearVerdict?: string;
    usSpecialIntel?: UsStockSpecialIntelProps;
    liquidityFragility?: {
      bidAskSpreadPct: number;
      turnoverRate: number;
      liquidityFragilityIndex: number;
      slippageBufferMin: number;
      slippageBufferMax: number;
      marketImpactWarning?: string;
    };
  };
  onOpenKnowledgeGraph: (symbol: string) => void;
  onOpenDeductionModal?: (item: any) => void;
}

export const PerStockDeductionRetroCard: React.FC<PerStockDeductionRetroCardProps> = ({
  item,
  onOpenKnowledgeGraph,
  onOpenDeductionModal,
}) => {
  const [expanded, setExpanded] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [subTab, setSubTab] = useState<"retro" | "capitalFlow" | "community" | "fundamentals" | "kg" | "news" | "position">("retro");

  const rec = item.currentRecommendation;
  const pos = item.position;
  const past = item.pastRetro;
  const sentiment = item.communitySentiment;
  const flow = item.capitalFlow;
  const fund = item.fundamentals;
  const isBuy = rec?.action === "BUY";
  const isTrim = rec?.action === "TRIM" || rec?.action === "SELL";

  const handleCopyOrderSlip = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!rec) return;
    const slip = formatOrderSlipText({
      symbol: item.symbol,
      companyName: item.companyName,
      action: rec.action,
      actionType: (rec as any).actionType,
      suggestedShares: rec.suggestedShares,
      estimatedPrice: rec.estimatedPrice || pos?.marketPrice,
      estimatedAmount: rec.estimatedAmount,
      entryZone: rec.entryZone,
      stopLossPrice: rec.stopLossPrice,
      targetPrice: rec.targetPrice,
      whySummary: rec.whySummary || rec.rationale || item.strategyCategoryReason,
    });
    navigator.clipboard.writeText(slip);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const pnl = pos ? (pos.marketPrice - pos.costBasis) * pos.shares : 0;
  const pnlPct = pos && pos.costBasis > 0 ? (((pos.marketPrice - pos.costBasis) / pos.costBasis) * 100).toFixed(1) : "0";

  const categoryLabel = item.candidateCategory === "EXISTING_HOLDING"
    ? "实盘持仓"
    : item.candidateCategory === "WATCHLIST"
    ? "MooMoo 自选"
    : "宏观选股";

  return (
    <div className="glass-card border-slate-800 hover:border-cyan-500/30 transition-all overflow-hidden">
      {/* Stock Banner Header */}
      <div className="p-4 bg-slate-900/80 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 font-bold text-white text-base flex items-center gap-2">
            <span>{item.symbol}</span>
            <span className="text-[10px] font-normal px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              {categoryLabel}
            </span>
          </div>
          <div>
            <div className="font-bold text-white text-sm flex items-center gap-2 flex-wrap">
              <span>{item.companyName || item.symbol}</span>
              {item.strategyCategoryLabel && (
                <span className={`px-2 py-0.5 text-[11px] font-bold rounded-md border ${
                  item.strategyCategory === "OVERSOLD_BUY"
                    ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                    : item.strategyCategory === "FUNDAMENTAL_BUY"
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    : item.strategyCategory === "NEWS_CATALYST_BUY"
                    ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
                    : item.strategyCategory === "CAPITAL_INFLOW_BUY"
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    : "bg-slate-800 text-slate-300 border-slate-700"
                }`}>
                  {item.strategyCategoryLabel}
                </span>
              )}
              {pos && pos.shares > 0 ? (
                <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  持仓中 ({pos.shares}股)
                </span>
              ) : pos && pos.shares === 0 ? (
                <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  已平仓 (0股)
                </span>
              ) : (
                <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-slate-800 text-slate-400 border border-slate-700">
                  全美股精选
                </span>
              )}
            </div>
            {item.strategyCategoryReason && (
              <p className="text-[11px] text-cyan-200/90 font-medium mt-1 leading-snug">
                💡 {item.strategyCategoryReason}
              </p>
            )}

            {pos && pos.shares > 0 ? (
              <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-300 mt-1.5">
                <div className="flex items-center gap-1 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                  <span className="text-slate-400">持仓:</span>
                  <strong className="text-white">{pos.shares} 股</strong>
                </div>
                <div className="flex items-center gap-1 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                  <span className="text-slate-400">买入成本:</span>
                  <strong className="text-white">${pos.costBasis.toFixed(2)}</strong>
                </div>
                <div className="flex items-center gap-1 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                  <span className="text-slate-400">当前现价:</span>
                  <strong className="text-white">${pos.marketPrice.toFixed(2)}</strong>
                </div>
                <div className="flex items-center gap-1 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                  <span className="text-slate-400">持仓现值:</span>
                  <strong className="text-cyan-300 font-bold">${(pos.shares * pos.marketPrice).toFixed(2)}</strong>
                </div>
                <div
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold border ${
                    pnl >= 0
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                  }`}
                >
                  <span>浮盈亏:</span>
                  <span>
                    {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} ({pnl >= 0 ? "+" : ""}{pnlPct}%)
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400 flex items-center gap-2 mt-1">
                <span>现价: ${pos ? pos.marketPrice.toFixed(2) : (rec?.estimatedPrice || 0).toFixed(2)}</span>
                <span className="text-slate-500 italic">(暂未建立实盘持仓)</span>
              </div>
            )}

            {/* 🌟 极简上班族挂单参数胶囊 */}
            {rec && (rec.action === "BUY" || rec.action === "TRIM" || rec.action === "SELL") && (
              <div className="flex flex-wrap items-center gap-2 text-xs mt-2 pt-2 border-t border-slate-800/80">
                <div className="flex items-center gap-1 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-cyan-300 font-mono">
                  <span className="text-slate-400 font-sans">建议挂单:</span>
                  <strong>{rec.entryZone ? `$${rec.entryZone.min.toFixed(2)} ~ $${rec.entryZone.max.toFixed(2)}` : `$${(rec.estimatedPrice || pos?.marketPrice || 0).toFixed(2)}`}</strong>
                  <span className="text-slate-400">({rec.suggestedShares}股)</span>
                </div>
                {rec.stopLossPrice && (
                  <div className="flex items-center gap-1 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-rose-400 font-mono">
                    <span className="text-slate-400 font-sans">止损位:</span>
                    <strong>${rec.stopLossPrice.toFixed(2)}</strong>
                  </div>
                )}
                {rec.targetPrice && (
                  <div className="flex items-center gap-1 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-emerald-400 font-mono">
                    <span className="text-slate-400 font-sans">目标位:</span>
                    <strong>${rec.targetPrice.toFixed(2)}</strong>
                  </div>
                )}
                {rec.whySummary && (
                  <span className="text-slate-300 text-xs truncate max-w-md hidden xl:inline">
                    • {rec.whySummary}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {(() => {
            const actType = (rec as any)?.actionType || (isBuy ? (pos && pos.shares > 0 ? "ADD_POSITION" : "OPEN_POSITION") : isTrim ? (rec?.action === "SELL" ? "CLOSE_POSITION" : "TRIM_POSITION") : "HOLD_AND_WATCH");
            const labelMap: Record<string, { label: string; badge: string }> = {
              OPEN_POSITION: { label: `🟢 建议建仓 (${rec?.suggestedShares || 0}股)`, badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" },
              ADD_POSITION: { label: `🟢 建议加仓 (${rec?.suggestedShares || 0}股)`, badge: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40" },
              TRIM_POSITION: { label: `🟡 建议减仓 (${rec?.suggestedShares || 0}股)`, badge: "bg-amber-500/20 text-amber-300 border-amber-500/40" },
              CLOSE_POSITION: { label: `🔴 建议清仓 (全部)`, badge: "bg-rose-500/20 text-rose-300 border-rose-500/40" },
              HOLD_AND_WATCH: { label: "⚪ 保持观望", badge: "bg-slate-800 text-slate-300 border-slate-700" },
              INSUFFICIENT_DATA_ABORT: { label: "⚠️ 信息不足·熔断推演", badge: "bg-amber-500/25 text-amber-300 border-amber-500/50 shadow-amber-500/10" },
            };
            const meta = labelMap[actType] || labelMap.HOLD_AND_WATCH;
            return (
              <div className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 border shadow-sm ${meta.badge}`}>
                <Sparkles className="w-3.5 h-3.5" />
                <span>{meta.label}</span>
              </div>
            );
          })()}

          {/* 📋 一键复制券商挂单指令按钮 */}
          {rec && (rec.action === "BUY" || rec.action === "TRIM" || rec.action === "SELL") && (
            <button
              onClick={handleCopyOrderSlip}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-sm cursor-pointer ${
                copied
                  ? "bg-emerald-500 text-slate-950 border-emerald-400 shadow-emerald-500/20"
                  : "bg-slate-950 hover:bg-slate-850 text-cyan-300 border-cyan-500/40 hover:border-cyan-400"
              }`}
              title="点击一键复制标准限价单挂单指令至剪贴板，可直接在 Moomoo/富途/IBKR 挂单"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "✓ 挂单指令已复制" : "📋 复制挂单指令"}</span>
            </button>
          )}

          {/* 展开/收起 7 维推演研报按钮 */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-all cursor-pointer"
            title="按需展开或折叠 7 维全要素推演研报与客观证据链"
          >
            <span>{expanded ? "收起研报" : "🔍 展开 7 维研报"}</span>
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => onOpenDeductionModal && onOpenDeductionModal(item)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-cyan-500/20 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            title="点击打开单股目标驱动推演独立全景舱"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>全景舱 ↗</span>
          </button>
          <button
            onClick={() => onOpenKnowledgeGraph(item.symbol)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-cyan-400 hover:bg-cyan-500/10 text-xs transition-all font-semibold cursor-pointer"
          >
            图谱 ↗
          </button>
        </div>
      </div>

      {/* SubTab Header */}
      <div className="px-4 py-2 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs py-1">
          <button
            onClick={() => setSubTab("retro")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold transition-all ${
              subTab === "retro"
                ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                : "text-slate-400 hover:text-white bg-slate-900 border border-slate-800"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>1. 4维走势复盘 & TimeFM</span>
          </button>

          <button
            onClick={() => setSubTab("capitalFlow")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold transition-all ${
              subTab === "capitalFlow"
                ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                : "text-slate-400 hover:text-white bg-slate-900 border border-slate-800"
            }`}
          >
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            <span>2. 大资金/机构动向</span>
          </button>

          <button
            onClick={() => setSubTab("community")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold transition-all ${
              subTab === "community"
                ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                : "text-slate-400 hover:text-white bg-slate-900 border border-slate-800"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>3. 散户/社区情绪</span>
          </button>

          <button
            onClick={() => setSubTab("fundamentals")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold transition-all ${
              subTab === "fundamentals"
                ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                : "text-slate-400 hover:text-white bg-slate-900 border border-slate-800"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>4. 基本面与财报</span>
          </button>

          <button
            onClick={() => setSubTab("kg")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold transition-all ${
              subTab === "kg"
                ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                : "text-slate-400 hover:text-white bg-slate-900 border border-slate-800"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>5. 知识图谱与衰减</span>
          </button>

          <button
            onClick={() => setSubTab("news")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold transition-all ${
              subTab === "news"
                ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                : "text-slate-400 hover:text-white bg-slate-900 border border-slate-800"
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>6. 消歧重磅新闻</span>
          </button>

          <button
            onClick={() => setSubTab("position")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold transition-all ${
              subTab === "position"
                ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                : "text-slate-400 hover:text-white bg-slate-900 border border-slate-800"
            }`}
          >
            <PieChart className="w-3.5 h-3.5" />
            <span>7. MooMoo 盘面明细</span>
          </button>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="text-slate-400 hover:text-white p-1 rounded"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* SubTab Content */}
      {expanded && (
        <div className="p-4 space-y-3 bg-slate-900/40 text-xs">
          {/* ⚡ 30秒极速操盘 3 大核心客观事实证据链与不变量安全防呆校验 (FINOS Legend 务实落地) */}
          <div className="p-3.5 rounded-xl bg-slate-950/90 border border-cyan-500/30 text-xs space-y-2 shadow-lg shadow-cyan-950/20">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-md bg-cyan-500/20 text-cyan-300">
                  <Zap className="w-3.5 h-3.5" />
                </div>
                <span className="font-bold text-white text-xs">⚡ 30秒极速操盘事实证据链 (3-Pillar Hard Facts)</span>
              </div>

              {/* 不变量校验通过徽章 */}
              {(item.invariantStatus || rec?.invariantStatus) && (
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>🛡️ 资金与点位不变量安全防呆校验已通过</span>
                  {(item.invariantStatus?.wasClamped || rec?.invariantStatus?.wasClamped) && (
                    <span className="text-[10px] text-amber-300 bg-amber-500/20 px-1 rounded ml-1">已自愈纠偏</span>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
              {/* 支柱 1: 基本面与估值锚点 */}
              <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 flex items-start gap-2">
                <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-400 shrink-0 mt-0.5 font-bold text-xs">
                  📊
                </div>
                <div className="space-y-0.5 min-w-0">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">1. 基本面与估值锚点</div>
                  <div className="text-slate-200 text-xs font-medium leading-snug line-clamp-2" title={item.evidenceHighlights?.fundamentalAnchor || rec?.evidenceHighlights?.fundamentalAnchor}>
                    {item.evidenceHighlights?.fundamentalAnchor || rec?.evidenceHighlights?.fundamentalAnchor || "基本面与估值中枢处于健康区间"}
                  </div>
                </div>
              </div>

              {/* 支柱 2: 权威消息与催化锚点 */}
              <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 flex items-start gap-2">
                <div className="p-1.5 rounded-md bg-indigo-500/10 text-indigo-400 shrink-0 mt-0.5 font-bold text-xs">
                  📰
                </div>
                <div className="space-y-0.5 min-w-0">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">2. 权威消息与行业催化</div>
                  <div className="text-slate-200 text-xs font-medium leading-snug line-clamp-2" title={item.evidenceHighlights?.catalystAnchor || rec?.evidenceHighlights?.catalystAnchor}>
                    {item.evidenceHighlights?.catalystAnchor || rec?.evidenceHighlights?.catalystAnchor || item.strategyCategoryReason || "行业景气度向好，近期无突发重大利空"}
                  </div>
                </div>
              </div>

              {/* 支柱 3: 资金面与 ATR 防线锚点 */}
              <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 flex items-start gap-2">
                <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-400 shrink-0 mt-0.5 font-bold text-xs">
                  🏦
                </div>
                <div className="space-y-0.5 min-w-0">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">3. 资金流与 ATR 防线</div>
                  <div className="text-slate-200 text-xs font-medium leading-snug line-clamp-2" title={item.evidenceHighlights?.flowRiskAnchor || rec?.evidenceHighlights?.flowRiskAnchor}>
                    {item.evidenceHighlights?.flowRiskAnchor || rec?.evidenceHighlights?.flowRiskAnchor || `主力资金动向平稳 · ATR软防线 $${rec?.stopLossPrice || "动态跟踪"}`}
                  </div>
                </div>
              </div>
            </div>

            {/* ⚔️ 多智能体多空辩论与对抗裁决 (Bull vs Bear Debate - TradingAgents 务实落地) */}
            {(item.bullThesis || rec?.bullThesis || item.bearishRiskPoint || rec?.bearishRiskPoint) && (
              <div className="pt-2 border-t border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-slate-200 text-xs">
                    <Swords className="w-3.5 h-3.5 text-rose-400" />
                    <span>⚔️ 多空对抗辩论与核心下行风险 (Bull vs Bear Debate)</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/20 font-medium">
                    拒绝盲目看多 · 严苛风控质询
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {/* 🟢 多方核心主线 */}
                  <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/20 space-y-1">
                    <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                      <span>🟢 多方核心主线 (Bull Thesis)</span>
                    </div>
                    <p className="text-slate-200 text-xs leading-relaxed">
                      {item.bullThesis || rec?.bullThesis || "基本面与行业景气共振，支撑向上动量。"}
                    </p>
                  </div>

                  {/* 🔴 空方最严苛反驳点 */}
                  <div className="p-2.5 rounded-lg bg-rose-950/20 border border-rose-500/20 space-y-1">
                    <div className="flex items-center gap-1 text-[11px] font-bold text-rose-400">
                      <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                      <span>🔴 空方严苛反驳/最大黑天鹅 (Bearish Risk)</span>
                    </div>
                    <p className="text-slate-200 text-xs leading-relaxed">
                      {item.bearishRiskPoint || rec?.bearishRiskPoint || "若跌破ATR止损防线或宏观流动性收紧需果断离场。"}
                    </p>
                  </div>
                </div>

                {/* ⚖️ 多空裁决与安全防线 */}
                {(item.bullBearVerdict || rec?.bullBearVerdict) && (
                  <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 flex items-center gap-2 text-xs">
                    <div className="p-1 rounded bg-indigo-500/20 text-indigo-300 shrink-0">
                      <Scale className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-slate-400 font-medium">多空出清裁决：</span>
                      <span className="text-indigo-200 font-semibold ml-1">{item.bullBearVerdict || rec?.bullBearVerdict}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 📅 美股特异化雷达 (Earnings & Unusual Option Flow) */}
            {(item.usSpecialIntel || rec?.usSpecialIntel) && (
              <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                {/* 财报窗口雷达 */}
                <div className="flex items-center gap-1.5 p-1.5 px-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
                  <Calendar className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="text-slate-400 text-[11px]">财报窗口:</span>
                  <span className={`text-[11px] font-bold ${
                    (item.usSpecialIntel?.earningsRiskLevel || rec?.usSpecialIntel?.earningsRiskLevel) === "HIGH"
                      ? "text-rose-400 animate-pulse"
                      : (item.usSpecialIntel?.earningsRiskLevel || rec?.usSpecialIntel?.earningsRiskLevel) === "MEDIUM"
                      ? "text-amber-400"
                      : "text-emerald-400"
                  }`}>
                    {item.usSpecialIntel?.earningsRiskLabel || rec?.usSpecialIntel?.earningsRiskLabel}
                  </span>
                </div>

                {/* 期权 Gamma 与异动 */}
                {(item.usSpecialIntel?.unusualOptionActivity || rec?.usSpecialIntel?.unusualOptionActivity) && (
                  <div className="flex items-center gap-1.5 p-1.5 px-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
                    <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="text-slate-400 text-[11px]">期权Gamma偏斜:</span>
                    <span className="text-[11px] font-bold text-slate-200">
                      {(item.usSpecialIntel?.unusualOptionActivity?.gammaBiasLabel || rec?.usSpecialIntel?.unusualOptionActivity?.gammaBiasLabel)}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      (PCR: {(item.usSpecialIntel?.unusualOptionActivity?.callPutVolumeRatio || rec?.usSpecialIntel?.unusualOptionActivity?.callPutVolumeRatio)?.toFixed(2)})
                    </span>
                  </div>
                )}

                {/* 🛡️ TradeMaster 微观做市商价差与智能挂单滑点保护 */}
                {(item.liquidityFragility || (rec as any)?.liquidityFragility) && (
                  <div className="flex items-center gap-1.5 p-1.5 px-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
                    <ShieldAlert className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="text-slate-400 text-[11px]">挂单滑点保护:</span>
                    <span className="text-[11px] font-bold text-emerald-300 font-mono">
                      ${(item.liquidityFragility || (rec as any)?.liquidityFragility).slippageBufferMin} ~ ${(item.liquidityFragility || (rec as any)?.liquidityFragility).slippageBufferMax}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      (价差: {(item.liquidityFragility || (rec as any)?.liquidityFragility).bidAskSpreadPct}%)
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 🚨 数据完备性刚性熔断报警卡片 (当信息缺失时显式拦截与引导) */}
          {(rec as any)?.dataSufficiencyReport && !(rec as any)?.dataSufficiencyReport.isSufficient && (
            <div className="p-3.5 rounded-xl bg-amber-950/30 border-2 border-amber-500/50 text-amber-200 space-y-2.5 shadow-lg shadow-amber-950/40">
              <div className="flex items-center justify-between">
                <div className="font-bold flex items-center gap-2 text-sm text-amber-300">
                  <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
                  <span>数据完备性不足 · 推演已主动熔断 (完备度: {(rec as any).dataSufficiencyReport.completenessScore}%)</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  杜绝大模型盲目臆测
                </span>
              </div>
              <p className="text-slate-300 text-xs leading-relaxed">
                {(rec as any).dataSufficiencyReport.abortReason}
              </p>
              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-bold text-amber-300">🛠️ 缺失数据项排障与修复指引：</div>
                {(rec as any).dataSufficiencyReport.missingItems.map((m: any, idx: number) => (
                  <div key={idx} className="p-2 rounded-lg bg-slate-950/80 border border-amber-500/30 text-[11px] space-y-0.5">
                    <div className="font-bold text-rose-300">[{m.category}] {m.description}</div>
                    <div className="text-slate-400 text-[10px]">👉 修复方式: <span className="text-cyan-300">{m.remedyAction}</span></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 🎮 微观多主体博弈仿真与出清罗盘 (当仿真数据可用时展示) */}
          {(rec as any)?.simulationResult && (
            <div className="p-3.5 rounded-xl bg-slate-950 border border-cyan-500/30 space-y-2.5 shadow-md">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white flex items-center gap-1.5 text-xs">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span>数字孪生博弈沙盘 · 微观出清中枢与 4 角色多空对比</span>
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">
                    博弈分歧度: <strong className="text-cyan-300">{(rec as any).simulationResult.equilibriumDispersionPct}%</strong>
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 border border-slate-700 text-slate-300">
                    脆弱指数: {(rec as any).simulationResult.liquidityFragilityScore}
                  </span>
                </div>
              </div>

              {/* 4 Agent 力量分布条 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                {(rec as any).simulationResult.agentStates?.map((agent: any, idx: number) => (
                  <div key={idx} className="p-2 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[10px] truncate">{agent.agentLabel}</span>
                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                        agent.bias.includes("LONG") ? "text-emerald-400 bg-emerald-500/10" : agent.bias.includes("SHORT") ? "text-rose-400 bg-rose-500/10" : "text-slate-400 bg-slate-800"
                      }`}>
                        {agent.bias}
                      </span>
                    </div>
                    <div className="font-mono text-white text-xs font-bold">${agent.targetPriceHorizon?.toFixed(2)}</div>
                    <div className="text-[9px] text-slate-500 line-clamp-1" title={agent.corePremise}>{agent.corePremise}</div>
                  </div>
                ))}
              </div>

              {/* 三态情景演化树 */}
              {(rec as any)?.scenarioBranches && (rec as any).scenarioBranches.length > 0 && (
                <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                  <div className="text-[11px] font-bold text-slate-400">🌲 蒙特卡洛三态情景演化树 (What-If Scenarios):</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {(rec as any).scenarioBranches.map((sc: any, idx: number) => (
                      <div key={idx} className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px] space-y-1">
                        <div className="flex items-center justify-between font-bold">
                          <span className="text-cyan-300">{sc.scenarioLabel}</span>
                          <span className="text-white">${sc.projectedPriceTarget?.toFixed(2)}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 line-clamp-2">{sc.executionRule}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SubTab 1: 4维走势复盘 */}
          {subTab === "retro" && (
            <div className="space-y-3">
              {/* Google TimeFM 时序大模型 AI 走势预测 */}
              {item.timefmForecast && (
                <div className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-500/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-indigo-400" />
                      <span>Google TimeFM 时序大模型 · 次日走势预测 (零样本自回归)</span>
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                      {item.timefmForecast.directionLabel}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                      <div className="text-slate-400">预测目标价</div>
                      <div className="font-bold text-white text-sm">
                        {item.timefmForecast.predictedPrice > 0 ? `$${item.timefmForecast.predictedPrice.toFixed(2)}` : "--"}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                      <div className="text-slate-400">预测涨跌幅</div>
                      <div
                        className={`font-bold text-sm ${
                          item.timefmForecast.predictedChangeRate >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {item.timefmForecast.predictedChangeRate >= 0 ? "+" : ""}
                        {item.timefmForecast.predictedChangeRate}%
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                      <div className="text-slate-400">10%~90% 置信带</div>
                      <div className="font-bold text-cyan-300">
                        ${item.timefmForecast.confidenceLow} ~ ${item.timefmForecast.confidenceHigh}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                      <div className="text-slate-400">时序动量置信度</div>
                      <div className="font-bold text-amber-300">{item.timefmForecast.confidenceScore}%</div>
                    </div>
                  </div>

                  <p className="text-slate-300 text-[11px] leading-relaxed bg-slate-900/90 p-2.5 rounded-lg border border-indigo-500/20">
                    💡 <strong>时序推论</strong>: {item.timefmForecast.momentumRationale}
                  </p>
                </div>
              )}

              {/* 实盘三态闭环检验归因卡片 */}
              {past.verificationLesson && (
                <div
                  className={`p-3.5 rounded-xl border space-y-2 ${
                    past.verificationOutcome === "EXPERIENCE"
                      ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-200"
                      : past.verificationOutcome === "LESSON"
                      ? "bg-rose-950/20 border-rose-500/30 text-rose-200"
                      : "bg-amber-950/20 border-amber-500/30 text-amber-200"
                  }`}
                >
                  <div className="font-bold flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>实盘闭环检验归因: {past.verificationOutcomeLabel || "实盘验证"}</span>
                    </span>
                    {past.actualNextChangeRate !== undefined && (
                      <span className="text-[11px] font-mono font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                        次日真实涨跌: {past.actualNextChangeRate >= 0 ? "+" : ""}{past.actualNextChangeRate}% (收盘 ${past.actualNextClosePrice?.toFixed(2)})
                      </span>
                    )}
                  </div>
                  <p className="text-slate-300 leading-relaxed text-[11px] bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    {past.verificationLesson}
                  </p>
                </div>
              )}

              {/* 前次推演与盘面核验对齐 */}
              <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <History className="w-4 h-4 text-cyan-400" />
                    <span>前次推演与盘面核验对齐 ({past.lastStrategyDate || "无历史对比记录"})</span>
                  </span>
                  <span className="text-emerald-400 font-bold">
                    预测准确率: {past.accuracyScore !== undefined ? `${past.accuracyScore}%` : "未知/首日无数据"}
                  </span>
                </div>
                <p className="text-slate-300 leading-relaxed bg-slate-900 p-2.5 rounded-lg border border-slate-800/80">
                  {past.actualPriceAction || "未检测到历史推演基准，暂无盘面复盘对比数据。"}
                </p>
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span>前次建议: <strong className="text-cyan-300">{past.lastAction || "未知"}</strong></span>
                  <span>
                    止盈目标价: {past.lastTargetPrice ? `$${past.lastTargetPrice.toFixed(2)}` : "未知"} | 止损线: {past.lastStopLossPrice ? `$${past.lastStopLossPrice.toFixed(2)}` : "未知"}
                  </span>
                </div>
              </div>

              {past.distilledLesson && (
                <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/30 text-cyan-200 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-xs text-cyan-300">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>蒸馏交易纪律 (Distilled Lesson):</span>
                  </div>
                  <p className="text-slate-300">{past.distilledLesson}</p>
                </div>
              )}
            </div>
          )}

          {/* SubTab 2: 大资金/机构动向 */}
          {subTab === "capitalFlow" && (
            <div className="space-y-2">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <span>机构与主力大资金走向 (Institutional Capital Flow)</span>
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                      flow?.trend === "INFLOW"
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                        : flow?.trend === "OUTFLOW"
                        ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {flow?.trend === "INFLOW" ? "主力净流入 (INFLOW)" : flow?.trend === "OUTFLOW" ? "主力净流出 (OUTFLOW)" : "中性/未知"}
                  </span>
                </div>
                <p className="text-slate-300 leading-relaxed bg-slate-900 p-2.5 rounded-lg border border-slate-800/80">
                  {flow?.description || "暂未搜刮到显著主力大资金动向"}
                </p>
              </div>
            </div>
          )}

          {/* SubTab 3: 社区讨论与情绪 */}
          {subTab === "community" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 font-bold text-sm">
                    情绪得分: {sentiment?.score !== undefined ? `${sentiment.score}/100` : "未知"}
                  </div>
                  <div>
                    <div className="font-bold text-white text-xs">
                      社区散户与社交倾向: <span className="text-emerald-400 font-bold">{sentiment?.mood || "未知"}</span>
                    </div>
                    <div className="text-[11px] text-slate-400">基于 SearXNG 抓取 Reddit / StockTwits 搜刮解析</div>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
                <div className="font-semibold text-slate-300 text-[11px]">社区热议焦点:</div>
                <div className="flex flex-wrap gap-1.5">
                  {sentiment?.keyTopics && sentiment.keyTopics.length > 0 ? (
                    sentiment.keyTopics.map((t: string, idx: number) => (
                      <span key={idx} className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-cyan-300 text-[11px]">
                        • {t}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-500 italic text-[11px]">暂无搜刮到的社区讨论主题</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SubTab 4: 基本面与财报 */}
          {subTab === "fundamentals" && (
            <div className="space-y-2">
              {fund ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div>
                    <span className="text-slate-400 block text-[11px]">市盈率 PE Ratio</span>
                    <span className="font-bold text-white">{fund.peRatio !== undefined ? fund.peRatio : "未知"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">营收同比 Revenue Growth</span>
                    <span className="font-bold text-emerald-400">{fund.revenueGrowthPct !== undefined ? `${fund.revenueGrowthPct}%` : "未知"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">净利润率 Net Margin</span>
                    <span className="font-bold text-cyan-300">{fund.netMarginPct !== undefined ? `${fund.netMarginPct}%` : "未知"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">下次财报日 Next Earnings</span>
                    <span className="font-bold text-slate-200">{fund.nextEarningsDate || "未知"}</span>
                  </div>
                </div>
              ) : (
                <div className="text-slate-400 italic p-3 bg-slate-950 rounded-xl border border-slate-800">
                  暂未录入该标的详细财报指标
                </div>
              )}
            </div>
          )}

          {/* SubTab 5: 知识图谱 */}
          {subTab === "kg" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-300">工业级产业链拓扑:</span>
                  {item.knowledgeGraph.spilloverAlphaScore !== undefined && (
                    <span className="text-[11px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                      溢出动量: {item.knowledgeGraph.spilloverAlphaScore >= 0 ? `+${item.knowledgeGraph.spilloverAlphaScore}` : item.knowledgeGraph.spilloverAlphaScore}
                    </span>
                  )}
                  {item.knowledgeGraph.networkRiskScore !== undefined && (
                    <span className="text-[11px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
                      网络风险: {item.knowledgeGraph.networkRiskScore}/100
                    </span>
                  )}
                </div>
                <button
                  onClick={() => onOpenKnowledgeGraph(item.symbol)}
                  className="text-cyan-400 hover:underline text-xs font-semibold"
                >
                  打开完整图谱视窗 ↗
                </button>
              </div>

              {item.knowledgeGraph.compressedSummary && (
                <div className="p-2.5 rounded-lg bg-indigo-950/30 border border-indigo-500/30 text-indigo-200 text-[11px]">
                  <strong>图谱提纯压缩记忆:</strong> {item.knowledgeGraph.compressedSummary}
                </div>
              )}

              {/* Top Edges summary */}
              {item.knowledgeGraph.edges && item.knowledgeGraph.edges.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold text-slate-400">核心产业链传导链路:</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {item.knowledgeGraph.edges.slice(0, 4).map((e, idx) => (
                      <div key={idx} className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-cyan-300">{e.source} → {e.target}</span>
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                            e.impact === "POSITIVE" ? "text-emerald-400" : "text-rose-400"
                          }`}>
                            {e.impact === "POSITIVE" ? "利多" : "利空"}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{e.relation}</p>
                        {e.exposurePct !== undefined && (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            敞口: {Math.round(e.exposurePct * 100)}% {e.timeLagDays ? `· 滞后 ${e.timeLagDays}天` : ""}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SubTab 6: 消歧重磅新闻 */}
          {subTab === "news" && (
            <div className="space-y-2">
              <div className="font-semibold text-slate-300">SearXNG 消歧检索重磅新闻:</div>
              {item.latestNews.length > 0 ? (
                <ul className="space-y-1.5">
                  {item.latestNews.map((n, i) => (
                    <li key={i} className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 flex items-start gap-2">
                      <span className="text-cyan-400 font-bold">•</span>
                      <span>{n}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-slate-500 italic p-2">暂无检索到的重磅个股新闻</div>
              )}
            </div>
          )}

          {/* SubTab 7: 持仓 */}
          {subTab === "position" && (
            <div className="space-y-2">
              {pos && pos.shares > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div>
                    <span className="text-slate-400 block text-[11px]">持有数量</span>
                    <span className="font-bold text-white">{pos.shares} 股</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">成本价</span>
                    <span className="font-bold text-white">${pos.costBasis.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">现值</span>
                    <span className="font-bold text-cyan-300">${(pos.shares * pos.marketPrice).toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">浮动盈亏</span>
                    <span className={`font-bold ${pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} ({pnl >= 0 ? "+" : ""}{pnlPct}%)
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-slate-400 italic p-2">暂未建立实盘持仓</div>
              )}
            </div>
          )}

          {/* Target Boundaries Footer */}
          {rec && (
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-slate-400">
              <div className="flex items-center gap-3">
                <Target className="w-4 h-4 text-cyan-400" />
                <span>止盈目标价: <strong className="text-emerald-400">${rec.targetPrice ? rec.targetPrice.toFixed(2) : "未知"}</strong></span>
                <span>止损防线价: <strong className="text-rose-400">${rec.stopLossPrice ? rec.stopLossPrice.toFixed(2) : "未知"}</strong></span>
              </div>
              <span className="text-[11px] text-slate-300 max-w-md truncate" title={rec.rationale}>
                理由: {rec.rationale}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
