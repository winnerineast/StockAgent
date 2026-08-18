<!-- graft:start -->
## Graft — repo context graph

This repo is indexed in `graft/`: small linked markdown nodes that explain each
system and carry exact file:line spans, kept in sync with the code through git.

For ANY task here — understanding how something works, finding where code lives,
or scoping a change — get context from the graph before grepping or opening
source files. Re-ask freely (it's cheap) and reuse literal identifiers you
already have (symbol, error string, file name) as the query. New to this repo?
Run `graft map` first — a token-budgeted orientation (dir clusters, hubs,
hotspots), no LLM, no key.

- Run `graft ask "<your question>" --source` → ranked nodes with the relevant
  code spans inlined (each hit's ≤8-line crux by default; `--full` for whole
  definitions when the crux isn't enough). Match the tool to the task shape:
  for understanding or editing, the top node IS the answer — cite its
  `covers:` file:line spans and edit straight from `--source`. For
  exhaustive tasks ("every occurrence / every caller of this pattern"), ranked
  results are top-N, not complete — run `graft grep "<literal>"` instead
  (exhaustive over indexed files, grouped by enclosing symbol), falling back
  to raw `grep -rn` only for unindexed files.
- `graft skeleton <file>` → every definition's signature + span, ~10× cheaper
  than reading the file; use it to skim an API surface.
- `graft callers <symbol>` gives precomputed, exact edges — who calls this.
  Add `--direction out` for what it calls, or `--depth N` to walk
  transitively for the full blast radius. For structural questions, skip
  ranking and use this directly.
- Or browse: `graft/INDEX.md` lists every node; follow the links.
- Monorepos and folders of multiple repos rank fairly across sub-projects —
  hits carry `[scope/]` labels naming which one they're from. Narrow with
  `graft ask "<task>" --in <scope>/` once you know where you're working.

If a returned span is truncated ("+N more lines"), open the file at that exact
range before finalizing. Only open source files when a node genuinely lacks a
needed detail, and then at the exact file:line the node points to — never
re-read whole files.

After big code changes, refresh the graph with `graft build` (deterministic,
no API key, $0).
<!-- graft:end -->

<!-- aidlc:start -->
## 🤖 AI-DLC 研发与测试工作流规范 (AI-Driven Development Life Cycle)

本项目严格遵循 **AI-DLC (AI-Driven Development Life Cycle)** 研发与质量门禁规范，拒绝盲目生成（Vibe Coding），确保金融量化代码的严格正确性与系统稳定性。

### 1. 阶段一：Inception (构想与契约对齐)
- **上下文调研**：先利用 `graft` 或架构卡片定位关键模块（如 `dailyStrategyDirector.ts`, `multiAgentMarketSimulator.ts`, `tradeInvariantValidator.ts`）。
- **刚性风控不变量校验**：任何涉及交易指令输出的模块，必须遵守：
  - 止损止盈不变量：严禁违反 $SL < P < TP$ 或单票最大仓位上限。
  - 数据就绪门禁：严禁在 MooMoo / SearXNG / Ollama 离线时产出未经校验的实盘指令。
- **方案先行与人类确认 (Human-in-the-Loop)**：重大功能或核心算法重构必须先产出包含影响范围、Schema 契约与测试方案的 Plan，获得开发者确认后方可进入下一阶段。

### 2. 阶段二：Construction (构建与测试先行)
- **原子化编码**：严禁对核心大文件进行粗暴重写或破坏已有量化状态机。
- **测试门禁 (Test-First & Invariant Testing)**：
  - 凡在 `server/src/services/` 中新增/修改业务与量化逻辑，必须在 `server/src/services/__tests__/` 同步补充 Vitest 单元测试用例。
  - 严格覆盖边界条件（如滑点极限、零除保护、极端行情波动）。
- **质量门禁验证**：交付前必须本地运行 `npm run test` (Vitest) 确保 100% 通过，并运行 `npm run check` 确保无 TypeScript 类型错误。

### 3. 阶段三：Operations (运行验证与工件沉淀)
- **端到端验证**：核验前后端联调状态及硬件/模型环境依赖。
- **工件沉淀**：改动记录与设计工件沉淀至 `docs/` 或相关文档中，必要时执行 `graft build` 刷新索引。
<!-- aidlc:end -->
