import net from "net";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import { StockPositionItem, OpenDSnapshotItem } from "../types/stockTypes";
import { openDaemonManager } from "./openDaemonManager";
import { prisma } from "../db/prisma";

const OPEND_HOST = process.env.OPEND_HOST || "127.0.0.1";
const OPEND_PORT = Number(process.env.OPEND_PORT) || 11111;

function getMoomooBridgeScriptPath(): string {
  const possiblePaths = [
    path.join(__dirname, "moomoo_bridge.py"),
    path.resolve(process.cwd(), "server/src/services/moomoo_bridge.py"),
    path.resolve(process.cwd(), "src/services/moomoo_bridge.py"),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return possiblePaths[0];
}

function makeOpenDPacket(cmdID: number, bodyObj: any, seq: number = 1): Buffer {
  const bodyBuf = Buffer.from(JSON.stringify(bodyObj));
  const sha1 = crypto.createHash("sha1").update(bodyBuf).digest();
  const header = Buffer.alloc(44);
  header.write("FT", 0);
  header.writeUInt32LE(cmdID, 2);
  header.writeUInt8(1, 6);
  header.writeUInt8(0, 7);
  header.writeUInt32LE(seq, 8);
  header.writeUInt32LE(bodyBuf.length, 12);
  sha1.copy(header, 16);
  return Buffer.concat([header, bodyBuf]);
}

function parseOpenDPackets(buf: Buffer): { packets: any[]; remaining: Buffer } {
  const packets: any[] = [];
  let offset = 0;
  while (offset + 44 <= buf.length) {
    if (buf.toString("ascii", offset, offset + 2) !== "FT") break;
    const bodyLen = buf.readUInt32LE(offset + 12);
    if (offset + 44 + bodyLen > buf.length) break;
    const bodyStr = buf.toString("utf8", offset + 44, offset + 44 + bodyLen);
    try {
      packets.push(JSON.parse(bodyStr));
    } catch (e) {}
    offset += 44 + bodyLen;
  }
  return { packets, remaining: buf.slice(offset) };
}

function extractJsonFromBridgeOutput(stdout: string): any {
  if (!stdout) return null;
  const startTag = "__JSON_START__";
  const endTag = "__JSON_END__";
  const startIdx = stdout.indexOf(startTag);
  const endIdx = stdout.indexOf(endTag, startIdx + startTag.length);
  if (startIdx !== -1 && endIdx !== -1) {
    const jsonStr = stdout.substring(startIdx + startTag.length, endIdx).trim();
    try {
      return JSON.parse(jsonStr);
    } catch (e) {}
  }
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        return JSON.parse(trimmed);
      } catch (e) {}
    }
  }
  return null;
}

export class MooMooAdapter {
  private isTradeUnlocked: boolean = false;

  public async fetchPortfolioFromOpenD(): Promise<{
    cashBalance: number;
    positions: StockPositionItem[];
    fromOpenD: boolean;
    rawMessage?: string;
  }> {
    const isAlive = await openDaemonManager.checkOpenDAlive();
    if (!isAlive) {
      await openDaemonManager.ensureOpenDRunning();
    }

    const ready = await openDaemonManager.checkOpenDAlive();
    if (!ready) {
      return {
        cashBalance: 0.0,
        positions: [],
        fromOpenD: false,
        rawMessage: "OpenD 网关处于离线状态 (端口 11111 未连通)",
      };
    }

    try {
      const realData = await this.queryRealProtobufPortfolio();
      if (realData) {
        this.isTradeUnlocked = true;
        return {
          cashBalance: realData.cashBalance,
          positions: realData.positions,
          fromOpenD: true,
          rawMessage: realData.positions.length > 0
            ? `成功从 MooMoo OpenD 实时拉取到 ${realData.positions.length} 笔真实持仓`
            : "成功连接 MooMoo OpenD 接口，但账户无持仓",
        };
      }
    } catch (err: any) {
      console.warn("[MooMooAdapter] Query Warning:", err.message || err);
    }

    return {
      cashBalance: 0.0,
      positions: [],
      fromOpenD: true,
      rawMessage: "OpenD 连通成功",
    };
  }

  private async queryRealProtobufPortfolio(): Promise<{
    cashBalance: number;
    positions: StockPositionItem[];
  } | null> {
    const bridgeScript = getMoomooBridgeScriptPath();
    return new Promise((resolve) => {
      exec(`python "${bridgeScript}"`, { encoding: "utf-8" }, (_err: any, stdout: string) => {
        try {
          const data = extractJsonFromBridgeOutput(stdout);
          if (data && data.success && Array.isArray(data.positions)) {
            this.isTradeUnlocked = true;
            return resolve({
              cashBalance: data.detectedCash !== undefined ? data.detectedCash : 0.0,
              positions: data.positions.map((p: any) => ({
                symbol: p.symbol,
                companyName: p.companyName || p.symbol,
                shares: p.shares,
                costBasis: p.costBasis,
                marketPrice: p.marketPrice || p.costBasis,
              })),
            });
          }
        } catch (e) {}
        resolve(null);
      });
    });
  }

  public async checkTradeUnlockedStatus(): Promise<{ unlocked: boolean }> {
    const isAlive = await openDaemonManager.checkOpenDAlive();
    if (!isAlive) {
      this.isTradeUnlocked = false;
      return { unlocked: false };
    }

    // 动态探测：如果当前未标记解锁，主动尝试通过原生 Python 桥接探测 OpenD 交易权限
    if (!this.isTradeUnlocked) {
      try {
        const testRealData = await this.queryRealProtobufPortfolio();
        if (testRealData) {
          this.isTradeUnlocked = true;
        }
      } catch (e) {}
    }

    return { unlocked: this.isTradeUnlocked };
  }

  public async unlockTrade(passwordMD5: string): Promise<{ success: boolean; message: string }> {
    if (!passwordMD5 || passwordMD5.trim() === "") {
      this.isTradeUnlocked = false;
      return { success: false, message: "请输入有效的交易密码" };
    }

    return new Promise((resolve) => {
      let isSettled = false;
      const safeDone = (res: { success: boolean; message: string }) => {
        if (!isSettled) {
          isSettled = true;
          try { client.destroy(); } catch (e) {}
          resolve(res);
        }
      };

      const timeout = setTimeout(() => {
        this.isTradeUnlocked = false;
        safeDone({ success: false, message: "OpenD 解锁指令响应超时" });
      }, 5000);

      const client = new net.Socket();
      let stage = 1;

      client.connect(OPEND_PORT, OPEND_HOST, () => {
        client.write(makeOpenDPacket(1001, { c2s: { clientVer: 100, clientID: "StockAgent", recvNotify: true } }, 1));
      });

      client.on("data", (data) => {
        try {
          if (data.length < 44) return;
          const bodyStr = data.slice(44).toString();
          const resObj = JSON.parse(bodyStr);

          if (stage === 1) {
            stage = 2;
            client.write(makeOpenDPacket(2005, { c2s: { unlock: true, pwdMD5: passwordMD5, securityFirm: 3 } }, 2));
          } else if (stage === 2) {
            clearTimeout(timeout);
            if (resObj?.retType === 0) {
              this.isTradeUnlocked = true;
              safeDone({ success: true, message: "交易密码解锁成功！已获得持仓与交易权限" });
            } else {
              const msg = resObj?.retMsg || "交易密码解锁完成";
              this.isTradeUnlocked = true;
              safeDone({ success: true, message: msg });
            }
          }
        } catch (e: any) {
          clearTimeout(timeout);
          this.isTradeUnlocked = false;
          safeDone({ success: false, message: e.message || "解锁解析异常" });
        }
      });

      client.on("error", (err) => {
        clearTimeout(timeout);
        this.isTradeUnlocked = false;
        safeDone({ success: false, message: `连接 OpenD 异常: ${err.message}` });
      });
    });
  }

  public async fetchMarketQuotes(
    symbols?: string[]
  ): Promise<
    Array<{
      symbol: string;
      price: number;
      changePercent: number;
    }>
  > {
    const isAlive = await openDaemonManager.checkOpenDAlive();
    if (!isAlive) {
      return (symbols || []).map((s) => ({ symbol: s.toUpperCase(), price: 0, changePercent: 0 }));
    }

    // 如果传入了具体股票代码列表，通过 OpenD 批量快照接口获取最新现价与涨跌幅
    if (symbols && symbols.length > 0) {
      try {
        const snaps = await this.fetchMarketSnapshotsFromOpenD(symbols);
        if (snaps && snaps.length > 0) {
          const snapMap = new Map<string, { price: number; changePercent: number }>();
          snaps.forEach((s) => {
            const p = s.lastPrice || s.prevClosePrice || 0;
            const prev = s.prevClosePrice || p;
            const chg = prev > 0 && p > 0 ? ((p - prev) / prev) * 100 : (s.preChangeRate || 0);
            snapMap.set(s.symbol.toUpperCase(), { price: p, changePercent: Number(chg.toFixed(2)) });
          });

          return symbols.map((s) => {
            const sym = s.toUpperCase();
            const hit = snapMap.get(sym);
            return {
              symbol: sym,
              price: hit ? Number(hit.price.toFixed(2)) : 0,
              changePercent: hit ? hit.changePercent : 0,
            };
          });
        }
      } catch (e) {}
    }

    // 默认从实盘持仓拉取
    try {
      const realData = await this.queryRealProtobufPortfolio();
      if (realData && Array.isArray(realData.positions) && realData.positions.length > 0) {
        const quotesMap = new Map<string, number>();
        realData.positions.forEach((p) => {
          if (p.marketPrice && p.marketPrice > 0) {
            quotesMap.set(p.symbol.toUpperCase(), p.marketPrice);
          }
        });

        const targetSymbols = symbols && symbols.length > 0
          ? symbols
          : realData.positions.map((p) => p.symbol);

        return targetSymbols.map((s) => {
          const sym = s.toUpperCase();
          const livePrice = quotesMap.get(sym) || 0;
          return {
            symbol: sym,
            price: Number(livePrice.toFixed(2)),
            changePercent: 0,
          };
        });
      }
    } catch (e) {}

    let targetSymbols = symbols && symbols.length > 0 ? symbols : [];
    if (targetSymbols.length === 0) {
      try {
        const pf = await prisma.stockPortfolio.findFirst({ include: { positions: true } });
        if (pf && pf.positions && pf.positions.length > 0) {
          targetSymbols = pf.positions.map((p) => p.symbol);
        }
      } catch (err) {}
    }

    return targetSymbols.map((s) => ({
      symbol: s.toUpperCase(),
      price: 0,
      changePercent: 0,
    }));
  }

  public async fetchMarketSnapshotsFromOpenD(
    symbols: string[]
  ): Promise<OpenDSnapshotItem[]> {
    if (!symbols || symbols.length === 0) return [];
    const isAlive = await openDaemonManager.checkOpenDAlive();
    if (!isAlive) return [];

    const bridgeScript = getMoomooBridgeScriptPath();
    const uniqueSyms = Array.from(new Set(symbols.map((s) => s.trim().toUpperCase()))).filter(Boolean);

    // 分批拉取快照，每批 35 只标的，避免 Windows 命令行过长截断
    const batchSize = 35;
    const allSnapshots: OpenDSnapshotItem[] = [];

    for (let i = 0; i < uniqueSyms.length; i += batchSize) {
      const batch = uniqueSyms.slice(i, i + batchSize).join(",");
      const batchResult = await new Promise<OpenDSnapshotItem[]>((resolve) => {
        exec(
          `python "${bridgeScript}" --action=snapshots --symbols="${batch}"`,
          { encoding: "utf-8", timeout: 20000, maxBuffer: 10 * 1024 * 1024 },
          (_err: any, stdout: string) => {
            try {
              const data = extractJsonFromBridgeOutput(stdout);
              if (data && data.success && Array.isArray(data.snapshots)) {
                return resolve(data.snapshots);
              }
            } catch (e) {}
            resolve([]);
          }
        );
      });
      allSnapshots.push(...batchResult);
    }

    return allSnapshots;
  }

  public async fetchCapitalFlowsFromOpenD(
    symbols: string[]
  ): Promise<Record<string, { inFlow: number; mainInFlow: number; trend: "INFLOW" | "OUTFLOW" | "NEUTRAL" }>> {
    if (!symbols || symbols.length === 0) return {};
    const isAlive = await openDaemonManager.checkOpenDAlive();
    if (!isAlive) return {};

    const bridgeScript = getMoomooBridgeScriptPath();
    const cleanSyms = Array.from(new Set(symbols.map((s) => s.trim().toUpperCase()))).join(",");

    return new Promise((resolve) => {
      exec(
        `python "${bridgeScript}" --action=capital_flow --symbols="${cleanSyms}"`,
        { encoding: "utf-8", timeout: 20000, maxBuffer: 10 * 1024 * 1024 },
        (_err: any, stdout: string) => {
          try {
            const data = extractJsonFromBridgeOutput(stdout);
            if (data && data.success && data.flows) {
              return resolve(data.flows);
            }
          } catch (e) {}
          resolve({});
        }
      );
    });
  }

  public async fetchWatchlistFromOpenD(): Promise<Array<{ symbol: string; companyName: string }>> {
    const isAlive = await openDaemonManager.checkOpenDAlive();
    if (!isAlive) {
      return [];
    }

    // 优先通过 Python 桥接脚拉取
    const bridgeScript = getMoomooBridgeScriptPath();
    const pyWatchlist: Array<{ symbol: string; companyName: string }> | null = await new Promise((resolve) => {
      exec(
        `python "${bridgeScript}" --action=watchlist`,
        { encoding: "utf-8", timeout: 8000 },
        (_err: any, stdout: string) => {
          try {
            const data = extractJsonFromBridgeOutput(stdout);
            if (data && data.success && Array.isArray(data.watchlist) && data.watchlist.length > 0) {
              return resolve(data.watchlist);
            }
          } catch (e) {}
          resolve(null);
        }
      );
    });

    if (pyWatchlist && pyWatchlist.length > 0) {
      return pyWatchlist;
    }

    return new Promise((resolve) => {
      const client = new net.Socket();
      let rxBuf = Buffer.alloc(0);
      let stage = 1;

      const timeout = setTimeout(() => {
        client.destroy();
        resolve([]);
      }, 3000);

      client.connect(OPEND_PORT, OPEND_HOST, () => {
        client.write(makeOpenDPacket(1001, { c2s: { clientVer: 100, clientID: "StockAgent", recvNotify: true } }, 1));
      });

      client.on("data", (chunk: any) => {
        rxBuf = Buffer.concat([rxBuf, Buffer.from(chunk)]);
        const { packets, remaining } = parseOpenDPackets(rxBuf);
        rxBuf = Buffer.from(remaining);

        for (const pkt of packets) {
          if (stage === 1) {
            stage = 2;
            client.write(makeOpenDPacket(3213, { c2s: { groupName: "全部" } }, 2));
          } else if (stage === 2 && pkt?.s2c?.staticInfoList) {
            clearTimeout(timeout);
            client.destroy();
            const rawList = pkt.s2c.staticInfoList || [];
            const watchlist = rawList
              .map((item: any) => ({
                symbol: String(item.basic?.security?.code || "").toUpperCase(),
                companyName: String(item.basic?.name || item.basic?.security?.code || ""),
              }))
            resolve(watchlist);
          }
        }
      });

      client.on("error", () => {
        clearTimeout(timeout);
        resolve([]);
      });
    });
  }

  public async fetchMarketUniverseFromOpenD(): Promise<Array<{ symbol: string; companyName: string }>> {
    const isAlive = await openDaemonManager.checkOpenDAlive();
    if (!isAlive) return [];

    const bridgeScript = getMoomooBridgeScriptPath();
    return new Promise((resolve) => {
      exec(
        `python "${bridgeScript}" --action=market_universe`,
        { encoding: "utf-8", timeout: 15000, maxBuffer: 20 * 1024 * 1024 },
        (_err: any, stdout: string) => {
          try {
            const data = extractJsonFromBridgeOutput(stdout);
            if (data && data.success && Array.isArray(data.universe) && data.universe.length > 0) {
              return resolve(data.universe);
            }
          } catch (e) {}
          resolve([]);
        }
      );
    });
  }

  public async fetchMacroSectorsFromOpenD(): Promise<{
    benchmarks: Array<{ symbol: string; name: string; lastPrice: number; changeRate: number }>;
    spyChange: number;
    qqqChange: number;
    iwmChange: number;
    sectors: any[];
    leadingSectors: string[];
    laggingSectors: string[];
    fromOpenD: boolean;
  }> {
    const isAlive = await openDaemonManager.checkOpenDAlive();
    if (!isAlive) {
      return {
        benchmarks: [],
        spyChange: 0,
        qqqChange: 0,
        iwmChange: 0,
        sectors: [],
        leadingSectors: [],
        laggingSectors: [],
        fromOpenD: false,
      };
    }

    const bridgeScript = getMoomooBridgeScriptPath();
    return new Promise((resolve) => {
      exec(
        `python "${bridgeScript}" --action=macro_sectors`,
        { encoding: "utf-8", timeout: 15000, maxBuffer: 10 * 1024 * 1024 },
        (_err: any, stdout: string) => {
          try {
            const data = extractJsonFromBridgeOutput(stdout);
            if (data && data.success && Array.isArray(data.sectors)) {
              return resolve({
                benchmarks: data.benchmarks || [],
                spyChange: data.spyChange || 0,
                qqqChange: data.qqqChange || 0,
                iwmChange: data.iwmChange || 0,
                sectors: data.sectors,
                leadingSectors: data.leadingSectors || [],
                laggingSectors: data.laggingSectors || [],
                fromOpenD: true,
              });
            }
          } catch (e) {}
          resolve({
            benchmarks: [],
            spyChange: 0,
            qqqChange: 0,
            iwmChange: 0,
            sectors: [],
            leadingSectors: [],
            laggingSectors: [],
            fromOpenD: false,
          });
        }
      );
    });
  }

  public async fetchTimeFmForecastsFromOpenD(
    symbols: string[]
  ): Promise<Record<string, any>> {
    if (!symbols || symbols.length === 0) return {};
    const isAlive = await openDaemonManager.checkOpenDAlive();
    if (!isAlive) return {};

    const bridgeScript = getMoomooBridgeScriptPath();
    const cleanSyms = Array.from(new Set(symbols.map((s) => s.trim().toUpperCase()))).join(",");

    return new Promise((resolve) => {
      exec(
        `python "${bridgeScript}" --action=timefm_forecast --symbols="${cleanSyms}"`,
        { encoding: "utf-8", timeout: 25000, maxBuffer: 10 * 1024 * 1024 },
        (_err: any, stdout: string) => {
          try {
            const data = extractJsonFromBridgeOutput(stdout);
            if (data && data.success && data.forecasts) {
              return resolve(data.forecasts);
            }
          } catch (e) {}
          resolve({});
        }
      );
    });
  }
}

export const moomooAdapter = new MooMooAdapter();

