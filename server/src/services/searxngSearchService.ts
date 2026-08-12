import { execSync } from "child_process";
import { prisma } from "../db/prisma";

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

      // 直接测试 SearXNG 根节点，无需发起外部搜索引擎检索，响应更迅捷稳定
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
      // 若刚唤醒容器搜索引擎尚在加载，重试一次
      if (results.length === 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
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

  public async fetchAndCacheMarketNews(symbols: string[]): Promise<{
    rawNewsText: string;
    newsItemsCount: number;
    searxngConnected: boolean;
    intelCache: Record<string, Array<{ title: string; snippet: string }>>;
  }> {
    const status = await this.ensureSearXNGRunning();
    const intelMap: Record<string, Array<{ title: string; snippet: string }>> = {};

    if (!status.connected) {
      return { rawNewsText: "", newsItemsCount: 0, searxngConnected: false, intelCache: intelMap };
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const queries = Array.from(new Set(["US market Fed inflation", ...symbols]));
    const allFetchedNews: Array<{ symbol?: string; title: string; summary: string }> = [];

    for (const q of queries) {
      const isSymbol = q !== "US market Fed inflation";
      const results = await this.searchStockNews(q, 3);
      const symbolNewsItems: Array<{ title: string; snippet: string }> = [];

      for (const item of results) {
        if (!item.title && !item.content) continue;
        const cleanTitle = item.title.replace(/<\/?[^>]+(>|$)/g, "").trim();
        const cleanSummary = item.content.replace(/<\/?[^>]+(>|$)/g, "").trim();

        if (cleanTitle) {
          allFetchedNews.push({
            symbol: isSymbol ? q : undefined,
            title: cleanTitle,
            summary: cleanSummary,
          });

          symbolNewsItems.push({ title: cleanTitle, snippet: cleanSummary });

          try {
            await prisma.stockMarketIntelCache.create({
              data: {
                intelDate: todayStr,
                symbol: isSymbol ? q : null,
                title: cleanTitle,
                summary: cleanSummary,
                source: item.url ? `SearXNG (${new URL(item.url).hostname})` : "SearXNG",
              },
            });
          } catch (e) {}
        }
      }

      if (isSymbol) {
        intelMap[q] = symbolNewsItems;
      }
    }

    const rawNewsText = allFetchedNews
      .map((n) => `[${n.symbol ? n.symbol : "MACRO"}] ${n.title}。${n.summary}`)
      .join("\n");

    return {
      rawNewsText,
      newsItemsCount: allFetchedNews.length,
      searxngConnected: true,
      intelCache: intelMap,
    };
  }
}

export const searxngSearchService = new SearXNGSearchService();
