import { beforeEach, describe, expect, it, vi } from "vitest";
import { runAdapterConformance } from "../../adapter/conformance.ts";
import {
  createAccountStorage,
  createHyperliquidAdapter,
  guardLiveMarketData,
  LIVE_FEED_REQUIRED_MESSAGE,
} from "../adapter.ts";
import type { HyperliquidTrading } from "../trading.ts";
import type { ConnectionState } from "../../adapter/types.ts";
import { createInfoClient } from "../info.ts";
import { hlSession } from "../session.ts";
import { FakeWebSocket, FakeWebSocketCtor } from "./fakeSocket.ts";

const MIN = 60_000;

function fakeInfoFetch() {
  const now = Math.floor(Date.now() / MIN) * MIN;
  const handler = (body: Record<string, unknown>): unknown => {
    switch (body.type) {
      case "perpDexs":
        return [null];
      case "perpCategories":
        return [];
      case "meta":
        return { universe: [{ name: "BTC", szDecimals: 5, maxLeverage: 40 }] };
      case "allMids":
        return { BTC: "76101.5" };
      case "l2Book":
        return {
          coin: "BTC",
          time: 123,
          levels: [[{ px: "100", sz: "1", n: 1 }], [{ px: "101", sz: "1", n: 1 }]],
        };
      case "candleSnapshot": {
        const req = body.req as { startTime: number; endTime?: number };
        const end = req.endTime ?? now;
        const out = [];
        for (let t = now - 999 * MIN; t <= now; t += MIN) {
          if (t >= req.startTime && t <= end) {
            out.push({ t, T: t + MIN - 1, s: "BTC", i: "1m", o: "100", c: "101", h: "102", l: "99", v: "5", n: 3 });
          }
        }
        return out;
      }
      default:
        return {};
    }
  };
  return vi.fn((_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return Promise.resolve(new Response(JSON.stringify(handler(body)), { status: 200 }));
  }) as unknown as typeof fetch;
}

function makeAdapter() {
  return createHyperliquidAdapter({
    marketData: {
      info: createInfoClient({ fetchImpl: fakeInfoFetch(), sleep: () => Promise.resolve() }),
      webSocketImpl: FakeWebSocketCtor,
    },
  });
}

beforeEach(() => {
  FakeWebSocket.reset();
  hlSession.setState({ address: null, status: "disconnected" });
});

runAdapterConformance("hyperliquid (mocked network)", () => makeAdapter(), {
  symbol: "BTC",
  timeframe: "1m",
  tickTimeoutMs: 50,
});

describe("guardLiveMarketData", () => {
  it("blocks place and modify order calls until the live feed is connected", async () => {
    let state: ConnectionState = "disconnected";
    let health = {
      adapter: { status: "available" as const },
      staleCount: 0,
      totalSymbols: 1,
      lastTickAgeMs: 0,
    };
    const placeOrder = vi.fn(async () => ({}) as never);
    const modifyOrder = vi.fn(async () => ({}) as never);
    const trading = { placeOrder, modifyOrder } as unknown as HyperliquidTrading;

    guardLiveMarketData(trading, () => state, () => health);
    const order = {
      accountId: "0xabc",
      symbol: "BTC",
      side: "BUY" as const,
      type: "MARKET" as const,
      quantity: 0.01,
    };

    await expect(trading.placeOrder(order)).rejects.toThrow(LIVE_FEED_REQUIRED_MESSAGE);
    await expect(trading.modifyOrder("1", { price: 1 })).rejects.toThrow(LIVE_FEED_REQUIRED_MESSAGE);
    expect(placeOrder).not.toHaveBeenCalled();
    expect(modifyOrder).not.toHaveBeenCalled();

    state = "connected";
    health = { ...health, staleCount: 1, lastTickAgeMs: 31_000 };
    await expect(trading.placeOrder(order)).rejects.toThrow(LIVE_FEED_REQUIRED_MESSAGE);
    health = { ...health, staleCount: 0, lastTickAgeMs: 0 };
    await trading.placeOrder(order);
    await trading.modifyOrder("1", { price: 1 });
    expect(placeOrder).toHaveBeenCalledTimes(1);
    expect(modifyOrder).toHaveBeenCalledTimes(1);
  });
});

describe("createHyperliquidAdapter", () => {
  it("composes market data, trading and storage under the hyperliquid name", () => {
    const a = makeAdapter();
    expect(a.name).toBe("hyperliquid");
    expect(a.trading.setLeverage).toBeTypeOf("function");
    expect(a.storage).toBeDefined();
  });

  it("disposes trading when market data disconnects", () => {
    const a = makeAdapter();
    const spy = vi.spyOn(a.trading, "dispose");
    a.marketData.disconnect?.();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("createAccountStorage", () => {
  function memory() {
    const m = new Map<string, string>();
    return {
      m,
      store: {
        getItem: (k: string) => m.get(k) ?? null,
        setItem: (k: string, v: string) => (m.set(k, v), true),
        removeItem: (k: string) => m.delete(k),
      },
    };
  }

  it("namespaces by connected address so state follows the account", () => {
    const { m, store } = memory();
    let scope: string | null = null;
    const s = createAccountStorage({ store, getScope: () => scope });
    s.set("drawings", "anon-data");
    scope = "0xAbC";
    s.set("drawings", "acct-data");
    expect([...m.keys()].sort()).toEqual(["hl:0xabc:drawings", "hl:anon:drawings"]);
    expect(s.get("drawings")).toBe("acct-data");
    scope = null;
    expect(s.get("drawings")).toBe("anon-data");
    s.remove("drawings");
    expect(s.get("drawings")).toBeNull();
  });

  it("never reads another account's data", () => {
    const { store } = memory();
    let scope: string | null = "0x1";
    const s = createAccountStorage({ store, getScope: () => scope });
    s.set("k", "one");
    scope = "0x2";
    expect(s.get("k")).toBeNull();
  });
});
