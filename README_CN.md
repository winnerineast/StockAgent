# StockAgent Studio - 上班族低频智能操盘与策略复盘系统 (SPA)

[English Version](README.md) | **中文文档**

> **专为上班族量身打造**：以“天”为单位的低频下班操盘与复盘系统。基于 **100% 真实 MooMoo OpenD 原生 TCP 实盘通道** + **本地 Docker/WSL SearXNG 极速全网搜索** + **硬件自适应 Ollama 本地大模型**，深度融合 **vn.py 经典量化风控架构**、**TradeMaster 宏观动力学与 PRUDEX-Compass 体系** 及 **FinAgent 双层记忆反思**。**严禁机器自动下单**，提供精准到股数、入场区间与限价滑点保护的定量调仓指南。

---

## 📸 系统实机界面与核心功能使用指南 (Visual User Guide)

本系统的核心目标是帮助上班族在**每天收盘后花 5 分钟**快速审视实盘持仓、研判宏观动力学、获取具备严格风控防呆的调仓指令，并在次日开盘前以限价单手动挂单。以下按功能模块详细介绍系统界面与使用方法：

---

### 1. 🎛️ 封面与工作台总览 (Cover & Studio Dashboard)

工作台顶部整合了系统状态、交易时态、实盘核心资产 KPI 与全流程执行步进器，让用户对系统运行环境与实盘资产一览无余。

![工作台全景总览与时态罗盘](./docs/images/01_studio_dashboard_cover.png)

#### 🌟 关键功能与交互说明：
* **硬件与服务就绪状态栏 (HeaderBar)**：
  - 实时显示 GPU 显存负载（如 RTX 4090 24GB 显存 / 64GB 内存负载）；
  - 呈现 4 大核心依赖绿灯：`🟢 OpenD 连通` (11111)、`🟢 SearXNG 就绪` (8088)、`🟢 本地模型就绪` (11434，支持硬件自动推荐如 Qwen 3.8B/7B/14B) 与 `🟢 交易已解锁`；
  - 提供**前置执行屏障 (Preflight Barrier)**：若任意一项依赖未就绪，系统主动拦截盲目推演，弹出排障指引。
* **美股交易时态状态机 (Market Session Clock)**：
  - 自动识别当前美东时间所处的交易时态：`夜间休市期 (静默维护)`、`盘前 (早盘备战)`、`盘中 (实时跟踪)` 与 `盘后 (复盘推演)`；
  - 动态切换大模型所扮演的专业角色（如夜间量化系统维护官、盘前策略先锋、盘中风控巡检官）；
  - 支持 **时空穿梭模拟模式 (Simulation Mode)**，允许用户在非交易时间模拟任意盘前/盘中时段进行回测演练。
* **4 大资产风控 KPI 卡片**：
  - **总资产 (Net Assets)** 与现金占比：实时自 OpenD 原生账户同步；
  - **持仓浮动盈亏 (P&L)**：持仓市值与成本实时比对，盈亏颜色智能标注；
  - **前次推演预测准确率**：基于历史建议与次日真实收盘价的点对点回测对账；
  - **调仓风控预算 (Budget)**：结合 Sizer 滑块设定的单次计划调仓资金。

---

### 2. 🌐 全网宏观资讯与 TradeMaster 市场动力学中枢 (Macro & MDM Dynamics)

融合 SearXNG 权威财经新闻检索与南洋理工大学 (NTU) **TradeMaster 市场动力学状态机 (MDM)**，为个股推演注入宏观自适应约束。

![全网宏观大盘与 MDM 市场动力学中枢](./docs/images/02_macro_mdm_sector_studio.png)

#### 🌟 关键功能与指标解析：
* **TradeMaster MDM 市场动力学状态机 (Market Dynamics Modeling)**：
  - **TSI 趋势强度 (Trend Strength Index)**：基于 SPY 日线动量回归斜率与均线排列计算（如 `+0.15` 多头偏强）；
  - **VCI 波动聚集度 (Volatility Clustering Index)**：基于 UVXY/VIX 波动方差与极值集聚度（如 `0.00` 平稳）；
  - **自适应风控输出**：状态机输出当前处于 `TRENDING_BULL` (多头顺势)、`COMPRESSED_CONSOLIDATION` (低波窄幅蓄势)、`HIGH_VOLATILITY_CHOP` (高波洗盘) 或 `TRENDING_BEAR` (防守避险)，并自动调节**组合总仓位上限**（如 55%~75%）与**单票上限**（$\le 35\%$）。
* **跨资产晴雨表 (Cross-Asset Anchors)**：
  - 恐慌指数 (VIX)、美债 10 年期收益率 (US10Y) 与 SPY/QQQ Beta 强弱联动。
* **标普 11 大行业 ETF 资金流与相对强度 (RS)**：
  - 实时直连 OpenD 统计 XLE/SMH/XLK/XLI/XLV 等行业 ETF 的涨跌幅、资金净流入/流出与相对大盘强度 (RS)，定位科技成长 vs 周期防御轮动方向。
* **SearXNG Tier-1 权威信源分级蒸馏**：
  - 从 Bloomberg、Reuters、WSJ 等权威通讯社定向检索并输出精炼的宏观基调、主线板块与操盘纪律。

---

### 3. ⚡ 30秒极速决策与单股全要素推演控制台 (Stock Deduction & Sizer)

系统为持仓标的、24h 清仓标的、自选关注及宏观候选标的提供统一的量化推演卡片，彻底剔除长篇大论，直击 30 秒操盘因果。

![多因子全要素推演卡片与 30 秒决策面板](./docs/images/03_stock_deduction_and_sizer.png)

#### 🌟 核心功能与卡片区域详解：
* **持仓加减控制总揽 (Sizer) 与多维过滤器**：
  - **调仓资金预算滑块**：支持自由滑动分配资金（如 \$500 ~ \$50,000）；
  - **风控偏好切换**：`保守型` (提高安全边际)、`平衡型` (标准波段)、`激进型` (顺势突破)；
  - **2-Tier 标的分类与策略过滤**：
    - 决策状态过滤：`全部标的`、`🏆 高确定性重仓`、`⚡ 建议调仓`、`🛡️ 实盘持仓`、`⏳ 观察备选`、`🟢 经验反哺`、`🔴 教训警示`；
    - 5 大多因子策略分类：`主力净流入建仓`、`超跌反弹建仓`、`基本面安全边际`、`消息催化建仓`、`中性观望`。
* **⚡ 30 秒极速决策「3 大客观事实证据链」 (3-Pillar Hard Facts)**：
  - **1. 基本面与估值锚点**：OpenD 动态 PE/PS、营收增速与估值合理性判定；
  - **2. 权威消息与行业催化**：SearXNG 深度消歧后的突发利好/利空事实；
  - **3. 资金流与 ATR 防线**：主力资金超大单净买入额与 ATR 动态软防线。
* **🛡️ 交易不变量刚性防呆校验 (Trade Invariant Guardrails)**：
  - 借鉴 FINOS Legend 思想，每笔建议均通过资金充足性、仓位上限（$\le 35\%$）、点位单调性（$SL < P < TP$）自动校验，点亮绿色安全通过徽章；若模型输出溢出则自动纠偏自愈。
* **⚔️ 多智能体多空对抗辩论 (Bull vs Bear Debate)**：
  - 借鉴 TradingAgents 架构，强制大模型同时输出多方主线理由、**空方致命下行风险点 (`bearishRiskPoint`)** 与 **多空出清裁决 (`bullBearVerdict`)**，杜绝盲目看多。
* **🛡️ 微观做市商流动性与挂单滑点保护 (Microstructure Protection)**：
  - 依据买卖盘口价差 (Bid/Ask Spread) 与换手率计算流动性脆弱度指数 (LFI)；
  - 在 `EntryZone` 自动测算并输出**限价单滑点保护区间**（如建议买入限价挂在 \$97.46 ~ \$98.50 之间，防范开盘集合竞价冲高回落追高被套）。
* **Google TimeFM 时序大模型次日预测**：
  - 输入 120 天 K 线时序，输出高置信度次日涨跌方向、预期涨幅与 10%~90% 置信区间。
* **🚨 数据完备性刚性熔断机制 (Data Sufficiency Gatekeeper)**：
  - 当某些标的因未开盘或数据缺失时（如 AAPL 模拟离线），系统主动熔断该标的的盲目推演，明确列出缺失字段与排障指引，杜绝 AI 凭空臆测。

---

### 4. 🧭 TradeMaster PRUDEX-Compass 6 维体检罗盘 (Quality Benchmark)

点击顶部导航的 **`🧭 PRUDEX 6维体检 & FinAgent 原则库 (Retro & Quality Radar)`**，即可进入南洋理工大学 PRUDEX-Compass 体系操盘质量评估专区。

![PRUDEX-Compass 6 维体检罗盘](./docs/images/04_prudex_compass_radar.png)

#### 🌟 6 维评估体系与 17 个细分子指标：
* **[P] 收益力 (Profitability - 80分 / 基准 68分)**：实盘对账胜率 (76.5%)、盈亏比 (2.8x)、累计对账净收益；
* **[R] 风控力 (Risk-Control - 88分 / 基准 72分)**：ATR 止损执行达标率 (92.0%)、已规避潜在损失、最大回撤截断率；
* **[U] 普适性 (Universality - 74分 / 基准 60分)**：跨行业板块覆盖率 (8 大板块)、牛熊周期适应度；
* **[D] 多样性 (Diversity - 78分 / 基准 65分)**：持仓 HHI 集中度 (0.19 均衡)、单票仓位合规率 (100%)；
* **[E] 可靠性 (Reliability - 85分 / 基准 70分)**：期望校准误差 ECE (6.2%)、虚假自信与幻觉拦截率；
* **[X] 可解释性 (Explainability - 92分 / 基准 80分)**：5 大事实链完整度 (4.8/5.0)、下班决策时间 ($<30$ 秒)。
* **🧭 智能体检诊断指引**：系统自动综合 6 维得分生成个性化操盘改进建议（如适度增加防御板块配置以进一步降低集中度）。

---

### 5. 🏛️ FinAgent 双层反思原则库与历史复盘对账 (Dual-Level Memory)

深度借鉴 FinAgent 核心论文成果，构建**单票级战术反思**与**全局级战略守则**的双层记忆沉淀体系，实现越用越聪明的正向闭环。

![FinAgent 双层反思原则库与历史复盘时间轴](./docs/images/05_finagent_dual_principles.png)

#### 🌟 双层记忆与复盘对账机制：
* **🏛️ L2 全局战略守则 (已固化为系统刚性防守约束)**：
  - 从高频教训中提炼并固化的全天候纪律（例如：“高波洗盘期间强制将总仓位压低至 45% 以下”、“夜间下班挂单严格限定在 EntryZone 区间挂限价单”）；
  - 标注置信度权重（如 95%）与实盘核验强化次数。
* **🎯 L1 单票战术级经验与反思 (标的上下文精准注入)**：
  - 针对特定标的的战术特征（例如：“NVDA 财报日前 7 天进入静默期防黑天鹅提前锁定浮盈”、“TSLA 触及 52 周阻力位若主力流出切勿追高”）；
  - 推演该标的时自动作为先验知识注入大模型 Prompt。
* **历史复盘时间序列 (Timeline)**：
  - 每日盘后自动对账前日建议 vs 实盘收盘价，三态自动归因（`🟢 成功经验` / `🔴 失败教训` / `⚪ 随机噪音`），记录累计规避损失与实际收益。

---

## 🌟 核心架构与系统全景数据流

```mermaid
flowchart TD
    subgraph Preflight ["前置就绪屏障 (Execution Order Barrier)"]
        P1["🔌 MooMoo OpenD: 11111"]
        P2["🔍 SearXNG 检索: 8088"]
        P3["🤖 本地大模型: 11434"]
        P4["🔐 交易权限密码已解锁"]
        P1 & P2 & P3 & P4 -->|4大依赖全部就绪| Barrier["🚀 启动 Step 1 流水线"]
    end

    subgraph S1 ["Step 1: OpenD 原生实盘与资产对接"]
        Barrier --> A["OpenD 原生网关 TCP 11111"]
        A -->|100% 真实拉取·无Mock| B["实盘持仓 + 可用现金 + 官方自选股"]
    end

    subgraph S2 ["Step 2: SearXNG 权威资讯 & MDM 动力学"]
        B --> C["SearXNG 双通道自动唤醒 8088"]
        C -->|定向抓取| D["Bloomberg / CNBC / Reuters / WSJ 头条资讯"]
        D -->|MDM 状态机| E["TSI 趋势强度 + VCI 波动聚集 + 11 板块广度"]
    end

    subgraph S3 ["Step 3: 全美股多因子 5 大策略归类过滤"]
        E --> F["全美股雷达池 349个行业板块"]
        F --> G["优先级: 1.实盘持仓 > 2.自选关注 > 3.全美股雷达"]
        G --> H["OpenD 52周高低点、PE、EPS、净利润、换手率与机构主力资金"]
        H --> I{"多因子 5 大策略筛选"}
        I -->|📉 超跌建仓| J1["52周高点回撤 >= 15% 且估值合理"]
        I -->|💎 基本面亮眼建仓| J2["OpenD PE <= 38 且稳健盈利"]
        I -->|🚀 消息面催化建仓| J3["盘前跳空或重磅利好共振"]
        I -->|🏦 大资金进入建仓| J4["OpenD 机构超大单持续净流入"]
        I -->|👀 可以观望| J5["持仓/自选箱体震荡维持底仓"]
        I -->|不符合策略| J6["❌ 自动略过 Skip"]
        J1 & J2 & J3 & J4 & J5 --> K["入选候选推演列表"]
        K -.->|后台异步非阻塞| L["创建/更新专属标的知识图谱"]
    end

    subgraph S4 ["Step 4: Ollama 融合推演 + EIIE 凸优化 + 滑点保护"]
        E & K --> M["注入目标参数 (G%目标收益, T日跨度, D%最大回撤)"]
        M --> N["Ollama Map-Reduce 分批限流推理"]
        N --> Q["EIIE 现代组合理论风险调整权重 + 单票 ≤35% 上限"]
        N --> Q2["微观做市商价差模型 + EntryZone 限价挂单滑点保护"]
    end

    subgraph S5 ["Step 5: PRUDEX-Compass 6 维体检 & FinAgent 双层反思闭环"]
        Q & Q2 --> O["生成精确到股数、入场区间的定量调仓指南"]
        O --> R["一键复制下单指令 (供上班族手机端手动下单)"]
        O --> S["PRUDEX 6 维量化体检 (P/R/U/D/E/X) + FinAgent L1/L2 记忆沉淀"]
    end
```

---

## 💡 经典量化理论与学术研究务实落地对照表

| 核心模块 | 学术 / 工程理论来源 | StockAgent 务实落地实现与文件位置 |
| :--- | :--- | :--- |
| **市场动力学状态机 (MDM)** | **TradeMaster Market Dynamics Modeling** | [`marketDynamicsService.ts`](file:///c:/Users/lilin/StockAgent/server/src/services/marketDynamicsService.ts)：计算 SPY TSI 趋势强度、UVXY VCI 波动聚集度与 11 板块广度，自适应调节仓位上限与 ATR 止损倍数。 |
| **组合权重凸优化 (EIIE)** | **TradeMaster EIIE / MPT 现代组合理论** | [`portfolioOptimizerService.ts`](file:///c:/Users/lilin/StockAgent/server/src/services/portfolioOptimizerService.ts)：基于风险调整期望收益求解最优权重，刚性执行单标的 $\le 35\%$、单板块 $\le 50\%$ 上限，输出整数股数与预期 Sharpe 比率。 |
| **PRUDEX 操盘综合体检** | **TradeMaster PRUDEX-Compass Benchmark** | [`prudexCompassService.ts`](file:///c:/Users/lilin/StockAgent/server/src/services/prudexCompassService.ts)：覆盖 **P** (收益力)、**R** (风控力)、**U** (普适性)、**D** (多样性)、**E** (可靠性)、**X** (可解释性) 6 维 17 个子指标与体检诊断。 |
| **双层记忆反思原则库** | **FinAgent Dual-Level Memory Reflection** | [`memoryConsolidationService.ts`](file:///c:/Users/lilin/StockAgent/server/src/services/memoryConsolidationService.ts)：区分 **L1 单票战术级反思**（财报静默期、阻力位）与 **L2 全局战略守则**（高波压仓、限价滑点保护）。 |
| **微观做市商与滑点保护** | **TradeMaster Microstructure Model** | [`multiAgentMarketSimulator.ts`](file:///c:/Users/lilin/StockAgent/server/src/services/multiAgentMarketSimulator.ts)：计算流动性脆弱度 (LFI)，在 EntryZone 自动预留限价单滑点缓冲区间。 |
| **交易与数据不变量防呆** | **FINOS Legend Class Invariants** | [`tradeInvariantValidator.ts`](file:///c:/Users/lilin/StockAgent/server/src/services/tradeInvariantValidator.ts)：防爆仓与防 AI 幻觉守门员。强制执行资金不超可用上限、止损严禁倒挂高于现价，异常时自动纠偏自愈。 |
| **数据完备性刚性熔断** | **FINOS Legend Gatekeeper 门禁机制** | [`dataSufficiencyGatekeeper.ts`](file:///c:/Users/lilin/StockAgent/server/src/services/dataSufficiencyGatekeeper.ts)：核心字段缺失时主动阻断推演，给出明确排障指引，杜绝大模型盲目臆测。 |

---

## 👔 专为上班族打造的特色功能总结

1. **严禁机器自动下单 (Zero Automated Execution)**：
   - 彻底避免由于网络波动、API 滑点或极端行情导致的机器强平风险；
   - 每个推荐标的卡片均提供 **「📋 复制下单指令」**，一键复制 `标的 / 买卖方向 / 股数 / 限价`，方便上班族晚上在手机或电脑端自主确认挂单。
2. **⚡ 下班 30 秒极速决策「3 大客观事实证据链」 (3-Pillar Decision Facts)**：
   - 每张标的卡片醒目呈现 **基本面估值锚点**、**权威要闻催化**与**主力资金/ATR防守线**，直击核心因果，下班 30 秒快速评估挂单决策。
3. **🛡️ 交易不变量刚性防呆与自愈 (Trade Invariant Guardrails)**：
   - 任何大模型推演建议均需通过资金充足性、仓位上限与点位单调性检验，点亮安全通过徽章，彻底杜绝 AI 幻觉造成的违规挂单。
4. **执行顺序屏障 (Preflight Barrier)**：
   - 系统严密把控执行顺序：当且仅当 **OpenD (11111)**、**SearXNG (8088)**、**Ollama 本地模型 (11434)** 与 **交易解锁** 4 项全部就绪后，才正式启动 Step 1 推演流水线。
5. **Single-Flight 服务端单飞互斥锁与限流**：
   - 全局拦截并发重复请求，合并在途推演任务；
   - Ollama 推理采用 2-Worker 并发池与 60s 宽裕超时，彻底解决本地显存积压与排队超时问题。
6. **SearXNG 双通道自动唤起 (Docker + WSL Daemon)**：
   - 自动检测并唤醒 WSL Ubuntu 与 Windows Docker 守护进程，无需手动开终端敲命令行启动服务。
7. **⚔️ 多智能体多空对抗辩论与严苛风控质询 (Bull vs Bear Debate)**：
   - 深度吸收 `TradingAgents` 架构精髓，单次 Prompt 中让大模型同时扮演多头研究员与严苛风控官，强制输出 `bearishRiskPoint` 致命下行风险点与 `bullBearVerdict` 裁决，拒绝盲目看多。
8. **📅 美股专属财报静默期与期权 Gamma 异动雷达 (US Equity Special Intel)**：
   - 动态推演财报倒计时（$\le 7$ 天自动标红高危静默期预警），结合盘口主力资金流向实时测算做市商 Gamma 偏斜与认购/认沽比（PCR）。
9. **100% 真实数据·零硬编码 (Zero Mock / Hardcoding)**：
   - 彻底移除了所有静态假数据和 `1000.0` 默认兜底，所有行情、净值、现金均直连 OpenD 实盘端口。

---

## 🚀 快速开始 (Quick Start)

### 1. 环境准备
- **Node.js**: `v18+`
- **Docker** 或 **WSL2** (用于 SearXNG 本地搜索引擎容器)
- **Ollama**: 本地运行 `http://127.0.0.1:11434`（推荐配置 Qwen 3.8 / Qwen 3.6 / Gemma 4）
- **MooMoo OpenD**: 本地运行 `127.0.0.1:11111`
- **Python**: `3.9+` 并安装 `pip install moomoo-api`

### 2. 安装与启动

```bash
# 1. 安装根目录及前后端依赖
npm install

# 2. 初始化 SQLite 数据库
npm run db:push

# 3. 启动开发服务器 (同时启动后端 3001 与前端 3000)
npm run dev
```

打开浏览器访问：**`http://localhost:3000`**

---

## 🛠️ 项目结构 (Project Structure)

```
StockAgent/
├── client/                     # React + Vite + TailwindCSS SPA 前端
│   ├── src/
│   │   ├── components/         # Studio 视图、步进器、标的卡片、全景舱弹窗、PRUDEX 看板
│   │   └── App.tsx             # 状态驱动、执行屏障与 Studio 路由
├── server/                     # Node.js + Express + Prisma 后端
│   ├── src/
│   │   ├── routes/             # RESTful API 路由 (/api/stock/...)
│   │   ├── services/           # MDM 动力学、EIIE 组合优化、PRUDEX 评估、双层记忆、量化风控
│   │   └── types/              # 5 大策略分类、MDM、PRUDEX、不变量类型定义
│   └── prisma/                 # SQLite 数据库 Schema
├── docs/                       # 项目文档与高清实机运行截图
│   └── images/                 # 工作台全景、宏观中枢、推演卡片、PRUDEX 罗盘、原则库截图
├── package.json                # 项目依赖与脚本
└── README.md                   # 英文说明文档
```

---

## 📄 License

[MIT License](LICENSE)
