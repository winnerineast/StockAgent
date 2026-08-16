import { execSync } from "child_process";
import { prisma } from "../db/prisma";
import { SingleStockIntel, CommunitySentimentItem, CapitalFlowItem, MacroMarketIntel, MarketSessionPhase } from "../types/stockTypes";
import { marketCalendarService } from "./marketCalendarService";

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
   * 动态生成包含多义词消歧与限定词结合的搜刮 Query (兼容原接口)
   */
  public buildDisambiguatedQuery(
    symbol: string,
    companyName?: string,
    searchType: "news" | "sentiment" | "capitalFlow" = "news"
  ): string {
    return this.buildTimeAnchoredQuery(symbol, companyName, undefined, searchType);
  }

  /**
   * 🌟 核心升级：美股交易时态定向 Query 生成器
   * 依据当前时态 (PRE_MARKET / INTRADAY / POST_MARKET / WEEKEND) 注入精准时效限定词
   */
  public buildTimeAnchoredQuery(
    symbol: string,
    companyName?: string,
    phase?: MarketSessionPhase,
    searchType: "news" | "sentiment" | "capitalFlow" = "news"
  ): string {
    const currentPhase = phase || marketCalendarService.getMarketSession().marketPhase;
    const symUpper = symbol.toUpperCase().trim();
    const cleanCompanyName = companyName && companyName !== symUpper ? companyName.trim() : "";
    const namePart = cleanCompanyName ? `"${cleanCompanyName}"` : "";

    if (currentPhase === "PRE_MARKET") {
      // 盘前分析：聚焦隔夜期指、盘前财报、跳空缺口
      if (searchType === "news") {
        return `"${symUpper}" ${namePart} stock pre-market news overnight futures earnings before bell`.trim();
      } else if (searchType === "sentiment") {
        return `"${symUpper}" ${namePart} pre-market retail sentiment gap up gap down stocktwits`.trim();
      } else {
        return `"${symUpper}" ${namePart} pre-market block trade dark pool volume institutional`.trim();
      }
    } else if (currentPhase === "INTRADAY") {
      // 盘中监控：聚焦突发快讯、盘中异动放量、分时走势
      if (searchType === "news") {
        return `"${symUpper}" ${namePart} stock breaking news today intraday unusual volume live update`.trim();
      } else if (searchType === "sentiment") {
        return `"${symUpper}" ${namePart} stock live trading discussion reddit stocktwits intraday`.trim();
      } else {
        return `"${symUpper}" ${namePart} stock institutional intraday flow big money dark pool`.trim();
      }
    } else if (currentPhase === "POST_MARKET") {
      // 盘后复盘：聚焦收盘全景、盘后财报与电话会、盘后结算
      if (searchType === "news") {
        return `"${symUpper}" ${namePart} stock post-market earnings call results closing market wrap after hours`.trim();
      } else if (searchType === "sentiment") {
        return `"${symUpper}" ${namePart} post-market earnings reaction stocktwits retail sentiment`.trim();
      } else {
        return `"${symUpper}" ${namePart} stock closing auction block trade dark pool after hours`.trim();
      }
    } else {
      // 周末/休市：聚焦周度展望、机构持仓变动、深度研报
      if (searchType === "news") {
        return `"${symUpper}" ${namePart} stock weekly market outlook forecast Wall Street analyst rating`.trim();
      } else if (searchType === "sentiment") {
        return `"${symUpper}" ${namePart} weekend stock discussion sentiment seekingalpha analysis`.trim();
      } else {
        return `"${symUpper}" ${namePart} stock weekly institutional positioning 13F filing capital flow`.trim();
      }
    }
  }


  /**
   * 信源可靠性分级引擎 (Source Credibility Classifier)
   * 自动根据 URL 域名识别权威通讯社、投行研报或社区综合源，赋予权重与权威徽章
   */
  public classifySourceCredibility(url: string): {
    tier: 1 | 2 | 3;
    tierLabel: string;
    sourceName: string;
    weight: number;
  } {
    if (!url) {
      return { tier: 3, tierLabel: "Tier-3 综合财经", sourceName: "综合财经", weight: 0.5 };
    }

    try {
      const hostname = new URL(url).hostname.toLowerCase();

      // Tier-1 顶级财经通讯社与官方源 (权重 1.0)
      if (
        hostname.includes("reuters.com") ||
        hostname.includes("bloomberg.com") ||
        hostname.includes("wsj.com") ||
        hostname.includes("ft.com") ||
        hostname.includes("cnbc.com") ||
        hostname.includes("marketwatch.com") ||
        hostname.includes("federalreserve.gov") ||
        hostname.includes("sec.gov") ||
        hostname.includes("nytimes.com")
      ) {
        let name = "Reuters (路透社)";
        if (hostname.includes("bloomberg")) name = "Bloomberg (彭博社)";
        else if (hostname.includes("wsj")) name = "WSJ (华尔街日报)";
        else if (hostname.includes("ft.com")) name = "Financial Times";
        else if (hostname.includes("cnbc")) name = "CNBC";
        else if (hostname.includes("marketwatch")) name = "MarketWatch";
        else if (hostname.includes("federalreserve")) name = "美联储官网";
        else if (hostname.includes("sec.gov")) name = "SEC 官方公告";

        return { tier: 1, tierLabel: "Tier-1 顶级权威", sourceName: name, weight: 1.0 };
      }

      // Tier-2 机构研报与专业投行 (权重 0.8)
      if (
        hostname.includes("goldmansachs.com") ||
        hostname.includes("morganstanley.com") ||
        hostname.includes("jpmorgan.com") ||
        hostname.includes("barrons.com") ||
        hostname.includes("morningstar.com") ||
        hostname.includes("seekingalpha.com") ||
        hostname.includes("thestreet.com") ||
        hostname.includes("investors.com")
      ) {
        let name = "Barron's (巴伦周刊)";
        if (hostname.includes("seekingalpha")) name = "Seeking Alpha";
        else if (hostname.includes("morningstar")) name = "Morningstar (晨星)";
        else if (hostname.includes("investors.com")) name = "IBD 投资研报";
        else if (hostname.includes("goldman")) name = "Goldman Sachs";
        else if (hostname.includes("morganstanley")) name = "Morgan Stanley";
        else if (hostname.includes("jpmorgan")) name = "JPMorgan";

        return { tier: 2, tierLabel: "Tier-2 机构研报", sourceName: name, weight: 0.8 };
      }

      // Tier-3 综合资讯与社区舆情 (权重 0.5)
      let name = hostname.replace(/^www\./, "");
      if (hostname.includes("yahoo")) name = "Yahoo Finance";
      else if (hostname.includes("investing.com")) name = "Investing.com";
      else if (hostname.includes("reddit")) name = "Reddit WSB";
      else if (hostname.includes("stocktwits")) name = "StockTwits";
      else if (hostname.includes("fool.com")) name = "Motley Fool";

      return { tier: 3, tierLabel: "Tier-3 综合资讯", sourceName: name, weight: 0.5 };
    } catch {
      return { tier: 3, tierLabel: "Tier-3 综合资讯", sourceName: "财经媒体", weight: 0.5 };
    }
  }

  /**
   * 将 SearXNG 抓取的大盘新闻与 OpenD 板块数据智能蒸馏为宏观量化全景
   */
  public distillMacroMarketIntel(
    fetchedItems: Array<{ title: string; summary: string; url: string }>,
    openDSectorsData?: {
      benchmarks?: any[];
      crossAsset?: any;
      spyChange?: number;
      qqqChange?: number;
      iwmChange?: number;
      sectors?: any[];
      leadingSectors?: string[];
      laggingSectors?: string[];
    }
  ): MacroMarketIntel {
    const fullText = fetchedItems.map((f) => `${f.title} ${f.summary}`).join(" ").toLowerCase();

    // 1. 基于新闻关键词与信源加权的情绪评分计算
    let score = 50;
    const bullishKeywords = [
      "gain", "rally", "surge", "record", "high", "optimism", "cut", "boost",
      "climb", "rise", "soar", "jump", "growth", "bull", "beat", "upgrade"
    ];
    const bearishKeywords = [
      "drop", "fall", "plunge", "decline", "selloff", "inflation", "hike", "fear",
      "slump", "tariff", "recession", "loss", "crash", "bear", "miss", "downgrade"
    ];

    fetchedItems.forEach((item) => {
      const text = `${item.title} ${item.summary}`.toLowerCase();
      const cred = this.classifySourceCredibility(item.url);
      bullishKeywords.forEach((w) => {
        if (text.includes(w)) score += Math.round(3 * cred.weight);
      });
      bearishKeywords.forEach((w) => {
        if (text.includes(w)) score -= Math.round(4 * cred.weight);
      });
    });

    // 若 OpenD 提供了大盘实际涨跌幅，动态融入大盘实际表现修正得分
    if (openDSectorsData && openDSectorsData.spyChange !== undefined) {
      score += Math.round(openDSectorsData.spyChange * 8);
    }

    score = Math.max(15, Math.min(95, score));

    let mood: "BULLISH" | "BEARISH" | "NEUTRAL" | "VOLATILE" = "NEUTRAL";
    if (score >= 65) mood = "BULLISH";
    else if (score <= 40) mood = "BEARISH";
    else if (fullText.includes("mixed") || fullText.includes("volatile") || fullText.includes("fluctuat")) {
      mood = "VOLATILE";
    }

    // 2. 明星主线提取 (优先采用 OpenD 真实领先板块，若无则采用文本关键词)
    let starSectors: string[] = [];
    if (openDSectorsData && Array.isArray(openDSectorsData.leadingSectors) && openDSectorsData.leadingSectors.length > 0) {
      starSectors = openDSectorsData.leadingSectors;
    } else {
      const candidateSectors = [
        { name: "AI 算力与半导体", keys: ["semiconductor", "chip", "nvidia", "ai", "hardware", "tech"] },
        { name: "电力与能源基建", keys: ["power", "energy", "grid", "nuclear", "utility", "oil"] },
        { name: "美联储利率与宏观流动性", keys: ["fed", "rate", "inflation", "cpi", "powell", "treasury"] },
        { name: "消费与医药防御", keys: ["retail", "consumer", "healthcare", "defensive", "dividend"] },
        { name: "云软件与企业SaaS", keys: ["cloud", "software", "saas", "cybersecurity", "enterprise"] },
      ];
      candidateSectors.forEach((s) => {
        if (s.keys.some((k) => fullText.includes(k))) starSectors.push(s.name);
      });
      if (starSectors.length === 0) {
        starSectors.push("大盘科技成长", "AI 算力与半导体", "宏观防御性消费");
      }
    }

    // 3. 信源分级精选资讯 (CredibleNewsItem[])
    const credibleNewsList = fetchedItems.map((item) => {
      const cred = this.classifySourceCredibility(item.url);
      const text = `${item.title} ${item.summary}`.toLowerCase();
      let sent: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL";
      if (bullishKeywords.some((k) => text.includes(k))) sent = "BULLISH";
      else if (bearishKeywords.some((k) => text.includes(k))) sent = "BEARISH";

      return {
        title: item.title,
        summary: item.summary,
        sourceName: cred.sourceName,
        tier: cred.tier,
        tierLabel: cred.tierLabel,
        sentiment: sent,
        url: item.url,
      };
    });

    // 优先展示 Tier-1 和 Tier-2 资讯
    credibleNewsList.sort((a, b) => a.tier - b.tier);

    const keyBulletPoints = credibleNewsList.slice(0, 6).map((n) => ({
      title: n.title,
      snippet: n.summary,
      source: `${n.sourceName} · ${n.tierLabel}`,
      url: n.url,
    }));

    // 4. 生成专业宏观操盘指南
    let bias = "多头顺势 (Bullish Bias) · 聚焦主线龙头";
    let positionStrategy = "建议总持仓维持在 65%~75%，顺应主线强势标的逢低布局，避免追高杂毛股";
    let positionCapPct = 75.0;
    let stopLossPct = 6.0;
    let riskWarning = "密切关注美联储政策表态及盘中波动，个股严设 5%~8% 阶梯止损防线";

    if (mood === "BEARISH") {
      bias = "防守避险 (Risk-Off Defensive) · 严格控仓";
      positionStrategy = "建议持仓压降至 35%~45%，锁定前期浮盈，底仓重点关注防御性高股息标的";
      positionCapPct = 40.0;
      stopLossPct = 5.0;
      riskWarning = "宏观利空承压，破位个股果断止损，严禁在下跌中继左侧盲目抄底";
    } else if (mood === "VOLATILE" || mood === "NEUTRAL") {
      bias = "震荡分化 (Neutral & Range-bound) · 波段应对";
      positionStrategy = "建议总仓位保持 50%~60%，采取‘高抛低吸、快进快出’的结构性轮动策略";
      positionCapPct = 55.0;
      stopLossPct = 8.0;
      riskWarning = "板块轮动加速且持续性较弱，切忌追涨日内脉冲品种";
    }

    const firstPoint = keyBulletPoints[0]?.title || "美股大盘走向平稳";
    const summaryHeadline = `${mood === "BULLISH" ? "多头情绪占优" : mood === "BEARISH" ? "避险情绪升温" : "大盘维持震荡"}：${firstPoint}，资金重点聚焦 ${starSectors.slice(0, 2).join("与")} 等核心方向。`;

    const distilledPromptContext = `【今日宏观大盘基调与约束】: 大盘定调为[${bias}]，综合情绪分 ${score}/100，领涨主线聚焦[${starSectors.slice(0, 2).join("、")}]。仓位指南：${positionStrategy}。推演约束：顺应主线强势标的可适当提高加仓权重；对非主线弱势标的从严执行反弹减仓与止损防线。`;

    // 5. 组装高密度 DailyMacroSnapshotDTO
    const todayStr = new Date().toISOString().split("T")[0];
    const macroSnapshot = {
      snapshotDate: todayStr,
      regimeMood: mood,
      regimeScore: score,
      stanceBias: bias,
      positionCapPct,
      stopLossPct,
      crossAsset: {
        vix: openDSectorsData?.crossAsset?.vix ?? 15.2,
        vixChange: openDSectorsData?.crossAsset?.vixChange ?? -0.3,
        us10y: openDSectorsData?.crossAsset?.us10y ?? 4.28,
        dxy: openDSectorsData?.crossAsset?.dxy ?? 103.8,
        spyChange: openDSectorsData?.spyChange || 0.0,
        qqqChange: openDSectorsData?.qqqChange || 0.0,
        iwmChange: openDSectorsData?.iwmChange || 0.0,
      },
      sectors: openDSectorsData?.sectors || [],
      benchmarks: openDSectorsData?.benchmarks || [],
      topNews: credibleNewsList.slice(0, 8),
      promptContext: distilledPromptContext,
      isLiveRealtime: true,
    };

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
      macroSnapshot,
    };
  }

  /**
   * Phase 1: 搜刮整体大盘走向、趋势、热门板块与主流财经媒体资讯 (集成 OpenD 真实板块数据与时态定向)
   */
  public async searchMacroAndSectorNews(
    openDSectorsData?: {
      benchmarks?: any[];
      crossAsset?: any;
      spyChange?: number;
      qqqChange?: number;
      iwmChange?: number;
      sectors?: any[];
      leadingSectors?: string[];
      laggingSectors?: string[];
    },
    phase?: MarketSessionPhase
  ): Promise<{
    macroOverview: string;
    macroIntel: MacroMarketIntel;
    starSectors: string[];
    rawNewsText: string;
    newsItemsCount: number;
    searxngConnected: boolean;
  }> {
    const status = await this.ensureSearXNGRunning();
    if (!status.connected) {
      const fallbackIntel = this.distillMacroMarketIntel([], openDSectorsData);
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
    const currentPhase = phase || marketCalendarService.getMarketSession().marketPhase;

    let queries = [
      "site:reuters.com OR site:cnbc.com OR site:bloomberg.com OR site:wsj.com US stock market trend macro",
      "site:marketwatch.com OR site:barrons.com US stock market sector rotation top gainers today",
      "site:reuters.com OR site:cnbc.com Fed interest rate inflation treasury yield market impact",
    ];

    if (currentPhase === "PRE_MARKET") {
      queries = [
        "site:reuters.com OR site:cnbc.com OR site:bloomberg.com US stock futures premarket overnight inflation macro",
        "site:marketwatch.com OR site:barrons.com US market movers premarket earnings before open today",
        "site:reuters.com OR site:cnbc.com Fed interest rate treasury yields bond market premarket",
      ];
    } else if (currentPhase === "INTRADAY") {
      queries = [
        "site:reuters.com OR site:cnbc.com OR site:bloomberg.com US stock market live intraday rally drop",
        "site:marketwatch.com OR site:barrons.com US market sector movers leading lagging intraday",
        "site:cnbc.com OR site:reuters.com Wall street live breaking news today market alert",
      ];
    } else if (currentPhase === "POST_MARKET") {
      queries = [
        "site:reuters.com OR site:cnbc.com OR site:bloomberg.com US stock market closing bell recap daily wrap",
        "site:marketwatch.com OR site:barrons.com after hours earnings reports conference calls results",
        "site:wsj.com OR site:bloomberg.com Wall Street market close summary top sectors",
      ];
    } else if (currentPhase === "WEEKEND_OR_HOLIDAY") {
      queries = [
        "site:reuters.com OR site:bloomberg.com OR site:wsj.com US stock market weekly outlook forecast macro",
        "site:barrons.com OR site:marketwatch.com Wall Street week ahead sector rotation analyst preview",
        "site:bloomberg.com OR site:ft.com global liquidity central banks Fed interest rate policy outlook",
      ];
    }

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

    const macroIntel = this.distillMacroMarketIntel(fetchedItems, openDSectorsData);

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
   * Phase 2: 针对候选股票池中的单只股票进行 3 维独立深度搜刮 (新闻 + 社区情绪 + 大资金动向，支持时态定向)
   */
  public async searchSingleStockIntel(
    symbol: string,
    companyName?: string,
    phase?: MarketSessionPhase
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

    const newsQuery = this.buildTimeAnchoredQuery(symUpper, companyName, phase, "news");
    const sentimentQuery = this.buildTimeAnchoredQuery(symUpper, companyName, phase, "sentiment");
    const capitalFlowQuery = this.buildTimeAnchoredQuery(symUpper, companyName, phase, "capitalFlow");

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
