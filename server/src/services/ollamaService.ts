import os from "os";
import { execSync } from "child_process";
import {
  ActionItem,
  StockActionVerdict,
  RiskAlert,
  StockPositionItem,
  StockKnowledgeGraphItem,
  SingleStockIntel,
  StockFundamentals,
  StockStrategyCategory,
  TimeFmForecastItem,
  MarketSessionContext,
} from "../types/stockTypes";
import { graphQuantitativeEngine } from "./graphQuantitativeEngine";
import { quantRiskManager } from "./quantRiskManager";
import { marketCalendarService } from "./marketCalendarService";

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

export interface RawOllamaModelInfo {
  name: string;
  size?: number;
  details?: {
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
    format?: string;
  };
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
        timeout: 2000,
        stdio: ["ignore", "pipe", "ignore"],
      });
      const lines = output.trim().split("\n");
      if (lines.length > 0 && lines[0].trim()) {
        const parts = lines[0].split(",");
        gpuName = parts[0]?.trim() || "NVIDIA GPU";
        vramGb = Number((parseFloat(parts[1]?.trim() || "0") / 1024).toFixed(1));
      }
    } catch {
      const cpus = os.cpus();
      if (cpus && cpus.length > 0) {
        gpuName = `CPU Inference (${cpus[0].model.trim()})`;
      }
    }

    const summary = vramGb > 0
      ? `${gpuName} (${vramGb}GB 显存) + ${totalRamGb}GB 内存 (${cpuCores}核)`
      : `${totalRamGb}GB 内存 + ${gpuName} (${cpuCores}核)`;

    this.cachedHardwareInfo = {
      totalRamGb,
      gpuName,
      vramGb,
      cpuCores,
      summary,
    };
    return this.cachedHardwareInfo;
  }

  public evaluateModel(modelName: string, hardware: HardwareInfo): ModelRecommendation {
    const lower = modelName.toLowerCase();
    let score = 50;
    let reason = "通用开源大模型";
    let paramSize = "标准";

    // 0. 排除文本嵌入与向量模型 (Embedding / Reranker 模型不具备文本生成与推演能力)
    if (
      lower.includes("embed") ||
      lower.includes("bge") ||
      lower.includes("nomic") ||
      lower.includes("rerank")
    ) {
      return {
        name: modelName,
        score: 0,
        isRecommended: false,
        reason: "文本嵌入/向量模型，非策略生成大模型",
        parameterSize: "Embedding",
      };
    }

    // 1. Qwen / 通义千问系列 (支持精确识别 qwen3.8 / qwen3.6 / qwen2.5 及 72b / 32b / 27b / 14b / 8b / 7b)
    if (lower.includes("qwen") || lower.includes("千问")) {
      // 提取代际版本号 (如 qwen3.8 -> 3.8, qwen3.6 -> 3.6, qwen2.5 -> 2.5)
      const verMatch = lower.match(/qwen(\d+(?:\.\d+)?)/i);
      const versionNum = verMatch ? parseFloat(verMatch[1]) : 2.5;

      // 提取参数量 (如 72b, 32b, 30b, 27b, 14b, 8b, 7b, 4b, 1.5b)
      const sizeMatch = lower.match(/(\d+(?:\.\d+)?)[bB]/);
      const sizeNum = sizeMatch ? parseFloat(sizeMatch[1]) : 0;
      paramSize = sizeNum > 0 ? `${sizeNum}B` : "旗舰基座";

      // 基础代际得分 (最新强大代际: 3.8 > 3.6 > 3.0 > 2.5)
      let baseScore = 82;
      if (versionNum >= 3.8) {
        baseScore = 98;
        reason = "最新通义千问 3.8 旗舰大模型，逻辑推理与金融盘面推演能力顶尖";
      } else if (versionNum >= 3.6) {
        baseScore = 92;
        reason = "千问 3.6 代际模型，具备扎实的多因子量化决策能力";
      } else if (versionNum >= 3.0) {
        baseScore = 88;
        reason = "千问 3 代大模型，性能优良";
      } else if (versionNum >= 2.5) {
        baseScore = 85;
        reason = "千问 2.5 经典稳定基座";
      }

      // 结合 24GB 显存 (RTX 4090) 硬件适配加成
      if (hardware.vramGb && hardware.vramGb >= 24) {
        if (sizeNum >= 27 && sizeNum <= 34) {
          baseScore += 2;
          reason += " (24GB 显存黄金适配)";
        }
      }

      score = Math.min(99, baseScore);
    }
    // 2. DeepSeek 系列 (深度逻辑与金融推演)
    else if (lower.includes("deepseek")) {
      paramSize = "Reasoning/MoE";
      score = 96;
      reason = "深度推理与逻辑归因能力极强，金融推演优选";
    }
    // 3. Google Gemma 系列
    else if (lower.includes("gemma")) {
      const sizeMatch = lower.match(/(\d+(?:\.\d+)?)[bB]/);
      paramSize = sizeMatch ? `${sizeMatch[1]}B` : "Gemma";
      score = lower.includes("gemma4") || lower.includes("gemma-4") ? 93 : 88;
      reason = "Google 优质开源基座，时序与语义理解优秀";
    }
    // 4. Meta Llama 3 系列
    else if (lower.includes("llama3") || lower.includes("llama-3")) {
      const sizeMatch = lower.match(/(\d+(?:\.\d+)?)[bB]/);
      paramSize = sizeMatch ? `${sizeMatch[1]}B` : "Llama3";
      score = 90;
      reason = "Meta 顶尖基座，泛化与决策能力稳定";
    }
    // 5. 其他大模型 (Muse, SenseNova 等)
    else {
      const sizeMatch = lower.match(/(\d+(?:\.\d+)?)[bB]/);
      const sizeNum = sizeMatch ? parseFloat(sizeMatch[1]) : 0;
      paramSize = sizeNum > 0 ? `${sizeNum}B` : "通用";
      if (sizeNum >= 27 && hardware.vramGb && hardware.vramGb >= 24) {
        score = 88;
        reason = "大参数开源模型，显存适配良好";
      } else {
        score = 75;
        reason = "通用开源大模型";
      }
    }

    return {
      name: modelName,
      score,
      isRecommended: false,
      reason,
      parameterSize: paramSize,
    };
  }

  public async getStatus(): Promise<OllamaStatus> {
    const hardware = this.detectHardware();
    try {
      const resp = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(2500),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const data: any = await resp.json();
      const rawModels: RawOllamaModelInfo[] = data.models || [];
      const modelNames = rawModels.map((m) => m.name);

      const evaluated = modelNames.map((name) => this.evaluateModel(name, hardware));
      evaluated.sort((a, b) => b.score - a.score);

      let recommendedModel = "";
      if (evaluated.length > 0) {
        evaluated[0].isRecommended = true;
        recommendedModel = evaluated[0].name;
      }

      return {
        connected: true,
        ollamaUrl: this.baseUrl,
        models: modelNames,
        recommendedModel,
        hardware,
        modelRecommendations: evaluated,
        message: modelNames.length > 0
          ? `🟢 Ollama 在线 (已加载 ${modelNames.length} 个模型)`
          : `🟡 Ollama 在线但未安装任何模型`,
      };
    } catch {
      return {
        connected: false,
        ollamaUrl: this.baseUrl,
        models: [],
        recommendedModel: "",
        hardware,
        modelRecommendations: [],
        message: `🔴 Ollama 未运行 (无法连接 ${this.baseUrl})`,
      };
    }
  }

  public async generateMacroSummaryWithOllama(
    modelName: string,
    searxngNewsText: string
  ): Promise<string> {
    const prompt = `你是一名华尔街顶级宏观策略首席分析师与美股基金经理。
请基于以下最新实时宏观新闻与资讯，提炼一段精炼、富有洞察力的美股盘前宏观走势综述 (约 150-250 字)。
说明当前市场主线、流动性预期、主要风险偏好及对仓位防守/进攻的指引。

【实时宏观资讯】:
${searxngNewsText || "暂无最新全球宏观突发新闻"}

请直接输出综述正文，不要包含多余问候或 markdown 标题：`;

    try {
      const resp = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(60000),
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: "user", content: prompt }],
          stream: false,
        }),
      });

      if (resp.ok) {
        const resData: any = await resp.json();
        const output = resData?.message?.content?.trim();
        if (output) return output;
      }
    } catch (e) {
      console.warn(`[Ollama Macro Summary] Inference timeout or error: ${e}`);
    }

    return searxngNewsText
      ? searxngNewsText.slice(0, 180)
      : "美股盘前大盘走势分化，建议重点关注基本面与催化消息，控制回撤。";
  }

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
      timefmForecast?: TimeFmForecastItem;
      verifiedPromptHistory?: string;
      targetProfitGoalPct?: number;
      targetTimeHorizonDays?: number;
      maxDrawdownPct?: number;
      userBudget?: number;
      marketSession?: MarketSessionContext;
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
    const tfm = stockData.timefmForecast;
    const verifiedMemories = stockData.verifiedPromptHistory || "无历史实盘验证教训";
    const macroConstraint = stockData.macroPromptContext || "宏观大盘整体平稳，注意顺应主线与止损防线。";
    const categoryInfo = stockData.strategyCategoryLabel
      ? `${stockData.strategyCategoryLabel}: ${stockData.strategyCategoryReason || ""}`
      : "全美股精选标的";

    const targetT = stockData.targetTimeHorizonDays || 5;
    const targetG = stockData.targetProfitGoalPct || 8.0;
    const maxD = stockData.maxDrawdownPct || 4.0;
    const userBudget = stockData.userBudget || 2000.0;

    const session = stockData.marketSession || marketCalendarService.getMarketSession();
    const sessionPromptText = marketCalendarService.formatSessionPromptContext(session);

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

    const tfmText = tfm
      ? `【Google TimeFM 时序大模型 AI 走势预测】:\n- 次日预测方向: ${tfm.directionLabel}\n- 预测目标中枢: $${tfm.predictedPrice} (置信区间 [${tfm.confidenceLow}, ${tfm.confidenceHigh}])\n- 时序动量推论: ${tfm.momentumRationale}`
      : "【Google TimeFM 时序大模型 AI 走势预测】: 暂无足够K线样本进行预测";

    const spilloverAlpha = kg ? (kg.spilloverAlphaScore ?? graphQuantitativeEngine.calculateSpilloverAlpha(kg)) : 0;
    const networkRisk = kg ? (kg.networkRiskScore ?? graphQuantitativeEngine.calculateNetworkRisk(kg)) : 30;

    const prompt = `分析美股标的 [${s}] (${cName}) 的全要素数据。
我们计算的目的不是为了处理海量信息而堆砌信息，而是消除迷茫的程度，在严格成本与时间限制下，把走势确定性算准。

${sessionPromptText}

【用户刚性目标与资金约束】:
- 手头可调用资金空间: $${userBudget.toFixed(0)}
- 限定交易日时间跨度: ${targetT} 个交易日
- 预期盈利目标: +${targetG.toFixed(1)}%
- 最大风险回撤红线: -${maxD.toFixed(1)}%

【策略分类归属】:
${categoryInfo}

【大盘宏观背景与策略约束】:
${macroConstraint}

【盘面与持仓】:
- 当前现价: $${curP.toFixed(2)}
- 持仓状况: ${posInfoText}

${tfmText}

【基本面财报】:
${fundText}

【${session.marketPhase === "PRE_MARKET" ? "盘前新闻与催化" : session.marketPhase === "INTRADAY" ? "盘中实时突发快讯" : "最新新闻资讯"}】:
${newsText}

【主力/机构大资金走向】:
${flowText}

${kgText}

${verifiedMemories}

输出要求:
请以严格的 JSON 格式输出以下结构：
{
  "actionType": "OPEN_POSITION" | "ADD_POSITION" | "TRIM_POSITION" | "CLOSE_POSITION" | "HOLD_AND_WATCH",
  "action": "BUY" | "TRIM" | "HOLD" | "SELL",
  "symbol": "${s}",
  "companyName": "${cName}",
  "whySummary": "1~2句话直击核心：基于5大客观事实说明【为什么】做此操作",
  "entryZoneMin": ${Number((curP * 0.992).toFixed(2))},
  "entryZoneMax": ${Number((curP * 1.006).toFixed(2))},
  "rationale": "基于当前 [${session.phaseLabel}] 时态与 【${session.activeRoleName}】 角色，消除迷茫的核心确定性逻辑 (论证为何能在限定 ${targetT} 日内达成 +${targetG}% 目标，明确挂单区间与时间止损纪律)",
  "urgency": "HIGH" | "MEDIUM" | "LOW"
}`;

    try {
      const resp = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(60000),
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
        } catch {
          const match = contentText.match(/\{[\s\S]*\}/);
          if (match) jsonParsed = JSON.parse(match[0]);
        }

        if (jsonParsed && (jsonParsed.action || jsonParsed.actionType) && jsonParsed.symbol) {
          const inferActionType: StockActionVerdict = jsonParsed.actionType || (
            jsonParsed.action === "BUY"
              ? (pos && pos.shares > 0 ? "ADD_POSITION" : "OPEN_POSITION")
              : jsonParsed.action === "SELL" || jsonParsed.action === "TRIM"
              ? (jsonParsed.action === "SELL" ? "CLOSE_POSITION" : "TRIM_POSITION")
              : "HOLD_AND_WATCH"
          );

          const rawAction: ActionItem = {
            action: jsonParsed.action || (inferActionType === "OPEN_POSITION" || inferActionType === "ADD_POSITION" ? "BUY" : inferActionType === "CLOSE_POSITION" || inferActionType === "TRIM_POSITION" ? "TRIM" : "HOLD"),
            actionType: inferActionType,
            whySummary: jsonParsed.whySummary || jsonParsed.rationale?.slice(0, 120) || `基于 [${s}] 5大客观事实与确定性量化求解建议 ${inferActionType}`,
            symbol: s,
            companyName: cName,
            suggestedShares: Number(jsonParsed.suggestedShares || 10),
            estimatedPrice: curP,
            estimatedAmount: Number((10 * curP).toFixed(2)),
            rationale: jsonParsed.rationale || `基于 [${s}] 盘面现价 $${curP}、产业链拓扑与策略归属 (${categoryInfo}) 消除迷茫度推演`,
            urgency: jsonParsed.urgency || "MEDIUM",
            targetPrice: Number((curP * (1 + targetG / 100)).toFixed(2)),
            stopLossPrice: Number((curP * (1 - maxD / 100)).toFixed(2)),
            riskRewardRatio: 2.0,
            strategyCategory: stockData.strategyCategory,
            strategyCategoryLabel: stockData.strategyCategoryLabel,
            strategyCategoryReason: stockData.strategyCategoryReason,
            targetTimeHorizonDays: targetT,
            targetProfitGoalPct: targetG,
            entryZone: {
              min: Number(jsonParsed.entryZoneMin || (curP * 0.992).toFixed(2)),
              max: Number(jsonParsed.entryZoneMax || (curP * 1.006).toFixed(2)),
            },
          };

          return quantRiskManager.alignActionWithQuantRisk(
            rawAction,
            curP,
            spilloverAlpha,
            networkRisk,
            userBudget,
            userBudget,
            targetG,
            targetT,
            maxD
          );
        }
      }
    } catch (e) {
      console.warn(`[Ollama Deduce Stock] Error for ${s}: ${e}`);
    }

    return null;
  }

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
      timefmForecasts?: Record<string, TimeFmForecastItem>;
      stockVerifiedHistories?: Record<string, string>;
      targetProfitGoalPct?: number;
      targetTimeHorizonDays?: number;
      maxDrawdownPct?: number;
    }
  ): Promise<OllamaDeductionResult> {
    const status = await this.getStatus();
    if (!status.connected || status.models.length === 0) {
      throw new Error("Ollama 服务未连接");
    }

    const selectedModel = status.models.includes(modelName) ? modelName : status.recommendedModel || status.models[0];
    const targetT = context.targetTimeHorizonDays || 5;
    const targetG = context.targetProfitGoalPct || 8.0;
    const maxD = context.maxDrawdownPct || 4.0;

    // Stage A: 宏观 Chunk 推理
    const macroOverview = await this.generateMacroSummaryWithOllama(selectedModel, context.searxngNewsText);

    // Stage B: 候选股票 Map Chunk 分批并发推理 (并发池限流 2，防止显存与队列超时)
    const deduceOneSymbol = async (sym: string): Promise<ActionItem> => {
      const pos = context.positions.find((p) => p.symbol.toUpperCase() === sym.toUpperCase());
      const curP =
        context.quotesMap.get(sym.toUpperCase()) ||
        pos?.marketPrice ||
        pos?.costBasis ||
        0;

      const intel: SingleStockIntel = context.candidateStockIntels.get(sym.toUpperCase()) || {
        symbol: sym,
        latestNews: [],
        communitySentiment: { mood: "NEUTRAL", keyTopics: [] },
        capitalFlow: { trend: "NEUTRAL", description: "资金动向未知" },
      };

      const kg = context.knowledgeGraphs.find((g) => g.symbol.toUpperCase() === sym.toUpperCase());
      const catMeta = context.candidateCategoryMap?.get(sym.toUpperCase());
      const tfm = context.timefmForecasts?.[sym.toUpperCase()];
      const verifiedHistory = context.stockVerifiedHistories?.[sym.toUpperCase()];

      const itemRes = await this.deduceSingleStockWithOllama(selectedModel, {
        symbol: sym,
        companyName: pos?.companyName || sym,
        currentPrice: curP,
        holdingPosition: pos,
        intel,
        knowledgeGraph: kg,
        fundamentals: intel.fundamentals,
        lessonsLearned: context.lessonsLearned,
        macroPromptContext: context.macroPromptContext,
        strategyCategory: catMeta?.category,
        strategyCategoryLabel: catMeta?.label,
        strategyCategoryReason: catMeta?.reason,
        timefmForecast: tfm,
        verifiedPromptHistory: verifiedHistory,
        targetProfitGoalPct: targetG,
        targetTimeHorizonDays: targetT,
        maxDrawdownPct: maxD,
        userBudget: context.totalBudget,
      });

      if (itemRes) {
        return itemRes;
      }

      // Fallback
      const isHolding = pos && pos.shares > 0;
      let actionType: "BUY" | "TRIM" | "HOLD" | "SELL" = "HOLD";
      let shares = 0;
      let rationale = "";

      if (catMeta?.category === "OVERSOLD_BUY") {
        actionType = "BUY";
        shares = curP > 0 ? Math.max(1, Math.floor((context.totalBudget * 0.3) / curP)) : 10;
        rationale = `[${sym}] 触发 52 周底部超跌多因子信号，在限定 ${targetT} 交易日内具备均值回归修复动能。`;
      } else if (catMeta?.category === "FUNDAMENTAL_BUY") {
        actionType = "BUY";
        shares = curP > 0 ? Math.max(1, Math.floor((context.totalBudget * 0.3) / curP)) : 10;
        rationale = `[${sym}] 核心财报与盈利质量强劲，契合中线目标。`;
      } else if (catMeta?.category === "NEWS_CATALYST_BUY") {
        actionType = "BUY";
        shares = curP > 0 ? Math.max(1, Math.floor((context.totalBudget * 0.25) / curP)) : 10;
        rationale = `[${sym}] 行业利好催化共振，适量介入博取短期弹性。`;
      } else if (catMeta?.category === "CAPITAL_INFLOW_BUY") {
        actionType = "BUY";
        shares = curP > 0 ? Math.max(1, Math.floor((context.totalBudget * 0.35) / curP)) : 10;
        rationale = `[${sym}] 盘面大资金逆势净流入，顺应资金主线建仓。`;
      } else if (isHolding) {
        actionType = "HOLD";
        shares = pos.shares;
        rationale = `[${sym}] 持仓运行健康，建议维持现有底仓并设定 ${targetT} 日时间止损纪律。`;
      } else {
        actionType = "HOLD";
        shares = 0;
        rationale = `[${sym}] 当前多空信号分歧，列入观察池保持跟踪。`;
      }

      const urgency: "HIGH" | "MEDIUM" | "LOW" = actionType === "BUY" ? "HIGH" : "LOW";

      const fallbackItem: ActionItem = {
        action: actionType,
        symbol: sym,
        companyName: pos?.companyName || sym,
        suggestedShares: shares,
        estimatedPrice: Number(curP.toFixed(2)),
        estimatedAmount: Number((shares * curP).toFixed(2)),
        rationale,
        urgency,
        strategyCategory: catMeta?.category,
        strategyCategoryLabel: catMeta?.label,
        strategyCategoryReason: catMeta?.reason,
      };

      return quantRiskManager.alignActionWithQuantRisk(
        fallbackItem,
        curP,
        kg?.spilloverAlphaScore || 0,
        kg?.networkRiskScore || 0,
        context.totalBudget,
        context.cashBalance,
        targetG,
        targetT,
        maxD
      );
    };

    const actions: ActionItem[] = [];
    const poolConcurrency = 2;
    for (let i = 0; i < context.candidateSymbols.length; i += poolConcurrency) {
      const chunk = context.candidateSymbols.slice(i, i + poolConcurrency);
      const chunkResults = await Promise.all(chunk.map((sym) => deduceOneSymbol(sym)));
      actions.push(...chunkResults);
    }

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
