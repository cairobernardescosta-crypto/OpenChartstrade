import { useMemo } from "react";
import type { CandlestickData, HistogramData, Time } from "lightweight-charts";
import type { Candle } from "../../services/schemas.ts";
import { candleTimeSeconds, isValidOhlcv } from "../../lib/market-data/candle-integrity.ts";

type CandleRow = CandlestickData<Time> & { volume: number };

function toCandleRow(candle: Candle): CandleRow {
  return {
    time: candleTimeSeconds(candle) as Time,
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
    .filter(isValidOhlcv)
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
    [candles, colors],
  );
}
