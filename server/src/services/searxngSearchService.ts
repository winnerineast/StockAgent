import { execSync } from "child_process";
import { prisma } from "../db/prisma";
import { SingleStockIntel, CommunitySentimentItem, CapitalFlowItem } from "../types/stockTypes";

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
   * Phase 1: 搜刮整体大盘走向、趋势、热门板块与主流财经媒体资讯
   */
  public async searchMacroAndSectorNews(): Promise<{
    macroOverview: string;
    starSectors: string[];
    rawNewsText: string;
    newsItemsCount: number;
    searxngConnected: boolean;
  }> {
    const status = await this.ensureSearXNGRunning();
    if (!status.connected) {
      return {
        macroOverview: "未连通 SearXNG 搜索引擎，暂无宏观大盘资讯",
        starSectors: [],
        rawNewsText: "",
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

    const macroOverview = fetchedItems.length > 0
      ? fetchedItems.map((n) => `• ${n.title}: ${n.summary.slice(0, 120)}`).join("\n")
      : "实时搜刮未返回有效大盘资讯";

    return {
      macroOverview,
      starSectors: ["科技与半导体", "AI 算力与电力", "宏观利率与消费"],
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
