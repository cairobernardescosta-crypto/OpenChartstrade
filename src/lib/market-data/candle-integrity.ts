export interface IntegrityCandle {
  time: number;
  timestamp?: number | string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export type GapPolicy = "continuous" | "utc-weekdays" | "unknown";
export type GapStatus = "missing" | "scheduled-closed" | "unknown";

export interface CandleGap {
  from: number;
  to: number;
  bars: number;
  status: GapStatus;
}

function secOrMsToSec(value: number): number {
  return Math.floor(value < 1_000_000_000_000 ? value : value / 1000);
}

export function candleTimeSeconds(candle: Pick<IntegrityCandle, "time" | "timestamp">): number {
  if (Number.isFinite(candle.time) && candle.time > 0) return secOrMsToSec(candle.time);
  if (typeof candle.timestamp === "number" && Number.isFinite(candle.timestamp) && candle.timestamp > 0) {
    return secOrMsToSec(candle.timestamp);
  }
  if (typeof candle.timestamp === "string") {
    const parsed = Date.parse(candle.timestamp);
    if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed / 1000);
  }
  return Number.NaN;
}

export function isValidOhlcv(candle: IntegrityCandle): boolean {
  const prices = [candle.open, candle.high, candle.low, candle.close];
  return Number.isFinite(candleTimeSeconds(candle))
    && prices.every((value) => Number.isFinite(value) && value > 0)
    && candle.high >= Math.max(candle.open, candle.close)
    && candle.low <= Math.min(candle.open, candle.close)
    && candle.high >= candle.low
    && (candle.volume === undefined || (Number.isFinite(candle.volume) && candle.volume >= 0));
}

/** Last valid row wins within one source. Confirmed rows override provisional rows. */
export function reconcileCandles<T extends IntegrityCandle>(
  confirmed: readonly T[],
  provisional: readonly T[] = [],
): T[] {
  const byTime = new Map<number, T>();
  for (const row of [...provisional, ...confirmed]) {
    if (!isValidOhlcv(row)) continue;
    byTime.set(candleTimeSeconds(row), row);
  }
  return [...byTime.entries()].sort(([a], [b]) => a - b).map(([, row]) => row);
}

function isWeekendInterval(from: number, interval: number): boolean {
  const start = new Date(from * 1000).getUTCDay();
  const end = new Date((from + interval - 1) * 1000).getUTCDay();
  return (start === 0 || start === 6) && (end === 0 || end === 6);
}

export function detectCandleGaps(
  candles: readonly IntegrityCandle[],
  intervalSeconds: number,
  policy: GapPolicy,
): CandleGap[] {
  if (!Number.isInteger(intervalSeconds) || intervalSeconds <= 0) return [];
  const rows = reconcileCandles(candles);
  const gaps: CandleGap[] = [];
  for (let index = 1; index < rows.length; index += 1) {
    const previous = candleTimeSeconds(rows[index - 1]!);
    const current = candleTimeSeconds(rows[index]!);
    if (current <= previous + intervalSeconds) continue;
    for (let from = previous + intervalSeconds; from < current; from += intervalSeconds) {
      const scheduled = policy === "utc-weekdays" && isWeekendInterval(from, intervalSeconds);
      const status: GapStatus = scheduled ? "scheduled-closed" : policy === "unknown" ? "unknown" : "missing";
      const last = gaps[gaps.length - 1];
      if (last && last.status === status && last.to === from) {
        last.to += intervalSeconds;
        last.bars += 1;
      } else {
        gaps.push({ from, to: from + intervalSeconds, bars: 1, status });
      }
    }
  }
  return gaps;
}
