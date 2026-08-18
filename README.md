# StockAgent Studio - Intelligent Stock Selection, Deduction & Retrospective Trading System (SPA)

**English** | [中文文档](README_CN.md)

> **Tailored for Working Professionals**: A daily-frequency, goal-oriented swing-trading and retrospective system. Powered by **100% Real-Time MooMoo OpenD Native TCP Data** + **Local Docker/WSL SearXNG Deep Search** + **Hardware-Aware Ollama Local LLMs**, deeply integrating **vn.py's classical quantitative risk control architecture**, **TradeMaster Market Dynamics Modeling & PRUDEX-Compass Benchmark**, and **FinAgent Dual-Level Memory Reflection**. **Strictly prohibits automated machine execution**, delivering precision quantitative rebalance directives with slippage buffer limits for safe manual placement.

---

## 📸 System UI Gallery & Visual User Guide

Designed specifically for working professionals to spend **5 minutes after market close** reviewing live positions, analyzing macro dynamics, receiving quantitative rebalance directives with rigorous safety invariants, and manually placing limit orders before the next opening bell.

---

### 1. 🎛️ Studio Cover & Live Dashboard (Cover & Studio Dashboard)

The top section unifies system hardware health, trading market sessions, core account KPI cards, and an end-to-end deduction pipeline progress stepper.

![StockAgent Studio Main Dashboard](./docs/images/01_studio_dashboard_cover.png)

#### 🌟 Key Capabilities & Interaction Highlights:
* **Hardware & Service Readiness HeaderBar**:
  - Live GPU VRAM and system memory utilization monitor (e.g., RTX 4090 24GB / 64GB host memory);
  - 4 Core Service Readiness Badges: `🟢 OpenD Connected` (11111), `🟢 SearXNG Ready` (8088), `🟢 Local LLM Ready` (11434 with hardware-aware model recommendations such as Qwen 3.8B/7B/14B), and `🟢 Trade Password Unlocked`;
  - **Preflight Readiness Barrier**: Prevents blind execution if any essential service dependency is offline, displaying clear diagnostic guidance.
* **Market Session Time-Space State Machine**:
  - Automatically identifies current US Eastern trading phase: `NIGHT_RECESS` (Silent maintenance), `PRE_MARKET` (Strategy battle prep), `INTRADAY` (Live risk audit), and `POST_MARKET` (Retrospective & next-day deduction);
  - Dynamically assigns active LLM roles (e.g., Night Quant Systems Caretaker, Pre-Market Strategist, Intraday Risk Inspector);
  - Built-in **Simulation Mode (时空穿梭模式)**, allowing users to test and replay pre-market or intraday scenarios during off-market hours.
* **4-Asset Quantitative KPI Cards**:
  - **Net Assets & Cash Ratio**: Synchronized live from MooMoo OpenD accounts;
  - **Floating P&L**: Live position cost vs current market price with smart color coding;
  - **Past Deduction Accuracy**: Point-to-point backtesting accuracy against next-day realized close prices;
  - **Rebalance Risk Budget**: Rebalancing capacity controlled via the interactive Sizer slider.

---

### 2. 🌐 SearXNG Macro Intelligence & TradeMaster Market Dynamics Central (Macro & MDM Dynamics)

Integrates authoritative financial news retrieval via SearXNG with NTU's **TradeMaster Market Dynamics Modeling (MDM)** state machine to inject adaptive macro risk caps into stock-level deductions.

![Macro Sector Studio and MDM Dynamics](./docs/images/02_macro_mdm_sector_studio.png)

#### 🌟 Key Indicators & Theoretical Foundations:
* **TradeMaster MDM Market Dynamics State Machine**:
  - **TSI (Trend Strength Index)**: Evaluates SPY daily momentum regression slope and moving average alignment (e.g., `+0.15` bullish expansion);
  - **VCI (Volatility Clustering Index)**: Measures UVXY/VIX variance clustering and extreme jump frequency (e.g., `0.00` calm);
  - **Adaptive Risk Caps**: Automatically identifies regime states (`TRENDING_BULL`, `COMPRESSED_CONSOLIDATION`, `HIGH_VOLATILITY_CHOP`, `TRENDING_BEAR`), dynamically adjusting **max portfolio exposure** (e.g., 55%~75%) and **single-stock limits** ($\le 35\%$).
* **Cross-Asset Anchors**:
  - Volatility Index (VIX), US 10-Year Treasury Yield (US10Y), and SPY/QQQ Beta momentum.
* **S&P 11 Sector ETFs Relative Strength (RS) & Capital Flow**:
  - Real-time OpenD tracking of XLE/SMH/XLK/XLI/XLV turnover, net inflows/outflows, and RS relative to SPY to pinpoint growth vs defensive rotations.
* **SearXNG Tier-1 Credible Source Distillation**:
  - Targeted querying of Bloomberg, Reuters, and WSJ to generate synthesized trading biases and risk warnings.

---

### 3. ⚡ 30-Second Quick Decision & Single-Stock Deduction Cards (Stock Deduction & Sizer)

Provides unified quantitative deduction cards for existing holdings, 24h cleared positions, watchlists, and macro candidates, replacing fluff with 30-second decisive hard facts.

![Stock Deduction & 30s Decision Facts](./docs/images/03_stock_deduction_and_sizer.png)

#### 🌟 Feature Breakdown & Card Architecture:
* **Position Sizing Controller (Sizer) & Multi-Factor Filters**:
  - **Deployable Budget Slider**: Flexible adjustment from \$500 to \$50,000;
  - **Risk Preference Modes**: `Conservative` (demands higher margin of safety), `Balanced` (standard swing-trading), `Aggressive` (breakout momentum);
  - **2-Tier Classification & Filter Console**:
    - Decision Filters: `All`, `🏆 High-Conviction Core`, `⚡ Rebalance Actions`, `🛡️ Existing Holdings`, `⏳ Watchlist`, `🟢 Experience Feedbacks`, `🔴 Lesson Warnings`;
    - 5-Strategy Factor Buckets: `Capital Inflow Buy`, `Oversold Buy`, `Fundamental Buy`, `News Catalyst Buy`, `Watch & Wait`.
* **⚡ 30-Second Quick Decision "3-Pillar Hard Facts"**:
  - **1. Fundamentals & Valuation Anchor**: OpenD dynamic PE/PS, revenue growth, and fair valuation bounds;
  - **2. Authoritative News & Catalysts**: Disambiguated catalyst facts from SearXNG;
  - **3. Capital Flow & ATR Soft Risk Line**: Institutional super-large order net flow and ATR dynamic trailing stop line.
* **🛡️ Trade Invariant Guardrails**:
  - Inspired by FINOS Legend class invariants, every recommendation strictly enforces cash limits, max 35% single-stock caps, and monotonic stops ($SL < P < TP$), displaying verified safety badges with clamp-on-overflow self-healing.
* **⚔️ Multi-Agent Bull vs Bear Debate (TradingAgents Alignment)**:
  - Forces the LLM to simultaneously debate a Bull Thesis against a strict **Devil's Advocate Downside Risk (`bearishRiskPoint`)** and **Decisive Verdict (`bullBearVerdict`)**.
* **🛡️ Microstructure Liquidity Fragility & Slippage Protection Buffer**:
  - Computes Liquidity Fragility Index (LFI) from Bid/Ask spreads and turnover;
  - Generates **EntryZone limit order slippage buffer bounds** (e.g., limit order placement between \$97.46 and \$98.50 to prevent opening bell gap-and-trap losses).
* **Google TimeFM Foundation Model Next-Day Predictions**:
  - Evaluates 120-day K-line time series to output high-confidence directional labels, expected changes, and 10%~90% confidence bands.
* **🚨 Data Sufficiency Gatekeeper Circuit Breakers**:
  - Proactively halts deduction when vital market data is missing, listing exact missing items and remedies to prevent hallucinated advice.

---

### 4. 🧭 TradeMaster PRUDEX-Compass 6-Axis Quality Benchmark Radar

Clicking the **`🧭 PRUDEX 6维体检 & FinAgent 原则库 (Retro & Quality Radar)`** tab opens the PRUDEX-Compass evaluation suite inspired by NTU research.

![PRUDEX-Compass 6-Axis Evaluation Radar](./docs/images/04_prudex_compass_radar.png)

#### 🌟 6-Axis Radar & 17 Sub-Metrics:
* **[P] Profitability (80/100 vs Benchmark 68)**: Realized win rate (76.5%), Profit/Loss ratio (2.8x), Cumulative net realized P&L;
* **[R] Risk-Control (88/100 vs Benchmark 72)**: ATR stop-loss compliance rate (92.0%), Avoided potential losses, Max drawdown mitigation;
* **[U] Universality (74/100 vs Benchmark 60)**: Cross-sector coverage (8 major sectors), Bull/Bear regime adaptability;
* **[D] Diversity (78/100 vs Benchmark 65)**: Portfolio HHI concentration (0.19 balanced), Single-stock allocation cap compliance (100%);
* **[E] Reliability (85/100 vs Benchmark 70)**: Expected Calibration Error (ECE 6.2%), Overconfidence & hallucination interception;
* **[X] Explainability (92/100 vs Benchmark 80)**: 5-pillar fact chain completeness (4.8/5.0), Decision review latency ($<30$ seconds).
* **🧭 Automated Health Diagnostics**: System synthesizes all 6 axes to provide concrete strategic optimization advice.

---

### 5. 🏛️ FinAgent Dual-Level Memory Repository & Retrospective Timeline

Implements FinAgent's dual-level reflection memory model, separating **L1 Single-Stock Tactical Reflections** from **L2 Global Strategic Rigid Disciplines** for continuous positive feedback loops.

![FinAgent Dual-Level Memory & Retrospective Timeline](./docs/images/05_finagent_dual_principles.png)

#### 🌟 Dual Memory Mechanics & Daily Verification:
* **🏛️ L2 Global Strategic Rules (Solidified System Invariant Disciplines)**:
  - Distilled from recurrent retrospective lessons (e.g., "Force max portfolio cap below 45% during high-volatility chop", "Strictly restrict post-market orders to EntryZone limit order boundaries");
  - Tracks confidence weights (e.g., 95%) and sample verification counts.
* **🎯 L1 Single-Stock Tactical Reflections (Targeted Context Injection)**:
  - Symbol-specific behavioral lessons (e.g., "NVDA earnings 7-day blackout lock-in", "TSLA 52-week resistance breakout retest requirement");
  - Injected directly into LLM prompts whenever the target stock is evaluated.
* **Historical Retrospective Timeline**:
  - Automatically matches previous recommendations against actual close prices daily, performing tri-state attribution (`🟢 Experience` / `🔴 Lesson` / `⚪ Noise`) with cumulative avoided loss tracking.

---

## 🌟 Core Architecture & Pipeline Flowchart

```mermaid
flowchart TD
    subgraph Preflight ["Preflight Readiness Barrier"]
        P1["🔌 MooMoo OpenD: 11111"]
        P2["🔍 SearXNG Search: 8088"]
        P3["🤖 Local LLM: 11434"]
        P4["🔐 Trade Password Unlocked"]
        P1 & P2 & P3 & P4 -->|All 4 Ready| Barrier["🚀 Initiate Step 1 Pipeline"]
    end

    subgraph S1 ["Step 1: OpenD Native Positions & Assets"]
        Barrier --> A["OpenD Native TCP Gateway 11111"]
        A -->|100% Real Data · Zero Mock| B["Live Positions + Cash Balance + Watchlist"]
    end

    subgraph S2 ["Step 2: SearXNG Macro Intelligence & MDM Dynamics"]
        B --> C["SearXNG Dual-channel Auto Wake-up 8088"]
        C -->|Targeted Harvesting| D["Bloomberg / CNBC / Reuters / WSJ Headlines"]
        D -->|MDM State Machine| E["TSI Trend Strength + VCI Volatility Clustering + 11 Sector Breadth"]
    end

    subgraph S3 ["Step 3: Multi-Factor 5-Strategy Sieve"]
        E --> F["US Universe 349 Sector Plates"]
        F --> G["Priority: 1. Holdings > 2. Watchlist > 3. US Universe"]
        G --> H["OpenD 52-W High/Low, PE, EPS, Net Profit, Turnover & Capital Inflows"]
        H --> I{"Multi-Factor 5-Strategy Classification"}
        I -->|📉 Oversold Buy| J1["Drawdown >= 15% from 52-W High & Fair Valuation"]
        I -->|💎 Fundamental Buy| J2["OpenD PE <= 38 & Solid Profitability"]
        I -->|🚀 News Catalyst Buy| J3["Pre-market Gap or Bullish Catalyst Resonance"]
        I -->|🏦 Capital Inflow Buy| J4["OpenD Institutional Large-order Net Inflow"]
        I -->|👀 Watch & Wait| J5["Holding / Watchlist Box-range Bottoms"]
        I -->|Non-qualifying| J6["❌ Auto Skip"]
        J1 & J2 & J3 & J4 & J5 --> K["Screened Candidate Pool"]
        K -.->|Async Non-blocking| L["Create/Update Exclusive Knowledge Graphs"]
    end

    subgraph S4 ["Step 4: Ollama LLM Map-Reduce + EIIE Portfolio Optimization"]
        E & K --> M["Inject Goal Parameters (G% Profit, T Days Horizon, D% Max Drawdown)"]
        M --> N["Ollama Map-Reduce Batched Inference Pool"]
        N --> Q["EIIE MPT Risk-Adjusted Optimal Weights + Single-Stock Cap <= 35%"]
        N --> Q2["Microstructure Market Maker Spread Model + EntryZone Slippage Buffer"]
    end

    subgraph S5 ["Step 5: PRUDEX-Compass 6-Axis Radar & FinAgent Double Reflection"]
        Q & Q2 --> O["Precision Quantitative Rebalance Directives with Exact Share Counts"]
        O --> R["1-Click Order Clipboard Copy for Manual Execution"]
        O --> S["PRUDEX 6-Axis Evaluation (P/R/U/D/E/X) + FinAgent L1/L2 Memory Consolidation"]
    end
```

---

## 💡 Classical Financial Engineering & Academic Innovations

| Core Pillar | Classical & Academic Origin | StockAgent Implementation & File Location |
| :--- | :--- | :--- |
| **Market Dynamics State Machine (MDM)** | **TradeMaster Market Dynamics Modeling** | [`marketDynamicsService.ts`](file:///c:/Users/lilin/StockAgent/server/src/services/marketDynamicsService.ts): Calculates SPY TSI Trend Strength, UVXY VCI Volatility Clustering, and 11 sector breadth, adaptively setting max portfolio caps and ATR stop multipliers. |
| **Portfolio Convex Optimization (EIIE)** | **TradeMaster EIIE / Modern Portfolio Theory** | [`portfolioOptimizerService.ts`](file:///c:/Users/lilin/StockAgent/server/src/services/portfolioOptimizerService.ts): Solves risk-adjusted weights, enforces single stock $\le 35\%$, sector $\le 50\%$, and computes integer shares. |
| **PRUDEX-Compass 6-Axis Benchmark** | **TradeMaster PRUDEX-Compass Evaluation** | [`prudexCompassService.ts`](file:///c:/Users/lilin/StockAgent/server/src/services/prudexCompassService.ts): Assesses **P** (Profitability), **R** (Risk-Control), **U** (Universality), **D** (Diversity), **E** (Reliability), **X** (Explainability) across 17 sub-metrics. |
| **Dual-Level Memory Reflection** | **FinAgent Dual-Level Reflection** | [`memoryConsolidationService.ts`](file:///c:/Users/lilin/StockAgent/server/src/services/memoryConsolidationService.ts): Distinguishes **L1 Single-Stock Tactical Reflections** from **L2 Global Strategic Rigid Disciplines**. |
| **Microstructure Slippage Protection** | **TradeMaster Market Microstructure Model** | [`multiAgentMarketSimulator.ts`](file:///c:/Users/lilin/StockAgent/server/src/services/multiAgentMarketSimulator.ts): Calculates Liquidity Fragility Index (LFI) and pre-computes EntryZone limit order slippage buffer bounds. |
| **Trade Invariant Guardrails** | **FINOS Legend Class Invariants** | [`tradeInvariantValidator.ts`](file:///c:/Users/lilin/StockAgent/server/src/services/tradeInvariantValidator.ts): Anti-blowup & LLM hallucination guardrail. Strictly enforces cash bounds, single-stock caps, monotonic stops ($SL < P < TP$), and clamp-on-overflow self-healing. |
| **Data Sufficiency Gatekeeper** | **FINOS Legend Gatekeeper Mechanism** | [`dataSufficiencyGatekeeper.ts`](file:///c:/Users/lilin/StockAgent/server/src/services/dataSufficiencyGatekeeper.ts): Actively aborts deduction when critical market data is missing, providing clear troubleshooting steps. |

---

## 👔 Features Built for Working Professionals

1. **Zero Automated Machine Execution**:
   - Eliminates API slippage, connection dropouts, and catastrophic margin liquidations;
   - Every stock card includes a **"📋 Copy Order Directive"** button, instantly copying `Symbol / Direction / Shares / Limit Price` for quick manual placement in mobile/desktop apps.
2. **⚡ 30-Second Quick Decision Facts (3-Pillar Hard Facts)**:
   - Displays clear Fundamental, Catalyst, and Flow/ATR anchors on every card for quick 30-second reviews after work.
3. **🛡️ Rigid Trade Invariant Guardrails**:
   - Automatically validates and self-heals any LLM hallucination or capital overflow, stamping a verified safety badge on all recommendations.
4. **Preflight Readiness Barrier**:
   - Enforces strict execution order: Step 1 will only trigger when **OpenD (11111)**, **SearXNG (8088)**, **Ollama Local LLM (11434)**, and **Trade Password Unlock** are all verified green.
5. **Single-Flight Mutex & Throttled Queue**:
   - Server-side single flight prevents duplicate concurrent deduction runs;
   - Ollama inference uses a 2-worker concurrency pool with 60s timeouts, eliminating VRAM saturation and queue timeouts.
6. **Dual-Channel SearXNG Auto Wake-Up (Docker + WSL Daemon)**:
   - Automatically detects and wakes up WSL Ubuntu and Windows Docker engines when offline.
7. **⚔️ Multi-Agent Bull vs Bear Debate & Devil's Advocate (TradingAgents Alignment)**:
   - Evaluates trades through opposing viewpoints (Bull Thesis vs strict Devil's Advocate) in a single-turn structured prompt, exposing downside risks (`bearishRiskPoint`) and decisive verdicts (`bullBearVerdict`).
8. **📅 US Equity Special Intel & Earnings Blackout Radar**:
   - Computes earnings countdowns with automatic $\le 7$-day high-risk blackout flags, and calculates market maker option Gamma squeeze vs Put hedging bias (PCR).
9. **100% Real Data · Zero Hardcoding**:
   - All static mock data, hardcoded stock arrays, and dummy fallback figures (`1000.0`) have been 100% eliminated.

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js**: `v18+`
- **Docker** or **WSL2** (For SearXNG local search container)
- **Ollama**: Running locally at `http://127.0.0.1:11434` (Qwen 3.8 / Qwen 3.6 / Gemma 4 recommended)
- **MooMoo OpenD**: Running locally at `127.0.0.1:11111`
- **Python**: `3.9+` with `moomoo-api` installed (`pip install moomoo-api`)

### 2. Installation & Running

```bash
# 1. Install root, frontend, and backend dependencies
npm install

# 2. Initialize SQLite database schema
npm run db:push

# 3. Start development servers (runs backend on 3001 and frontend on 3000 concurrently)
npm run dev
```

Open your browser and navigate to: **`http://localhost:3000`**

---

## 🛠️ Project Structure

```
StockAgent/
├── client/                     # React + Vite + TailwindCSS SPA frontend
│   ├── src/
│   │   ├── components/         # Studio views, Stepper, Per-Stock Cards, Deduction Modals, PRUDEX Radar
│   │   └── App.tsx             # State manager, Preflight barrier, and Studio routes
├── server/                     # Node.js + Express + Prisma backend
│   ├── src/
│   │   ├── routes/             # RESTful API endpoints (/api/stock/...)
│   │   ├── services/           # MDM Dynamics, EIIE Optimizer, PRUDEX, Dual Memory, Quant Risk Manager
│   │   └── types/              # 5-strategy types, MDM, PRUDEX, quant parameters, pipeline stages
│   └── prisma/                 # SQLite database schema
├── docs/                       # Documentation and HD screenshots
│   └── images/                 # Cover dashboard, macro central, stock cards, PRUDEX radar, principles
├── package.json                # Project dependencies and scripts
└── README_CN.md                # Chinese documentation
```

---

## 📄 License

[MIT License](LICENSE)
