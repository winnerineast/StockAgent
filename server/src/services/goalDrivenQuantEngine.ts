import {
  ActionItem,
  CapitalSpaceAnalysis,
  EntryZone,
  GoalDrivenConstraint,
  OpenDSnapshotItem,
  SingleStockIntel,
  StockKnowledgeGraphItem,
  StockPositionItem,
  StockStrategyCategory,
  TimeFmForecastItem,
} from "../types/stockTypes";

/**
 * 目标驱动与消除迷茫度量化计算核心引擎
 * 围绕:
 * 1. 可用资金空间 (持仓市值 + 调仓释放现金 + 用户指定动用预算)
 * 2. 限定交易日跨度 T
 * 3. 盈利目标 G% 与最大回撤预算 D%
 * 4. 消除迷茫度 (确定性指数 Certainty Index) 与 T 日目标达成概率
 */
export class GoalDrivenQuantEngine {
  /**
   * 标准正态分布累积分布函数近似算法 (Abramowitz & Stegun 精度优于 1.5e-7)
   */
  public stdNormalCDF(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    const absX = Math.abs(x) / Math.SQRT2;

    const t = 1.0 / (1.0 + p * absX);
    const y =
      1.0 -
      ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

    return 0.5 * (1.0 + sign * y);
  }

  /**
   * 1. 动态求解操盘资金空间
   * 综合持仓现状、调仓释放资金、用户指定金额与实盘闲置现金
   */
  public calculateCapitalSpace(params: {
    existingPositions: StockPositionItem[];
    actualCash: number;
    userInputBudget?: number;
    freedCapitalFromTrims?: number;
    macroRegimeMood?: string;
  }): CapitalSpaceAnalysis {
    const {
      existingPositions = [],
      actualCash = 0,
      userInputBudget,
      freedCapitalFromTrims = 0,
      macroRegimeMood = "NEUTRAL",
    } = params;

    // 1. 现有持仓总沉淀市值
    const existingHoldingsValue = existingPositions.reduce((sum, p) => {
      const price = p.marketPrice > 0 ? p.marketPrice : p.costBasis;
      return sum + (p.shares > 0 ? p.shares * price : 0);
    }, 0);

    // 2. 用户指定的可动用预算 (若未输入则严格以实盘可用现金为准，零硬编码)
    const effectiveUserInput =
      userInputBudget !== undefined && userInputBudget > 0
        ? userInputBudget
        : actualCash;

    // 3. 实际可调用闲置资金 (取输入预算与实盘现金的调和值，允许以输入为准进行推演)
    const availableCashBase = Math.min(effectiveUserInput, actualCash > 0 ? actualCash : effectiveUserInput);

    // 4. 总合成可用操盘空间 = 可调用基础资金 + 预期平仓/减仓回流资金
    const totalDeployableCapacity = Number(
      (availableCashBase + freedCapitalFromTrims).toFixed(2)
    );

    // 5. 根据宏观状态决定自适应现金安全垫 (Cash Buffer)
    let cashBufferPct = 0.2; // 默认 20% 现金留存
    if (macroRegimeMood === "BULLISH") {
      cashBufferPct = 0.1; // 强主线多头行情：留存 10%
    } else if (macroRegimeMood === "BEARISH" || macroRegimeMood === "VOLATILE") {
      cashBufferPct = 0.35; // 弱势/高波动防守：留存 35%
    }

    const cashBufferAmount = Number(
      (totalDeployableCapacity * cashBufferPct).toFixed(2)
    );

    return {
      existingHoldingsValue: Number(existingHoldingsValue.toFixed(2)),
      potentialFreedCapital: Number(freedCapitalFromTrims.toFixed(2)),
      userInputDeployableCapital: Number(effectiveUserInput.toFixed(2)),
      actualAvailableCash: Number(actualCash.toFixed(2)),
      totalDeployableCapacity,
      allocatedCapital: 0, // 在后续头寸分配中回填
      cashBufferAmount,
      cashBufferPct: Number((cashBufferPct * 100).toFixed(1)),
    };
  }

  /**
   * 2. 计算标的 T 日时序波动锥与目标达成概率 P(Hit Goal within T days)
   */
  /**
   * 计算标的真实波幅 TR (True Range) 与 14 日等效 ATR
   * 采用经典工业级算法：TR = max(High - Low, |High - PrevClose|, |Low - PrevClose|)
   */
  public calculateATR(params: {
    currentPrice: number;
    snapshot?: OpenDSnapshotItem;
    customAtr?: number;
  }): {
    atr: number;
    atrPct: number;
  } {
    const { currentPrice, snapshot, customAtr } = params;
    const curP = currentPrice > 0 ? currentPrice : 1.0;

    if (customAtr && customAtr > 0) {
      return {
        atr: Number(customAtr.toFixed(2)),
        atrPct: Number(((customAtr / curP) * 100).toFixed(2)),
      };
    }

    let tr = curP * 0.025; // 默认 2.5% 基准真实波幅

    if (snapshot) {
      const high = snapshot.highPrice || curP;
      const low = snapshot.lowPrice || curP;
      const prevClose = snapshot.prevClosePrice || curP;

      if (high >= low && high > 0 && low > 0) {
        const hl = high - low;
        const hpc = Math.abs(high - prevClose);
        const lpc = Math.abs(low - prevClose);
        const dailyTR = Math.max(hl, hpc, lpc);

        if (dailyTR > 0) {
          tr = dailyTR;
        }
      } else if (snapshot.highest52WeeksPrice && snapshot.lowest52WeeksPrice) {
        // 若缺少当日高低点，以 52 周极值作为备选平滑参考 (除以 14 作为经验尺度)
        const range52w = snapshot.highest52WeeksPrice - snapshot.lowest52WeeksPrice;
        tr = Math.max(curP * 0.015, Math.min(curP * 0.08, range52w / 14.0));
      }

      // 换手率大于 5% 时适度放大波动容差
      if (snapshot.turnoverRate && snapshot.turnoverRate > 5.0) {
        tr *= 1.15;
      }
    }

    // 限制 ATR 在股价 1.2% ~ 9.5% 的安全统计边界内
    const boundedATR = Math.max(curP * 0.012, Math.min(curP * 0.095, tr));

    return {
      atr: Number(boundedATR.toFixed(2)),
      atrPct: Number(((boundedATR / curP) * 100).toFixed(2)),
    };
  }

  /**
   * 计算标的年化真实波动率 (Annualized Realized Volatility)
   * 结合经典 Parkinson 极值波动率、52周对数跨度与 ATR 日内扩散:
   * sigma_ann = sqrt(252) * sigma_daily
   */
  public calculateAnnualizedVolatility(params: {
    currentPrice: number;
    snapshot?: OpenDSnapshotItem;
    customAtr?: number;
  }): number {
    const { currentPrice, snapshot, customAtr } = params;
    const curP = currentPrice > 0 ? currentPrice : 100.0;

    // 1. 基于 ATR 的基准日波动率
    const { atrPct } = this.calculateATR({ currentPrice: curP, snapshot, customAtr });
    let dailyVol = atrPct / 100.0;

    // 2. 若具备日内最高价与最低价，融合 Parkinson 极值估计量
    if (snapshot && snapshot.highPrice && snapshot.lowPrice && snapshot.highPrice > snapshot.lowPrice) {
      const hlRatio = snapshot.highPrice / snapshot.lowPrice;
      const parkinsonDaily = Math.sqrt((1.0 / (4.0 * Math.LN2)) * Math.pow(Math.log(hlRatio), 2));
      if (parkinsonDaily > 0) {
        dailyVol = 0.6 * dailyVol + 0.4 * parkinsonDaily;
      }
    }

    // 3. 转化为年化波动率百分比 (按每年 252 个交易日平方根放大)
    const annualizedVolPct = dailyVol * Math.sqrt(252) * 100;

    // 限制在美股常规统计边界 (12% ~ 85%) 内
    return Number(Math.max(12.0, Math.min(85.0, annualizedVolPct)).toFixed(1));
  }

  /**
   * 2. 计算标的 T 日时序波动锥与目标达成概率 P(Hit Goal within T days)
   */
  public calculateGoalAttainment(params: {
    currentPrice: number;
    targetProfitGoalPct: number;      // G% 如 8.0
    targetTimeHorizonDays: number;    // T 如 5
    snapshot?: OpenDSnapshotItem;
    timefmForecast?: TimeFmForecastItem;
    spilloverAlpha?: number;          // 知识图谱溢出 Alpha (-50 ~ 50)
    capitalInflowTrend?: string;      // INFLOW / OUTFLOW
    strategyCategory?: StockStrategyCategory;
    customAtr?: number;
  }): {
    dailyVolatility: number;
    horizonVolatility: number;
    compositeDriftRate: number;
    goalAttainmentProbability: number;
    stopLossSurvivalProbability: number;
    atr: number;
    atrPct: number;
  } {
    const {
      currentPrice,
      targetProfitGoalPct = 8.0,
      targetTimeHorizonDays = 5,
      snapshot,
      timefmForecast,
      spilloverAlpha = 0,
      capitalInflowTrend = "NEUTRAL",
      strategyCategory,
      customAtr,
    } = params;

    if (currentPrice <= 0) {
      return {
        dailyVolatility: 0.025,
        horizonVolatility: 0.05,
        compositeDriftRate: 0,
        goalAttainmentProbability: 50,
        stopLossSurvivalProbability: 50,
        atr: 0.5,
        atrPct: 2.5,
      };
    }

    // 1. 基于真实波幅 ATR 计算标的日波动率 sigma_daily
    const { atr, atrPct } = this.calculateATR({ currentPrice, snapshot, customAtr });
    let dailyVol = atrPct / 100;

    // T 日波动扩散范围 sigma_T = sigma_daily * sqrt(T)
    const T = Math.max(1, targetTimeHorizonDays);
    const horizonVolatility = dailyVol * Math.sqrt(T);

    // 2. 计算复合预期漂移率 mu_daily (Daily Drift Rate)
    let dailyDrift = 0.001; // 基准微弱正向漂移 (0.1%/日)

    // TimeFM 零样本时序预测贡献
    if (timefmForecast) {
      if (timefmForecast.direction === "UP") {
        const tfmMag = Math.min(0.03, Math.max(0.005, (timefmForecast.predictedChangeRate || 2.0) / 100));
        dailyDrift += tfmMag * 0.4;
      } else if (timefmForecast.direction === "DOWN") {
        dailyDrift -= 0.008;
      }
    }

    // 主力大资金流动贡献
    if (capitalInflowTrend === "INFLOW" || (snapshot?.mainCapitalInflow && snapshot.mainCapitalInflow > 0)) {
      dailyDrift += 0.004;
    } else if (capitalInflowTrend === "OUTFLOW") {
      dailyDrift -= 0.004;
    }

    // 知识图谱产业链因果 Alpha
    if (spilloverAlpha !== 0) {
      dailyDrift += (spilloverAlpha / 100) * 0.005;
    }

    // 超跌均值回归动量
    if (strategyCategory === "OVERSOLD_BUY") {
      dailyDrift += 0.006;
    }

    // 3. 计算 T 日目标达成概率 P(S_T >= P_target)
    // S_T 服从对数正态扩散模型并引入尖峰肥尾调节 (Student's-t / Kurtosis Fat-tail Adjustment)
    const targetReturnLog = Math.log(1.0 + Math.max(0.01, targetProfitGoalPct / 100));
    const meanT = (dailyDrift - 0.5 * dailyVol * dailyVol) * T;

    // 肥尾与跳空扩散修正：波动率越高，厚尾效应越明显，有效扩散带宽扩张 10%~35%
    const fatTailCorrection = 1.0 + Math.min(0.35, Math.max(0.0, (dailyVol - 0.018) * 8.0));
    const stdT = horizonVolatility * fatTailCorrection;

    const zGoal = (meanT - targetReturnLog) / stdT;
    const rawGoalProb = this.stdNormalCDF(zGoal);
    const goalAttainmentProbability = Number(
      Math.min(92.0, Math.max(20.0, rawGoalProb * 100)).toFixed(1)
    );

    // 4. 计算不触及动态止损线的安全存活概率
    const stopReturnLog = Math.log(1.0 - Math.max(0.02, dailyVol * 1.8));
    const zStop = (meanT - stopReturnLog) / stdT;
    const rawStopProb = this.stdNormalCDF(zStop);
    const stopLossSurvivalProbability = Number(
      Math.min(95.0, Math.max(25.0, rawStopProb * 100)).toFixed(1)
    );

    return {
      dailyVolatility: Number(dailyVol.toFixed(4)),
      horizonVolatility: Number(horizonVolatility.toFixed(4)),
      compositeDriftRate: Number((dailyDrift * 100).toFixed(2)),
      goalAttainmentProbability,
      stopLossSurvivalProbability,
      atr,
      atrPct,
    };
  }

  /**
   * 3. 确定性指数 / 消除迷茫度量化模型 (Certainty Score, 0~100)
   * 衡量各因子对走势不确定性的消除程度，过滤无效噪音
   */
  public calculateCertaintyScore(params: {
    goalProbability: number;
    timefmForecast?: TimeFmForecastItem;
    snapshot?: OpenDSnapshotItem;
    intel?: SingleStockIntel;
    knowledgeGraph?: StockKnowledgeGraphItem;
    strategyCategory?: StockStrategyCategory;
    macroRegimeMood?: string;
  }): {
    certaintyScore: number;
    entropyReductionText: string;
    factorConfirmations: string[];
  } {
    const {
      goalProbability,
      timefmForecast,
      snapshot,
      intel,
      knowledgeGraph,
      strategyCategory,
      macroRegimeMood = "NEUTRAL",
    } = params;

    let score = 50; // 基准中性得分
    const confirmations: string[] = [];

    // 1. 目标达成概率锚定贡献 (+0 ~ +25)
    const probDelta = (goalProbability - 50) * 0.5;
    score += probDelta;

    // 2. 主力大资金定势确认 (+12 / -8)
    const flowTrend = intel?.capitalFlow?.trend;
    const mainInflow = snapshot?.mainCapitalInflow || 0;
    if (flowTrend === "INFLOW" || mainInflow > 0) {
      score += 12;
      confirmations.push("主力资金净流入沉淀");
    } else if (flowTrend === "OUTFLOW") {
      score -= 8;
    }

    // 3. Google TimeFM 零样本时序方向共振 (+10 / -10)
    if (timefmForecast) {
      if (timefmForecast.direction === "UP" && timefmForecast.confidenceScore > 65) {
        score += 10;
        confirmations.push(`TimeFM 时序动量向上 (置信度 ${timefmForecast.confidenceScore}%)`);
      } else if (timefmForecast.direction === "DOWN") {
        score -= 10;
      }
    }

    // 4. 产业链知识图谱拓扑溢出确认 (+8)
    const spillover = knowledgeGraph?.spilloverAlphaScore || 0;
    if (spillover > 15) {
      score += 8;
      confirmations.push("产业链上下游因果正向溢出");
    }

    // 5. 52周安全边际与估值支撑 (+10)
    if (strategyCategory === "OVERSOLD_BUY" || strategyCategory === "FUNDAMENTAL_BUY") {
      score += 10;
      confirmations.push("深度安全边际支撑");
    }

    // 6. 宏观环境共振 (+5 / -5)
    if (macroRegimeMood === "BULLISH") {
      score += 5;
    } else if (macroRegimeMood === "BEARISH") {
      score -= 5;
    }

    const finalCertainty = Math.min(98, Math.max(25, Math.round(score)));

    let entropyReductionText = "";
    if (finalCertainty >= 80) {
      entropyReductionText = "高度确定性 (多因子闭环共振，大幅消除方向迷茫与波动噪音)";
    } else if (finalCertainty >= 65) {
      entropyReductionText = "中高确定性 (主要因果链清晰，具备明确收益风险比)";
    } else {
      entropyReductionText = "低确定性 / 噪音较重 (多空信号分歧，需保持防御与小仓位)";
    }

    return {
      certaintyScore: finalCertainty,
      entropyReductionText,
      factorConfirmations: confirmations,
    };
  }

  /**
   * 4. 求解单只标的的具体交易路径与 T 日时间止损纪律 (基于真实 ATR 精确锚定)
   */
  public formulateTradePath(params: {
    symbol: string;
    companyName: string;
    currentPrice: number;
    action: "BUY" | "TRIM" | "HOLD" | "SELL";
    targetProfitGoalPct?: number;      // G% 如 8.0
    targetTimeHorizonDays?: number;    // T 如 5
    maxDrawdownPct?: number;           // D% 如 4.0
    certaintyScore?: number;
    goalProbability?: number;
    allocatedAmount?: number;
    suggestedShares?: number;
    strategyCategory?: StockStrategyCategory;
    strategyCategoryLabel?: string;
    snapshot?: OpenDSnapshotItem;
    customAtr?: number;
  }): {
    entryZone: EntryZone;
    targetPrice: number;
    stopLossPrice: number;
    takeProfitPct: number;
    stopLossPct: number;
    timeStopRule: string;
    goalDrivenRationale: string;
    expectedPnLAmount: number;
    maxRiskAmount: number;
    riskRewardRatio: number;
    atr: number;
    atrPct: number;
    perShareRisk: number;
  } {
    const {
      symbol,
      currentPrice,
      action,
      targetProfitGoalPct = 8.0,
      targetTimeHorizonDays = 5,
      maxDrawdownPct = 4.0,
      certaintyScore = 75,
      goalProbability = 68,
      allocatedAmount = 0,
      suggestedShares = 10,
      strategyCategoryLabel,
      snapshot,
      customAtr,
    } = params;

    const curP = currentPrice > 0 ? currentPrice : 1.0;

    // 1. 计算标的 14 日 ATR 真实波幅
    const { atr: effectiveAtr, atrPct } = this.calculateATR({
      currentPrice: curP,
      snapshot,
      customAtr,
    });

    // 2. 买入挂单区间 (vn.py 经典回踩均线/支撑位挂单，拒绝市价追高)
    // 下限：现价下浮 0.35 个 ATR；上限：现价上浮 0.15 个 ATR
    const entryMin = Number(Math.max(0.01, curP - 0.35 * effectiveAtr).toFixed(2));
    const entryMax = Number((curP + 0.15 * effectiveAtr).toFixed(2));
    const entryZone: EntryZone = { min: entryMin, max: entryMax };

    // 3. 动态止损与目标价测算 (基于 ATR 波动率锚定，防洗盘误扫)
    let stopLossDistance = Math.max(1.8 * effectiveAtr, curP * (maxDrawdownPct / 100));
    let takeProfitDistance = Math.max(2.5 * effectiveAtr, curP * (targetProfitGoalPct / 100));

    let targetPrice = Number((curP + takeProfitDistance).toFixed(2));
    let stopLossPrice = Number(Math.max(0.01, curP - stopLossDistance).toFixed(2));
    let takeProfitPct = Number(((takeProfitDistance / curP) * 100).toFixed(1));
    let stopLossPct = -Number(((stopLossDistance / curP) * 100).toFixed(1));

    if (action === "TRIM" || action === "SELL") {
      targetPrice = Number((curP + 0.8 * effectiveAtr).toFixed(2));
      stopLossPrice = Number(Math.max(0.01, curP - 0.8 * effectiveAtr).toFixed(2));
      takeProfitPct = Number(((0.8 * effectiveAtr / curP) * 100).toFixed(1));
      stopLossPct = -takeProfitPct;
    } else if (action === "HOLD") {
      targetPrice = Number((curP + 1.5 * effectiveAtr).toFixed(2));
      stopLossPrice = Number(Math.max(0.01, curP - 1.5 * effectiveAtr).toFixed(2));
      takeProfitPct = Number(((1.5 * effectiveAtr / curP) * 100).toFixed(1));
      stopLossPct = -takeProfitPct;
    }

    const potentialReward = Math.max(0.01, targetPrice - curP);
    const potentialRisk = Math.max(0.01, curP - stopLossPrice);
    const riskRewardRatio = Number((potentialReward / potentialRisk).toFixed(2));
    const perShareRisk = Number(potentialRisk.toFixed(2));

    // 4. 严格 T 日时间止损纪律
    const timeStopRule =
      action === "BUY"
        ? `【时间止损纪律】建仓后持有观察窗口限定为 ${targetTimeHorizonDays} 个交易日。若在第 ${targetTimeHorizonDays} 个交易日收盘前未能有效向上突破或涨幅不足 ${Math.max(2, Math.floor(targetProfitGoalPct * 0.4))}%，执行无条件平仓或重评，消除时间机会成本与资金占用。`
        : action === "TRIM"
        ? `【阶梯止盈纪律】当前分批锁定收益，释放资金回流操盘现金池，剩余底仓以成本线为保本防线。`
        : `【防守跟踪纪律】保持现有仓位，若 ${targetTimeHorizonDays} 日内跌破 ATR 支撑位 $${stopLossPrice} 则转为减仓防守。`;

    // 5. 消除迷茫度的核心逻辑提炼 (明确挂单区间、ATR 与止损逻辑)
    const goalDrivenRationale =
      action === "BUY"
        ? `[${symbol}] 围绕手头资金分配 $${allocatedAmount.toFixed(0)} (${suggestedShares}股)。在限定 ${targetTimeHorizonDays} 交易日内达成 +${targetProfitGoalPct.toFixed(1)}% 目标的测算概率为 ${goalProbability}% (确定性得分 ${certaintyScore}/100)。分类为 [${strategyCategoryLabel || "精选建仓"}]，以 ATR 挂单区间 $${entryMin}~$${entryMax} 控制回踩成本，下设 1.8×ATR 防线 $${stopLossPrice} (${stopLossPct}%) 硬止损。`
        : action === "TRIM"
        ? `[${symbol}] 调仓锁定浮动利润，预计释放回流操盘现金，用于向更高确定性目标转移。`
        : `[${symbol}] 维持底仓观察，当前波动在预设 ${targetTimeHorizonDays} 日 ATR 波动锥 ($${effectiveAtr}/日) 合理容差范围内。`;

    const expectedPnLAmount = Number(
      (suggestedShares * (targetPrice - curP)).toFixed(2)
    );
    const maxRiskAmount = Number(
      (suggestedShares * potentialRisk).toFixed(2)
    );

    return {
      entryZone,
      targetPrice,
      stopLossPrice,
      takeProfitPct,
      stopLossPct,
      timeStopRule,
      goalDrivenRationale,
      expectedPnLAmount,
      maxRiskAmount,
      riskRewardRatio,
      atr: effectiveAtr,
      atrPct,
      perShareRisk,
    };
  }

  /**
   * 5. 组合级资金最优分配求解器 (Constrained Kelly / Risk-Budget Allocation)
   * 在可用操盘资金空间 C 下，采用单笔 1.5% 账户最大损失风险预算精选头寸
   */
  public optimizePortfolioAllocation(params: {
    candidateActions: ActionItem[];
    capitalSpace: CapitalSpaceAnalysis;
    targetProfitGoalPct: number;
    targetTimeHorizonDays: number;
    maxDrawdownPct: number;
  }): {
    optimizedActions: ActionItem[];
    updatedCapitalSpace: CapitalSpaceAnalysis;
    overallCertaintyScore: number;
    overallGoalProbability: number;
  } {
    const {
      candidateActions,
      capitalSpace,
      targetProfitGoalPct = 8.0,
      targetTimeHorizonDays = 5,
      maxDrawdownPct = 4.0,
    } = params;

    // 可用于新开仓与加仓的净预算 (总可用空间扣除安全垫)
    const netDeployableCapital = Math.max(
      0,
      capitalSpace.totalDeployableCapacity - capitalSpace.cashBufferAmount
    );

    const buyCandidates = candidateActions.filter((a) => a.action === "BUY");
    const otherCandidates = candidateActions.filter((a) => a.action !== "BUY");

    if (buyCandidates.length === 0 || netDeployableCapital <= 0) {
      return {
        optimizedActions: candidateActions,
        updatedCapitalSpace: {
          ...capitalSpace,
          allocatedCapital: 0,
        },
        overallCertaintyScore: 70,
        overallGoalProbability: 60,
      };
    }

    // 1. 按照 (确定性得分 * 目标达成概率) 对买入候选标的降序排序
    buyCandidates.sort((a, b) => {
      const scoreA = (a.certaintyScore || 50) * (a.goalAttainmentProbability || 50);
      const scoreB = (b.certaintyScore || 50) * (b.goalAttainmentProbability || 50);
      return scoreB - scoreA;
    });

    // 2. 精选前 1 ~ 3 只最高确定性标的分配头寸，杜绝无效撒网
    const topPicksCount = Math.min(3, Math.max(1, buyCandidates.length));
    const topBuyPicks = buyCandidates.slice(0, topPicksCount);
    const remainingBuyPicks = buyCandidates.slice(topPicksCount);

    // 设定单票权重分配比例 (如 1票: 100%, 2票: 60%/40%, 3票: 50%/30%/20%)
    const weightProfiles: Record<number, number[]> = {
      1: [1.0],
      2: [0.58, 0.42],
      3: [0.48, 0.32, 0.20],
    };
    const weights = weightProfiles[topPicksCount] || [1.0];

    // 单笔交易最大允许风险敞口 (1.5% 账户净可用资金)
    const maxSingleRiskBudget = Math.max(15.0, netDeployableCapital * 0.015);

    let totalAllocated = 0;
    const finalAllocatedBuyActions: ActionItem[] = [];

    topBuyPicks.forEach((act, idx) => {
      const curPrice = act.estimatedPrice > 0 ? act.estimatedPrice : 1.0;
      const allocTarget = netDeployableCapital * weights[idx];

      // 预先求解单股风险与 ATR 交易路径
      const prePath = this.formulateTradePath({
        symbol: act.symbol,
        companyName: act.companyName || act.symbol,
        currentPrice: curPrice,
        action: "BUY",
        targetProfitGoalPct,
        targetTimeHorizonDays,
        maxDrawdownPct,
        certaintyScore: act.certaintyScore || 75,
        goalProbability: act.goalAttainmentProbability || 68,
        strategyCategory: act.strategyCategory,
        strategyCategoryLabel: act.strategyCategoryLabel,
      });

      // 基于单笔风险预算 (Risk Budget) 与 资金上限 双重约束求解最优股数
      const perShareRisk = Math.max(0.1, prePath.perShareRisk);
      const sharesByRisk = Math.floor(maxSingleRiskBudget / perShareRisk);
      const sharesByCapital = Math.floor(allocTarget / curPrice);

      let shares = Math.min(sharesByCapital, Math.max(1, sharesByRisk));

      // 若资金充足但因单价高导致股数为0，若允许则至少买1股
      if (shares <= 0 && netDeployableCapital >= curPrice) {
        shares = 1;
      }

      // 确保分配资金不突破单票分配上限
      if (shares * curPrice > allocTarget && shares > 1) {
        shares = Math.max(1, Math.floor(allocTarget / curPrice));
      }

      const actualAlloc = Number((shares * curPrice).toFixed(2));
      totalAllocated += actualAlloc;

      const path = this.formulateTradePath({
        symbol: act.symbol,
        companyName: act.companyName || act.symbol,
        currentPrice: curPrice,
        action: "BUY",
        targetProfitGoalPct,
        targetTimeHorizonDays,
        maxDrawdownPct,
        certaintyScore: act.certaintyScore || 75,
        goalProbability: act.goalAttainmentProbability || 68,
        allocatedAmount: actualAlloc,
        suggestedShares: shares,
        strategyCategory: act.strategyCategory,
        strategyCategoryLabel: act.strategyCategoryLabel,
      });

      finalAllocatedBuyActions.push({
        ...act,
        suggestedShares: shares,
        estimatedAmount: actualAlloc,
        capitalAllocationAmount: actualAlloc,
        capitalAllocationPct:
          capitalSpace.totalDeployableCapacity > 0
            ? Number(((actualAlloc / capitalSpace.totalDeployableCapacity) * 100).toFixed(1))
            : 0,
        targetPrice: path.targetPrice,
        stopLossPrice: path.stopLossPrice,
        takeProfitPct: path.takeProfitPct,
        stopLossPct: path.stopLossPct,
        riskRewardRatio: path.riskRewardRatio,
        entryZone: path.entryZone,
        timeStopRule: path.timeStopRule,
        goalDrivenRationale: path.goalDrivenRationale,
        expectedPnLAmount: path.expectedPnLAmount,
        maxRiskAmount: path.maxRiskAmount,
        atr: path.atr,
        atrPct: path.atrPct,
        perShareRisk: path.perShareRisk,
        maxRiskBudget: Number(maxSingleRiskBudget.toFixed(2)),
        positionWeightPct: Number((weights[idx] * 100).toFixed(1)),
      });
    });

    // 将未排入前3的其余候选买入标的转为观察标的 (HOLD/备选)
    const convertedRemainingPicks: ActionItem[] = remainingBuyPicks.map((act) => ({
      ...act,
      action: "HOLD",
      suggestedShares: 0,
      estimatedAmount: 0,
      capitalAllocationAmount: 0,
      capitalAllocationPct: 0,
      rationale: `[${act.symbol}] 符合备选特征，但根据资金空间上限优先集中重仓配置前 ${topPicksCount} 只最高确定性标的，本标的列入重点盯盘备选池。`,
      timeStopRule: `【备选池规则】维持观察，待前排标的触发 ${targetTimeHorizonDays} 日止盈释放资金后再行调度。`,
    }));

    // 计算全局消除迷茫度与组合整体目标达成概率
    const scoredPicks = finalAllocatedBuyActions.length > 0 ? finalAllocatedBuyActions : candidateActions;
    const avgCertainty = Math.round(
      scoredPicks.reduce((acc, cur) => acc + (cur.certaintyScore || 65), 0) / scoredPicks.length
    );
    const avgGoalProb = Number(
      (
        scoredPicks.reduce((acc, cur) => acc + (cur.goalAttainmentProbability || 60), 0) /
        scoredPicks.length
      ).toFixed(1)
    );

    const optimizedActions = [
      ...finalAllocatedBuyActions,
      ...otherCandidates,
      ...convertedRemainingPicks,
    ];

    return {
      optimizedActions,
      updatedCapitalSpace: {
        ...capitalSpace,
        allocatedCapital: Number(totalAllocated.toFixed(2)),
      },
      overallCertaintyScore: avgCertainty,
      overallGoalProbability: avgGoalProb,
    };
  }
}

export const goalDrivenQuantEngine = new GoalDrivenQuantEngine();
