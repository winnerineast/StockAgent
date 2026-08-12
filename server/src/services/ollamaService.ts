import os from "os";
import { execSync } from "child_process";
import { ActionItem, RiskAlert, StockPositionItem, StockKnowledgeGraphItem } from "../types/stockTypes";

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

  public buildPromptPayload(context: {
    positions: StockPositionItem[];
    watchlist: Array<{ symbol: string; companyName: string }>;
    quotesMap: Map<string, number>;
    searxngNewsText: string;
    knowledgeGraphs: StockKnowledgeGraphItem[];
    lessonsLearned: string[];
    totalBudget: number;
    cashBalance: number;
    riskPreference: string;
  }): {
    promptText: string;
    kgContextText: string;
    positionsText: string;
    lessonsText: string;
    searxngNewsText: string;
  } {
    const kgContextText = context.knowledgeGraphs
      .map((kg) => {
        const nodesText = kg.nodes.map((n) => `  - [${n.type}] ${n.name}: ${n.description || ""}`).join("\n");
        const edgesText = kg.edges.map((e) => `  - ${e.source} --(${e.relation})--> ${e.target} [${e.impact}]`).join("\n");
        return `### 股票代码: ${kg.symbol} (${kg.industrySector})\n【实体节点】:\n${nodesText}\n【关系关联边】:\n${edgesText}\n【个股催化剂】:\n${kg.newsCatalysts.join("; ")}`;
      })
      .join("\n\n");

    const positionsText = context.positions
      .map((p) => {
        const price = context.quotesMap.get(p.symbol.toUpperCase()) || p.marketPrice || p.costBasis;
        const pnlPct = p.costBasis > 0 ? (((price - p.costBasis) / p.costBasis) * 100).toFixed(1) : "0";
        return `- 代码: ${p.symbol}, 持有: ${p.shares}股, 成本价: $${p.costBasis.toFixed(2)}, 当前现价: $${price.toFixed(2)}, 浮盈亏: ${pnlPct}%`;
      })
      .join("\n");

    const lessonsText = context.lessonsLearned.map((l, i) => `${i + 1}. ${l}`).join("\n");

    const promptText = `你是一位专业的美股量化交易主控专家。请结合以下【硬件调优模型】、【实时大盘新闻】、【实盘持仓】、【每只股票的操盘知识图谱】及【历史风控教训】，为今日美股开盘制定精确定量的加减仓操盘指南。

========================================
一、盘前 SearXNG 实时新闻与大盘资讯
========================================
${context.searxngNewsText || "美股大盘盘前波动率平稳，关注 Fed 利率走势。"}

========================================
二、实盘持仓与资金状态
========================================
- 可用现金余额: $${context.cashBalance.toFixed(2)}
- 本次调仓可用预算: $${context.totalBudget.toFixed(2)}
- 交易风险偏好: ${context.riskPreference} (保守/平衡/激进)
持仓明细:
${positionsText || "当前暂无持仓"}

========================================
三、单只股票专属操盘知识图谱 (Knowledge Graph)
========================================
${kgContextText}

========================================
四、历史复盘积累的风控教训与纪律 (Lessons Learned)
========================================
${lessonsText}

========================================
输出要求:
请分析上述所有上下文，以纯 JSON 格式输出以下结构，不要包含 markdown 代码块外多余文本：
{
  "marketOverview": "简短分析当前大盘与持仓状况的宏观总结",
  "riskAlerts": [
    {
      "level": "WARNING" | "CRITICAL" | "INFO",
      "title": "预警标题",
      "description": "预警详细说明",
      "relatedSymbol": "股票代码"
    }
  ],
  "actions": [
    {
      "action": "BUY" | "TRIM" | "HOLD" | "SELL",
      "symbol": "股票代码",
      "companyName": "公司名称",
      "suggestedShares": 10,
      "estimatedPrice": 150,
      "estimatedAmount": 1500,
      "rationale": "基于知识图谱上下游、SearXNG 催化剂与止盈止损线给出的调仓理由",
      "urgency": "HIGH" | "MEDIUM" | "LOW",
      "targetPrice": 170.0,
      "stopLossPrice": 138.0,
      "riskRewardRatio": 2.5
    }
  ]
}`;

    return {
      promptText,
      kgContextText,
      positionsText,
      lessonsText,
      searxngNewsText: context.searxngNewsText,
    };
  }

  public async generateStrategyWithOllama(
    modelName: string,
    context: {
      positions: StockPositionItem[];
      watchlist: Array<{ symbol: string; companyName: string }>;
      quotesMap: Map<string, number>;
      searxngNewsText: string;
      knowledgeGraphs: StockKnowledgeGraphItem[];
      lessonsLearned: string[];
      totalBudget: number;
      cashBalance: number;
      riskPreference: string;
    }
  ): Promise<OllamaDeductionResult> {
    const status = await this.getStatus();
    if (!status.connected || status.models.length === 0) {
      throw new Error("Ollama 服务未连接或未安装任何 LLM 模型");
    }

    const selectedModel = status.models.includes(modelName) ? modelName : status.recommendedModel || status.models[0];
    const payload = this.buildPromptPayload(context);
    const prompt = payload.promptText;

    try {
      const resp = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          messages: [{ role: "user", content: prompt }],
          stream: false,
          format: "json",
        }),
      });

      if (!resp.ok) {
        throw new Error(`Ollama 响应 HTTP ${resp.status}`);
      }

      const resData: any = await resp.json();
      const contentText = resData?.message?.content || "";

      let jsonParsed: any = null;
      try {
        jsonParsed = JSON.parse(contentText);
      } catch (e) {
        const jsonMatch = contentText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonParsed = JSON.parse(jsonMatch[0]);
        }
      }

      if (jsonParsed && Array.isArray(jsonParsed.actions)) {
        return {
          actions: jsonParsed.actions,
          riskAlerts: jsonParsed.riskAlerts || [],
          marketOverview: jsonParsed.marketOverview || `Ollama (${selectedModel}) 结合知识图谱与新闻推演完成`,
          promptText: prompt,
          rawOllamaResponse: contentText,
          knowledgeGraphContext: kgContextText,
          searxngNewsContext: context.searxngNewsText,
          positionsContext: positionsText,
          lessonsContext: lessonsText,
          modelUsed: selectedModel,
        };
      }
    } catch (err: any) {
      console.warn(`[OllamaService] 模型 ${selectedModel} 推理异常:`, err.message || err);
    }

    throw new Error(`Ollama 模型 ${selectedModel} 推理或解析失败`);
  }
}

export const ollamaService = new OllamaService();
