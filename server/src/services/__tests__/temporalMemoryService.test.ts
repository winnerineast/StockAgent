import { describe, it, expect, beforeEach, vi } from "vitest";
import { TemporalMemoryService } from "../temporalMemoryService";

describe("TemporalMemoryService (Holistic Context Primitive: Half-Open Validity & As-of-Time)", () => {
  let service: TemporalMemoryService;

  beforeEach(() => {
    service = TemporalMemoryService.getInstance();
  });

  describe("isBeliefActiveAt (半开时态有效区间 [validStart, validEnd) 逻辑)", () => {
    it("当 validEnd 为 null (+∞) 时，任意大于等于 validStart 的时刻均应处于活跃状态", () => {
      const vStart = "2026-03-01";
      const vEnd = null;

      // 1. 在生效时间前：尚未获得认知，应为 false
      expect(service.isBeliefActiveAt(vStart, vEnd, "2026-02-28")).toBe(false);
      // 2. 恰好在生效时刻：处于半开区间左闭起点，应为 true
      expect(service.isBeliefActiveAt(vStart, vEnd, "2026-03-01")).toBe(true);
      // 3. 在生效时刻之后：持续有效，应为 true
      expect(service.isBeliefActiveAt(vStart, vEnd, "2026-08-19")).toBe(true);
    });

    it("当 validEnd 闭合时，处于 [validStart, validEnd) 内部为 true，达到或超过 validEnd 为 false (右开)", () => {
      const vStart = "2026-04-01";
      const vEnd = "2026-06-15"; // 在 6月15日 被新证据取代

      // 4月1日生效
      expect(service.isBeliefActiveAt(vStart, vEnd, "2026-04-01")).toBe(true);
      // 5月1日处于区间内部
      expect(service.isBeliefActiveAt(vStart, vEnd, "2026-05-01")).toBe(true);
      // 6月14日处于区间内部
      expect(service.isBeliefActiveAt(vStart, vEnd, "2026-06-14")).toBe(true);
      // 6月15日刚好达到 validEnd (右开点，已被新原则接管)，应为 false
      expect(service.isBeliefActiveAt(vStart, vEnd, "2026-06-15")).toBe(false);
      // 6月16日之后已被历史归档，应为 false
      expect(service.isBeliefActiveAt(vStart, vEnd, "2026-07-01")).toBe(false);
    });
  });

  describe("As-of-Time 历史回测切片与消除未来函数 (Zero Lookahead Bias)", () => {
    it("对 NVDA 的认知演化序列进行时态切片，能 100% 精确复现不同历史时刻的信念", () => {
      // 模拟 NVDA 在 2026 年的 3 条原则演化链：
      // Rule 1: [2026-01-01, 2026-03-15) "NVDA 估值偏高，建仓区间必须打折挂单" -> 被 3月15日 财报超预期推翻
      // Rule 2: [2026-03-15, 2026-07-01) "NVDA Blackwell 需求爆发，突破即加仓" -> 被 7月1日 供应链瓶颈推翻
      // Rule 3: [2026-07-01, null) "NVDA 主线震荡，依托 20 日均线低吸移动止盈"
      const rules = [
        { id: "r1", validStart: "2026-01-01", validEnd: "2026-03-15", title: "估值防守" },
        { id: "r2", validStart: "2026-03-15", validEnd: "2026-07-01", title: "右侧追多" },
        { id: "r3", validStart: "2026-07-01", validEnd: null, title: "均线低吸" },
      ];

      // 回测 2026-02-15 时的状态：只有 Rule 1 活跃
      const activeFeb = rules.filter((r) => service.isBeliefActiveAt(r.validStart, r.validEnd, "2026-02-15"));
      expect(activeFeb).toHaveLength(1);
      expect(activeFeb[0].id).toBe("r1");

      // 回测 2026-05-20 时的状态：只有 Rule 2 活跃 (Rule 1 已失效，Rule 3 尚未出生)
      const activeMay = rules.filter((r) => service.isBeliefActiveAt(r.validStart, r.validEnd, "2026-05-20"));
      expect(activeMay).toHaveLength(1);
      expect(activeMay[0].id).toBe("r2");

      // 当前 2026-08-19 查询状态：只有 Rule 3 活跃
      const activeAug = rules.filter((r) => service.isBeliefActiveAt(r.validStart, r.validEnd, "2026-08-19"));
      expect(activeAug).toHaveLength(1);
      expect(activeAug[0].id).toBe("r3");
    });
  });
});
