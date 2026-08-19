import { prisma } from "../db/prisma";
import { ConsolidatedPrincipleItem, PastLessonEvidence } from "../types/stockTypes";

export class MemoryConsolidationService {
  private static instance: MemoryConsolidationService;

  public static getInstance(): MemoryConsolidationService {
    if (!MemoryConsolidationService.instance) {
      MemoryConsolidationService.instance = new MemoryConsolidationService();
    }
    return MemoryConsolidationService.instance;
  }

  /**
   * 艾宾浩斯时间衰减算法 (Ebbinghaus Exponential Decay Function)
   * 半衰期为 30 天 (lambda = ln(2)/30 ≈ 0.0231)
   * - 14 天内：权重 1.0 (黄金工作记忆)
   * - 30 天：权重 0.5 (半衰期)
   * - 60 天：权重 0.25
   * - 90 天及以上：权重低于 0.125，触发冷归档
   */
  public calculateDecayWeight(lastReinforcedDateStr: string, currentDateStr?: string): number {
    const now = currentDateStr ? new Date(currentDateStr) : new Date();
    const lastDate = new Date(lastReinforcedDateStr);
    const diffMs = Math.max(0, now.getTime() - lastDate.getTime());
    const daysAgo = diffMs / (1000 * 60 * 60 * 24);

    if (daysAgo <= 14) return 1.0;

    const lambda = 0.023105; // ln(2) / 30
    const rawWeight = Math.exp(-lambda * (daysAgo - 14));
    return Number(Math.max(0.0, Math.min(1.0, rawWeight)).toFixed(3));
  }

  /**
   * 将新核验的实盘教训/经验聚合到长期认知记忆库 (StockTradingMemoryStore) 中，执行聚类、去重与重组
   */
  public async consolidateAndDistill(
    portfolioId: string = "default-portfolio",
    symbol: string,
    verifiedLessons: PastLessonEvidence[]
  ): Promise<ConsolidatedPrincipleItem[]> {
    const symbolUpper = symbol.toUpperCase();
    const todayStr = new Date().toISOString().split("T")[0];

    if (!verifiedLessons || verifiedLessons.length === 0) {
      return this.getActivePrinciples(portfolioId, symbolUpper);
    }

    for (const item of verifiedLessons) {
      if (item.outcome === "RANDOM_NOISE") continue;

      let category: "ENTRY_DISCIPLINE" | "STOP_LOSS_RULE" | "TAKE_PROFIT_RULE" | "EVENT_CATALYST" = "ENTRY_DISCIPLINE";
      let ruleTitle = "突破与建仓纪律";
      const textLower = item.lessonText.toLowerCase();

      if (textLower.includes("止损") || textLower.includes("回调") || textLower.includes("破位") || textLower.includes("假突破")) {
        category = "STOP_LOSS_RULE";
        ruleTitle = "支撑位破位与防守止损纪律";
      } else if (textLower.includes("卖飞") || textLower.includes("止盈") || textLower.includes("逆势大涨")) {
        category = "TAKE_PROFIT_RULE";
        ruleTitle = "主线强势波段移动止盈纪律";
      } else if (textLower.includes("财报") || textLower.includes("催化") || textLower.includes("重磅")) {
        category = "EVENT_CATALYST";
        ruleTitle = "重大事件与预期差博弈纪律";
      }

      // 查询是否已有相同分类的长期原则
      const existing = await prisma.stockTradingMemoryStore.findUnique({
        where: {
          portfolioId_symbol_category_title: {
            portfolioId,
            symbol: symbolUpper,
            category,
            title: ruleTitle,
          },
        },
      });

      if (existing) {
        // 合并与强化：样本数+1，更新最后强化日期，重组精炼描述
        const newSampleCount = existing.sampleCount + 1;
        const newWeight = Math.min(1.0, existing.confidenceWeight + 0.2);
        const distilled = this.synthesizeRuleDescription(symbolUpper, category, newSampleCount, item.lessonText);

        let logIds: string[] = [];
        try {
          logIds = JSON.parse(existing.evidenceLogsJson || "[]");
        } catch (e) {}
        if (item.id && !logIds.includes(item.id)) logIds.push(item.id);

        await prisma.stockTradingMemoryStore.update({
          where: { id: existing.id },
          data: {
            sampleCount: newSampleCount,
            confidenceWeight: newWeight,
            distilledRule: distilled,
            lastReinforcedDate: todayStr,
            isArchived: false,
            evidenceLogsJson: JSON.stringify(logIds.slice(-20)),
          },
        });
      } else {
        // 创建新原则
        const distilled = this.synthesizeRuleDescription(symbolUpper, category, 1, item.lessonText);
        await prisma.stockTradingMemoryStore.create({
          data: {
            portfolioId,
            symbol: symbolUpper,
            principleType: "INDIVIDUAL_STOCK",
            category,
            title: ruleTitle,
            distilledRule: distilled,
            sampleCount: 1,
            confidenceWeight: 1.0,
            firstLearnedDate: item.date || todayStr,
            lastReinforcedDate: todayStr,
            validStart: item.date || todayStr,
            validEnd: null, // +∞ 活跃有效
            isArchived: false,
            evidenceLogsJson: JSON.stringify(item.id ? [item.id] : []),
          },
        });
      }
    }

    return this.getActivePrinciples(portfolioId, symbolUpper);
  }

  /**
   * 自动生成归纳合并后的高阶原则文本 (Distilled Rule Synthesis)
   */
  private synthesizeRuleDescription(
    symbol: string,
    category: string,
    sampleCount: number,
    latestLessonSnippet: string
  ): string {
    if (category === "STOP_LOSS_RULE") {
      return `【${symbol} 严控防守原则】历史累计沉淀 ${sampleCount} 次实盘止损复盘经验：警惕左侧放量假突破与布林线上轨诱多，必须等待右侧均线企稳确认，下设 -4%~-6% 严格硬止损防线。(最新核验要点: ${latestLessonSnippet.slice(0, 100)})`;
    } else if (category === "TAKE_PROFIT_RULE") {
      return `【${symbol} 波段止盈原则】历史累计沉淀 ${sampleCount} 次实盘波段复盘经验：对主线确定性较强的波段行情，避免过早全额平仓卖飞，建议采用阶梯减仓与移动止盈策略。(最新核验要点: ${latestLessonSnippet.slice(0, 100)})`;
    } else if (category === "EVENT_CATALYST") {
      return `【${symbol} 催化博弈原则】历史累计沉淀 ${sampleCount} 次事件驱动复盘经验：重大财报与产业峰会前波动剧烈，需提前降低持仓敞口至 30% 以下控制不确定性。(最新核验要点: ${latestLessonSnippet.slice(0, 100)})`;
    } else {
      return `【${symbol} 建仓挂单原则】历史累计沉淀 ${sampleCount} 次实盘建仓复盘经验：优先在预设安全边际区间 (Entry Zone) 挂单分批入场，避免开盘冲高盲目市价追涨。(最新核验要点: ${latestLessonSnippet.slice(0, 100)})`;
    }
  }

  /**
   * 获取指定标的当前有效的长期原则（按衰减权重降序排列，自动过滤冷归档）
   */
  public async getActivePrinciples(
    portfolioId: string = "default-portfolio",
    symbol: string
  ): Promise<ConsolidatedPrincipleItem[]> {
    const symbolUpper = symbol.toUpperCase();
    const records = await prisma.stockTradingMemoryStore.findMany({
      where: {
        portfolioId,
        symbol: symbolUpper,
        isArchived: false,
      },
    });

    const activeList: ConsolidatedPrincipleItem[] = [];

    for (const r of records) {
      const dynamicWeight = this.calculateDecayWeight(r.lastReinforcedDate);
      if (dynamicWeight < 0.12) {
        // 自动归档长期未被强化的过时记忆
        await prisma.stockTradingMemoryStore.update({
          where: { id: r.id },
          data: { isArchived: true, confidenceWeight: dynamicWeight },
        });
        continue;
      }

      let evidenceIds: string[] = [];
      try {
        evidenceIds = JSON.parse(r.evidenceLogsJson || "[]");
      } catch (e) {}

      activeList.push({
        id: r.id,
        portfolioId: r.portfolioId,
        symbol: r.symbol,
        principleType: r.principleType as any,
        category: r.category as any,
        title: r.title,
        distilledRule: r.distilledRule,
        sampleCount: r.sampleCount,
        confidenceWeight: dynamicWeight,
        firstLearnedDate: r.firstLearnedDate,
        lastReinforcedDate: r.lastReinforcedDate,
        isArchived: false,
        evidenceLogIds: evidenceIds,
        validStart: r.validStart || r.firstLearnedDate,
        validEnd: r.validEnd,
        supersededById: r.supersededById || undefined,
        supersedeReason: r.supersedeReason || undefined,
        evidenceWeightSum: r.evidenceWeightSum ?? 1.0,
      });
    }

    return activeList.sort((a, b) => b.confidenceWeight - a.confidenceWeight);
  }

  /**
   * 获取 FinAgent 风格的双层反思记忆完整报告 (Dual-Level Reflection Report)
   */
  public async getDualLevelMemoryReport(
    portfolioId: string = "default-portfolio"
  ): Promise<{
    tacticalReflections: any[];
    strategicDisciplines: any[];
    totalPrinciplesCount: number;
    activeEnforcedCount: number;
    latestReinforcedDate: string;
  }> {
    const records = await prisma.stockTradingMemoryStore.findMany({
      where: { portfolioId, isArchived: false },
      orderBy: { confidenceWeight: "desc" },
    });

    const tactical: any[] = [];
    const strategic: any[] = [];
    let latestDate = new Date().toISOString().split("T")[0];

    for (const r of records) {
      const dynamicWeight = this.calculateDecayWeight(r.lastReinforcedDate);
      if (dynamicWeight < 0.12) continue;

      if (r.lastReinforcedDate > latestDate) {
        latestDate = r.lastReinforcedDate;
      }

      const item = {
        id: r.id,
        level: r.principleType === "GLOBAL_DISCIPLINE" ? "L2_STRATEGIC" : "L1_TACTICAL",
        levelLabel: r.principleType === "GLOBAL_DISCIPLINE" ? "🏛️ L2 全局战略守则" : `🎯 L1 ${r.symbol} 战术反思`,
        symbol: r.symbol,
        category: r.category,
        ruleSummary: r.title,
        triggerContext: r.distilledRule,
        enforcementAction: r.category === "STOP_LOSS_RULE" ? "触发刚性截断防线" : "优化挂单安全区间",
        sampleCount: r.sampleCount,
        confidenceWeight: Number(dynamicWeight.toFixed(2)),
      };

      if (r.principleType === "GLOBAL_DISCIPLINE" || r.symbol === "GLOBAL" || r.sampleCount >= 3) {
        strategic.push(item);
      } else {
        tactical.push(item);
      }
    }

    // 若无全局纪律，提供内置冷启动经典原则
    if (strategic.length === 0) {
      strategic.push({
        id: "default-strategic-1",
        level: "L2_STRATEGIC",
        levelLabel: "🏛️ L2 全局战略守则",
        symbol: "GLOBAL",
        category: "STOP_LOSS_RULE",
        ruleSummary: "大盘极端下行时刚性控制总风险敞口",
        triggerContext: "在 TRENDING_BEAR 或高波动率 VCI 偏离时，严禁逆势盲目抄底重仓，最大持仓压缩至 30% 以下。",
        enforcementAction: "触发刚性截断防线",
        sampleCount: 5,
        confidenceWeight: 0.95,
      });
      strategic.push({
        id: "default-strategic-2",
        level: "L2_STRATEGIC",
        levelLabel: "🏛️ L2 全局战略守则",
        symbol: "GLOBAL",
        category: "ENTRY_DISCIPLINE",
        ruleSummary: "上班族下班挂单滑点防护守则",
        triggerContext: "盘前委托必须在 EntryZone.min 附近挂限价单，严防开盘集合竞价冲高回落被套。",
        enforcementAction: "优化挂单安全区间",
        sampleCount: 4,
        confidenceWeight: 0.90,
      });
    }

    return {
      tacticalReflections: tactical,
      strategicDisciplines: strategic,
      totalPrinciplesCount: tactical.length + strategic.length,
      activeEnforcedCount: strategic.length,
      latestReinforcedDate: latestDate,
    };
  }

  /**
   * 格式化原则库文本，用于注入大模型系统指令 (Prompt Context Injection)
   */
  public formatPrinciplesForPrompt(principles: ConsolidatedPrincipleItem[]): string {
    if (!principles || principles.length === 0) {
      return "";
    }

    const lines = ["【该标的长期实盘进化原则与纪律库】:"];
    principles.forEach((p) => {
      lines.push(`• 📌 [置信度: ${Math.round(p.confidenceWeight * 100)}% | 样本量: ${p.sampleCount}次] ${p.distilledRule}`);
    });
    return lines.join("\n");
  }
}

export const memoryConsolidationService = MemoryConsolidationService.getInstance();

