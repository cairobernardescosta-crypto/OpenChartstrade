import { describe, expect, it } from "vitest";
import type { Candle } from "../../services/schemas.ts";
import { buildChartData } from "./chartData.ts";

const colors = { volumeUp: "#00aa00", volumeDown: "#aa0000" };

function candle(overrides: Partial<Candle> & Pick<Candle, "time">): Candle {
  return {
    time: overrides.time,
    open: 10,
    high: 12,
    low: 9,
    close: 11,
    volume: 5,
    ...overrides,
  };
}

describe("buildChartData", () => {
  it("sorts candles and keeps the latest duplicate timestamp", () => {
    const result = buildChartData(
      [
        candle({ time: 2_000, close: 12, volume: 7 }),
        candle({ time: 1_000, close: 9, volume: 3 }),
        candle({ time: 1_000, close: 8, volume: 4 }),
      ],
      colors,
    );

    expect(result.chartData.map((row) => [row.time, row.close])).toEqual([
      [1_000, 8],
      [2_000, 12],
    ]);
    expect(result.volumeData).toEqual([
      { time: 1_000, value: 4, color: colors.volumeDown },
      { time: 2_000, value: 7, color: colors.volumeUp },
    ]);
  });

  it("normalizes millisecond and ISO timestamps and drops invalid rows", () => {
    const result = buildChartData(
      [
        candle({ time: 1_700_000_000_000 }),
        candle({ time: 0, timestamp: "2024-01-01T00:00:00.000Z" } as Partial<Candle> & Pick<Candle, "time">),
        candle({ time: 0 }),
      ],
      colors,
    );

    expect(result.chartData.map((row) => row.time)).toEqual([
      1_704_067_200,
      1_700_000_000,
    ]);
  });
});
