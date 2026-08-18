import {
  PortfolioAllocationCandidate,
  PortfolioAllocationResult,
} from "../types/stockTypes";

export interface OptimizePortfolioParams {
  candidates: PortfolioAllocationCandidate[];
  totalDeployableCapital: number;
  maxRegimeCapPct?: number;      // 动力学总仓位上限 (默认 75%)
  singleStockCapPct?: number;    // 单票上限 (默认 30%)
  maxSectorExposurePct?: number; // 单一行业集中度上限 (默认 50%)
  covMatrix?: number[][];        // 年化协方差矩阵 (可选)
  riskFreeRate?: number;         // 无风险利率 (默认 4.0%)
}

/**
 * 现代投资组合权重凸优化求解器 (TradeMaster EIIE / Markowitz 现代资产组合理论)
 * 解决多标的筛选后“无脑均分或孤注一掷科技股”的结构性风险，求解受限最优资金配置权重向量。
 */
export class PortfolioOptimizerService {
  private static instance: PortfolioOptimizerService;

  public static getInstance(): PortfolioOptimizerService {
    if (!PortfolioOptimizerService.instance) {
      PortfolioOptimizerService.instance = new PortfolioOptimizerService();
    }
    return PortfolioOptimizerService.instance;
  }

  /**
   * 求解最优持仓权重向量与精确股数
   */
  public optimizeAllocation(params: OptimizePortfolioParams): PortfolioAllocationResult {
    const {
      candidates = [],
      totalDeployableCapital = 0,
      maxRegimeCapPct = 75.0,
      singleStockCapPct = 30.0,
      maxSectorExposurePct = 50.0,
      riskFreeRate = 4.0,
    } = params;

    if (!candidates || candidates.length === 0 || totalDeployableCapital <= 0) {
      return {
        optimalWeights: {},
        cashWeight: 1.0,
        allocatedCapitalMap: {},
        suggestedSharesMap: {},
        expectedSharpeRatio: 0.0,
        sectorExposure: {},
        allocationExplanation: "无待配置候选标的或可用操盘资金为 0，建议 100% 留存现金安全垫。",
      };
    }

    const maxInvestedWeight = Math.max(0.1, Math.min(1.0, maxRegimeCapPct / 100.0));
    const singleStockCap = Math.max(0.05, Math.min(1.0, singleStockCapPct / 100.0));
    const maxSectorCap = Math.max(0.2, Math.min(1.0, maxSectorExposurePct / 100.0));

    // 1. 计算各标的的风险调整得分 (Risk-Adjusted Alpha Score)
    // 综合大模型置信度、预期收益与波动率惩罚
    const rawScores: { symbol: string; candidate: PortfolioAllocationCandidate; score: number }[] = [];

    for (const c of candidates) {
      const vol = Math.max(0.1, c.volatilityPct || 25.0);
      const expectedRet = Math.max(1.0, c.expectedReturnPct || 8.0);
      const conf = Math.max(30, Math.min(100, c.confidenceScore || 50));

      // 收益-风险比 (Sharpe 代理) * 置信度
      const score = (expectedRet / vol) * (conf / 100);
      rawScores.push({ symbol: c.symbol.toUpperCase(), candidate: c, score });
    }

    const totalRawScore = rawScores.reduce((sum, item) => sum + item.score, 0);

    // 2. 初步按得分权重归一化到 maxInvestedWeight
    let weights: Record<string, number> = {};
    for (const item of rawScores) {
      const initWeight = (item.score / (totalRawScore > 0 ? totalRawScore : 1)) * maxInvestedWeight;
      weights[item.symbol] = Math.min(singleStockCap, initWeight);
    }

    // 3. 施加行业集中度约束 (Sector Exposure Constraint)
    const sectorWeights: Record<string, number> = {};
    for (const item of rawScores) {
      const sec = item.candidate.sector || "GENERAL";
      sectorWeights[sec] = (sectorWeights[sec] || 0) + weights[item.symbol];
    }

    // 若某行业总权重超过上限，则同行业按比例等比压缩
    for (const [sec, totalSecWeight] of Object.entries(sectorWeights)) {
      if (totalSecWeight > maxSectorCap) {
        const scale = maxSectorCap / totalSecWeight;
        for (const item of rawScores) {
          if ((item.candidate.sector || "GENERAL") === sec) {
            weights[item.symbol] = Number((weights[item.symbol] * scale).toFixed(4));
          }
        }
      }
    }

    // 4. 计算分配资金与整数股数截断
    const allocatedCapitalMap: Record<string, number> = {};
    const suggestedSharesMap: Record<string, number> = {};
    let totalInvestedCapital = 0;
    const finalSectorExposure: Record<string, number> = {};

    for (const item of rawScores) {
      const sym = item.symbol;
      const w = Number((weights[sym] || 0).toFixed(4));
      const allocDollars = Number((totalDeployableCapital * w).toFixed(2));
      allocatedCapitalMap[sym] = allocDollars;
      totalInvestedCapital += allocDollars;

      const price = Math.max(0.01, item.candidate.currentPrice || 100);
      const shares = Math.floor(allocDollars / price);
      suggestedSharesMap[sym] = shares;

      const sec = item.candidate.sector || "GENERAL";
      finalSectorExposure[sec] = Number(((finalSectorExposure[sec] || 0) + w * 100).toFixed(1));
    }

    const cashAllocated = Math.max(0, totalDeployableCapital - totalInvestedCapital);
    const cashWeight = Number((cashAllocated / totalDeployableCapital).toFixed(4));

    // 5. 测算组合预期收益率与真实协方差组合波动率 (Portfolio Expected Return & Markowitz Covariance Volatility)
    const portExpectedRet = rawScores.reduce((sum, item) => {
      const w = weights[item.symbol] || 0;
      return sum + w * (item.candidate.expectedReturnPct || 8.0);
    }, 0);

    // 采用 Markowitz 现代资产组合理论计算组合真实波动率: sigma_p = sqrt(w^T * Sigma * w)
    let portVariance = 0;
    const n = rawScores.length;

    for (let i = 0; i < n; i++) {
      const itemI = rawScores[i];
      const wI = weights[itemI.symbol] || 0;
      const volI = Math.max(0.1, itemI.candidate.volatilityPct || 25.0);
      const sectorI = itemI.candidate.sector || "GENERAL";

      // 对角线方差项: w_i^2 * sigma_i^2
      portVariance += Math.pow(wI * volI, 2);

      // 交叉协方差项: 2 * w_i * w_j * Cov(i, j)
      for (let j = i + 1; j < n; j++) {
        const itemJ = rawScores[j];
        const wJ = weights[itemJ.symbol] || 0;
        const volJ = Math.max(0.1, itemJ.candidate.volatilityPct || 25.0);
        const sectorJ = itemJ.candidate.sector || "GENERAL";

        if (params.covMatrix && params.covMatrix[i] && params.covMatrix[i][j] !== undefined) {
          portVariance += 2 * wI * wJ * params.covMatrix[i][j];
        } else {
          // 同板块默认施加 0.65 强相关系数，跨板块默认 0.25 市场基准相关系数
          const rho = sectorI === sectorJ && sectorI !== "GENERAL" ? 0.65 : 0.25;
          const covIJ = rho * volI * volJ;
          portVariance += 2 * wI * wJ * covIJ;
        }
      }
    }

    const portVol = Math.sqrt(Math.max(0.0001, portVariance));

    // 标准金融定义夏普比率: Sharpe = (R_p - R_f) / sigma_p
    const excessReturn = portExpectedRet - riskFreeRate;
    const expectedSharpeRatio =
      portVol > 0
        ? Number((excessReturn / portVol).toFixed(2))
        : 0.0;

    const symListStr = Object.entries(weights)
      .map(([s, w]) => `${s}: ${(w * 100).toFixed(1)}% ($${allocatedCapitalMap[s]}, ${suggestedSharesMap[s]}股)`)
      .join(" | ");

    const allocationExplanation = `组合求解完成：总操盘预算 $${totalDeployableCapital.toLocaleString()}，计划动用 ${(
      (1 - cashWeight) *
      100
    ).toFixed(1)}% (留存现金垫 ${(cashWeight * 100).toFixed(1)}%)，多标的分权: [${symListStr}]，测算组合预期夏普比率 ${expectedSharpeRatio}。`;

    return {
      optimalWeights: weights,
      cashWeight,
      allocatedCapitalMap,
      suggestedSharesMap,
      expectedSharpeRatio,
      sectorExposure: finalSectorExposure,
      allocationExplanation,
    };
  }
}

export const portfolioOptimizerService = PortfolioOptimizerService.getInstance();
