# 📝 [功能名称] - AI-DLC Inception 设计工件模板

> **用途**：在执行中大型功能开发或核心量化 Agent 演进前，AI 必须依据此模板输出设计工件供人类审查。

---

## 1. 需求与目标 (Requirements & Motivation)
- **业务背景**：说明为什么要做此改动（如提升复盘死因归因准确率、增加新宏观动力学指标）。
- **预期效果**：改动后的输入输出或看板交互变化。

---

## 2. 影响范围与组件 (Architecture & Impact Analysis)
- **前端受影响组件**：
  - `client/src/components/...`
- **后端受影响服务**：
  - `server/src/services/...`
- **数据结构与接口变更 (Schema Changes)**：
  ```typescript
  // 列出新增或变更的 TypeScript 类型
  export interface ModifiedType {
    // ...
  }
  ```

---

## 3. 风控与不变量检查 (Risk & Invariant Checklist)
- [ ] 是否涉及价格区间？（必须符合 $SL < P < TP$）
- [ ] 是否涉及仓位与资金？（严禁突破单票最大持仓上限）
- [ ] 是否涉及外部服务超时与降级？（MooMoo / SearXNG / Ollama 离线时是否有 Mock 兜底）
- [ ] 是否影响现有状态机？（夜间休市 / 盘前 / 盘中 / 盘后）

---

## 4. 测试与验证策略 (Verification Strategy)
- **新增单元测试文件**：`server/src/services/__tests__/xxx.test.ts`
- **核心用例覆盖**：
  1. 正常入参与主流程测试
  2. 极端波动/异常数据熔断测试
  3. 空数据/网络异常降级测试
- **门禁命令**：`npm run test && npm run check`
