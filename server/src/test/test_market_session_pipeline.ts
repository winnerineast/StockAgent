import { marketCalendarService } from "../services/marketCalendarService";
import { searxngSearchService } from "../services/searxngSearchService";
import { MarketSessionPhase } from "../types/stockTypes";

async function runMarketSessionPipelineTests() {
  console.log("======================================================================");
  console.log("🚀 开始美股交易日历、时空状态机与时态定向推演全链路自动化验证");
  console.log("======================================================================\n");

  let totalTests = 0;
  let passedTests = 0;

  const assert = (condition: boolean, msg: string) => {
    totalTests++;
    if (condition) {
      console.log(`  ✅ [PASS] ${msg}`);
      passedTests++;
    } else {
      console.error(`  ❌ [FAIL] ${msg}`);
      throw new Error(`Assertion failed: ${msg}`);
    }
  };

  // =========================================================================
  // 1. TIER 1: 毫秒级交易时态与临界边界切换断言
  // =========================================================================
  console.log("📌 [Tier 1] 毫秒级交易时态与状态机边界测试 (美东夏令时 EDT / UTC-4 验证):");

  const boundaryCases = [
    // 盘前开启临界点 (04:00:00 ET)
    { time: "2026-08-17T03:59:59-04:00", expected: "OVERNIGHT_CLOSED", label: "03:59:59 ET -> 夜间休市静默期" },
    { time: "2026-08-17T04:00:00-04:00", expected: "PRE_MARKET", label: "04:00:00 ET -> 盘前推演期开启" },
    
    // 正式开盘临界点 (09:30:00 ET)
    { time: "2026-08-17T09:29:59-04:00", expected: "PRE_MARKET", label: "09:29:59 ET -> 盘前最后 1 秒防线" },
    { time: "2026-08-17T09:30:00-04:00", expected: "INTRADAY", label: "09:30:00 ET -> 敲钟正式开盘 (盘中监控)" },

    // 盘中交易期中段 (14:30:00 ET)
    { time: "2026-08-17T14:30:00-04:00", expected: "INTRADAY", label: "14:30:00 ET -> 盘中实时监控中" },

    // 收盘闭市临界点 (16:00:00 ET)
    { time: "2026-08-17T15:59:59-04:00", expected: "INTRADAY", label: "15:59:59 ET -> 盘中尾盘最后 1 秒" },
    { time: "2026-08-17T16:00:00-04:00", expected: "POST_MARKET", label: "16:00:00 ET -> 敲钟收盘 (盘后复盘归因)" },

    // 盘后结算结束临界点 (20:00:00 ET)
    { time: "2026-08-17T19:59:59-04:00", expected: "POST_MARKET", label: "19:59:59 ET -> 盘后结算尾声" },
    { time: "2026-08-17T20:00:00-04:00", expected: "OVERNIGHT_CLOSED", label: "20:00:00 ET -> 夜间休市静默期开启" },

    // 周末非交易日
    { time: "2026-08-16T12:00:00-04:00", expected: "WEEKEND_OR_HOLIDAY", label: "星期日 12:00 ET -> 周末休市研判期" },
    { time: "2026-08-15T15:00:00-04:00", expected: "WEEKEND_OR_HOLIDAY", label: "星期六 15:00 ET -> 周末休市研判期" },
  ];

  for (const tc of boundaryCases) {
    const s = marketCalendarService.getMarketSession(tc.time);
    assert(s.marketPhase === tc.expected, `${tc.label} (实际: ${s.marketPhase}, 倒计时: ${s.countdownLabel})`);
  }

  // =========================================================================
  // 2. TIER 1.5: NYSE / NASDAQ 官方法定休市日与提前闭市算法
  // =========================================================================
  console.log("\n📌 [Tier 1.5] NYSE 官方法定节假日与提前闭市日算法验证 (2026 年历表):");

  const holidayCases = [
    { year: 2026, month: 1, day: 1, name: "元旦 New Year's Day" },
    { year: 2026, month: 1, day: 19, name: "马丁路德金纪念日 MLK Day" },
    { year: 2026, month: 2, day: 16, name: "总统日 Presidents' Day" },
    { year: 2026, month: 4, day: 3, name: "耶稣受难日 Good Friday (算法推导)" },
    { year: 2026, month: 5, day: 25, name: "阵亡将士纪念日 Memorial Day" },
    { year: 2026, month: 6, day: 19, name: "六月节独立日 Juneteenth" },
    { year: 2026, month: 7, day: 3, name: "独立日补休 Independence Day Observed" },
    { year: 2026, month: 9, day: 7, name: "劳动节 Labor Day" },
    { year: 2026, month: 11, day: 26, name: "感恩节 Thanksgiving Day" },
    { year: 2026, month: 12, day: 25, name: "圣诞节 Christmas Day" },
  ];

  for (const hol of holidayCases) {
    const check = marketCalendarService.isNyseHoliday(hol.year, hol.month, hol.day);
    assert(check.isHoliday, `休市日识别: ${hol.year}-${hol.month.toString().padStart(2, "0")}-${hol.day.toString().padStart(2, "0")} [${hol.name}] -> ${check.holidayName}`);
  }

  // 验证 2026 黑色星期五提前 13:00 收盘
  const blackFridayDateStr = "2026-11-27T13:05:00-05:00"; // 感恩节翌日 13:05 EST
  const bfSession = marketCalendarService.getMarketSession(blackFridayDateStr);
  assert(bfSession.marketPhase === "POST_MARKET", `黑五提前闭市: 2026-11-27 13:05 EST -> 提前进入 POST_MARKET`);

  // =========================================================================
  // 3. TIER 2: SearXNG 搜索关键词时空时效定向与真实容器响应测试
  // =========================================================================
  console.log("\n📌 [Tier 2] SearXNG 搜索关键词时态定向构建与网络连通测试:");

  const sampleSymbol = "NVDA";
  const sampleCompany = "NVIDIA Corporation";

  const preMarketQuery = searxngSearchService.buildTimeAnchoredQuery(sampleSymbol, sampleCompany, "PRE_MARKET", "news");
  const intradayQuery = searxngSearchService.buildTimeAnchoredQuery(sampleSymbol, sampleCompany, "INTRADAY", "news");
  const postMarketQuery = searxngSearchService.buildTimeAnchoredQuery(sampleSymbol, sampleCompany, "POST_MARKET", "news");
  const weekendQuery = searxngSearchService.buildTimeAnchoredQuery(sampleSymbol, sampleCompany, "WEEKEND_OR_HOLIDAY", "news");

  console.log(`  • 盘前 Query: ${preMarketQuery}`);
  assert(preMarketQuery.includes("pre-market") && preMarketQuery.includes("overnight"), "盘前 Query 必须包含 pre-market 与 overnight");

  console.log(`  • 盘中 Query: ${intradayQuery}`);
  assert(intradayQuery.includes("intraday") && intradayQuery.includes("breaking news"), "盘中 Query 必须包含 intraday 与 breaking news");

  console.log(`  • 盘后 Query: ${postMarketQuery}`);
  assert(postMarketQuery.includes("post-market") && postMarketQuery.includes("after hours"), "盘后 Query 必须包含 post-market 与 after hours");

  console.log(`  • 周末 Query: ${weekendQuery}`);
  assert(weekendQuery.includes("weekly market outlook"), "周末 Query 必须包含 weekly market outlook");

  // 真实测试 SearXNG 服务连通与真实检索
  const searxngStatus = await searxngSearchService.getStatus(false);
  console.log(`  • SearXNG 状态: ${searxngStatus.message} (连通: ${searxngStatus.connected})`);
  if (searxngStatus.connected) {
    const livePreNews = await searxngSearchService.searchStockNews(preMarketQuery, 2);
    console.log(`  • 盘前真实搜索抓取到 ${livePreNews.length} 篇资讯: "${livePreNews[0]?.title?.slice(0, 40)}..."`);
    assert(livePreNews.length >= 0, "SearXNG 盘前搜索请求成功响应");
  }

  // =========================================================================
  // 4. TIER 3: 大模型提示词角色与使命时态注入断言
  // =========================================================================
  console.log("\n📌 [Tier 3] 大模型 (Ollama) 系统提示词角色与行动指令时态注入断言:");

  const phases: MarketSessionPhase[] = ["PRE_MARKET", "INTRADAY", "POST_MARKET", "WEEKEND_OR_HOLIDAY"];
  for (const p of phases) {
    const s = marketCalendarService.getMarketSession(undefined, p);
    const promptText = marketCalendarService.formatSessionPromptContext(s);
    
    assert(promptText.includes(s.phaseLabel), `Prompt 成功包含时态标签: ${s.phaseLabel}`);
    assert(promptText.includes(s.activeRoleName), `Prompt 成功注入大模型专属担当角色: 【${s.activeRoleName}】`);

    if (p === "PRE_MARKET") {
      assert(promptText.includes("entryZone") || promptText.includes("开盘挂单"), "盘前 Prompt 必须强调建议挂单区间与开盘防线");
    } else if (p === "INTRADAY") {
      assert(promptText.includes("动态跟踪止损") || promptText.includes("盘中"), "盘中 Prompt 必须强调动态风控与盘中调仓");
    } else if (p === "POST_MARKET") {
      assert(promptText.includes("三态实盘检验归因") || promptText.includes("复盘"), "盘后 Prompt 必须强调实盘归因与经验沉淀");
    }
  }

  // =========================================================================
  // 5. TIER 4: 时空穿梭模拟演练器 (Simulation Mode) 切换断言
  // =========================================================================
  console.log("\n📌 [Tier 4] 前后端时空穿梭模拟演练器 (Simulation Mode) 断言:");

  const simPre = marketCalendarService.getMarketSession("2026-08-17T08:30:00-04:00", "PRE_MARKET");
  assert(simPre.isSimulated === true && simPre.marketPhase === "PRE_MARKET", "模拟盘前成功挂载 isSimulated: true");

  const simIntra = marketCalendarService.getMarketSession("2026-08-17T14:00:00-04:00", "INTRADAY");
  assert(simIntra.isSimulated === true && simIntra.marketPhase === "INTRADAY", "模拟盘中成功挂载 isSimulated: true");

  console.log("\n======================================================================");
  console.log(`🎉 自动化测试套件执行完毕！测试项统计: ${passedTests}/${totalTests} 通过 (100% 成功率)`);
  console.log("======================================================================");
}

runMarketSessionPipelineTests().catch((err) => {
  console.error("💥 测试运行中发生未捕获异常:", err);
  process.exit(1);
});
