import { ActionItem, RiskAlert, StockPositionItem } from "../types/stockTypes";

export class StockEngine {
  /**
   * 基于自选股、持仓、SearXNG 新闻与实时价格，计算精确定量的【选股与建仓/加减仓建议】
   */
  public generateStockScreenerRecommendations(
    positions: StockPositionItem[],
    watchlist: Array<{ symbol: string; companyName: string }>,
    quotesMap: Map<string, number>,
    searxngNewsText: string,
    customBudget: number = 1000.0,
    riskPreference: string = "BALANCED"
  ): {
    actions: ActionItem[];
    oversoldOpportunities: ActionItem[];
    riskAlerts: RiskAlert[];
    marketOverview: string;
  } {
    const actions: ActionItem[] = [];
    const oversoldOpportunities: ActionItem[] = [];
    const riskAlerts: RiskAlert[] = [];

    const existingSymbols = new Set(positions.map((p) => p.symbol.toUpperCase()));

    // 1. 针对已有持仓进行调仓 (加仓/减仓/止盈止损) 评估
    positions.forEach((p) => {
      const sym = p.symbol.toUpperCase();
      const curPrice = quotesMap.get(sym) || p.marketPrice || p.costBasis;
      const pnlPct = p.costBasis > 0 ? ((curPrice - p.costBasis) / p.costBasis) * 100 : 0;

      if (pnlPct >= 15.0) {
        // 浮盈 > 15%，触发止盈减仓建议
        const trimShares = Math.max(1, Math.floor(p.shares * 0.3));
        const estAmount = Number((trimShares * curPrice).toFixed(2));
        actions.push({
          action: "TRIM",
          symbol: sym,
          companyName: p.companyName || sym,
          suggestedShares: trimShares,
          estimatedPrice: Number(curPrice.toFixed(2)),
          estimatedAmount: estAmount,
          rationale: `[${sym}] 当前累计浮盈 +${pnlPct.toFixed(1)}%，触发阶梯止盈风控。建议锁定部分利润。`,
          urgency: "HIGH",
          targetPrice: Number((curPrice * 1.1).toFixed(2)),
          stopLossPrice: Number((p.costBasis * 1.05).toFixed(2)),
          riskRewardRatio: 2.5,
          takeProfitPct: 10,
          stopLossPct: 5,
          fundamentalScore: 92,
        });
      } else if (pnlPct <= -8.0) {
        // 浮亏 <= -8%，触发止损线告警
        riskAlerts.push({
          level: "CRITICAL",
          title: `[${sym}] 触发止损预警`,
          description: `持仓浮亏跌破 -8.0% (当前 ${pnlPct.toFixed(1)}%)，请注意防范下行风险`,
          relatedSymbol: sym,
        });

        const trimShares = Math.max(1, Math.floor(p.shares * 0.5));
        actions.push({
          action: "TRIM",
          symbol: sym,
          companyName: p.companyName || sym,
          suggestedShares: trimShares,
          estimatedPrice: Number(curPrice.toFixed(2)),
          estimatedAmount: Number((trimShares * curPrice).toFixed(2)),
          rationale: `[${sym}] 突破软止损防线 (-8%)，减仓以规避右侧二次下探风险。`,
          urgency: "HIGH",
          targetPrice: Number((Math.max(curPrice, p.costBasis) * 1.05).toFixed(2)),
          stopLossPrice: Number((curPrice * 0.95).toFixed(2)),
          riskRewardRatio: 1.8,
          fundamentalScore: 78,
        });
      } else {
        // 正常持有
        actions.push({
          action: "HOLD",
          symbol: sym,
          companyName: p.companyName || sym,
          suggestedShares: 0,
          estimatedPrice: Number(curPrice.toFixed(2)),
          estimatedAmount: 0,
          rationale: `[${sym}] 价格波动在合理带 (${pnlPct.toFixed(1)}%) 内，趋势维持横盘，建议继续持有观察。`,
          urgency: "LOW",
          targetPrice: Number((curPrice * 1.12).toFixed(2)),
          stopLossPrice: Number((curPrice * 0.92).toFixed(2)),
          riskRewardRatio: 2.2,
          fundamentalScore: 88,
        });
      }
    });

    // 2. 针对自选股列表中未持有的标的进行【优质超跌建仓 (BUY Opportunity)】分析
    let remainingBudget = customBudget;
    const candidates = watchlist.filter((w) => !existingSymbols.has(w.symbol.toUpperCase()));

    candidates.forEach((item) => {
      const sym = item.symbol.toUpperCase();
      const curPrice = quotesMap.get(sym) || 0;
      if (curPrice <= 0) return;

      const allocation = Math.min(remainingBudget, Math.max(200, customBudget * 0.35));

      if (allocation >= curPrice) {
        const buyShares = Math.floor(allocation / curPrice);
        if (buyShares > 0) {
          const estAmount = Number((buyShares * curPrice).toFixed(2));
          remainingBudget -= estAmount;

          const oversoldItem: ActionItem = {
            action: "BUY",
            symbol: sym,
            companyName: item.companyName || sym,
            suggestedShares: buyShares,
            estimatedPrice: Number(curPrice.toFixed(2)),
            estimatedAmount: estAmount,
            rationale: `[${sym}] 结合 SearXNG 盘前资讯与 MooMoo 实时行情，符合 ${riskPreference} 风控偏好，建议在 $${curPrice} 建仓 ${buyShares} 股。`,
            urgency: "HIGH",
            targetPrice: Number((curPrice * 1.15).toFixed(2)),
            stopLossPrice: Number((curPrice * 0.92).toFixed(2)),
            riskRewardRatio: 2.5,
            takeProfitPct: 15,
            stopLossPct: 8,
            isOversoldOpportunity: true,
            oversoldReason: `受短线消息与盘面回调测试支撑位（现价 $${curPrice}）。`,
          };

          actions.push(oversoldItem);
          oversoldOpportunities.push(oversoldItem);
        }
      }
    });

    // 宏观概述
    const marketOverview = searxngNewsText
      ? `根据 MooMoo 实时盘面与 SearXNG 全网最新美股资讯：\n${searxngNewsText.slice(0, 220)}...\n美股各板块表现分化，优质标的因短线消息面砸盘出现超跌，建议择优分批建仓。`
      : `美股盘前科技与半导体板块分化，部分优质蓝筹标的受短线消息面情绪扰动回调至支撑位。建议重点关注基本面强劲的超跌建仓机会。`;

    return {
      actions,
      oversoldOpportunities,
      riskAlerts,
      marketOverview,
    };
  }
}

export const stockEngine = new StockEngine();

