/**
 * Read-only live smoke test for gold markets exposed by Hyperliquid HIP-3.
 *
 * Run with:
 *   node scripts/hl-smoke-xauusd.mts
 *   npx tsx scripts/hl-smoke-xauusd.mts
 *
 * This script does not assume that a particular dex or GOLD market is active.
 * It discovers current markets through the same registry used by the terminal,
 * then checks historical candles and the current top-of-book quote.
 */
import { createHyperliquidMarketData } from "../src/hyperliquid/marketData.ts";

const md = createHyperliquidMarketData();

try {
  const symbols = await md.getSymbols();
  const goldMarkets = symbols.filter((symbol) => {
    const name = symbol.name.toUpperCase();
    const displayName = (symbol.displayName ?? "").toUpperCase();
    return (
      name === "GOLD" ||
      name.endsWith(":GOLD") ||
      name.includes("XAU") ||
      displayName.includes("GOLD")
    );
  });

  console.log(`Hyperliquid active markets discovered: ${symbols.length}`);

  if (goldMarkets.length === 0) {
    console.error("No active GOLD/XAU market was returned by the live registry.");
    console.error("No symbol was added or simulated. Verify the provider's current market universe.");
    process.exitCode = 2;
  } else {
    for (const symbol of goldMarkets) {
      const market = md.registry.bySymbol(symbol.name);
      console.log(`\nMarket: ${symbol.name}`);
      console.log(`Display name: ${symbol.displayName ?? symbol.name}`);
      console.log(`Category: ${symbol.category}`);
      console.log(`Dex: ${market?.dex || "core"}`);
      console.log(`Asset ID: ${market?.assetId ?? "unavailable"}`);
      console.log("Instrument type: Hyperliquid perpetual market, not assumed to be spot XAUUSD.");

      try {
        const candles = await md.getCandles({
          symbol: symbol.name,
          timeframe: "1h",
          limit: 5,
        });
        console.log(`Historical 1h candles: ${candles.length}`);
        for (const candle of candles) {
          console.log(
            `  ${new Date(candle.time * 1000).toISOString()} O=${candle.open} H=${candle.high} L=${candle.low} C=${candle.close} V=${candle.volume}`,
          );
        }
      } catch (error) {
        console.error("Historical candle check failed:", error instanceof Error ? error.message : error);
      }

      try {
        const quote = await md.getQuote?.(symbol.name);
        console.log("Top-of-book quote:", quote ?? "unavailable");
      } catch (error) {
        console.error("Quote check failed:", error instanceof Error ? error.message : error);
      }
    }
  }
} catch (error) {
  console.error("Could not verify Hyperliquid gold markets:", error);
  process.exitCode = 1;
} finally {
  md.disconnect?.();
}
