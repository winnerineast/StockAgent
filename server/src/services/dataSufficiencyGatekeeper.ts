import {
  ActionItem,
  DataSufficiencyConfig,
  DataSufficiencyReport,
  MissingDataDiagnostic,
  OpenDSnapshotItem,
  StockFundamentals,
  StockKnowledgeGraphItem,
} from "../types/stockTypes";
import { dataFreshnessGuard } from "./dataFreshnessGuard";

export const DEFAULT_SUFFICIENCY_CONFIG: Required<DataSufficiencyConfig> = {
  requireOrderBookPrice: true,
  requireMainCapitalFlow: true,
  requireNewsCoverage: true,
  maxNewsAgeDays: 7,
  requireFundamentalsPe: true,
  requireKnowledgeGraph: true,
  minKnowledgeGraphNodes: 2,
  requireOptionGamma: false, // 期权数据设为选配增强项
};

/**
 * 数据完备性刚性准入闸门 (DataSufficiencyGatekeeper)
 * 核心法则：
 * 1. 杜绝在信息真空下调用大模型臆测推演；
 * 2. 精确指出断流/缺失的维度及具体字段；
 * 3. 给出具备可操作性的修复指引 (Remedy Action)；
 * 4. 零硬编码，所有规则阈值均通过配置对象动态驱动。
 */
export class DataSufficiencyGatekeeper {
  /**
   * 评估单个标的的信息完备性
   */
  public static evaluateSymbol(
    params: {
      symbol: string;
      companyName?: string;
      snapshot?: OpenDSnapshotItem;
      news?: string[];
      fundamentals?: StockFundamentals;
      knowledgeGraph?: StockKnowledgeGraphItem;
      hasOptionChainData?: boolean;
    },
    customConfig?: DataSufficiencyConfig
  ): DataSufficiencyReport {
    const config: Required<DataSufficiencyConfig> = {
      ...DEFAULT_SUFFICIENCY_CONFIG,
      ...(customConfig || {}),
    };

    const {
      symbol,
      snapshot,
      news = [],
      fundamentals,
      knowledgeGraph,
      hasOptionChainData,
      marketPhase,
      isOpenDConnected = true,
      hasLevel3Permissions = true,
    } = params as any;

    const isMarketClosed =
      marketPhase === "WEEKEND_OR_HOLIDAY" ||
      marketPhase === "POST_MARKET" ||
      marketPhase === "OVERNIGHT_CLOSED";

    // 智能价格提取与数据时效/正确性校验 (通过 DataFreshnessGuard 过滤)
    const rawPrice =
      snapshot?.lastPrice && snapshot.lastPrice > 0
        ? snapshot.lastPrice
        : snapshot?.prevClosePrice && snapshot.prevClosePrice > 0
        ? snapshot.prevClosePrice
        : snapshot?.closePrice && snapshot.closePrice > 0
        ? snapshot.closePrice
        : undefined;

    const priceSanity = dataFreshnessGuard.validatePriceSanity({
      primaryPrice: rawPrice,
      prevClosePrice: snapshot?.prevClosePrice,
    });

    const effectivePrice = priceSanity.isValid ? priceSanity.sanitizedPrice : undefined;

    const missingItems: MissingDataDiagnostic[] = [];

    // 1. 实盘行情与挂单价格校验
    if (config.requireOrderBookPrice) {
      if (!effectivePrice || effectivePrice <= 0 || isNaN(effectivePrice)) {
        if (isMarketClosed) {
          missingItems.push({
            category: "LIVE_MARKET",
            field: "lastPrice",
            severity: "CRITICAL",
            description: `美股处于休市/周末时段，OpenD 暂未下发该标的有效历史收盘锚点价 (当前值: null)`,
            remedyAction: `当前处于美股休市期间，标的暂无实时撮合。系统需获取有效收盘价后方可测算风险与点位，您可在顶部切换为「模拟盘中」时态或等待开盘刷新。`,
          });
        } else if (isOpenDConnected) {
          missingItems.push({
            category: "LIVE_MARKET",
            field: "lastPrice",
            severity: "CRITICAL",
            description: `OpenD 网关已连通 (${hasLevel3Permissions ? "LV3 顶配权限" : "行情已连通"})，但标的 [${symbol}] 暂未拉取到报价 (当前值: ${snapshot?.lastPrice ?? "null"})`,
            remedyAction: `您的 OpenD 权限充足，但该标的可能在本地客户端中尚未被触发检索。建议在 MooMoo 客户端中搜索一下 [${symbol}] 以激活本地行情缓存。`,
          });
        } else {
          missingItems.push({
            category: "LIVE_MARKET",
            field: "lastPrice",
            severity: "CRITICAL",
            description: `MooMoo OpenD 网关 (127.0.0.1:11111) 未连通`,
            remedyAction: `请打开并登录本地 MooMoo OpenD 客户端以恢复行情通道。`,
          });
        }
      }
    }

    // 2. 机构主力与大单资金流向校验
    if (config.requireMainCapitalFlow) {
      const hasFlowData =
        snapshot &&
        (snapshot.mainCapitalInflow !== undefined || snapshot.capitalInflow !== undefined);
      if (!hasFlowData) {
        if (isMarketClosed) {
          missingItems.push({
            category: "LIVE_MARKET",
            field: "mainCapitalInflow",
            severity: "WARNING", // 休市期间资金流降级为 WARNING，不作为阻断推演的硬致命项
            description: `美股处于休市/周末时段，交易所暂停产生日内实时大单撮合数据`,
            remedyAction: `休市期间资金流向无实时增量，系统将自动采用历史主力筹码分布；开盘后将自动恢复实时逐笔资金流追踪。`,
          });
        } else {
          missingItems.push({
            category: "LIVE_MARKET",
            field: "mainCapitalInflow",
            severity: "CRITICAL",
            description: `机构主力/大单资金流向数据未同步`,
            remedyAction: `OpenD 实时资金流接口未返回有效数据，请检查该标的盘口资金流权限。`,
          });
        }
      }
    }

    // 3. 全网资讯时效与覆盖度校验
    if (config.requireNewsCoverage) {
      const validNews = (news || []).filter((n: any) => typeof n === "string" && n.trim().length > 5);
      if (validNews.length === 0) {
        missingItems.push({
          category: "NEWS_SEARCH",
          field: "latestNews",
          severity: "CRITICAL",
          description: `未检索到标的 [${symbol}] 近期有效资讯与催化剂快讯`,
          remedyAction: `资讯引擎未能抓取到相关新闻，请确认网络畅通或本地 SearXNG/直连通道正常。`,
        });
      }
    }

    // 4. 财务基本面与估值指标校验 (支持亏损成长股切换与 DataFreshnessGuard 正确性清洗)
    if (config.requireFundamentalsPe) {
      const fundSanity = dataFreshnessGuard.validateFundamentalsSanity(fundamentals);
      const pe = fundamentals?.peRatio ?? snapshot?.peRatio;
      const hasValidPe = pe !== undefined && pe !== null && !isNaN(pe) && pe > 0;
      const hasRevenueGrowth = fundamentals?.revenueGrowthPct !== undefined;
      const isLossMakingValid = fundSanity.isLossMaking && hasRevenueGrowth;

      if (!hasValidPe && !hasRevenueGrowth && !isLossMakingValid) {
        missingItems.push({
          category: "FUNDAMENTALS",
          field: "peRatio",
          severity: "CRITICAL",
          description: `标的市盈率 (PE) 与财务基本面数据未同步`,
          remedyAction: `该标的为新加入自选/雷达的股票，本地财报库暂未录入其 PE 估值与营收指标。点击该标的卡片中的「知识图谱」即可快速补录基本面。`,
        });
      }
    }

    // 5. 产业链因果拓扑图谱校验
    if (config.requireKnowledgeGraph) {
      const nodeCount = knowledgeGraph?.nodes?.length ?? 0;
      const edgeCount = knowledgeGraph?.edges?.length ?? 0;
      if (!knowledgeGraph || nodeCount < config.minKnowledgeGraphNodes) {
        missingItems.push({
          category: "KNOWLEDGE_GRAPH",
          field: "nodes",
          severity: "CRITICAL",
          description: `产业链因果拓扑图谱缺失或关联节点数过少 (当前节点数: ${nodeCount}, 要求 ≥ ${config.minKnowledgeGraphNodes})`,
          remedyAction: `请在系统「知识图谱」面板中为 [${symbol}] 录入上下游供应商、客户及核心竞争对手因果关联。`,
        });
      } else if (edgeCount === 0) {
        missingItems.push({
          category: "KNOWLEDGE_GRAPH",
          field: "edges",
          severity: "WARNING",
          description: `知识图谱存在节点但缺少因果影响关系边 (Edges = 0)`,
          remedyAction: `请补全图谱实体间的供给、竞争或宏观驱动关系边以计算冲击传导。`,
        });
      }
    }

    // 6. 期权 Gamma 筹码结构 (选配)
    if (config.requireOptionGamma && !hasOptionChainData) {
      missingItems.push({
        category: "OPTIONS_CHAIN",
        field: "optionChain",
        severity: "WARNING",
        description: `标的期权未平仓合约 (Open Interest) 与 Gamma 分布未获取`,
        remedyAction: `可开通美股期权链订阅以激活做市商防御位推演。`,
      });
    }

    const criticalCount = missingItems.filter((m) => m.severity === "CRITICAL").length;
    const warningCount = missingItems.filter((m) => m.severity === "WARNING").length;
    const isSufficient = criticalCount === 0;

    // 完备度打分：每个 Critical 扣 25 分，每个 Warning 扣 10 分
    const rawScore = 100 - criticalCount * 25 - warningCount * 10;
    const completenessScore = Math.max(0, Math.min(100, rawScore));

    const abortReason = !isSufficient
      ? `🚨 信息完备性校验未通过 (${missingItems.filter(m => m.severity === "CRITICAL").map(m => m.field).join(", ")})。已主动阻断推演，严禁在信息缺失下主观臆测。`
      : undefined;

    return {
      symbol: symbol.toUpperCase(),
      isSufficient,
      completenessScore,
      criticalMissingCount: criticalCount,
      warningCount,
      missingItems,
      abortReason,
      evaluatedAt: new Date().toISOString(),
    };
  }

  /**
   * 当数据不完备时，生成标准化的熔断 ActionItem (零资金分配，绝对安全)
   */
  public static buildInsufficientDataAction(params: {
    symbol: string;
    companyName?: string;
    currentPrice?: number;
    report: DataSufficiencyReport;
  }): ActionItem {
    const { symbol, companyName, currentPrice = 0, report } = params;
    const missingFieldsText = report.missingItems
      .filter((m) => m.severity === "CRITICAL")
      .map((m) => m.field)
      .join("、");

    const diagnosticBullets = report.missingItems
      .map(
        (m, idx) =>
          `${idx + 1}. [${m.category}] ${m.description}\n   👉 修复建议: ${m.remedyAction}`
      )
      .join("\n");

    return {
      action: "HOLD",
      actionType: "INSUFFICIENT_DATA_ABORT",
      symbol: symbol.toUpperCase(),
      companyName: companyName || symbol,
      suggestedShares: 0,
      estimatedPrice: currentPrice,
      estimatedAmount: 0,
      urgency: "LOW",
      whySummary: `⚠️ 信息维度不足拒绝推演：核心要素 [${missingFieldsText || "未知"}] 缺失，完备度 ${report.completenessScore}%。`,
      rationale: `【信息缺失告警与排障指引】:\n系统坚守「宁可错过，绝不在信息盲区臆测」原则。由于底层关键数据断流，已主动熔断大模型推演。\n\n${diagnosticBullets}\n\n📌 建议操作：请在补齐上述数据或修复对应服务后重新执行推演。`,
      targetPrice: undefined,
      stopLossPrice: undefined,
      capitalAllocationAmount: 0,
      capitalAllocationPct: 0,
      certaintyScore: 0,
      goalAttainmentProbability: 0,
      dataSufficiencyReport: report,
    };
  }
}

export const dataSufficiencyGatekeeper = DataSufficiencyGatekeeper;
