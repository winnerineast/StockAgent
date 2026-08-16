import {
  ActionItem,
  EntryZone,
  OpenDSnapshotItem,
  RiskAlert,
  SingleStockIntel,
  StockKnowledgeGraphItem,
  StockPositionItem,
  StockStrategyCategory,
  TimeFmForecastItem,
} from "../types/stockTypes";
import { goalDrivenQuantEngine } from "./goalDrivenQuantEngine";

export interface StockClassificationResult {
  strategyCategory: StockStrategyCategory;
  strategyCategoryLabel: string;
  strategyCategoryReason: string;
  action: "BUY" | "TRIM" | "HOLD" | "SELL";
  suggestedShares: number;
  estimatedPrice: number;
  estimatedAmount: number;
  rationale: string;
  urgency: "HIGH" | "MEDIUM" | "LOW";
  targetPrice: number;
  stopLossPrice: number;
  riskRewardRatio: number;
  targetTimeHorizonDays: number;
  targetProfitGoalPct: number;
  goalAttainmentProbability: number;
  certaintyScore: number;
  entryZone: EntryZone;
  timeStopRule: string;
  goalDrivenRationale: string;
  expectedPnLAmount: number;
  maxRiskAmount: number;
  atr?: number;
  atrPct?: number;
  perShareRisk?: number;
}

export class StockEngine {
  /**
   * 基于 OpenD 官方盘面/财务/资金流与 SearXNG 消息，执行 5 大策略分类多因子判定与目标驱动量化测算
   */
  public classifyStockOpportunity(
    symbol: string,
    companyName: string,
    snapshot?: OpenDSnapshotItem,
    intel?: SingleStockIntel,
    position?: StockPositionItem,
    budgetPerStock: number = 2000.0,
    targetProfitGoalPct: number = 8.0,
    targetTimeHorizonDays: number = 5,
    maxDrawdownPct: number = 4.0,
    timefmForecast?: TimeFmForecastItem,
    knowledgeGraph?: StockKnowledgeGraphItem,
    macroRegimeMood: string = "NEUTRAL"
  ): StockClassificationResult | null {
    const sym = symbol.toUpperCase();
    const curPrice = snapshot?.lastPrice || position?.marketPrice || position?.costBasis || 0;
    if (curPrice <= 0) return null;

    const sharesHolding = position?.shares || 0;
    const hasHolding = sharesHolding > 0;
    const costBasis = position?.costBasis || curPrice;
    const pnlPct = costBasis > 0 ? ((curPrice - costBasis) / costBasis) * 100 : 0;

    // 优先风控：若已有持仓浮盈 > 18% 或 浮亏 < -8%，优先触发止盈止损调仓
    if (hasHolding && pnlPct >= 18.0) {
      const trimShares = Math.max(1, Math.floor(sharesHolding * 0.35));
      const path = goalDrivenQuantEngine.formulateTradePath({
        symbol: sym,
        companyName,
        currentPrice: curPrice,
        action: "TRIM",
        targetProfitGoalPct,
        targetTimeHorizonDays,
        maxDrawdownPct,
        certaintyScore: 88,
        goalProbability: 82,
        allocatedAmount: Number((trimShares * curPrice).toFixed(2)),
        suggestedShares: trimShares,
        strategyCategoryLabel: "👀 止盈防线 · 锁定利润",
        snapshot,
      });

      return {
        strategyCategory: "WATCH_AND_WAIT",
        strategyCategoryLabel: "👀 止盈防线 · 锁定利润",
        strategyCategoryReason: `累计浮盈 +${pnlPct.toFixed(1)}%，触发阶段性锁定部分利润风控。`,
        action: "TRIM",
        suggestedShares: trimShares,
        estimatedPrice: curPrice,
        estimatedAmount: Number((trimShares * curPrice).toFixed(2)),
        rationale: `[${sym}] 累计浮盈 +${pnlPct.toFixed(1)}%，建议减仓 ${trimShares} 股锁定收益，释放现金回流操盘池。`,
        urgency: "HIGH",
        targetPrice: path.targetPrice,
        stopLossPrice: path.stopLossPrice,
        riskRewardRatio: path.riskRewardRatio,
        targetTimeHorizonDays,
        targetProfitGoalPct,
        goalAttainmentProbability: 82,
        certaintyScore: 88,
        entryZone: path.entryZone,
        timeStopRule: path.timeStopRule,
        goalDrivenRationale: path.goalDrivenRationale,
        expectedPnLAmount: path.expectedPnLAmount,
        maxRiskAmount: path.maxRiskAmount,
        atr: path.atr,
        atrPct: path.atrPct,
        perShareRisk: path.perShareRisk,
      };
    }

    if (hasHolding && pnlPct <= -8.0) {
      const trimShares = Math.max(1, Math.floor(sharesHolding * 0.5));
      const path = goalDrivenQuantEngine.formulateTradePath({
        symbol: sym,
        companyName,
        currentPrice: curPrice,
        action: "TRIM",
        targetProfitGoalPct,
        targetTimeHorizonDays,
        maxDrawdownPct,
        certaintyScore: 78,
        goalProbability: 40,
        allocatedAmount: Number((trimShares * curPrice).toFixed(2)),
        suggestedShares: trimShares,
        strategyCategoryLabel: "⚠️ 止损戒备 · 仓位风控",
        snapshot,
      });

      return {
        strategyCategory: "WATCH_AND_WAIT",
        strategyCategoryLabel: "⚠️ 止损戒备 · 仓位风控",
        strategyCategoryReason: `持仓浮亏 ${pnlPct.toFixed(1)}% 突破 -8.0% 止损线，严控下行风险。`,
        action: "TRIM",
        suggestedShares: trimShares,
        estimatedPrice: curPrice,
        estimatedAmount: Number((trimShares * curPrice).toFixed(2)),
        rationale: `[${sym}] 突破硬止损防线，建议减仓规避进一步下行风险。`,
        urgency: "HIGH",
        targetPrice: path.targetPrice,
        stopLossPrice: path.stopLossPrice,
        riskRewardRatio: path.riskRewardRatio,
        targetTimeHorizonDays,
        targetProfitGoalPct,
        goalAttainmentProbability: 40,
        certaintyScore: 78,
        entryZone: path.entryZone,
        timeStopRule: path.timeStopRule,
        goalDrivenRationale: path.goalDrivenRationale,
        expectedPnLAmount: path.expectedPnLAmount,
        maxRiskAmount: path.maxRiskAmount,
        atr: path.atr,
        atrPct: path.atrPct,
        perShareRisk: path.perShareRisk,
      };
    }

    // 因子 1: 超跌回撤判定 (OVERSOLD_BUY)
    const high52w = snapshot?.highest52WeeksPrice || 0;
    const drawdown52w = high52w > 0 ? ((curPrice - high52w) / high52w) * 100 : 0;
    const pe = snapshot?.peRatio || snapshot?.peTtmRatio || 0;

    const isOversold = (drawdown52w <= -15.0 || (snapshot?.preChangeRate && snapshot.preChangeRate <= -3.0)) &&
      (pe <= 0 || pe < 75);

    // 因子 2: 基本面亮眼判定 (FUNDAMENTAL_BUY)
    const isFundamentallyStrong = (pe > 0 && pe <= 38.0) &&
      (snapshot?.earningPerShare !== undefined ? snapshot.earningPerShare > 0 : true) &&
      (snapshot?.netProfit !== undefined ? snapshot.netProfit > 0 : true);

    // 因子 3: 消息面强劲判定 (NEWS_CATALYST_BUY)
    const newsKeywords = ["beat", "upgrade", "record", "soar", "partnership", "breakthrough", "rally", "growth", "approved", "bullish"];
    const newsText = (intel?.latestNews || []).join(" ").toLowerCase();
    const hasNewsCatalyst = newsKeywords.some((k) => newsText.includes(k)) ||
      (snapshot?.preChangeRate !== undefined && snapshot.preChangeRate >= 1.5) ||
      intel?.communitySentiment?.mood === "BULLISH";

    // 因子 4: 近期大资金进入判定 (CAPITAL_INFLOW_BUY)
    const hasCapitalInflow = (snapshot?.mainCapitalInflow !== undefined && snapshot.mainCapitalInflow > 0) ||
      (snapshot?.capitalInflow !== undefined && snapshot.capitalInflow > 0) ||
      intel?.capitalFlow?.trend === "INFLOW";

    // 匹配策略分类
    let category: StockStrategyCategory | null = null;
    let label = "";
    let reason = "";

    if (isOversold) {
      category = "OVERSOLD_BUY";
      label = "📉 超跌建仓";
      reason = `52周高点深度回撤 ${drawdown52w.toFixed(1)}%，现价 $${curPrice.toFixed(2)} 测试支撑位，基本面具备安全边际。`;
    } else if (hasCapitalInflow) {
      category = "CAPITAL_INFLOW_BUY";
      label = "🏦 近期大资金进入建仓";
      reason = `OpenD 官方大资金监测显示主力持续净流入，筹码加速沉淀。`;
    } else if (hasNewsCatalyst) {
      category = "NEWS_CATALYST_BUY";
      label = "🚀 消息面强劲建仓";
      reason = `突发重磅利好催化与全网多头情绪共振，短周期爆发力强。`;
    } else if (isFundamentallyStrong) {
      category = "FUNDAMENTAL_BUY";
      label = "💎 基本面亮眼建仓";
      reason = `OpenD 官方 PE ${pe > 0 ? pe.toFixed(1) : "合理"}，EPS 强劲，长期价值安全边际充足。`;
    } else if (hasHolding) {
      category = "WATCH_AND_WAIT";
      label = "👀 可以观望";
      reason = `目前处于箱体整理区间，多空博弈均衡，建议保持现有持仓并持续跟踪。`;
    }

    if (!category) return null;

    // 2. 调用 GoalDrivenQuantEngine 进行目标达成概率与确定性指数测算
    const goalAttain = goalDrivenQuantEngine.calculateGoalAttainment({
      currentPrice: curPrice,
      targetProfitGoalPct,
      targetTimeHorizonDays,
      snapshot,
      timefmForecast,
      spilloverAlpha: knowledgeGraph?.spilloverAlphaScore,
      capitalInflowTrend: intel?.capitalFlow?.trend,
      strategyCategory: category,
    });

    const certainty = goalDrivenQuantEngine.calculateCertaintyScore({
      goalProbability: goalAttain.goalAttainmentProbability,
      timefmForecast,
      snapshot,
      intel,
      knowledgeGraph,
      strategyCategory: category,
      macroRegimeMood,
    });

    // 计算建仓股数与金额 (单笔风险预算对齐)
    const actionType: "BUY" | "HOLD" = category === "WATCH_AND_WAIT" ? "HOLD" : "BUY";
    const buyShares = actionType === "BUY"
      ? Math.max(1, Math.floor((budgetPerStock > 0 ? budgetPerStock : curPrice) / curPrice))
      : sharesHolding;
    const buyAmount = Number((buyShares * curPrice).toFixed(2));

    const path = goalDrivenQuantEngine.formulateTradePath({
      symbol: sym,
      companyName,
      currentPrice: curPrice,
      action: actionType,
      targetProfitGoalPct,
      targetTimeHorizonDays,
      maxDrawdownPct,
      certaintyScore: certainty.certaintyScore,
      goalProbability: goalAttain.goalAttainmentProbability,
      allocatedAmount: buyAmount,
      suggestedShares: buyShares,
      strategyCategory: category,
      strategyCategoryLabel: label,
      snapshot,
    });

    return {
      strategyCategory: category,
      strategyCategoryLabel: label,
      strategyCategoryReason: reason,
      action: actionType,
      suggestedShares: buyShares,
      estimatedPrice: curPrice,
      estimatedAmount: buyAmount,
      rationale: path.goalDrivenRationale,
      urgency: actionType === "BUY" ? "HIGH" : "LOW",
      targetPrice: path.targetPrice,
      stopLossPrice: path.stopLossPrice,
      riskRewardRatio: path.riskRewardRatio,
      targetTimeHorizonDays,
      targetProfitGoalPct,
      goalAttainmentProbability: goalAttain.goalAttainmentProbability,
      certaintyScore: certainty.certaintyScore,
      entryZone: path.entryZone,
      timeStopRule: path.timeStopRule,
      goalDrivenRationale: path.goalDrivenRationale,
      expectedPnLAmount: path.expectedPnLAmount,
      maxRiskAmount: path.maxRiskAmount,
      atr: path.atr,
      atrPct: path.atrPct,
      perShareRisk: path.perShareRisk,
    };
  }

  /**
   * 基于自选股、持仓、OpenD 官方快照与资金流，执行全美股多因子筛选与目标优化
   */
  public generateStockScreenerRecommendations(
    positions: StockPositionItem[],
    watchlist: Array<{ symbol: string; companyName: string }>,
    quotesMap: Map<string, number>,
    searxngNewsText: string,
    customBudget: number = 0,
    riskPreference: string = "BALANCED",
    snapshotsMap?: Map<string, OpenDSnapshotItem>,
    intelsMap?: Map<string, SingleStockIntel>,
    targetProfitGoalPct: number = 8.0,
    targetTimeHorizonDays: number = 5,
    maxDrawdownPct: number = 4.0
  ): {
    actions: ActionItem[];
    oversoldOpportunities: ActionItem[];
    riskAlerts: RiskAlert[];
    marketOverview: string;
  } {
    const rawActions: ActionItem[] = [];
    const oversoldOpportunities: ActionItem[] = [];
    const riskAlerts: RiskAlert[] = [];

    const allSymbols = Array.from(new Set([
      ...positions.map((p) => p.symbol.toUpperCase()),
      ...watchlist.map((w) => w.symbol.toUpperCase()),
    ]));

    for (const sym of allSymbols) {
      const pos = positions.find((p) => p.symbol.toUpperCase() === sym);
      const wItem = watchlist.find((w) => w.symbol.toUpperCase() === sym);
      const companyName = pos?.companyName || wItem?.companyName || sym;
      const snap = snapshotsMap?.get(sym);
      const intel = intelsMap?.get(sym);

      const classified = this.classifyStockOpportunity(
        sym,
        companyName,
        snap,
        intel,
        pos,
        customBudget * 0.35,
        targetProfitGoalPct,
        targetTimeHorizonDays,
        maxDrawdownPct
      );

      if (classified) {
        const act: ActionItem = {
          action: classified.action,
          symbol: sym,
          companyName,
          suggestedShares: classified.suggestedShares,
          estimatedPrice: classified.estimatedPrice,
          estimatedAmount: classified.estimatedAmount,
          rationale: classified.rationale,
          urgency: classified.urgency,
          targetPrice: classified.targetPrice,
          stopLossPrice: classified.stopLossPrice,
          riskRewardRatio: classified.riskRewardRatio,
          strategyCategory: classified.strategyCategory,
          strategyCategoryLabel: classified.strategyCategoryLabel,
          strategyCategoryReason: classified.strategyCategoryReason,
          targetTimeHorizonDays: classified.targetTimeHorizonDays,
          targetProfitGoalPct: classified.targetProfitGoalPct,
          goalAttainmentProbability: classified.goalAttainmentProbability,
          certaintyScore: classified.certaintyScore,
          entryZone: classified.entryZone,
          timeStopRule: classified.timeStopRule,
          goalDrivenRationale: classified.goalDrivenRationale,
          expectedPnLAmount: classified.expectedPnLAmount,
          maxRiskAmount: classified.maxRiskAmount,
          isOversoldOpportunity: classified.strategyCategory === "OVERSOLD_BUY",
          oversoldReason: classified.strategyCategoryReason,
        };

        rawActions.push(act);
        if (act.action === "BUY") {
          oversoldOpportunities.push(act);
        }
      }
    }

    const marketOverview = searxngNewsText
      ? `根据 OpenD 官方盘面与全网资讯分析：\n${searxngNewsText.slice(0, 220)}...\n各板块表现分化，已根据限定 ${targetTimeHorizonDays} 日 +${targetProfitGoalPct}% 盈利目标与确定性指数筛选出最优标的。`
      : `根据 OpenD 官方行情，围绕限定 ${targetTimeHorizonDays} 日 +${targetProfitGoalPct}% 盈利目标，精选超跌与大资金流入标的。`;

    return {
      actions: rawActions,
      oversoldOpportunities,
      riskAlerts,
      marketOverview,
    };
  }
}

export const stockEngine = new StockEngine();
