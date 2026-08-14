import os from "os";
import { execSync } from "child_process";
import {
  ActionItem,
  RiskAlert,
  StockPositionItem,
  StockKnowledgeGraphItem,
  SingleStockIntel,
  StockFundamentals,
  StockStrategyCategory,
} from "../types/stockTypes";
import { graphQuantitativeEngine } from "./graphQuantitativeEngine";
import { quantRiskManager } from "./quantRiskManager";

export interface HardwareInfo {
  totalRamGb: number;
  gpuName?: string;
  vramGb?: number;
  cpuCores: number;
  summary: string;
}

export interface ModelRecommendation {
  name: string;
  score: number;
  isRecommended: boolean;
  reason: string;
  parameterSize?: string;
}

export interface OllamaStatus {
  connected: boolean;
  ollamaUrl: string;
  models: string[];
  recommendedModel: string;
  hardware: HardwareInfo;
  modelRecommendations: ModelRecommendation[];
  message: string;
}

export interface OllamaDeductionResult {
  actions: ActionItem[];
  riskAlerts: RiskAlert[];
  marketOverview: string;
  promptText: string;
  rawOllamaResponse?: string;
  knowledgeGraphContext: string;
  searxngNewsContext: string;
  positionsContext: string;
  lessonsContext: string;
  modelUsed: string;
}

export class OllamaService {
  private cachedHardwareInfo: HardwareInfo | null = null;

  private get baseUrl(): string {
    return process.env.OLLAMA_URL || "http://127.0.0.1:11434";
  }

  public detectHardware(): HardwareInfo {
    if (this.cachedHardwareInfo) return this.cachedHardwareInfo;

    const totalRamGb = Number((os.totalmem() / (1024 * 1024 * 1024)).toFixed(1));
    const cpuCores = os.cpus().length;
    let gpuName = "Generic Graphics";
    let vramGb = 0;

    try {
      const output = execSync('nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits', {
        encoding: "utf-8",
        timeout: 3000,
      }).trim();
      if (output) {
        const parts = output.split(",");
        if (parts.length >= 2) {
          gpuName = parts[0].trim();
          vramGb = Number((parseFloat(parts[1].trim()) / 1024).toFixed(1));
        }
      }
    } catch (e) {
      try {
        const psOut = execSync('powershell -Command "(Get-CimInstance Win32_VideoController | Select-Object -First 1).Name"', {
          encoding: "utf-8",
          timeout: 3000,
        }).trim();
        if (psOut) gpuName = psOut;
      } catch (e2) {}
    }

    const summary = vramGb > 0
      ? `💻 ${totalRamGb}GB RAM | ${gpuName} (${vramGb}GB VRAM)`
      : `💻 ${totalRamGb}GB RAM | ${cpuCores} 核 CPU`;

    this.cachedHardwareInfo = { totalRamGb, gpuName, vramGb, cpuCores, summary };
    return this.cachedHardwareInfo;
  }

  public rankModelsForHardware(installedModels: string[], hardware: HardwareInfo): {
    recommendedModel: string;
    modelRecommendations: ModelRecommendation[];
  } {
    if (installedModels.length === 0) {
      return { recommendedModel: "", modelRecommendations: [] };
    }

    const vram = hardware.vramGb || 0;
    const maxMemoryCapacityGb = vram > 0 ? vram : hardware.totalRamGb * 0.6;

    const recommendations: ModelRecommendation[] = installedModels.map((m) => {
      const lower = m.toLowerCase();
      let score = 50;
      let reason = "通用大语言模型";
      let parameterSize = "标准参数";

      if (lower.includes("qwen3.6") || lower.includes("qwen2.5:32b") || lower.includes("qwen2.5:72b")) {
        score = 98;
        reason = "针对中英金融与结构化 JSON 强对齐的最强推理模型";
        parameterSize = "27B/32B 大参数";
      } else if (lower.includes("qwen") || lower.includes("deepseek")) {
        score = 94;
        reason = "优秀的代码与金融逻辑推演大模型";
        parameterSize = "14B/32B";
      } else if (lower.includes("gemma4:12b") || lower.includes("gemma2:27b")) {
        score = 93;
        reason = "Google Gemma 官方通用推理旗舰模型";
        parameterSize = "12B/27B";
      } else if (lower.includes("muse-glimmer-30b")) {
        score = 91;
        reason = "大参数多任务复杂逻辑推理模型";
        parameterSize = "30B 大参数";
      } else if (lower.includes("sensenova")) {
        score = 86;
        reason = "高速响应平衡型 8B 模型";
        parameterSize = "8B";
      } else if (lower.includes("gemma4:e4b") || lower.includes("e4b")) {
        score = 75;
        reason = "极速轻量款模型";
        parameterSize = "4B";
      } else if (lower.includes("embed")) {
        score = 10;
        reason = "Embedding 向量模型 (非生成式 LLM)";
        parameterSize = "Vector";
      }

      if (maxMemoryCapacityGb < 12 && (lower.includes("30b") || lower.includes("32b") || lower.includes("70b"))) {
        score -= 25;
        reason += " (硬件显存较吃紧)";
      }

      return {
        name: m,
        score,
        isRecommended: false,
        reason,
        parameterSize,
      };
    });

    recommendations.sort((a, b) => b.score - a.score);

    const best = recommendations[0];
    if (best) best.isRecommended = true;

    return {
      recommendedModel: best ? best.name : installedModels[0],
      modelRecommendations: recommendations,
    };
  }

  public async getStatus(): Promise<OllamaStatus> {
    const ollamaUrl = this.baseUrl;
    const hardware = this.detectHardware();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const resp = await fetch(`${ollamaUrl}/api/tags`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (resp.ok) {
        const data: any = await resp.json();
        const models = Array.isArray(data?.models) ? data.models.map((m: any) => m.name) : [];
        const { recommendedModel, modelRecommendations } = this.rankModelsForHardware(models, hardware);

        return {
          connected: true,
          ollamaUrl,
          models,
          recommendedModel,
          hardware,
          modelRecommendations,
          message: `🟢 Ollama 已连通 (${hardware.summary})，推荐首选模型: ${recommendedModel}`,
        };
      }
    } catch (err: any) {}

    return {
      connected: false,
      ollamaUrl,
      models: [],
      recommendedModel: "",
      hardware,
      modelRecommendations: [],
      message: `🔴 未检测到 Ollama 服务 (${ollamaUrl})`,
    };
  }

  /**
   * Stage A Chunk: 独立推演大盘宏观与明星热门板块
   */
  public async generateMacroSummaryWithOllama(
    modelName: string,
    searxngNewsText: string
  ): Promise<string> {
    const prompt = `请作为专业美股量化宏观分析师，根据以下从 SearXNG 抓取到的最新美股全网盘前资讯，简短总结今日美股大盘走向、主要市场情绪与明星热门板块。

========================================
全网盘前资讯:
${searxngNewsText || "盘前资讯暂未检索到显著异常，维持平稳动向。"}

========================================
输出要求:
输出一段不超过 200 字的精炼宏观大盘与热门板块总结。`;

    try {
      const resp = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: "user", content: prompt }],
          stream: false,
        }),
      });

      if (resp.ok) {
        const resData: any = await resp.json();
        const content = resData?.message?.content;
        if (content) return content.trim();
      }
    } catch (e) {}

    return searxngNewsText ? searxngNewsText.slice(0, 180) : "美股盘前大盘走势分化，建议重点关注基本面与催化消息。";
  }

  /**
   * Stage B Map Chunk: 针对单只候选股票做分段小 Context 推理 (含盘面、基本面、消息、情绪、大资金与衰减图谱)
   * 纯动态构造，零硬编码示例
   */
  public async deduceSingleStockWithOllama(
    modelName: string,
    stockData: {
      symbol: string;
      companyName?: string;
      currentPrice: number;
      holdingPosition?: StockPositionItem;
      intel: SingleStockIntel;
      knowledgeGraph?: StockKnowledgeGraphItem;
      fundamentals?: StockFundamentals;
      lessonsLearned: string[];
      macroPromptContext?: string;
      strategyCategory?: StockStrategyCategory;
      strategyCategoryLabel?: string;
      strategyCategoryReason?: string;
    }
  ): Promise<ActionItem | null> {
    const s = stockData.symbol;
    const cName = stockData.companyName || s;
    const curP = stockData.currentPrice;
    const pos = stockData.holdingPosition;
    const news = stockData.intel.latestNews;
    const flow = stockData.intel.capitalFlow;
    const fund = stockData.fundamentals;
    const kg = stockData.knowledgeGraph;
    const macroConstraint = stockData.macroPromptContext || "宏观大盘整体平稳，注意顺应主线与止损防线。";
    const categoryInfo = stockData.strategyCategoryLabel
      ? `${stockData.strategyCategoryLabel}: ${stockData.strategyCategoryReason || ""}`
      : "全美股精选标的";

    const posInfoText = pos && pos.shares > 0
      ? `目前持仓 ${pos.shares} 股，成本价 $${pos.costBasis.toFixed(2)}，浮动盈亏 ${(((curP - pos.costBasis) / pos.costBasis) * 100).toFixed(1)}%`
      : "当前暂无持仓 (为候选观察/建仓标的)";

    const newsText = news.length > 0 ? news.join("\n") : "暂无最新新闻";
    const flowText = flow ? `趋势: ${flow.trend}, 详情: ${flow.description}` : "资金动向未知";
    const fundText = fund
      ? `PE: ${fund.peRatio ?? "未知"}, 营收增长: ${fund.revenueGrowthPct ?? "未知"}%, 净利润率: ${fund.netMarginPct ?? "未知"}%, 下次财报日: ${fund.nextEarningsDate ?? "未知"}`
      : "基本面数据暂未录入";

    const kgText = kg
      ? graphQuantitativeEngine.formatTripletsForPrompt(kg)
      : "【产业链知识图谱】: 暂未检索到扩展拓扑节点";

    const spilloverAlpha = kg ? (kg.spilloverAlphaScore ?? graphQuantitativeEngine.calculateSpilloverAlpha(kg)) : 0;
    const networkRisk = kg ? (kg.networkRiskScore ?? graphQuantitativeEngine.calculateNetworkRisk(kg)) : 30;

    const lessonsText = stockData.lessonsLearned.length > 0
      ? stockData.lessonsLearned.map((l, i) => `${i + 1}. ${l}`).join("\n")
      : "无历史风控教训";

    const prompt = `分析美股标的 [${s}] (${cName}) 的全要素数据，结合策略分类归属、产业链上下游拓扑与今日宏观大盘约束，评估操作方向与逻辑论据。

【策略分类归属】:
${categoryInfo}

【大盘宏观背景与策略约束】:
${macroConstraint}

【盘面与持仓】:
- 当前现价: $${curP.toFixed(2)}
- 持仓状况: ${posInfoText}

【基本面财报】:
${fundText}

【盘前新闻与催化】:
${newsText}

【主力/机构大资金走向】:
${flowText}

${kgText}

【历史复盘风控教训】:
${lessonsText}

输出要求:
请以纯 JSON 格式输出以下结构 (不要包含 markdown 额外文本):
{
  "action": "BUY" | "TRIM" | "HOLD" | "SELL",
  "symbol": "${s}",
  "companyName": "${cName}",
  "rationale": "详细操作逻辑说明 (结合产业链因果传导与量化动量归因)",
  "urgency": "HIGH" | "MEDIUM" | "LOW"
}`;

    try {
      const resp = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: "user", content: prompt }],
          stream: false,
          format: "json",
        }),
      });

      if (resp.ok) {
        const resData: any = await resp.json();
        const contentText = resData?.message?.content || "";
        let jsonParsed: any = null;
        try {
          jsonParsed = JSON.parse(contentText);
        } catch (e) {
          const match = contentText.match(/\{[\s\S]*\}/);
          if (match) jsonParsed = JSON.parse(match[0]);
        }

        if (jsonParsed && jsonParsed.action && jsonParsed.symbol) {
          const rawAction: ActionItem = {
            action: jsonParsed.action,
            symbol: s,
            companyName: cName,
            suggestedShares: Number(jsonParsed.suggestedShares || 10),
            estimatedPrice: curP,
            estimatedAmount: Number((10 * curP).toFixed(2)),
            rationale: jsonParsed.rationale || `基于 [${s}] 盘面现价 $${curP}、产业链拓扑与策略归属 (${categoryInfo}) 推演`,
            urgency: jsonParsed.urgency || "MEDIUM",
            targetPrice: 0,
            stopLossPrice: 0,
            riskRewardRatio: 2.0,
            strategyCategory: stockData.strategyCategory,
            strategyCategoryLabel: stockData.strategyCategoryLabel,
            strategyCategoryReason: stockData.strategyCategoryReason,
          };

          // 通过数学风控与 ATR 波幅严格对齐解算目标价、止损价与持仓股数
          return quantRiskManager.alignActionWithQuantRisk(
            rawAction,
            curP,
            spilloverAlpha,
            networkRisk
          );
        }
      }
    } catch (e) {}

    return null;
  }

  /**
   * Stage C Master Fusion: 汇总分段 Map-Reduce 结果生成完整推演结果
   */
  public async generateStrategyWithOllama(
    modelName: string,
    context: {
      positions: StockPositionItem[];
      candidateSymbols: string[];
      candidateStockIntels: Map<string, SingleStockIntel>;
      quotesMap: Map<string, number>;
      searxngNewsText: string;
      macroPromptContext?: string;
      candidateCategoryMap?: Map<string, { category: StockStrategyCategory; label: string; reason: string }>;
      knowledgeGraphs: StockKnowledgeGraphItem[];
      lessonsLearned: string[];
      totalBudget: number;
      cashBalance: number;
      riskPreference: string;
    }
  ): Promise<OllamaDeductionResult> {
    const status = await this.getStatus();
    if (!status.connected || status.models.length === 0) {
      throw new Error("Ollama 服务未连接");
    }

    const selectedModel = status.models.includes(modelName) ? modelName : status.recommendedModel || status.models[0];

    // Stage A: 宏观 Chunk 推理
    const macroOverview = await this.generateMacroSummaryWithOllama(selectedModel, context.searxngNewsText);

    // Stage B: 候选股票 Map Chunk 并发分段推理 (注入宏观约束与策略归属提示词)
    const inferencePromises = context.candidateSymbols.map(async (sym) => {
      const pos = context.positions.find((p) => p.symbol.toUpperCase() === sym.toUpperCase());
      const curP =
        context.quotesMap.get(sym.toUpperCase()) ||
        pos?.marketPrice ||
        pos?.costBasis ||
        0;

      const intel = context.candidateStockIntels.get(sym.toUpperCase()) || {
        symbol: sym,
        latestNews: [],
        communitySentiment: { mood: "UNKNOWN", keyTopics: [] },
        capitalFlow: { trend: "NEUTRAL", description: "未知" },
      };
      const kg = context.knowledgeGraphs.find((k) => k.symbol.toUpperCase() === sym.toUpperCase());
      const catMeta = context.candidateCategoryMap?.get(sym.toUpperCase());

      const itemRes = await this.deduceSingleStockWithOllama(selectedModel, {
        symbol: sym,
        companyName: pos?.companyName || sym,
        currentPrice: curP,
        holdingPosition: pos,
        intel,
        knowledgeGraph: kg,
        lessonsLearned: context.lessonsLearned,
        macroPromptContext: context.macroPromptContext,
        strategyCategory: catMeta?.category,
        strategyCategoryLabel: catMeta?.label,
        strategyCategoryReason: catMeta?.reason,
      });

      if (itemRes) {
        return itemRes;
      }

      // Fallback rule-based recommendation
      const isHolding = pos && pos.shares > 0;
      const pnlPct = pos && pos.costBasis > 0 ? ((curP - pos.costBasis) / pos.costBasis) * 100 : 0;
      let actionType: "BUY" | "TRIM" | "HOLD" = "HOLD";
      let shares = 0;
      let rationale = `[${sym}] 现价 $${curP.toFixed(2)}，多维指标处于中性区间，维持观望`;

      if (catMeta?.category === "OVERSOLD_BUY" || catMeta?.category === "CAPITAL_INFLOW_BUY" || catMeta?.category === "FUNDAMENTAL_BUY" || catMeta?.category === "NEWS_CATALYST_BUY") {
        actionType = "BUY";
        shares = curP > 0 ? Math.max(1, Math.floor(Math.min(context.totalBudget * 0.35, 1000) / curP)) : 0;
        rationale = `[${sym}] 触发 ${catMeta.label} 信号 (${catMeta.reason})，建议在现价 $${curP.toFixed(2)} 建仓 ${shares} 股。`;
      } else if (isHolding && pnlPct >= 18.0) {
        actionType = "TRIM";
        shares = Math.max(1, Math.floor(pos.shares * 0.35));
        rationale = `[${sym}] 累计浮盈 +${pnlPct.toFixed(1)}%，建议减仓 ${shares} 股锁定收益`;
      } else if (isHolding && pnlPct <= -8.0) {
        actionType = "TRIM";
        shares = Math.max(1, Math.floor(pos.shares * 0.5));
        rationale = `[${sym}] 触发 -8.0% 止损纪律，建议减仓 ${shares} 股规避下行风险`;
      } else if (isHolding) {
        actionType = "HOLD";
        shares = pos.shares;
        rationale = `[${sym}] 持仓运行健康，建议维持现有底仓`;
      }

      const urgency: "HIGH" | "MEDIUM" | "LOW" = actionType === "TRIM" || actionType === "BUY" ? "HIGH" : "LOW";

      const fallbackItem: ActionItem = {
        action: actionType,
        symbol: sym,
        companyName: pos?.companyName || sym,
        suggestedShares: shares,
        estimatedPrice: Number(curP.toFixed(2)),
        estimatedAmount: Number((shares * curP).toFixed(2)),
        rationale,
        urgency,
        targetPrice: Number((curP * 1.15).toFixed(2)),
        stopLossPrice: Number((curP * 0.92).toFixed(2)),
        riskRewardRatio: 2.2,
        strategyCategory: catMeta?.category,
        strategyCategoryLabel: catMeta?.label,
        strategyCategoryReason: catMeta?.reason,
        isOversoldOpportunity: catMeta?.category === "OVERSOLD_BUY",
        oversoldReason: catMeta?.reason,
      };
      return fallbackItem;
    });

    const actions: ActionItem[] = await Promise.all(inferencePromises);
    const riskAlerts: RiskAlert[] = [];

    context.candidateSymbols.forEach((sym) => {
      const pos = context.positions.find((p) => p.symbol.toUpperCase() === sym.toUpperCase());
      const curP = context.quotesMap.get(sym.toUpperCase()) || pos?.marketPrice || pos?.costBasis || 0;
      if (pos && pos.costBasis > 0 && curP > 0) {
        const pnlPct = ((curP - pos.costBasis) / pos.costBasis) * 100;
        if (pnlPct <= -8.0) {
          riskAlerts.push({
            level: "CRITICAL",
            title: `[${sym}] 触发止损戒备`,
            description: `当前浮亏 ${pnlPct.toFixed(1)}%，已下破 -8.0% 防线`,
            relatedSymbol: sym,
          });
        }
      }
    });

    return {
      actions,
      riskAlerts,
      marketOverview: macroOverview,
      promptText: `[Map-Reduce Chunked Pipeline Execute on ${selectedModel}]`,
      rawOllamaResponse: JSON.stringify({ macroOverview, actionsCount: actions.length }),
      knowledgeGraphContext: `${context.knowledgeGraphs.length} 标的知识图谱数据组装完毕`,
      searxngNewsContext: context.searxngNewsText,
      positionsContext: `${context.positions.length} 笔持仓明细`,
      lessonsContext: `${context.lessonsLearned.length} 条纪律与教训`,
      modelUsed: selectedModel,
    };
  }
}

export const ollamaService = new OllamaService();
