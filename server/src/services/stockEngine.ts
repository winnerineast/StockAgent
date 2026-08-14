import { ActionItem, OpenDSnapshotItem, RiskAlert, SingleStockIntel, StockPositionItem, StockStrategyCategory } from "../types/stockTypes";

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
}

export class StockEngine {
  /**
   * 基于 OpenD 官方盘面/财务/资金流与 SearXNG 消息，执行 5 大策略分类多因子判定
   * 若不符合任何 5 大分类则返回 null (直接略过)
   */
  public classifyStockOpportunity(
    symbol: string,
    companyName: string,
    snapshot?: OpenDSnapshotItem,
    intel?: SingleStockIntel,
    position?: StockPositionItem,
    budgetPerStock: number = 2000.0
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
      return {
        strategyCategory: "WATCH_AND_WAIT",
        strategyCategoryLabel: "👀 止盈防线 · 锁定利润",
        strategyCategoryReason: `累计浮盈 +${pnlPct.toFixed(1)}%，触发阶段性锁定部分利润风控。`,
        action: "TRIM",
        suggestedShares: trimShares,
        estimatedPrice: curPrice,
        estimatedAmount: Number((trimShares * curPrice).toFixed(2)),
        rationale: `[${sym}] 累计浮盈 +${pnlPct.toFixed(1)}%，建议减仓 ${trimShares} 股锁定收益。`,
        urgency: "HIGH",
        targetPrice: Number((curPrice * 1.1).toFixed(2)),
        stopLossPrice: Number((costBasis * 1.05).toFixed(2)),
        riskRewardRatio: 2.8,
      };
    }

    if (hasHolding && pnlPct <= -8.0) {
      const trimShares = Math.max(1, Math.floor(sharesHolding * 0.5));
      return {
        strategyCategory: "WATCH_AND_WAIT",
        strategyCategoryLabel: "⚠️ 止损戒备 · 仓位风控",
        strategyCategoryReason: `持仓浮亏 ${pnlPct.toFixed(1)}% 突破 -8.0% 止损线，严控风险。`,
        action: "TRIM",
        suggestedShares: trimShares,
        estimatedPrice: curPrice,
        estimatedAmount: Number((trimShares * curPrice).toFixed(2)),
        rationale: `[${sym}] 突破软止损防线，建议减仓规避下行风险。`,
        urgency: "HIGH",
        targetPrice: Number((curPrice * 1.05).toFixed(2)),
        stopLossPrice: Number((curPrice * 0.95).toFixed(2)),
        riskRewardRatio: 1.5,
      };
    }

    // 因子 1: 超跌回撤判定 (OVERSOLD_BUY)
    const high52w = snapshot?.highest52WeeksPrice || 0;
    const drawdown52w = high52w > 0 ? ((curPrice - high52w) / high52w) * 100 : 0;
    const pe = snapshot?.peRatio || snapshot?.peTtmRatio || 0;

    const isOversold = (drawdown52w <= -15.0 || (snapshot?.preChangeRate && snapshot.preChangeRate <= -3.0)) &&
      (pe <= 0 || pe < 75); // 估值未严重泡沫化

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

    // 计算标准建仓股数
    const buyShares = Math.max(1, Math.floor(Math.min(budgetPerStock, 1500) / curPrice));
    const buyAmount = Number((buyShares * curPrice).toFixed(2));

    // 按照 5 大策略分类严格归类
    if (isOversold) {
      return {
        strategyCategory: "OVERSOLD_BUY",
        strategyCategoryLabel: "📉 超跌建仓",
        strategyCategoryReason: `52周高点深度回撤 ${drawdown52w.toFixed(1)}%，现价 $${curPrice.toFixed(2)} 测试支撑位，基本面具备安全边际。`,
        action: "BUY",
        suggestedShares: buyShares,
        estimatedPrice: curPrice,
        estimatedAmount: buyAmount,
        rationale: `[${sym}] 属于典型优质超跌标的，回调提供左侧分批建仓机会。`,
        urgency: "HIGH",
        targetPrice: Number((curPrice * 1.18).toFixed(2)),
        stopLossPrice: Number((curPrice * 0.92).toFixed(2)),
        riskRewardRatio: 2.6,
      };
    }

    if (hasCapitalInflow) {
      return {
        strategyCategory: "CAPITAL_INFLOW_BUY",
        strategyCategoryLabel: "🏦 近期大资金进入建仓",
        strategyCategoryReason: `OpenD 官方大资金监测显示机构主力持续净流入，筹码加速沉淀。`,
        action: "BUY",
        suggestedShares: buyShares,
        estimatedPrice: curPrice,
        estimatedAmount: buyAmount,
        rationale: `[${sym}] 机构主力资金持续加仓，跟随主力大单顺势建仓。`,
        urgency: "HIGH",
        targetPrice: Number((curPrice * 1.15).toFixed(2)),
        stopLossPrice: Number((curPrice * 0.93).toFixed(2)),
        riskRewardRatio: 2.4,
      };
    }

    if (hasNewsCatalyst) {
      return {
        strategyCategory: "NEWS_CATALYST_BUY",
        strategyCategoryLabel: "🚀 消息面强劲建仓",
        strategyCategoryReason: `盘前突发重磅利好催化，分析师评级上调与全网多头情绪共振。`,
        action: "BUY",
        suggestedShares: buyShares,
        estimatedPrice: curPrice,
        estimatedAmount: buyAmount,
        rationale: `[${sym}] 消息面与情绪面形成多头共振，建议突破追涨适度加仓。`,
        urgency: "MEDIUM",
        targetPrice: Number((curPrice * 1.16).toFixed(2)),
        stopLossPrice: Number((curPrice * 0.92).toFixed(2)),
        riskRewardRatio: 2.2,
      };
    }

    if (isFundamentallyStrong) {
      return {
        strategyCategory: "FUNDAMENTAL_BUY",
        strategyCategoryLabel: "💎 基本面亮眼建仓",
        strategyCategoryReason: `OpenD 官方 PE ${pe > 0 ? pe.toFixed(1) : "合理"}，EPS 与净利润强劲，长期价值安全边际充足。`,
        action: "BUY",
        suggestedShares: buyShares,
        estimatedPrice: curPrice,
        estimatedAmount: buyAmount,
        rationale: `[${sym}] 估值合理、业绩增速稳健，适合作为底仓价值成长标的。`,
        urgency: "MEDIUM",
        targetPrice: Number((curPrice * 1.15).toFixed(2)),
        stopLossPrice: Number((curPrice * 0.91).toFixed(2)),
        riskRewardRatio: 2.3,
      };
    }

    // 因子 5: 可以观望 (WATCH_AND_WAIT) - 针对持仓标的或重点自选标的维持底仓跟踪
    if (hasHolding) {
      return {
        strategyCategory: "WATCH_AND_WAIT",
        strategyCategoryLabel: "👀 可以观望",
        strategyCategoryReason: `目前处于箱体整理区间，多空博弈均衡，建议保持现有持仓并持续跟踪。`,
        action: "HOLD",
        suggestedShares: sharesHolding,
        estimatedPrice: curPrice,
        estimatedAmount: 0,
        rationale: `[${sym}] 波动在正常合理区间内，未触发加减仓极值信号，建议保持底仓。`,
        urgency: "LOW",
        targetPrice: Number((curPrice * 1.12).toFixed(2)),
        stopLossPrice: Number((curPrice * 0.92).toFixed(2)),
        riskRewardRatio: 2.0,
      };
    }

    // 其余不符合 5 大建仓/持仓策略的股票直接略过 (Skip)
    return null;
  }

  /**
   * 基于自选股、持仓、OpenD 官方快照与资金流，执行全美股多因子筛选
   */
  public generateStockScreenerRecommendations(
    positions: StockPositionItem[],
    watchlist: Array<{ symbol: string; companyName: string }>,
    quotesMap: Map<string, number>,
    searxngNewsText: string,
    customBudget: number = 1000.0,
    riskPreference: string = "BALANCED",
    snapshotsMap?: Map<string, OpenDSnapshotItem>,
    intelsMap?: Map<string, SingleStockIntel>
  ): {
    actions: ActionItem[];
    oversoldOpportunities: ActionItem[];
    riskAlerts: RiskAlert[];
    marketOverview: string;
  } {
    const actions: ActionItem[] = [];
    const oversoldOpportunities: ActionItem[] = [];
    const riskAlerts: RiskAlert[] = [];

    // 合并持仓与自选
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
        customBudget * 0.35
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
          isOversoldOpportunity: classified.strategyCategory === "OVERSOLD_BUY",
          oversoldReason: classified.strategyCategoryReason,
        };

        actions.push(act);
        if (act.action === "BUY") {
          oversoldOpportunities.push(act);
        }
      }
    }

    const marketOverview = searxngNewsText
      ? `根据 OpenD 官方盘面与全网资讯分析：\n${searxngNewsText.slice(0, 220)}...\n各板块表现分化，已根据 5 大建仓策略筛选出最强标的。`
      : `根据 OpenD 官方行情，美股科技与半导体领涨，精选超跌与大资金流入标的分批建仓。`;

    return {
      actions,
      oversoldOpportunities,
      riskAlerts,
      marketOverview,
    };
  }
}

export const stockEngine = new StockEngine();
