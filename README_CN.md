# StockAgent Studio - 上班族低频智能操盘与策略复盘系统 (SPA)

[English Version](README.md) | **中文文档**

> **专为上班族量身打造**：以“天”为单位的低频下班操盘与复盘系统。基于 **100% 真实 MooMoo OpenD 原生 TCP 实盘通道** + **本地 Docker/WSL SearXNG 极速全网搜索** + **硬件自适应 Ollama 本地大模型**，深度融合 **vn.py 经典量化风控与持仓管理架构**，严禁机器自动下单，提供精准到股数的定量调仓指南。

---

## 🌟 核心架构与系统全景

```mermaid
flowchart TD
    subgraph Preflight [前置就绪屏障 (Execution Order Barrier)]
        P1[🔌 MooMoo OpenD: 11111]
        P2[🔍 SearXNG 检索: 8088]
        P3[🤖 本地大模型: 11434]
        P4[🔐 交易权限密码已解锁]
        P1 & P2 & P3 & P4 -->|4大依赖全部就绪| Barrier[🚀 启动 Step 1 流水线]
    end

    subgraph S1 [Step 1: OpenD 原生实盘与资产对接]
        Barrier --> A[OpenD 原生网关 TCP 11111]
        A -->|100% 真实拉取·无Mock| B[实盘持仓 + 可用现金 + 官方自选股]
    end

    subgraph S2 [Step 2: SearXNG 全网宏观资讯与大盘定调]
        B --> C[SearXNG 双通道自动唤醒 8088]
        C -->|定向抓取| D[Bloomberg / CNBC / Reuters / Wall Street 头条资讯]
        D -->|Ollama 宏观提炼| E[市场情绪评分 + 明星主线 + 操盘基调 + 宏观约束上下文]
    end

    subgraph S3 [Step 3: 全美股多因子 5 大策略归类过滤]
        E --> F[全美股雷达池 349个行业板块]
        F --> G[优先级: 1.实盘持仓 > 2.自选关注 > 3.全美股雷达]
        G --> H[OpenD 52周高低点、PE、EPS、净利润、换手率与机构主力资金]
        H --> I{多因子 5 大策略筛选}
        I -->|📉 超跌建仓| J1[52周高点回撤 >= 15% 且估值合理]
        I -->|💎 基本面亮眼建仓| J2[OpenD PE <= 38 且稳健盈利]
        I -->|🚀 消息面催化建仓| J3[盘前跳空或重磅利好共振]
        I -->|🏦 大资金进入建仓| J4[OpenD 机构超大单持续净流入]
        I -->|👀 可以观望| J5[持仓/自选箱体震荡维持底仓]
        I -->|不符合策略| J6[❌ 自动略过 Skip]
        J1 & J2 & J3 & J4 & J5 --> K[入选候选推演列表]
        K -.->|后台异步非阻塞| L[创建/更新专属标的知识图谱]
    end

    subgraph S4 [Step 4: Ollama 大模型融合推演 + vn.py 量化风控]
        E & K --> M[注入目标参数 (G%目标收益, T日跨度, D%最大回撤)]
        M --> N[Ollama Map-Reduce 分批限流推理]
        N --> Q[vn.py ATR 真实波幅 + 动态止损止盈 + 单标的仓位上限截断]
    end

    subgraph S5 [Step 5: 决策执行矩阵 & 实盘经验闭环落库]
        Q --> O[生成精确到股数、入场区间的定量调仓指南]
        O --> R[一键复制下单指令 (供上班族手机端手动下单)]
        O --> S[实盘对账与三态归因: 🟢成功经验 / 🔴失败教训 / ⚪随机噪音]
    end
```

---

## 💡 深度借鉴 vn.py 的 4 大核心量化中枢架构

针对上班族“以天为单位、低频下班操盘、严禁机器自动下单”的实际业务场景，系统深度借鉴了 vn.py 量化框架的底层精髓：

| 借鉴模块 | vn.py 经典量化设计 | StockAgent 落地实现与文件位置 |
| :--- | :--- | :--- |
| **组合风控与头寸缩放** | `PortfolioStrategy` & `RiskManager` 固定风险预算 | [`quantRiskManager.ts`](file:///c:/Users/lilin/StockAgent/server/src/services/quantRiskManager.ts)：基于 ATR 真实波动率与用户 $G\%$ 目标收益率、$D\%$ 回撤容忍度，反推精确到股数的建议买入量，单标的强制 $\le 35\%$ 组合上限。 |
| **实盘跟踪与归因闭环** | `TradeRecorder` & `PerformanceAnalysis` 绩效归因 | [`deductionVerificationService.ts`](file:///c:/Users/lilin/StockAgent/server/src/services/deductionVerificationService.ts)：点对点比对过去 $T$ 天建议 vs 真实收盘价，三态自动归因（`SUCCESS`/`FAILURE`/`RANDOM_NOISE`），教训经验自动反哺大模型上下文。 |
| **时态状态机驱动** | `TradingCalendar` & `EventEngine` 交易日历驱动 | [`marketCalendarService.ts`](file:///c:/Users/lilin/StockAgent/server/src/services/marketCalendarService.ts)：划分盘前 (`PRE_MARKET`)、盘中 (`INTRADAY`)、盘后 (`POST_MARKET`) 与周末 (`WEEKEND`)，下班后自动切入盘后复盘与次日推演态。 |
| **统一网关封装** | `BaseGateway` 原生协议与数据契约封装 | [`moomooAdapter.ts`](file:///c:/Users/lilin/StockAgent/server/src/services/moomooAdapter.ts)：将 MooMoo OpenD 底层 Protobuf/TCP 封装为标准的持仓、资产与盘口接口。 |

---

## 👔 专为上班族打造的特色功能

1. **严禁机器自动下单 (Zero Automated Execution)**：
   - 彻底避免由于网络波动、API 滑点或极端行情导致的机器强平风险；
   - 每个推荐标的卡片均提供 **「📋 复制下单指令」**，一键复制 `标的 / 买卖方向 / 股数 / 限价`，方便上班族晚上在手机或电脑端自主确认挂单。
2. **执行顺序屏障 (Preflight Barrier)**：
   - 系统严密把控执行顺序：当且仅当 **OpenD (11111)**、**SearXNG (8088)**、**Ollama 本地模型 (11434)** 与 **交易解锁** 4 项全部就绪后，才正式启动 Step 1 推演流水线。
3. **Single-Flight 服务端单飞互斥锁与限流**：
   - 全局拦截并发重复请求，合并在途推演任务；
   - Ollama 推理采用 2-Worker 并发池与 60s 宽裕超时，彻底解决本地显存积压与排队超时问题。
4. **SearXNG 双通道自动唤起 (Docker + WSL Daemon)**：
   - 自动检测并唤醒 WSL Ubuntu 与 Windows Docker 守护进程，无需手动开终端敲命令行启动服务。
5. **100% 真实数据·零硬编码 (Zero Mock / Hardcoding)**：
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
│   │   ├── components/         # Studio 视图、步进器、标的卡片、全景舱弹窗
│   │   └── App.tsx             # 状态驱动、执行屏障与 Studio 路由
├── server/                     # Node.js + Express + Prisma 后端
│   ├── src/
│   │   ├── routes/             # RESTful API 路由 (/api/stock/...)
│   │   ├── services/           # 量化风控、目标驱动引擎、OpenD 网关、Ollama、SearXNG
│   │   └── types/              # 5 大策略分类、风控参数与流水线类型定义
│   └── prisma/                 # SQLite 数据库 Schema
├── graft/                      # Graft 自动生成的代码上下文图谱 (Git Ignored)
├── .gitignore                  # Git 排除规则
└── package.json                # 项目依赖与脚本
```

---

## 📄 License

[MIT License](LICENSE)
