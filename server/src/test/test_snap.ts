import { moomooAdapter } from "../services/moomooAdapter";
import { StockEngine } from "../services/stockEngine";

async function test() {
  const syms = ["NVDA", "AAPL", "MSFT", "TSLA", "AMD", "PLTR", "INTC"];
  console.log(`Querying ${syms.length} symbols via OpenD...`);
  const snaps = await moomooAdapter.fetchMarketSnapshotsFromOpenD(syms);
  console.log(`Fetched ${snaps.length} snapshots from OpenD!`);
  
  for (const s of snaps.slice(0, 10)) {
    const dd = s.highest52WeeksPrice && s.highest52WeeksPrice > 0 ? ((s.lastPrice - s.highest52WeeksPrice) / s.highest52WeeksPrice) * 100 : 0;
    console.log(`  [${s.symbol}] Price=$${s.lastPrice}, 52wHigh=$${s.highest52WeeksPrice} (DD=${dd.toFixed(1)}%), PE=${s.peRatio}`);
  }
  
  console.log("\nClassifying all symbols:");
  const engine = new StockEngine();
  for (const s of snaps) {
    const classified = engine.classifyStockOpportunity(s.symbol, s.name || s.symbol, s);
    if (classified) {
      console.log(`  ⭐ [${s.symbol}] -> ${classified.strategyCategoryLabel} (${classified.action}) | 理由: ${classified.strategyCategoryReason}`);
    }
  }
}

test().catch(console.error);
