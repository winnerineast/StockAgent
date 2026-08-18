import {
  MarketDynamicsRegime,
  MarketDynamicsReport,
} from "../types/stockTypes";
import { moomooAdapter } from "./moomooAdapter";

export interface DynamicsEvaluationInput {
  tsi: number;              // Trend Strength Index (-1.0 ~ +1.0)
  vci: number;              // Volatility Clustering Index (e.g. -2.0 ~ +3.0)
  marketBreadthPct: number; // 0 ~ 100
  llmSentimentMood?: "BULLISH" | "BEARISH" | "NEUTRAL" | "VOLATILE";
}

/**
 * 市场动力学状态机服务 (TradeMaster MDM Engine)
 * 结合大盘均线动量、真实波动率聚集度与全市场广度，输出客观量化 Regime 及自适应风控约束。
 */
export class MarketDynamicsService {
  private static instance: MarketDynamicsService;

  public static getInstance(): MarketDynamicsService {
    if (!MarketDynamicsService.instance) {
      MarketDynamicsService.instance = new MarketDynamicsService();
    }
    return MarketDynamicsService.instance;
  }

  /**
   * 纯数学动力学仲裁器 (Deterministic Market Dynamics Evaluator)
   */
  public evaluateRegime(input: DynamicsEvaluationInput): MarketDynamicsReport {
    const { tsi, vci, marketBreadthPct, llmSentimentMood = "NEUTRAL" } = input;

    let regime: MarketDynamicsRegime = "COMPRESSED_CONSOLIDATION";
    let regimeLabel = "📦 低波窄幅蓄势 (Compressed Consolidation)";
    let rationale = "指数处于箱体震荡与波动率收敛区间，市场广度中性，重点关注低估值超跌与高确定性催化标的。";
    let maxPortfolioCapPct = 60;
    let singleStockCapPct = 25;
    let atrStopMultiplier = 1.6;

    // 1. 单边熊市 / 极端风险防御判定 (BEAR)
    if (tsi <= -0.25 || (tsi < 0 && vci >= 1.5) || (llmSentimentMood === "BEARISH" && tsi < -0.1)) {
      regime = "TRENDING_BEAR";
      regimeLabel = "🐻 单边防御熊市 (Trending Bear)";
      rationale = `大盘均线破位下行 (TSI: ${tsi})，下行波动聚集度上升 (VCI: ${vci})，触发刚性防守屏障，严格压制总仓位并执行窄幅硬止损。`;
      maxPortfolioCapPct = 30;
      singleStockCapPct = 15;
      atrStopMultiplier = 1.2;
    }
    // 2. 强动量主升牛市判定 (BULL)
    else if (tsi >= 0.25 && vci <= 0.9 && marketBreadthPct >= 50 && llmSentimentMood !== "BEARISH") {
      regime = "TRENDING_BULL";
      regimeLabel = "🐂 强动量主升浪 (Trending Bull)";
      rationale = `大盘均线呈多头排列 (TSI: +${tsi})，市场广度健康 (${marketBreadthPct}% 标的高于均线)，且恐慌波动受控 (VCI: ${vci})，适合顺势持股与积极做多。`;
      maxPortfolioCapPct = 80;
      singleStockCapPct = 35;
      atrStopMultiplier = 2.0;
    }
    // 3. 高波宽幅震荡 / 多空剧烈洗盘判定 (HIGH_VOL_CHOP)
    else if (vci >= 1.2 || (Math.abs(tsi) < 0.25 && (marketBreadthPct < 40 || llmSentimentMood === "VOLATILE"))) {
      regime = "HIGH_VOLATILITY_CHOP";
      regimeLabel = "⚡ 高波宽幅洗盘 (High Volatility Chop)";
      rationale = `市场波动率聚集度显著放大 (VCI: ${vci})，多空博弈激烈且热点轮动极快，建议严控仓位防踏空与防追高，缩紧止损。`;
      maxPortfolioCapPct = 45;
      singleStockCapPct = 20;
      atrStopMultiplier = 1.35;
    }

    return {
      regime,
      regimeLabel,
      trendStrengthIndex: Number(tsi.toFixed(3)),
      volatilityClusteringIndex: Number(vci.toFixed(3)),
      marketBreadthPct: Number(marketBreadthPct.toFixed(1)),
      adaptedRiskParams: {
        maxPortfolioCapPct,
        singleStockCapPct,
        atrStopMultiplier,
      },
      rationale,
      evaluatedAt: new Date().toISOString(),
    };
  }

  /**
   * 从 OpenD 自动拉取实时数据并进行动力学评估
   */
  public async getLiveMarketDynamics(
    llmSentimentMood?: "BULLISH" | "BEARISH" | "NEUTRAL" | "VOLATILE"
  ): Promise<MarketDynamicsReport> {
    try {
      const openDData = await moomooAdapter.fetchMarketDynamicsFromOpenD();
      return this.evaluateRegime({
        tsi: openDData.tsi,
        vci: openDData.vci,
        marketBreadthPct: openDData.marketBreadthPct,
        llmSentimentMood,
      });
    } catch (e) {
      // 优雅降级默认评估
      return this.evaluateRegime({
        tsi: 0.0,
        vci: 0.0,
        marketBreadthPct: 50.0,
        llmSentimentMood,
      });
    }
  }
}

export const marketDynamicsService = MarketDynamicsService.getInstance();
