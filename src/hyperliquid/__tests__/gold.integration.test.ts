import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { MarketEvent } from "../../adapter/types.ts";
import { createInfoClient } from "../info.ts";
import { createHyperliquidMarketData, TIMEFRAME_MS } from "../marketData.ts";
import { FakeWebSocket, FakeWebSocketCtor } from "./fakeSocket.ts";

const GOLD = "xyz:GOLD";

function makeGoldSource() {
  const fetchImpl = (async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    let result: unknown;
    switch (body.type) {
      case "perpDexs":
        result = [null, { name: "xyz" }];
        break;
      case "perpCategories":
        result = [[GOLD, "commodities"]];
        break;
      case "meta":
        result = body.dex === "xyz"
          ? { universe: [{ name: GOLD, szDecimals: 3, maxLeverage: 20 }], collateralToken: 0 }
          : { universe: [] };
        break;
      case "allMids":
        result = body.dex === "xyz" ? { [GOLD]: "3658.75" } : {};
        break;
      case "l2Book":
        result = {
          coin: GOLD,
          time: 1_700_000_000_123,
          levels: [[{ px: "3658.6", sz: "1", n: 1 }], [{ px: "3658.9", sz: "2", n: 1 }]],
        };
        break;
      case "candleSnapshot": {
        const req = body.req as { coin: string; interval: string };
        const intervalMs = TIMEFRAME_MS[req.interval] ?? 60_000;
        const t = Math.floor(Date.now() / intervalMs) * intervalMs;
        result = [{
          t,
          T: t + intervalMs - 1,
          s: req.coin,
          i: req.interval,
          o: "3616.5",
          h: "3629",
          l: "3614",
          c: "3627.1",
          v: "12.5",
          n: 4,
        }];
        break;
      }
      default:
        result = {};
    }
    return new Response(JSON.stringify(result), { status: 200 });
  }) as typeof fetch;

  const md = createHyperliquidMarketData({
    info: createInfoClient({ fetchImpl, sleep: () => Promise.resolve() }),
    webSocketImpl: FakeWebSocketCtor,
  });
  return md;
}

describe("Hyperliquid GOLD market integration", () => {
  beforeEach(() => FakeWebSocket.reset());
  afterEach(() => {
    FakeWebSocket.last()?.close();
  });

  it("discovers the exact HIP-3 symbol and loads every supported chart interval", async () => {
    const md = makeGoldSource();
    try {
      const symbols = await md.getSymbols();
      const gold = symbols.find((symbol) => symbol.name === GOLD);
      expect(gold).toMatchObject({
        id: GOLD,
        name: GOLD,
        displayName: "Gold",
        category: "Commodities",
      });

      for (const timeframe of Object.keys(TIMEFRAME_MS)) {
        const candles = await md.getCandles({ symbol: GOLD, timeframe, limit: 1 });
        expect(candles).toHaveLength(1);
        expect(candles[0]).toMatchObject({
          open: 3616.5,
          high: 3629,
          low: 3614,
          close: 3627.1,
          volume: 12.5,
        });
      }

      await expect(md.getQuote!(GOLD)).resolves.toMatchObject({
        symbol: GOLD,
        bid: 3658.6,
        ask: 3658.9,
      });
    } finally {
      md.disconnect?.();
    }
  });

  it("routes live GOLD candles and BBO ticks through the shared adapter events", async () => {
    const md = makeGoldSource();
    const events: MarketEvent[] = [];
    try {
      await md.getSymbols();
      md.subscribe((event) => events.push(event));
      md.setSymbolInterest?.([GOLD]);
      md.connect?.();
      const ws = FakeWebSocket.last();
      ws.open();

      await md.getCandles({ symbol: GOLD, timeframe: "1h", limit: 1 });
      const subscriptions = ws.sent
        .filter((message): message is { method: string; subscription: Record<string, string> } =>
          (message as { method?: string }).method === "subscribe",
        )
        .map((message) => message.subscription);
      expect(subscriptions).toContainEqual({ type: "bbo", coin: GOLD });
      expect(subscriptions).toContainEqual({ type: "candle", coin: GOLD, interval: "1h" });

      ws.push({
        channel: "candle",
        data: { t: 1_700_000_100_000, T: 1_700_003_699_999, s: GOLD, i: "1h", o: "3616.5", c: "3627.1", h: "3629", l: "3614", v: "12.5", n: 4 },
      });
      ws.push({
        channel: "bbo",
        data: { coin: GOLD, time: 1_700_000_000_123, bbo: [{ px: "3658.6" }, { px: "3658.9" }] },
      });

      expect(events).toContainEqual(expect.objectContaining({
        type: "candle",
        symbol: GOLD,
        timeframe: "1h",
        close: 3627.1,
      }));
      expect(events).toContainEqual({
        type: "tick",
        symbol: GOLD,
        bid: 3658.6,
        ask: 3658.9,
        timestamp: 1_700_000_000_123,
      });
    } finally {
      md.disconnect?.();
    }
  });
});
