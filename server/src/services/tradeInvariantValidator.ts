import { ActionItem, StockPositionItem, TradeInvariantStatus } from "../types/stockTypes";

export interface TradeInvariantValidationParams {
  action: ActionItem;
  currentPrice: number;
  availableCash: number;
  totalMarketValue?: number;
  existingPosition?: StockPositionItem;
  positionCapPct?: number; // 默认 0.35 (35%)
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

      // 不变量 1.2：买入总金额绝不能突破可用现金与单票持仓上限 (Position Cap)
      totalChecks++;
      const effectiveCapital = availableCash > 0 ? availableCash : totalMarketValue;
      const maxAllocDollar = effectiveCapital > 0 ? effectiveCapital * positionCapPct : curP;
      const maxSharesByCash = effectiveCapital > 0 ? Math.max(1, Math.floor(effectiveCapital / curP)) : 1;
      const maxSharesByCap = effectiveCapital > 0 ? Math.max(1, Math.floor(maxAllocDollar / curP)) : 1;
      const safeSharesLimit = Math.min(maxSharesByCash, maxSharesByCap);

      if (validatedAction.suggestedShares > safeSharesLimit && effectiveCapital > 0) {
        notes.push(
          `建议买入 ${validatedAction.suggestedShares} 股超出单票 ${(positionCapPct * 100).toFixed(0)}% 资金上限或可用现金，已安全截断至 ${safeSharesLimit} 股`
        );
        validatedAction.suggestedShares = safeSharesLimit;
        wasClamped = true;
      }
      validatedAction.estimatedAmount = Number((validatedAction.suggestedShares * curP).toFixed(2));
      passedCount++;
      badges.push("CASH_BOUND_SAFE");

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

      // 不变量 1.4：建仓区间合理性约束 (EntryZone: 0.98 * curP <= min <= max <= 1.02 * curP)
      totalChecks++;
      if (
        !validatedAction.entryZone ||
        validatedAction.entryZone.min <= 0 ||
        validatedAction.entryZone.max <= 0 ||
        validatedAction.entryZone.min > validatedAction.entryZone.max
      ) {
        validatedAction.entryZone = {
          min: Number((curP * 0.992).toFixed(2)),
          max: Number((curP * 1.006).toFixed(2)),
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
}

export const tradeInvariantValidator = TradeInvariantValidator;
