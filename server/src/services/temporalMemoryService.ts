import { prisma } from "../db/prisma";
import { ConsolidatedPrincipleItem } from "../types/stockTypes";

export interface TemporalPrincipleFilter {
  portfolioId?: string;
  symbol?: string;
  asOfDate?: string; // YYYY-MM-DD (若提供则执行 As-of-Time 时态切片查询)
  includeArchived?: boolean;
}

export interface SupersessionOptions {
  portfolioId: string;
  oldPrincipleId: string;
  newPrinciple: {
    symbol: string;
    principleType?: "INDIVIDUAL_STOCK" | "SECTOR_RULE" | "GLOBAL_DISCIPLINE";
    category: "ENTRY_DISCIPLINE" | "STOP_LOSS_RULE" | "TAKE_PROFIT_RULE" | "EVENT_CATALYST";
    title: string;
    distilledRule: string;
    confidenceWeight?: number;
    sampleCount?: number;
    evidenceLogIds?: string[];
  };
  supersedeReason: string;
  effectiveDate: string; // YYYY-MM-DD
}

export class TemporalMemoryService {
  private static instance: TemporalMemoryService;

  public static getInstance(): TemporalMemoryService {
    if (!TemporalMemoryService.instance) {
      TemporalMemoryService.instance = new TemporalMemoryService();
    }
    return TemporalMemoryService.instance;
  }

  /**
   * 判断某个信念/原则在指定时刻 t* 是否处于半开有效区间 [validStart, validEnd)
   * 论文规范: t_start <= t* < t_end，其中 t_end 为 null 时代表 +∞ (当前持续活跃)
   */
  public isBeliefActiveAt(
    validStart: string | null | undefined,
    validEnd: string | null | undefined,
    asOfDate: string
  ): boolean {
    if (!asOfDate) return true;
    const start = validStart || "1970-01-01";
    // 1. 如果 asOfDate 早于生效时间，则此时尚未产生该认知
    if (asOfDate < start) return false;
    // 2. 如果 validEnd 存在且 asOfDate >= validEnd，则此时认知已被取代或失效
    if (validEnd && asOfDate >= validEnd) return false;
    return true;
  }

  /**
   * As-of-Time 历史时态切片查询: 精确重构智能体在历史时刻 asOfDate 所保有的活跃信念集合
   * 彻底杜绝历史回测与复盘对账时的未来信息穿越 (No Lookahead Bias)
   */
  public async getActivePrinciplesAsOf(
    filter: TemporalPrincipleFilter
  ): Promise<ConsolidatedPrincipleItem[]> {
    const portfolioId = filter.portfolioId || "default-portfolio";
    const whereClause: any = { portfolioId };

    if (filter.symbol) {
      whereClause.symbol = filter.symbol.toUpperCase();
    }

    if (!filter.includeArchived) {
      whereClause.isArchived = false;
    }

    const records = await prisma.stockTradingMemoryStore.findMany({
      where: whereClause,
      orderBy: { confidenceWeight: "desc" },
    });

    const results: ConsolidatedPrincipleItem[] = [];

    for (const r of records) {
      const vStart = r.validStart || r.firstLearnedDate;
      const vEnd = r.validEnd;

      // 如果指定了 As-of-Time 切片日期，执行严格的半开时态过滤 [validStart, validEnd)
      if (filter.asOfDate) {
        if (!this.isBeliefActiveAt(vStart, vEnd, filter.asOfDate)) {
          continue;
        }
      } else {
        // 当前实时查询：若已经存在 validEnd 且小于等于今日，则表示已被废弃
        const todayStr = new Date().toISOString().split("T")[0];
        if (vEnd && vEnd <= todayStr) {
          continue;
        }
      }

      let evidenceLogs: string[] = [];
      try {
        evidenceLogs = JSON.parse(r.evidenceLogsJson || "[]");
      } catch (e) {}

      results.push({
        id: r.id,
        portfolioId: r.portfolioId,
        symbol: r.symbol,
        principleType: r.principleType as any,
        category: r.category as any,
        title: r.title,
        distilledRule: r.distilledRule,
        sampleCount: r.sampleCount,
        confidenceWeight: r.confidenceWeight,
        firstLearnedDate: r.firstLearnedDate,
        lastReinforcedDate: r.lastReinforcedDate,
        isArchived: r.isArchived,
        evidenceLogIds: evidenceLogs,
        validStart: vStart,
        validEnd: vEnd,
        supersededById: r.supersededById || undefined,
        supersedeReason: r.supersedeReason || undefined,
        evidenceWeightSum: r.evidenceWeightSum ?? 1.0,
      });
    }

    return results;
  }

  /**
   * 执行带有历史保全的原则取代 (Evidence-Preserving Supersession)
   * 1. 将旧原则的 validEnd 闭合至 effectiveDate，记录 supersededById 与 supersedeReason
   * 2. 创建/激活新原则，设置 validStart = effectiveDate, validEnd = null (+∞)
   */
  public async supersedePrinciple(options: SupersessionOptions): Promise<{
    oldPrincipleId: string;
    newPrincipleId: string;
    effectiveDate: string;
  }> {
    const { portfolioId, oldPrincipleId, newPrinciple, supersedeReason, effectiveDate } = options;
    const symUpper = newPrinciple.symbol.toUpperCase();

    // 1. 创建新原则记录
    const createdNew = await prisma.stockTradingMemoryStore.create({
      data: {
        portfolioId,
        symbol: symUpper,
        principleType: newPrinciple.principleType || "INDIVIDUAL_STOCK",
        category: newPrinciple.category,
        title: newPrinciple.title,
        distilledRule: newPrinciple.distilledRule,
        sampleCount: newPrinciple.sampleCount || 1,
        confidenceWeight: newPrinciple.confidenceWeight ?? 1.0,
        firstLearnedDate: effectiveDate,
        lastReinforcedDate: effectiveDate,
        validStart: effectiveDate,
        validEnd: null, // +∞
        evidenceLogsJson: JSON.stringify(newPrinciple.evidenceLogIds || []),
        isArchived: false,
      },
    });

    // 2. 更新并闭合老原则的时间区间 [validStart, effectiveDate)
    if (oldPrincipleId) {
      await prisma.stockTradingMemoryStore.update({
        where: { id: oldPrincipleId },
        data: {
          validEnd: effectiveDate,
          supersededById: createdNew.id,
          supersedeReason,
          isArchived: true, // 软归档，但保留时态与因果链
        },
      });
    }

    return {
      oldPrincipleId,
      newPrincipleId: createdNew.id,
      effectiveDate,
    };
  }
}

export const temporalMemoryService = TemporalMemoryService.getInstance();
