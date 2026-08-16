import { MarketSessionContext, MarketSessionPhase } from "../types/stockTypes";

/**
 * 美股交易日历、时空状态机与时钟依赖注入中枢
 * 1. 严格美东时间 (America/New_York) 换算，自动适配夏令时 (EDT) 与冬令时 (EST)
 * 2. 严密的 NYSE / NASDAQ 官方休市日历与提前休市日算法 (Easter / Good Friday, Thanksgiving, etc.)
 * 3. 5 大时态精准切分 (PRE_MARKET, INTRADAY, POST_MARKET, OVERNIGHT_CLOSED, WEEKEND_OR_HOLIDAY)
 * 4. 支持任意历史/指定时间注入 (Time Injection)，实现 100% 确定性的全时态测试与演练
 */
export class MarketCalendarService {
  /**
   * 判定指定年份的复活节星期日 (Meeus/Jones/Butcher Gregorian 算法)
   */
  private getEasterSunday(year: number): { month: number; day: number } {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return { month, day };
  }

  /**
   * 判定指定年份的耶稣受难日 Good Friday (复活节前的星期五，美股法定全天休市)
   */
  private getGoodFriday(year: number): { month: number; day: number } {
    const easter = this.getEasterSunday(year);
    // 复活节倒推 2 天即为 Good Friday
    const easterDate = new Date(Date.UTC(year, easter.month - 1, easter.day));
    easterDate.setUTCDate(easterDate.getUTCDate() - 2);
    return { month: easterDate.getUTCMonth() + 1, day: easterDate.getUTCDate() };
  }

  /**
   * 获取某月第 N 个星期 X 的日期 (例如 1月的第3个星期一)
   */
  private getNthDayOfWeek(year: number, month: number, targetDayOfWeek: number, n: number): number {
    const firstDay = new Date(Date.UTC(year, month - 1, 1));
    let dayOfWeek = firstDay.getUTCDay();
    let day = 1 + ((targetDayOfWeek - dayOfWeek + 7) % 7) + (n - 1) * 7;
    return day;
  }

  /**
   * 获取某月最后一个星期 X 的日期 (例如 5月的最后一个星期一 Memorial Day)
   */
  private getLastDayOfWeek(year: number, month: number, targetDayOfWeek: number): number {
    // 构造下个月第0天即为本月最后一天
    const lastDayDate = new Date(Date.UTC(year, month, 0));
    let lastDate = lastDayDate.getUTCDate();
    let dayOfWeek = lastDayDate.getUTCDay();
    let diff = (dayOfWeek - targetDayOfWeek + 7) % 7;
    return lastDate - diff;
  }

  /**
   * 判断指定美东日期 (YYYY-MM-DD) 是否为 NYSE / NASDAQ 官方全天休市日
   */
  public isNyseHoliday(year: number, month: number, day: number): { isHoliday: boolean; holidayName?: string } {
    // 1. 元旦 New Year's Day (1月1日，若为周日顺延至周一，若为周六前移至前一年周五)
    if (month === 1 && day === 1) return { isHoliday: true, holidayName: "New Year's Day (元旦)" };
    if (month === 1 && day === 2) {
      const jan1Day = new Date(Date.UTC(year, 0, 1)).getUTCDay();
      if (jan1Day === 0) return { isHoliday: true, holidayName: "New Year's Day (元旦补休)" };
    }

    // 2. 马丁·路德·金纪念日 Martin Luther King, Jr. Day (1月的第3个星期一)
    const mlkDay = this.getNthDayOfWeek(year, 1, 1, 3);
    if (month === 1 && day === mlkDay) return { isHoliday: true, holidayName: "MLK Day (马丁路德金纪念日)" };

    // 3. 华盛顿诞辰日 / 总统日 Washington's Birthday / Presidents' Day (2月的第3个星期一)
    const presDay = this.getNthDayOfWeek(year, 2, 1, 3);
    if (month === 2 && day === presDay) return { isHoliday: true, holidayName: "Presidents' Day (华盛顿诞辰/总统日)" };

    // 4. 耶稣受难日 Good Friday (复活节前的星期五)
    const goodFriday = this.getGoodFriday(year);
    if (month === goodFriday.month && day === goodFriday.day) {
      return { isHoliday: true, holidayName: "Good Friday (耶稣受难日)" };
    }

    // 5. 阵亡将士纪念日 Memorial Day (5月的最后一个星期一)
    const memorialDay = this.getLastDayOfWeek(year, 5, 1);
    if (month === 5 && day === memorialDay) return { isHoliday: true, holidayName: "Memorial Day (阵亡将士纪念日)" };

    // 6. 六月节国家独立日 Juneteenth National Independence Day (6月19日，周末顺延)
    if (month === 6 && day === 19) return { isHoliday: true, holidayName: "Juneteenth (六月节独立日)" };
    if (month === 6 && day === 20) {
      const jun19Day = new Date(Date.UTC(year, 5, 19)).getUTCDay();
      if (jun19Day === 0) return { isHoliday: true, holidayName: "Juneteenth (六月节补休)" };
    }
    if (month === 6 && day === 18) {
      const jun19Day = new Date(Date.UTC(year, 5, 19)).getUTCDay();
      if (jun19Day === 6) return { isHoliday: true, holidayName: "Juneteenth (六月节补休)" };
    }

    // 7. 美国独立日 Independence Day (7月4日，周末顺延)
    if (month === 7 && day === 4) return { isHoliday: true, holidayName: "Independence Day (美国独立日)" };
    if (month === 7 && day === 5) {
      const jul4Day = new Date(Date.UTC(year, 6, 4)).getUTCDay();
      if (jul4Day === 0) return { isHoliday: true, holidayName: "Independence Day (独立日补休)" };
    }
    if (month === 7 && day === 3) {
      const jul4Day = new Date(Date.UTC(year, 6, 4)).getUTCDay();
      if (jul4Day === 6) return { isHoliday: true, holidayName: "Independence Day (独立日补休)" };
    }

    // 8. 劳动节 Labor Day (9月的第1个星期一)
    const laborDay = this.getNthDayOfWeek(year, 9, 1, 1);
    if (month === 9 && day === laborDay) return { isHoliday: true, holidayName: "Labor Day (劳动节)" };

    // 9. 感恩节 Thanksgiving Day (11月的第4个星期四)
    const thanksgivingDay = this.getNthDayOfWeek(year, 11, 4, 4);
    if (month === 11 && day === thanksgivingDay) return { isHoliday: true, holidayName: "Thanksgiving Day (感恩节)" };

    // 10. 圣诞节 Christmas Day (12月25日，周末顺延)
    if (month === 12 && day === 25) return { isHoliday: true, holidayName: "Christmas Day (圣诞节)" };
    if (month === 12 && day === 26) {
      const dec25Day = new Date(Date.UTC(year, 11, 25)).getUTCDay();
      if (dec25Day === 0) return { isHoliday: true, holidayName: "Christmas Day (圣诞节补休)" };
    }
    if (month === 12 && day === 24) {
      const dec25Day = new Date(Date.UTC(year, 11, 25)).getUTCDay();
      if (dec25Day === 6) return { isHoliday: true, holidayName: "Christmas Day (圣诞节补休)" };
    }

    return { isHoliday: false };
  }

  /**
   * 判断是否为半天提前闭市日 (13:00 ET 闭市，例如感恩节翌日黑五、平安夜等)
   */
  public isEarlyCloseDay(year: number, month: number, day: number): boolean {
    // 1. 黑色星期五 (感恩节后的星期五)
    const thanksgivingDay = this.getNthDayOfWeek(year, 11, 4, 4);
    if (month === 11 && day === thanksgivingDay + 1) return true;

    // 2. 圣诞前夕 (12月24日若为工作日)
    if (month === 12 && day === 24) {
      const d = new Date(Date.UTC(year, 11, 24)).getUTCDay();
      if (d >= 1 && d <= 5) return true;
    }

    // 3. 独立日前夕 (7月3日若为工作日且7月4日不为周末)
    if (month === 7 && day === 3) {
      const d = new Date(Date.UTC(year, 6, 3)).getUTCDay();
      if (d >= 1 && d <= 4) return true;
    }

    return false;
  }

  /**
   * 将任意参考时间 (UTC / Local / Timestamp) 统一转换为美东时区 (America/New_York) 拆解分量
   */
  public getEasternComponents(referenceTime: Date | string | number = new Date()): {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
    dayOfWeek: number; // 0=Sunday, 1=Monday... 6=Saturday
    isDST: boolean;
    timeZoneAbbr: string;
    formattedET: string;
    formattedLocal: string;
    rawDate: Date;
  } {
    const rawDate = typeof referenceTime === "string" || typeof referenceTime === "number"
      ? new Date(referenceTime)
      : referenceTime;

    // 使用 Intl.DateTimeFormat 精确提取 America/New_York 时区各分量
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      weekday: "short",
      hour12: false,
      timeZoneName: "short",
    });

    const parts = dtf.formatToParts(rawDate);
    const partMap: Record<string, string> = {};
    parts.forEach((p) => {
      partMap[p.type] = p.value;
    });

    const year = parseInt(partMap.year, 10);
    const month = parseInt(partMap.month, 10);
    const day = parseInt(partMap.day, 10);
    let hour = parseInt(partMap.hour, 10);
    if (hour === 24) hour = 0;
    const minute = parseInt(partMap.minute, 10);
    const second = parseInt(partMap.second, 10);

    const tzAbbr = partMap.timeZoneName || "EDT";
    const isDST = tzAbbr.includes("DT");

    // 计算星期几
    const etDateUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    const dayOfWeek = etDateUtc.getUTCDay();

    const pad = (n: number) => n.toString().padStart(2, "0");
    const formattedET = `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)} ${tzAbbr}`;
    const formattedLocal = rawDate.toLocaleString("zh-CN", { hour12: false });

    return {
      year,
      month,
      day,
      hour,
      minute,
      second,
      dayOfWeek,
      isDST,
      timeZoneAbbr: tzAbbr,
      formattedET,
      formattedLocal,
      rawDate,
    };
  }

  /**
   * 核心主方法：获取当前/指定参考时间的美股完整时态上下文
   */
  public getMarketSession(
    referenceTime: Date | string | number = new Date(),
    phaseOverride?: MarketSessionPhase
  ): MarketSessionContext {
    const et = this.getEasternComponents(referenceTime);
    const pad = (n: number) => n.toString().padStart(2, "0");
    const todayStr = `${et.year}-${pad(et.month)}-${pad(et.day)}`;

    const isWeekend = et.dayOfWeek === 0 || et.dayOfWeek === 6;
    const holidayCheck = this.isNyseHoliday(et.year, et.month, et.day);
    const isEarlyClose = this.isEarlyCloseDay(et.year, et.month, et.day);

    const isTradingDay = !isWeekend && !holidayCheck.isHoliday;

    // 美东当天分钟数 (0 ~ 1439)
    const minutesSinceMidnight = et.hour * 60 + et.minute;
    const preMarketStart = 4 * 60; // 04:00 ET = 240
    const regularOpen = 9 * 60 + 30; // 09:30 ET = 570
    const regularClose = isEarlyClose ? 13 * 60 : 16 * 60; // 16:00 ET = 960 (半天为 13:00)
    const postMarketEnd = 20 * 60; // 20:00 ET = 1200

    let marketPhase: MarketSessionPhase = "WEEKEND_OR_HOLIDAY";
    let phaseLabel = "⚪ 周末/休市研判期";
    let phaseDescription = "当前为非交易日，量化引擎聚焦宏观周报推演、跨资产流动性梳理与知识图谱拓扑沉淀";
    let activeRoleName = "宏观战略规划师";
    let timeToNextBellMinutes = 0;
    let countdownLabel = "";

    if (isTradingDay) {
      if (minutesSinceMidnight >= preMarketStart && minutesSinceMidnight < regularOpen) {
        marketPhase = "PRE_MARKET";
        phaseLabel = "🟡 盘前推演期";
        phaseDescription = "美股盘前时段，聚焦隔夜宏观、盘前财报与开盘挂单建仓区间 (Entry Zone) 预案";
        activeRoleName = "盘前首席策略官";
        timeToNextBellMinutes = regularOpen - minutesSinceMidnight;
        countdownLabel = `距离美股正式开盘还有 ${timeToNextBellMinutes} 分钟`;
      } else if (minutesSinceMidnight >= regularOpen && minutesSinceMidnight < regularClose) {
        marketPhase = "INTRADAY";
        phaseLabel = "🟢 盘中交易期";
        phaseDescription = "美股正式交易中，实时监控盘面异动、急跌抄底机会、动态止损止盈预警与实时调仓";
        activeRoleName = "盘中实时风控操盘官";
        timeToNextBellMinutes = regularClose - minutesSinceMidnight;
        countdownLabel = isEarlyClose
          ? `距离特殊提前收盘 (13:00) 还有 ${timeToNextBellMinutes} 分钟`
          : `距离美股正式收盘还有 ${Math.floor(timeToNextBellMinutes / 60)}小时${timeToNextBellMinutes % 60}分`;
      } else if (minutesSinceMidnight >= regularClose && minutesSinceMidnight < postMarketEnd) {
        marketPhase = "POST_MARKET";
        phaseLabel = "🔵 盘后复盘期";
        phaseDescription = "美股盘后结算时段，深度执行全天三态实盘检验归因 (成功经验/失败教训/噪音)、盘后财报解读与明日应对";
        activeRoleName = "盘后复盘归因与进化审计官";
        timeToNextBellMinutes = postMarketEnd - minutesSinceMidnight;
        countdownLabel = `距离夜间休市清算还有 ${Math.floor(timeToNextBellMinutes / 60)}小时${timeToNextBellMinutes % 60}分`;
      } else {
        marketPhase = "OVERNIGHT_CLOSED";
        phaseLabel = "🌙 夜间休市期";
        phaseDescription = "美股处于夜间休市静默期，系统执行自动化数据归档与次日晨会预备";
        activeRoleName = "夜间量化系统维护官";
        const minutesToNextPre = minutesSinceMidnight < preMarketStart
          ? preMarketStart - minutesSinceMidnight
          : (1440 - minutesSinceMidnight) + preMarketStart;
        timeToNextBellMinutes = minutesToNextPre;
        countdownLabel = `距离次日 04:00 盘前开启还有 ${Math.floor(minutesToNextPre / 60)}小时${minutesToNextPre % 60}分`;
      }
    } else {
      if (isWeekend) {
        const daysToMonday = et.dayOfWeek === 6 ? 2 : 1;
        countdownLabel = `周末休市中，距离周一 09:30 开盘约 ${daysToMonday * 24} 小时`;
      } else {
        countdownLabel = `法定节假日 [${holidayCheck.holidayName || "休市"}] 休市中`;
      }
    }

    // 允许外部强制覆盖时态 (用于测试与时空穿梭模拟演练)
    if (phaseOverride) {
      marketPhase = phaseOverride;
      if (phaseOverride === "PRE_MARKET") {
        phaseLabel = "🟡 [模拟] 盘前推演期";
        activeRoleName = "盘前首席策略官";
        phaseDescription = "【时空穿梭模拟】聚焦隔夜宏观、盘前财报与开盘挂单建仓区间 (Entry Zone) 预案";
        countdownLabel = "模拟盘前状态中";
      } else if (phaseOverride === "INTRADAY") {
        phaseLabel = "🟢 [模拟] 盘中交易期";
        activeRoleName = "盘中实时风控操盘官";
        phaseDescription = "【时空穿梭模拟】实时监控盘面异动、急跌抄底机会、动态止损止盈预警与实时调仓";
        countdownLabel = "模拟盘中状态中";
      } else if (phaseOverride === "POST_MARKET") {
        phaseLabel = "🔵 [模拟] 盘后复盘期";
        activeRoleName = "盘后复盘归因与进化审计官";
        phaseDescription = "【时空穿梭模拟】深度执行全天三态实盘检验归因 (成功经验/失败教训/噪音)、盘后财报解读与明日应对";
        countdownLabel = "模拟盘后状态中";
      } else if (phaseOverride === "WEEKEND_OR_HOLIDAY") {
        phaseLabel = "⚪ [模拟] 周末/休市研判期";
        activeRoleName = "宏观战略规划师";
        phaseDescription = "【时空穿梭模拟】宏观周报推演、跨资产流动性梳理与知识图谱拓扑沉淀";
        countdownLabel = "模拟周末状态中";
      }
    }

    // 计算下一个交易日
    const nextTradingDay = this.calculateNextTradingDay(et.year, et.month, et.day);

    return {
      easternTimeStr: et.formattedET,
      localTimeStr: et.formattedLocal,
      isTradingDay,
      marketPhase,
      phaseLabel,
      phaseDescription,
      activeRoleName,
      timeToNextBellMinutes,
      countdownLabel,
      currentTradingDay: todayStr,
      nextTradingDay,
      isSimulated: !!phaseOverride || (referenceTime !== undefined && referenceTime !== null),
    };
  }

  /**
   * 计算下一个合法的 NYSE 交易日 YYYY-MM-DD
   */
  public calculateNextTradingDay(year: number, month: number, day: number): string {
    let d = new Date(Date.UTC(year, month - 1, day));
    for (let i = 1; i <= 10; i++) {
      d.setUTCDate(d.getUTCDate() + 1);
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth() + 1;
      const dt = d.getUTCDate();
      const dow = d.getUTCDay();

      if (dow === 0 || dow === 6) continue; // 周末
      const hol = this.isNyseHoliday(y, m, dt);
      if (hol.isHoliday) continue; // 节假日

      const pad = (n: number) => n.toString().padStart(2, "0");
      return `${y}-${pad(m)}-${pad(dt)}`;
    }
    return `${year}-${month.toString().padStart(2, "0")}-${(day + 1).toString().padStart(2, "0")}`;
  }

  /**
   * 格式化注入到大模型 Prompt 的时空锚定文本段
   */
  public formatSessionPromptContext(session: MarketSessionContext): string {
    let missionGuide = "";
    switch (session.marketPhase) {
      case "PRE_MARKET":
        missionGuide = `1. 当前为【盘前分析时段】(尚未开盘)。
2. 请重点评估隔夜宏观风向、盘前跳空缺口 (Gap-up/down) 与盘前大单。
3. 必须输出明确的【建议挂单建仓区间 entryZone: { min, max }】与【今日开盘最大止损防线】，为即时开盘挂单做好全方位准备。`;
        break;
      case "INTRADAY":
        missionGuide = `1. 当前为【盘中实时交易中】。
2. 请重点关注盘面实时波动、主力资金急剧突变、分时急跌超卖捞底机会与急涨止盈点。
3. 必须输出【动态跟踪止损止盈预警】与【当前仓位紧急加减仓调控】，防范盘中闪崩并捕捉盘中确定性 Alpha。`;
        break;
      case "POST_MARKET":
        missionGuide = `1. 当前为【收盘后复盘与结算时段】。
2. 请结合今日收盘实盘结果深度执行【三态实盘检验归因 (成功经验 / 失败教训 / 随机噪音)】。
3. 必须深度剖析为何涨跌、总结策略有效性、解读盘后最新财报与电话会，并提炼沉淀为明日策略库资产。`;
        break;
      case "WEEKEND_OR_HOLIDAY":
      default:
        missionGuide = `1. 当前为【周末/休市研判时段】。
2. 请进行周度全景宏观研判、跨资产 (美元/美债/VIX) 大盘环境推演与产业链知识图谱拓扑扩充。
3. 聚焦下周行业催化与大盘主线，建立高确定性备选股票候选池。`;
        break;
    }

    return `【当前美股时空时态锚点】:
- 美东时间 (ET): ${session.easternTimeStr}
- 市场阶段: ${session.phaseLabel} (${session.countdownLabel})
- 交易日状态: ${session.isTradingDay ? "🟢 官方交易日" : "⚪ 休市研判日"}
- 大模型当前角色: 【${session.activeRoleName}】

【当前时态核心行动指引】:
${missionGuide}`;
  }
}

export const marketCalendarService = new MarketCalendarService();
