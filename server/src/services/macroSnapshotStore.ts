import { prisma } from "../db/prisma";
import { DailyMacroSnapshotDTO, SectorSnapshotItem, CredibleNewsItem, CrossAssetAnchors } from "../types/stockTypes";

export class MacroSnapshotStoreService {
  /**
   * 保存或更新当天的宏观与板块量化快照 (每日仅 1 条记录，高密度存储)
   */
  public async saveDailySnapshot(dto: DailyMacroSnapshotDTO): Promise<DailyMacroSnapshotDTO> {
    const dateStr = dto.snapshotDate || new Date().toISOString().split("T")[0];

    const crossAssetPayload = {
      ...dto.crossAsset,
      benchmarks: dto.benchmarks,
      marketDynamics: dto.marketDynamics,
    };

    const record = await prisma.dailyMacroSnapshot.upsert({
      where: { snapshotDate: dateStr },
      create: {
        snapshotDate: dateStr,
        regimeMood: dto.regimeMood,
        regimeScore: dto.regimeScore,
        stanceBias: dto.stanceBias,
        positionCapPct: dto.positionCapPct,
        stopLossPct: dto.stopLossPct,
        crossAssetJson: JSON.stringify(crossAssetPayload),
        sectorMatrixJson: JSON.stringify(dto.sectors),
        topNewsJson: JSON.stringify(dto.topNews),
        promptContext: dto.promptContext,
      },
      update: {
        regimeMood: dto.regimeMood,
        regimeScore: dto.regimeScore,
        stanceBias: dto.stanceBias,
        positionCapPct: dto.positionCapPct,
        stopLossPct: dto.stopLossPct,
        crossAssetJson: JSON.stringify(crossAssetPayload),
        sectorMatrixJson: JSON.stringify(dto.sectors),
        topNewsJson: JSON.stringify(dto.topNews),
        promptContext: dto.promptContext,
      },
    });

    return this.mapToDTO(record);
  }

  /**
   * 获取最新一条宏观快照 (供页面加载时 0 延迟秒级回显)
   */
  public async getLatestSnapshot(): Promise<DailyMacroSnapshotDTO | null> {
    const record = await prisma.dailyMacroSnapshot.findFirst({
      orderBy: { snapshotDate: "desc" },
    });
    if (!record) return null;
    return this.mapToDTO(record);
  }

  /**
   * 获取过去 N 天的宏观 Regime 演进与板块轮动矩阵 (供时间轴与复盘分析)
   */
  public async getHistoricalSnapshots(limitDays: number = 30): Promise<DailyMacroSnapshotDTO[]> {
    const records = await prisma.dailyMacroSnapshot.findMany({
      orderBy: { snapshotDate: "asc" },
      take: limitDays,
    });
    return records.map((r) => this.mapToDTO(r));
  }

  private mapToDTO(record: any): DailyMacroSnapshotDTO {
    let crossAsset: CrossAssetAnchors = {
      vix: 0,
      vixChange: 0,
      us10y: 0,
      dxy: 0,
      spyChange: 0,
      qqqChange: 0,
      iwmChange: 0,
    };
    let sectors: SectorSnapshotItem[] = [];
    let topNews: CredibleNewsItem[] = [];
    let benchmarksFromPayload: any[] | undefined = undefined;
    let marketDynamics: any = undefined;

    try {
      const parsedCross = JSON.parse(record.crossAssetJson || "{}");
      crossAsset = {
        vix: Number(parsedCross.vix ?? 0),
        vixChange: Number(parsedCross.vixChange ?? 0),
        us10y: Number(parsedCross.us10y ?? 0),
        dxy: Number(parsedCross.dxy ?? 0),
        spyChange: Number(parsedCross.spyChange ?? 0),
        qqqChange: Number(parsedCross.qqqChange ?? 0),
        iwmChange: Number(parsedCross.iwmChange ?? 0),
      };
      if (Array.isArray(parsedCross.benchmarks) && parsedCross.benchmarks.length > 0) {
        benchmarksFromPayload = parsedCross.benchmarks;
      }
      if (parsedCross.marketDynamics) {
        marketDynamics = parsedCross.marketDynamics;
      }
    } catch {}
    try {
      sectors = JSON.parse(record.sectorMatrixJson || "[]");
    } catch {}
    try {
      topNews = JSON.parse(record.topNewsJson || "[]");
    } catch {}

    const benchmarks = benchmarksFromPayload || [
      { symbol: "SPY", name: "标普500大盘", lastPrice: 0, changeRate: crossAsset.spyChange || 0 },
      { symbol: "QQQ", name: "纳指100科技", lastPrice: 0, changeRate: crossAsset.qqqChange || 0 },
      { symbol: "IWM", name: "罗素2000小盘", lastPrice: 0, changeRate: crossAsset.iwmChange || 0 },
    ];

    return {
      id: record.id,
      snapshotDate: record.snapshotDate,
      createdAt: record.createdAt?.toISOString(),
      regimeMood: record.regimeMood as any,
      regimeScore: record.regimeScore,
      stanceBias: record.stanceBias,
      positionCapPct: record.positionCapPct,
      stopLossPct: record.stopLossPct,
      crossAsset,
      sectors,
      benchmarks,
      topNews,
      promptContext: record.promptContext,
      marketDynamics,
    };
  }
}

export const macroSnapshotStoreService = new MacroSnapshotStoreService();
