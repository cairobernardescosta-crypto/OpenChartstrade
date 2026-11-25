import { describe, expect, it } from "vitest";
import {
  detectCandleGaps,
  isValidOhlcv,
  reconcileCandles,
  type IntegrityCandle,
} from "../lib/market-data/candle-integrity";

const bar = (time: number, patch: Partial<IntegrityCandle> = {}): IntegrityCandle => ({
  time,
  open: 10,
  high: 12,
  low: 9,
  close: 11,
  volume: 5,
  ...patch,
});

describe("OHLCV integrity", () => {
  it("rejects corrupt OHLCV and accepts missing volume", () => {
    expect(isValidOhlcv(bar(60))).toBe(true);
    expect(isValidOhlcv(bar(60,{volume:undefined}))).toBe(true);
    expect(isValidOhlcv(bar(60,{high:10}))).toBe(false);
    expect(isValidOhlcv(bar(60,{low:12}))).toBe(false);
    expect(isValidOhlcv(bar(60,{open:Number.NaN}))).toBe(false);
    expect(isValidOhlcv(bar(60,{volume:-1}))).toBe(false);
  });

  it("deduplicates deterministically and gives confirmed data priority", () => {
    const result = reconcileCandles(
      [bar(60, { close: 11.25 }), bar(60, { close: 11.5, high: 12.5 })],
      [bar(60, { close: 10.5 }), bar(120)],
    );
    expect(result.map((row) => [row.time, row.close])).toEqual([[60, 11.5], [120, 11]]);
  });

  it("does not let an invalid confirmed row erase a valid provisional row", () => {
    expect(reconcileCandles([bar(60, { high: 8 })], [bar(60, { close: 10.5 })]))
      .toEqual([bar(60, { close: 10.5 })]);
  });

  it("marks gaps missing only for explicitly continuous markets", () => {
    expect(detectCandleGaps([bar(60), bar(240)], 60, "continuous"))
      .toEqual([{ from: 120, to: 240, bars: 2, status: "missing" }]);
    expect(detectCandleGaps([bar(60), bar(240)], 60, "unknown"))
      .toEqual([{ from: 120, to: 240, bars: 2, status: "unknown" }]);
  });

  it("keeps scheduled weekend closures separate from missing bars", () => {
    const friday = Date.UTC(2026, 10, 20, 23) / 1000;
    const monday = Date.UTC(2026, 10, 23, 1) / 1000;
    const gaps = detectCandleGaps([bar(friday), bar(monday)], 3600, "utc-weekdays");
    expect(gaps.some((gap) => gap.status === "scheduled-closed")).toBe(true);
    expect(gaps.some((gap) => gap.status === "missing")).toBe(true);
  });
});
