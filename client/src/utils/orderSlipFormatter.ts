export interface OrderSlipParams {
  symbol: string;
  companyName?: string;
  action: "BUY" | "SELL" | "HOLD" | "TRIM";
  actionType?: string;
  suggestedShares?: number;
  estimatedPrice?: number;
  estimatedAmount?: number;
  entryZone?: { min: number; max: number };
  stopLossPrice?: number;
  targetPrice?: number;
  whySummary?: string;
  rationale?: string;
}

export function formatOrderSlipText(params: OrderSlipParams): string {
  const {
    symbol,
    companyName,
    action,
    actionType,
    suggestedShares = 0,
    estimatedPrice = 0,
    estimatedAmount,
    entryZone,
    stopLossPrice,
    targetPrice,
    whySummary,
    rationale,
  } = params;

  const sym = symbol;
  const name = companyName || sym;
  const estVal = estimatedAmount ?? Number((suggestedShares * estimatedPrice).toFixed(2));

  const actionLabel =
    action === "BUY"
      ? actionType === "ADD_POSITION"
        ? "限价加仓 (BUY LIMIT)"
        : "限价建仓 (BUY LIMIT)"
      : action === "TRIM" || action === "SELL"
      ? actionType === "CLOSE_POSITION"
        ? "限价清仓 (SELL LIMIT)"
        : "限价减仓 (SELL LIMIT)"
      : "保持观望 (HOLD)";

  const zoneText = entryZone
    ? `$${entryZone.min.toFixed(2)} ~ $${entryZone.max.toFixed(2)}`
    : `$${estimatedPrice.toFixed(2)}`;

  const slText = stopLossPrice ? `$${stopLossPrice.toFixed(2)}` : "未设";
  const tpText = targetPrice ? `$${targetPrice.toFixed(2)}` : "未设";
  const why = whySummary || rationale || "遵循量化风控纪律";

  return [
    `【券商挂单小抄 · ${sym}】`,
    `标的: ${sym} (${name})`,
    `动作: ${actionLabel}`,
    `建议股数: ${suggestedShares} 股 (预估资金约 $${estVal})`,
    `挂单限价: ${zoneText}`,
    `止损点位: ${slText}`,
    `止盈目标: ${tpText}`,
    `核心理由: ${why}`,
  ].join("\n");
}
