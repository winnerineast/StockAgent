import { execSync } from "child_process";
import { prisma } from "../db/prisma";
import { SingleStockIntel, CommunitySentimentItem, CapitalFlowItem, MacroMarketIntel } from "../types/stockTypes";

export interface SearXNGSearchResultItem {
  title: string;
  url: string;
  content: string;
  engine?: string;
}

export interface SearXNGStatus {
  connected: boolean;
  searxngUrl: string;
  message: string;
}

export class SearXNGSearchService {
  private isAttemptingStart: boolean = false;

  private get baseUrl(): string {
    return process.env.SEARXNG_URL || "http://127.0.0.1:8088";
  }

  public async getStatus(attemptAutoStart: boolean = true): Promise<SearXNGStatus> {
    const searxngUrl = this.baseUrl;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const resp = await fetch(`${searxngUrl}/`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (resp.ok || resp.status === 200 || resp.status === 302) {
        return {
          connected: true,
          searxngUrl,
          message: "🟢 SearXNG 本地 Docker 容器运行正常",
        };
      }
    } catch (err: any) {}

    if (attemptAutoStart && !this.isAttemptingStart) {
      return await this.ensureSearXNGRunning();
    }

    return {
      connected: false,
      searxngUrl,
      message: `🔴 未检测到 SearXNG 服务 (${searxngUrl})`,
    };
  }

  public async ensureSearXNGRunning(): Promise<SearXNGStatus> {
    if (this.isAttemptingStart) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return await this.getStatus(false);
    }

    this.isAttemptingStart = true;

    try {
      console.log("[SearXNGSearchService] 执行 `docker start searxng`...");
      try {
        execSync("docker start searxng", { stdio: "ignore", timeout: 8000 });
      } catch (e1) {
        try {
          execSync("docker run -d -p 8088:8080 --name searxng searxng/searxng:latest", { stdio: "ignore", timeout: 12000 });
        } catch (e1_2) {}
      }

      let status = await this.getStatus(false);
      if (status.connected) {
        console.log("[SearXNGSearchService] 🟢 宿主机 Docker SearXNG 唤醒成功！");
        this.isAttemptingStart = false;
        return status;
      }

      try {
        execSync("wsl -d Ubuntu -u root service docker start", { stdio: "ignore", timeout: 8000 });
        execSync("wsl -d Ubuntu -u root docker start searxng", { stdio: "ignore", timeout: 8000 });
      } catch (wslErr) {}

      for (let attempt = 1; attempt <= 10; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        status = await this.getStatus(false);
        if (status.connected) {
          console.log(`[SearXNGSearchService] 🟢 SearXNG 容器在第 ${attempt} 秒成功启动！`);
          this.isAttemptingStart = false;
          return status;
        }
      }
    } catch (err: any) {
      console.warn("[SearXNGSearchService] Docker 唤醒异常:", err.message || err);
    } finally {
      this.isAttemptingStart = false;
    }

    return await this.getStatus(false);
  }

  public async searchStockNews(query: string, maxResults: number = 5): Promise<SearXNGSearchResultItem[]> {
    const status = await this.getStatus(true);
    if (!status.connected) {
      return [];
    }

    const doQuery = async () => {
      const searchUrl = `${this.baseUrl}/search?q=${encodeURIComponent(query)}&format=json&categories=news,general`;
      const resp = await fetch(searchUrl);
      if (!resp.ok) {
        throw new Error(`SearXNG HTTP ${resp.status}`);
      }
      const data: any = await resp.json();
      return Array.isArray(data?.results) ? data.results : [];
    };

    try {
      let results = await doQuery();
      if (results.length === 0) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        results = await doQuery();
      }

      return results.slice(0, maxResults).map((r: any) => ({
        title: r.title || "",
        url: r.url || "",
        content: r.content || r.snippet || "",
        engine: r.engine || "searxng",
      }));
    } catch (err: any) {
      console.warn(`[SearXNGSearchService] 搜索异常 (${query}):`, err.message || err);
      return [];
    }
  }

  /**
   * 动态生成包含多义词消歧与限定词结合的搜刮 Query
   */
  public buildDisambiguatedQuery(
    symbol: string,
    companyName?: string,
    searchType: "news" | "sentiment" | "capitalFlow" = "news"
  ): string {
    const symUpper = symbol.toUpperCase().trim();
    const cleanCompanyName = companyName && companyName !== symUpper ? companyName.trim() : "";
    const namePart = cleanCompanyName ? `"${cleanCompanyName}"` : "";

    if (searchType === "news") {
      return `"${symUpper}" ${namePart} stock financial news quarterly earnings analyst rating`.trim();
    } else if (searchType === "sentiment") {
      return `"${symUpper}" ${namePart} stock reddit stocktwits seekingalpha sentiment discussion`.trim();
    } else {
      return `"${symUpper}" ${namePart} stock institutional buying big money capital flow dark pool`.trim();
    }
  }

  /**
   * 将全网搜刮到的宏观资讯蒸馏为结构化、可读性极强且可注入大模型的 MacroMarketIntel
   */
  public distillMacroMarketIntel(
    fetchedItems: Array<{ title: string; summary: string; url: string }>
  ): MacroMarketIntel {
    if (fetchedItems.length === 0) {
      return {
        sentimentMood: "NEUTRAL",
        sentimentScore: 50,
        summaryHeadline: "全网盘前资讯暂未检索到显著异常，大盘维持平稳震荡动向。",
        starSectors: ["大盘科技成长", "AI 算力与半导体", "宏观防御性消费"],
        keyBulletPoints: [],
        macroTradingStance: {
          bias: "中性震荡 · 控仓观望",
          positionStrategy: "建议总持仓保持在 50%~60%，避免盲目追高开盘冲高标的",
          riskWarning: "严格执行个股 -8.0% 软止损纪律，防范盘中流动性抽离",
        },
        distilledPromptContext: "【大盘宏观背景】当前大盘处于中性震荡格局，多空博弈均衡。推演策略：对持仓标的严守防线，对新开仓标的提高安全边际要求。",
      };
    }

    const fullText = fetchedItems.map((f) => `${f.title} ${f.summary}`).join(" ").toLowerCase();

    // 情绪评分计算
    let score = 50;
    const bullishKeywords = [
      "gain", "rally", "surge", "record", "high", "optimism", "cut", "boost",
      "climb", "rise", "soar", "jump", "growth", "bull", "beat", "upgrade"
    ];
    const bearishKeywords = [
      "drop", "fall", "plunge", "decline", "selloff", "inflation", "hike", "fear",
      "slump", "tariff", "recession", "loss", "crash", "bear", "miss", "downgrade"
    ];

    bullishKeywords.forEach((w) => {
      if (fullText.includes(w)) score += 3;
    });
    bearishKeywords.forEach((w) => {
      if (fullText.includes(w)) score -= 4;
    });

    score = Math.max(15, Math.min(95, score));

    let mood: "BULLISH" | "BEARISH" | "NEUTRAL" | "VOLATILE" = "NEUTRAL";
    if (score >= 65) mood = "BULLISH";
    else if (score <= 40) mood = "BEARISH";
    else if (fullText.includes("mixed") || fullText.includes("volatile") || fullText.includes("fluctuat")) {
      mood = "VOLATILE";
    }

    // 明星主线与热点板块提取
    const candidateSectors = [
      { name: "AI 算力与半导体", keys: ["semiconductor", "chip", "nvidia", "ai", "hardware", "tech"] },
      { name: "电力与能源基建", keys: ["power", "energy", "grid", "nuclear", "utility", "oil"] },
      { name: "美联储利率与宏观流动性", keys: ["fed", "rate", "inflation", "cpi", "powell", "treasury"] },
      { name: "消费与医药防御", keys: ["retail", "consumer", "healthcare", "defensive", "dividend"] },
      { name: "云软件与企业SaaS", keys: ["cloud", "software", "saas", "cybersecurity", "enterprise"] },
    ];

    const starSectors: string[] = [];
    candidateSectors.forEach((s) => {
      if (s.keys.some((k) => fullText.includes(k))) {
        starSectors.push(s.name);
      }
    });
    if (starSectors.length === 0) {
      starSectors.push("科技与半导体", "AI 算力与电力", "宏观利率与消费");
    }

    // 格式化权威媒体要点
    const keyBulletPoints = fetchedItems.slice(0, 5).map((item) => {
      let sourceName = "权威财经";
      if (item.url) {
        if (item.url.includes("reuters.com")) sourceName = "Reuters (路透社)";
        else if (item.url.includes("bloomberg.com")) sourceName = "Bloomberg (彭博社)";
        else if (item.url.includes("cnbc.com")) sourceName = "CNBC";
        else if (item.url.includes("marketwatch.com")) sourceName = "MarketWatch";
        else if (item.url.includes("wsj.com")) sourceName = "WSJ (华尔街日报)";
      }

      return {
        title: item.title,
        snippet: item.summary,
        source: sourceName,
        url: item.url,
      };
    });

    // 生成专业宏观操盘指南
    let bias = "多头顺势 (Bullish Bias) · 聚焦主线龙头";
    let positionStrategy = "建议总持仓维持在 65%~75%，顺应主线强势标的逢低布局，避免追高杂毛股";
    let riskWarning = "密切关注美联储政策表态及盘中波动，个股严设 5%~8% 阶梯止损防线";

    if (mood === "BEARISH") {
      bias = "防守避险 (Risk-Off Defensive) · 严格控仓";
      positionStrategy = "建议持仓压降至 30%~40%，锁定前期浮盈，底仓重点关注防御性高股息标的";
      riskWarning = "宏观利空承压，破位个股果断止损，严禁在下跌中继左侧盲目抄底";
    } else if (mood === "VOLATILE" || mood === "NEUTRAL") {
      bias = "震荡分化 (Neutral & Range-bound) · 波段应对";
      positionStrategy = "建议总仓位保持 50% 上下，采取‘高抛低吸、快进快出’的结构性轮动策略";
      riskWarning = "板块轮动加速且持续性较弱，切忌追涨日内脉冲品种";
    }

    const firstPoint = fetchedItems[0]?.title || "美股大盘走向";
    const summaryHeadline = `${mood === "BULLISH" ? "多头情绪占优" : mood === "BEARISH" ? "避险情绪升温" : "大盘维持震荡"}：${firstPoint}，资金重点聚焦 ${starSectors.slice(0, 2).join("与")} 等核心方向。`;

    const distilledPromptContext = `【今日宏观大盘基调与约束】: 大盘定调为[${bias}]，综合情绪分 ${score}/100，领涨主线聚焦[${starSectors.slice(0, 2).join("、")}]。仓位指南：${positionStrategy}。推演约束：顺应主线强势标的可适当提高加仓权重；对非主线弱势标的从严执行反弹减仓与止损防线。`;

    return {
      sentimentMood: mood,
      sentimentScore: score,
      summaryHeadline,
      starSectors,
      keyBulletPoints,
      macroTradingStance: {
        bias,
        positionStrategy,
        riskWarning,
      },
      distilledPromptContext,
    };
  }

  /**
   * Phase 1: 搜刮整体大盘走向、趋势、热门板块与主流财经媒体资讯
   */
  public async searchMacroAndSectorNews(): Promise<{
    macroOverview: string;
    macroIntel: MacroMarketIntel;
    starSectors: string[];
    rawNewsText: string;
    newsItemsCount: number;
    searxngConnected: boolean;
  }> {
    const status = await this.ensureSearXNGRunning();
    if (!status.connected) {
      const fallbackIntel = this.distillMacroMarketIntel([]);
      return {
        macroOverview: JSON.stringify(fallbackIntel),
        macroIntel: fallbackIntel,
        starSectors: fallbackIntel.starSectors,
        rawNewsText: fallbackIntel.summaryHeadline,
        newsItemsCount: 0,
        searxngConnected: false,
      };
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const queries = [
      "site:reuters.com OR site:cnbc.com OR site:bloomberg.com OR site:marketwatch.com US stock market trend macro sentiment",
      "US stock market top gainers hot sectors trending stocks today",
      "Fed interest rate inflation economic policy US market impact",
    ];

    const fetchedItems: Array<{ title: string; summary: string; url: string }> = [];

    for (const q of queries) {
      const results = await this.searchStockNews(q, 3);
      for (const res of results) {
        if (!res.title && !res.content) continue;
        const cleanTitle = res.title.replace(/<\/?[^>]+(>|$)/g, "").trim();
        const cleanSummary = res.content.replace(/<\/?[^>]+(>|$)/g, "").trim();

        if (cleanTitle) {
          fetchedItems.push({ title: cleanTitle, summary: cleanSummary, url: res.url });
          try {
            await prisma.stockMarketIntelCache.create({
              data: {
                intelDate: todayStr,
                symbol: "MACRO",
                title: cleanTitle,
                summary: cleanSummary,
                source: res.url ? `SearXNG (${new URL(res.url).hostname})` : "SearXNG",
              },
            });
          } catch (e) {}
        }
      }
    }

    const rawNewsText = fetchedItems
      .map((n) => `[大盘宏观/热门板块] ${n.title}。${n.summary}`)
      .join("\n");

    const macroIntel = this.distillMacroMarketIntel(fetchedItems);

    return {
      macroOverview: JSON.stringify(macroIntel),
      macroIntel,
      starSectors: macroIntel.starSectors,
      rawNewsText,
      newsItemsCount: fetchedItems.length,
      searxngConnected: true,
    };
  }

  /**
   * Phase 2: 针对候选股票池中的单只股票进行 3 维独立深度搜刮 (新闻 + 社区情绪 + 大资金动向)
   */
  public async searchSingleStockIntel(
    symbol: string,
    companyName?: string
  ): Promise<SingleStockIntel> {
    const symUpper = symbol.toUpperCase().trim();
    const status = await this.getStatus(false);

    if (!status.connected) {
      return {
        symbol: symUpper,
        companyName,
        latestNews: [],
        communitySentiment: { mood: "UNKNOWN", keyTopics: [] },
        capitalFlow: { trend: "NEUTRAL", description: "SearXNG 服务未连接" },
      };
    }

    const newsQuery = this.buildDisambiguatedQuery(symUpper, companyName, "news");
    const sentimentQuery = this.buildDisambiguatedQuery(symUpper, companyName, "sentiment");
    const capitalFlowQuery = this.buildDisambiguatedQuery(symUpper, companyName, "capitalFlow");

    const [newsRes, sentimentRes, capitalFlowRes] = await Promise.all([
      this.searchStockNews(newsQuery, 3),
      this.searchStockNews(sentimentQuery, 2),
      this.searchStockNews(capitalFlowQuery, 2),
    ]);

    const cleanNews = newsRes
      .map((r) => `${r.title.replace(/<\/?[^>]+(>|$)/g, "")} ${r.content.replace(/<\/?[^>]+(>|$)/g, "")}`.trim())
      .filter((text) => text.length > 0);

    const sentimentTopics = sentimentRes
      .map((r) => r.title.replace(/<\/?[^>]+(>|$)/g, "").trim())
      .filter((t) => t.length > 0);

    const capitalFlowDocs = capitalFlowRes
      .map((r) => `${r.title} ${r.content}`.replace(/<\/?[^>]+(>|$)/g, "").trim())
      .filter((t) => t.length > 0);

    let flowTrend: "INFLOW" | "OUTFLOW" | "NEUTRAL" = "NEUTRAL";
    const combinedFlowText = capitalFlowDocs.join(" ").toLowerCase();
    if (combinedFlowText.includes("buying") || combinedFlowText.includes("inflow") || combinedFlowText.includes("accumulat")) {
      flowTrend = "INFLOW";
    } else if (combinedFlowText.includes("selling") || combinedFlowText.includes("outflow") || combinedFlowText.includes("dump")) {
      flowTrend = "OUTFLOW";
    }

    const capitalFlowDescription = capitalFlowDocs.length > 0
      ? capitalFlowDocs[0].slice(0, 160)
      : "暂未搜刮到显著主力大资金动向";

    return {
      symbol: symUpper,
      companyName,
      latestNews: cleanNews,
      communitySentiment: {
        score: cleanNews.length > 0 ? 75 : undefined,
        mood: cleanNews.length > 0 ? "BULLISH" : "UNKNOWN",
        keyTopics: sentimentTopics,
      },
      capitalFlow: {
        trend: flowTrend,
        description: capitalFlowDescription,
      },
    };
  }

  /**
   * 兼容原有接口
   */
  public async fetchAndCacheMarketNews(symbols: string[]): Promise<{
    rawNewsText: string;
    newsItemsCount: number;
    searxngConnected: boolean;
    intelCache: Record<string, Array<{ title: string; snippet: string }>>;
  }> {
    const macroRes = await this.searchMacroAndSectorNews();
    const intelCache: Record<string, Array<{ title: string; snippet: string }>> = {};

    for (const sym of symbols) {
      const singleIntel = await this.searchSingleStockIntel(sym);
      intelCache[sym] = singleIntel.latestNews.map((n) => ({ title: n.slice(0, 50), snippet: n }));
    }

    return {
      rawNewsText: macroRes.rawNewsText,
      newsItemsCount: macroRes.newsItemsCount,
      searxngConnected: macroRes.searxngConnected,
      intelCache,
    };
  }
}

export const searxngSearchService = new SearXNGSearchService();
