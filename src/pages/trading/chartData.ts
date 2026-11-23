import { useMemo } from "react";
import type { CandlestickData, HistogramData, Time } from "lightweight-charts";
import type { Candle } from "../../services/schemas.ts";

type CandleRow = CandlestickData<Time> & { volume: number };

// Treat values below 1e12 as seconds, at/above as milliseconds.
function secOrMsToMs(value: number): number {
  return value < 1_000_000_000_000 ? value * 1000 : value;
}

// Normalize a candle timestamp (seconds, milliseconds, or ISO string) to unix seconds.
function candleTimeSec(candle: Candle): number {
  let timestampMs = Number.NaN;
  if (typeof candle.time === "number" && candle.time > 0) {
    timestampMs = secOrMsToMs(candle.time);
  } else if (typeof candle.timestamp === "number" && candle.timestamp > 0) {
    timestampMs = secOrMsToMs(candle.timestamp);
  } else if (typeof candle.timestamp === "string") {
    timestampMs = Date.parse(candle.timestamp);
  }
  return Number.isNaN(timestampMs) ? Number.NaN : Math.floor(timestampMs / 1000);
}

function toCandleRow(candle: Candle): CandleRow {
  return {
    time: candleTimeSec(candle) as Time,
    open: Number(candle.open),
    high: Number(candle.high),
    low: Number(candle.low),
    close: Number(candle.close),
    volume: Number(candle.volume) || 0,
  };
}

// Keep the last row for each timestamp after sorting in ascending order.
function dedupeByTime(sorted: CandleRow[]): CandleRow[] {
  const output: CandleRow[] = [];
  for (let index = 0; index < sorted.length; index++) {
    const current = sorted[index]!;
    const next = sorted[index + 1];
    if (!next || (current.time as number) !== (next.time as number)) output.push(current);
  }
  return output;
}

export function buildChartData(
  candles: Candle[],
  colors: { volumeUp: string; volumeDown: string },
): { chartData: CandlestickData<Time>[]; volumeData: HistogramData<Time>[] } {
  const sorted = candles
    .map(toCandleRow)
    .filter((candle) => !Number.isNaN(candle.time as number) && (candle.time as number) > 0)
    .sort((a, b) => (a.time as number) - (b.time as number));
  const deduped = dedupeByTime(sorted);

  const chartData: CandlestickData<Time>[] = deduped.map(({ volume: _volume, ...rest }) => rest);
  const volumeData: HistogramData<Time>[] = deduped.map((candle) => ({
    time: candle.time,
    value: candle.volume,
    color: candle.close >= candle.open ? colors.volumeUp : colors.volumeDown,
  }));

  return { chartData, volumeData };
}

export function useChartData(candles: Candle[], colors: { volumeUp: string; volumeDown: string }) {
  return useMemo(
    () => buildChartData(candles, colors),
    [candles, colors.volumeUp, colors.volumeDown],
  );
}
