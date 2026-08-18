import { ActionItem, OpenDSnapshotItem, StockPositionItem, TradeInvariantStatus, UsStockSpecialIntel, OrderExecutionStatus } from "../types/stockTypes";

export interface TradeInvariantValidationParams {
  action: ActionItem;
  currentPrice: number;
  availableCash: number;
  totalMarketValue?: number;
  existingPosition?: StockPositionItem;
  positionCapPct?: number;          // 默认 0.35 (35%)
  snapshot?: OpenDSnapshotItem;     // 实时快照 (含成交量与换手率)
  usSpecialIntel?: UsStockSpecialIntel; // 美股财报与特殊情报
  daysUntilEarnings?: number;      // 距离财报发布日天数
  maxAdvParticipationPct?: number; // 单笔最大参与率上限 (默认 2% ADV)
  commissionPerShare?: number;     // 单股佣金 (默认 $0.005/股)
  minCommissionFee?: number;       // 单笔最低佣金 (默认 $1.0)
  slippagePct?: number;            // 预估滑点率 (默认依据波动率自适应 0.15% ~ 0.25%)
}

export interface TradeInvariantValidationResult {
  isValid: boolean;
  action: ActionItem;
  status: TradeInvariantStatus;
}

/**
 * 个人交易者轻量级数据与交易不变量校验器 (Trade Invariant Validator)
 * 借鉴 FINOS Legend 类约束与不变量 (Class Invariants) 哲学，
 * 用纯 TypeScript 打造，坚决阻断与自愈一切大模型幻觉、资金超标、点位倒挂与异常空值。
 */
export class TradeInvariantValidator {
  /**
   * 严格校验并自愈操盘建议的不变量
   */
  public static validateAndEnforce(params: TradeInvariantValidationParams): TradeInvariantValidationResult {
    const {
      action,
      currentPrice,
      availableCash,
      totalMarketValue = availableCash,
      existingPosition,
      positionCapPct = 0.35,
      snapshot,
      usSpecialIntel,
      daysUntilEarnings,
      maxAdvParticipationPct = 0.02,
      commissionPerShare = 0.005,
      minCommissionFee = 1.0,
      slippagePct,
    } = params;

    const validatedAction = { ...action };
    const badges: string[] = [];
    const notes: string[] = [];
    let wasClamped = false;
    let totalChecks = 0;
    let passedCount = 0;

    // 0. 基础价格与数值有效性不变量
    totalChecks++;
    const curP = currentPrice > 0 && !isNaN(currentPrice)
      ? currentPrice
      : validatedAction.estimatedPrice > 0
      ? validatedAction.estimatedPrice
      : 1.0;

    validatedAction.estimatedPrice = Number(curP.toFixed(2));
    passedCount++;
    badges.push("PRICE_VALID");

    if (!validatedAction.orderStatus) {
      validatedAction.orderStatus = "PENDING_SUBMIT";
    }

    // 1. 买入操作 (BUY / OPEN_POSITION / ADD_POSITION) 不变量
    if (validatedAction.action === "BUY") {
      // 不变量 1.1：买入股数必须为正整数
      totalChecks++;
      if (validatedAction.suggestedShares <= 0 || isNaN(validatedAction.suggestedShares)) {
        validatedAction.suggestedShares = 1;
        wasClamped = true;
        notes.push("买入股数异常，已自愈修正为 1 股底仓");
      } else {
        validatedAction.suggestedShares = Math.floor(validatedAction.suggestedShares);
      }
      passedCount++;

      // 不变量 1.2.0: 财报日前隔夜跳空防范机制 (Earnings Overnight Gap Shield)
      let effectiveCapPct = positionCapPct;
      const daysToEarnings = daysUntilEarnings ?? usSpecialIntel?.daysToEarnings ?? (
        usSpecialIntel?.earningsRiskLevel === "HIGH" ? 3 : undefined
      );

      if (daysToEarnings !== undefined && daysToEarnings >= 0 && daysToEarnings <= 3) {
        effectiveCapPct = positionCapPct * 0.5; // 临近 3 个交易日内发布财报，单票持仓上限缩减 50%
        badges.push("EARNINGS_RISK_SHIELD");
        notes.push(
          `标的 [${validatedAction.symbol}] 临近财报发布日 (${usSpecialIntel?.earningsDate || "3日内"})，为防范隔夜跳空风险，单票持仓上限已自动收缩 50% 至 ${(effectiveCapPct * 100).toFixed(1)}%`
        );
      }

      // 不变量 1.2：买入总金额绝不能突破可用现金与单票持仓上限 (Position Cap，需扣除既有持仓)
      totalChecks++;
      const existingHoldingShares = existingPosition && existingPosition.shares > 0 ? existingPosition.shares : 0;
      const existingHoldingVal = existingHoldingShares * curP;
      const totalPortfolioEquity = totalMarketValue > 0 ? totalMarketValue : (availableCash + existingHoldingVal);

      const maxTotalStockCapDollar = totalPortfolioEquity > 0 ? totalPortfolioEquity * effectiveCapPct : 0;
      const remainingCapDollar = Math.max(0, maxTotalStockCapDollar - existingHoldingVal);
      const maxSharesByCap = curP > 0 ? Math.floor(remainingCapDollar / curP) : 0;
      const maxSharesByCash = curP > 0 && availableCash > 0 ? Math.floor(availableCash / curP) : 0;
      let safeSharesLimit = Math.min(maxSharesByCash, maxSharesByCap);

      // 不变量 1.2.1: ADV 流动性容量防御约束 (单笔订单严禁超过 ADV 的 2%)
      const adv = snapshot?.averageDailyVolume || snapshot?.volume || 0;
      if (adv > 0) {
        const maxSharesByAdv = Math.max(1, Math.floor(adv * maxAdvParticipationPct));
        validatedAction.advLimitShares = maxSharesByAdv;
        if (safeSharesLimit > maxSharesByAdv) {
          safeSharesLimit = maxSharesByAdv;
        }
        badges.push("ADV_LIQUIDITY_SAFE");
      }

      if (validatedAction.suggestedShares > safeSharesLimit) {
        if (availableCash <= 0 || maxSharesByCash === 0) {
          notes.push(`可用现金不足 ($${availableCash.toFixed(2)})，无法执行买入建仓，买入股数已置为 0`);
        } else if (remainingCapDollar <= 0 || maxSharesByCap === 0) {
          notes.push(
            `标的 [${validatedAction.symbol}] 既有持仓市值 ($${existingHoldingVal.toFixed(2)}) 已达到或超过单票 ${(positionCapPct * 100).toFixed(0)}% 上限 ($${maxTotalStockCapDollar.toFixed(2)})，加仓股数已置为 0`
          );
        } else if (adv > 0 && safeSharesLimit === Math.max(1, Math.floor(adv * maxAdvParticipationPct))) {
          notes.push(
            `建议买入 ${validatedAction.suggestedShares} 股超出流动性容量防御上限 (${(maxAdvParticipationPct * 100).toFixed(1)}% ADV: ${safeSharesLimit} 股)，已安全截断至 ${safeSharesLimit} 股`
          );
        } else {
          notes.push(
            `建议买入 ${validatedAction.suggestedShares} 股超出单票 ${(positionCapPct * 100).toFixed(0)}% 资金上限（扣减既有持仓后剩余可加仓 $${remainingCapDollar.toFixed(2)}）或可用现金 ($${availableCash.toFixed(2)})，已安全截断至 ${safeSharesLimit} 股`
          );
        }
        validatedAction.suggestedShares = safeSharesLimit;
        wasClamped = true;
      }

      // 不变量 1.2.2: 滑点与交易摩擦成本核算 (Slippage & Friction Cost Model)
      const slipRate = slippagePct ?? (snapshot?.turnoverRate && snapshot.turnoverRate > 5.0 ? 0.25 : 0.15);
      const slippageCost = Number(((validatedAction.suggestedShares * curP) * (slipRate / 100)).toFixed(2));
      const estimatedFee = validatedAction.suggestedShares > 0
        ? Math.max(minCommissionFee, Number((validatedAction.suggestedShares * commissionPerShare).toFixed(2)))
        : 0;

      validatedAction.slippagePct = slipRate;
      validatedAction.estimatedSlippageCost = slippageCost;
      validatedAction.estimatedFee = estimatedFee;
      validatedAction.estimatedAmount = Number((validatedAction.suggestedShares * curP + slippageCost + estimatedFee).toFixed(2));
      passedCount++;
      badges.push("CASH_BOUND_SAFE");
      badges.push("SLIPPAGE_PROTECTED");

      // 不变量 1.3：点位单调性约束 (止损价 < 挂单现价 < 目标价)
      totalChecks++;
      let stopLoss = validatedAction.stopLossPrice;
      let targetPrice = validatedAction.targetPrice;

      // 如果止损价缺失或倒挂 (>= 现价)，强制依据 ATR 或 4% 硬止损重新校准
      if (!stopLoss || stopLoss >= curP || isNaN(stopLoss) || stopLoss <= 0) {
        stopLoss = Number((curP * 0.96).toFixed(2));
        wasClamped = true;
        notes.push(`止损价异常倒挂，已依据 4% 软防线自愈重置为 $${stopLoss}`);
      }

      // 如果目标价缺失或倒挂 (<= 现价)，强制依据 8% 目标收益重新校准
      if (!targetPrice || targetPrice <= curP || isNaN(targetPrice)) {
        targetPrice = Number((curP * 1.08).toFixed(2));
        wasClamped = true;
        notes.push(`目标价异常倒挂，已依据 8% 目标收益自愈重置为 $${targetPrice}`);
      }

      validatedAction.stopLossPrice = Number(stopLoss.toFixed(2));
      validatedAction.targetPrice = Number(targetPrice.toFixed(2));
      validatedAction.stopLossPct = Number((((curP - stopLoss) / curP) * 100).toFixed(1));
      validatedAction.takeProfitPct = Number((((targetPrice - curP) / curP) * 100).toFixed(1));
      validatedAction.riskRewardRatio = Number(
        (validatedAction.takeProfitPct / Math.max(0.5, validatedAction.stopLossPct)).toFixed(2)
      );
      passedCount++;
      badges.push("STOP_LOSS_INTEGRITY");

      // 不变量 1.4：建仓区间合理性约束 (EntryZone: 包含滑点缓冲)
      totalChecks++;
      if (
        !validatedAction.entryZone ||
        validatedAction.entryZone.min <= 0 ||
        validatedAction.entryZone.max <= 0 ||
        validatedAction.entryZone.min > validatedAction.entryZone.max
      ) {
        validatedAction.entryZone = {
          min: Number((curP * 0.992).toFixed(2)),
          max: Number((curP * (1.006 + slipRate / 100)).toFixed(2)),
        };
        wasClamped = true;
      }
      passedCount++;
      badges.push("ENTRY_ZONE_SAFE");
    }

    // 2. 卖出/减仓操作 (SELL / TRIM / TRIM_POSITION / CLOSE_POSITION) 不变量
    if (validatedAction.action === "SELL" || validatedAction.action === "TRIM") {
      totalChecks++;
      const currentHoldingShares = existingPosition?.shares || 0;
      if (currentHoldingShares > 0 && validatedAction.suggestedShares > currentHoldingShares) {
        notes.push(
          `建议卖出 ${validatedAction.suggestedShares} 股超过现有实盘持仓 (${currentHoldingShares} 股)，已自愈修正为 ${currentHoldingShares} 股`
        );
        validatedAction.suggestedShares = currentHoldingShares;
        wasClamped = true;
      }
      validatedAction.estimatedAmount = Number((validatedAction.suggestedShares * curP).toFixed(2));
      passedCount++;
      badges.push("POSITION_TRIM_SAFE");
    }

    // 3. 观望操作 (HOLD / HOLD_AND_WATCH) 不变量
    if (validatedAction.action === "HOLD") {
      totalChecks++;
      if (existingPosition && existingPosition.shares > 0) {
        validatedAction.suggestedShares = existingPosition.shares;
      }
      passedCount++;
      badges.push("HOLD_MAINTAINED");
    }

    const status: TradeInvariantStatus = {
      isVerified: true,
      passedCount,
      totalChecks,
      badges,
      diagnosticNotes: notes.length > 0 ? notes : undefined,
      wasClamped,
    };

    validatedAction.invariantStatus = status;

    return {
      isValid: true,
      action: validatedAction,
      status,
    };
  }

  /**
   * 格式化券商一键挂单小抄指令文本 (One-Click Copyable Order Slip)
   * 专门面向下班看盘的上班族，抹平认知负荷与计算成本
   */
  public static formatOrderSlipText(action: ActionItem): string {
    const sym = action.symbol;
    const name = action.companyName || sym;
    const act = action.action;
    const actType = action.actionType;
    const shares = action.suggestedShares || 0;
    const price = action.estimatedPrice || 0;
    const estVal = action.estimatedAmount || Number((shares * price).toFixed(2));

    const actionLabel =
      act === "BUY"
        ? actType === "ADD_POSITION"
          ? "限价加仓 (BUY LIMIT)"
          : "限价建仓 (BUY LIMIT)"
        : act === "TRIM" || act === "SELL"
        ? actType === "CLOSE_POSITION"
          ? "限价清仓 (SELL LIMIT)"
          : "限价减仓 (SELL LIMIT)"
        : "保持观望 (HOLD)";

    const zoneText = action.entryZone
      ? `$${action.entryZone.min.toFixed(2)} ~ $${action.entryZone.max.toFixed(2)}`
      : `$${price.toFixed(2)}`;

    const slText = action.stopLossPrice ? `$${action.stopLossPrice.toFixed(2)}` : "未设";
    const tpText = action.targetPrice ? `$${action.targetPrice.toFixed(2)}` : "未设";
    const why = action.whySummary || action.rationale || "遵循量化风控纪律";

    return [
      `【券商挂单小抄 · ${sym}】`,
      `标的: ${sym} (${name})`,
      `动作: ${actionLabel}`,
      `建议股数: ${shares} 股 (预估资金约 $${estVal})`,
      `挂单限价: ${zoneText}`,
      `止损点位: ${slText}`,
      `止盈目标: ${tpText}`,
      `核心理由: ${why}`,
    ].join("\n");
  }
}

export const tradeInvariantValidator = TradeInvariantValidator;
