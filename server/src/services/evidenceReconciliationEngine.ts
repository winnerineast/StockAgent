import {
  EvidenceSourceType,
  EvidenceItemForConfidence,
  ConflictArbitrationResult,
} from "../types/stockTypes";

export class EvidenceReconciliationEngine {
  private static instance: EvidenceReconciliationEngine;

  public static getInstance(): EvidenceReconciliationEngine {
    if (!EvidenceReconciliationEngine.instance) {
      EvidenceReconciliationEngine.instance = new EvidenceReconciliationEngine();
    }
    return EvidenceReconciliationEngine.instance;
  }

  /**
   * 客观金融信源可靠度先验表 (Source Reliability Prior Matrix)
   */
  public static readonly SOURCE_RELIABILITY_PRIORS: Record<EvidenceSourceType, number> = {
    USER_INPUT: 0.98,        // 用户人工指定刚性指令
    MOOMOO_ORDERBOOK: 0.95,  // 券商实盘 Level-2 逐笔成交与盘口资金流
    SEC_FILING: 0.90,        // SEC 官方披露 10-K / 10-Q / 8-K 权威审计财报
    TIME_FM: 0.75,           // Google TimeFM 工业级时序动量预测
    ANALYST_REPORT: 0.70,    // 华尔街投行研报与一致性预期 (Consensus)
    NEWS_SEARCH: 0.50,       // SearXNG 全网聚合新闻与社交媒体舆情
  };

  /**
   * 论文公式 2: 三因子置信度计算公式
   * c(b) = (1 - exp(-|Eb|/κ)) * exp(-max(0, tq - tlast)/ρ) * (1/|Eb| * sum(ri))
   * 
   * @param evidenceCount 支持该信念的独立证据条数 |Eb|
   * @param lastEvidenceDateStr 最新一条证据的时间戳 YYYY-MM-DD 或 ISO 字符串
   * @param queryDateStr 当前查询/决策的时间戳 YYYY-MM-DD 或 ISO 字符串
   * @param sourceReliabilities 各证据信源的可靠度列表 [r1, r2, ...]
   * @param kappa 样本饱和常数 (论文默认 κ=5)
   * @param rhoDays 时效衰减常数 (论文默认 ρ=30 天)
   */
  public calculateConfidenceScore(
    evidenceCount: number,
    lastEvidenceDateStr: string,
    queryDateStr: string,
    sourceReliabilities: number[],
    kappa: number = 5,
    rhoDays: number = 30
  ): number {
    if (evidenceCount <= 0 || sourceReliabilities.length === 0) {
      return 0.0;
    }

    // 1. 样本数饱和因子 (Count Saturation Term ∈ [0, 1))
    const countTerm = 1 - Math.exp(-evidenceCount / Math.max(1, kappa));

    // 2. 时间衰减因子 (Recency Decay Term ∈ (0, 1])
    const qTime = new Date(queryDateStr).getTime();
    const lastTime = new Date(lastEvidenceDateStr).getTime();
    const daysDiff = Math.max(0, (qTime - lastTime) / (1000 * 60 * 60 * 24));
    const recencyTerm = Math.exp(-daysDiff / Math.max(1, rhoDays));

    // 3. 信源可靠度平均值 (Mean Source Reliability Term ∈ [0, 1])
    const avgReliability =
      sourceReliabilities.reduce((sum, r) => sum + Math.max(0, Math.min(1, r)), 0) /
      sourceReliabilities.length;

    const rawScore = countTerm * recencyTerm * avgReliability;
    return Number(Math.max(0.0, Math.min(1.0, rawScore)).toFixed(4));
  }

  /**
   * 从结构化证据列表计算综合置信度
   */
  public calculateEvidenceSetConfidence(
    evidenceList: EvidenceItemForConfidence[],
    queryDateStr?: string
  ): number {
    if (!evidenceList || evidenceList.length === 0) return 0.0;

    const qDate = queryDateStr || new Date().toISOString().split("T")[0];
    const sorted = [...evidenceList].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    const latestDate = sorted[0].timestamp;

    const reliabilities = evidenceList.map((e) => {
      if (typeof e.reliability === "number") return e.reliability;
      return EvidenceReconciliationEngine.SOURCE_RELIABILITY_PRIORS[e.sourceType] ?? 0.5;
    });

    return this.calculateConfidenceScore(evidenceList.length, latestDate, qDate, reliabilities);
  }

  /**
   * 论文核心: 证据加权冲突调和与争议区间仲裁 (Evidence-Weighted Conflict Reconciliation)
   * 当多方逻辑 (Bull Thesis) 与空方风险 (Bear Thesis) 出现冲突时：
   * 1. 分别量化计算双方的置信度得分 c(b_bull) 与 c(b_bear)
   * 2. 若分歧差距落在争议区间 (|Δc| < 0.15)，标记为 CONTESTED，防范盲目单向开仓
   * 3. 若分歧显著 (|Δc| >= 0.15)，判定优势方向并给出对应建议
   */
  public arbitrateConflict(
    bullScore: number,
    bearScore: number,
    contestedThreshold: number = 0.15
  ): ConflictArbitrationResult {
    const clampedBull = Math.max(0, Math.min(1, bullScore));
    const clampedBear = Math.max(0, Math.min(1, bearScore));
    const diff = Number((clampedBull - clampedBear).toFixed(4));
    const absDiff = Math.abs(diff);

    if (absDiff < contestedThreshold) {
      return {
        status: "CONTESTED",
        dominantScore: Math.max(clampedBull, clampedBear),
        bullScore: clampedBull,
        bearScore: clampedBear,
        scoreDiff: absDiff,
        isContested: true,
        explanation: `⚠️ 多空双方证据置信度高度胶着 (多方: ${(clampedBull * 100).toFixed(1)}% vs 空方: ${(clampedBear * 100).toFixed(1)}%, 差距 ${(absDiff * 100).toFixed(1)}% < 15%)，处于剧烈博弈争议区间，建议控制敞口并观望。`,
        recommendedStance: "REDUCE_EXPOSURE_AND_WAIT",
      };
    }

    if (diff > 0) {
      return {
        status: "BULL_DOMINANT",
        dominantScore: clampedBull,
        bullScore: clampedBull,
        bearScore: clampedBear,
        scoreDiff: diff,
        isContested: false,
        explanation: `🟢 多方看多证据置信度显著胜出 (多方: ${(clampedBull * 100).toFixed(1)}% vs 空方: ${(clampedBear * 100).toFixed(1)}%, 净优势 +${(diff * 100).toFixed(1)}%)。`,
        recommendedStance: "PROCEED_LONG",
      };
    } else {
      return {
        status: "BEAR_DOMINANT",
        dominantScore: clampedBear,
        bullScore: clampedBull,
        bearScore: clampedBear,
        scoreDiff: absDiff,
        isContested: false,
        explanation: `🔴 空方风险证据置信度显著胜出 (空方: ${(clampedBear * 100).toFixed(1)}% vs 多方: ${(clampedBull * 100).toFixed(1)}%, 风险溢价 +${(absDiff * 100).toFixed(1)}%)。`,
        recommendedStance: "PROCEED_SHORT",
      };
    }
  }
}

export const evidenceReconciliationEngine = EvidenceReconciliationEngine.getInstance();
