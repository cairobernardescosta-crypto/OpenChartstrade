import type { CandleData } from "../indicators";
import type { ImportedIndicator } from "./schema";

export interface SessionRange {
  start: number; end: number; open: number; high: number; low: number; close: number;
  highTime: number; lowTime: number;
}

// Convert a civil minute to UTC, respecting IANA zone offsets. Reject nonexistent
// local times rather than silently moving a session boundary.
function civilTime(day: number, minute: number, fmt: Intl.DateTimeFormat): number | null {
  const target = day * 86400000 + minute * 60000;
  let guess = target;
  for (let i = 0; i < 5; i++) {
    const p = parts(guess, fmt);
    const actual = p.day * 86400000 + p.minute * 60000;
    if (actual === target) return guess / 1000;
    guess += target - actual;
  }
  return null;
}
function parts(ms: number, fmt: Intl.DateTimeFormat) {
  const p = Object.fromEntries(fmt.formatToParts(new Date(ms)).map(x => [x.type, x.value]));
  return { day: Date.UTC(Number(p.year), Number(p.month)-1, Number(p.day))/86400000,
    minute: Number(p.hour)*60+Number(p.minute) };
}
const minutes = (s: string) => Number(s.slice(0,2))*60+Number(s.slice(3));

export function sessionRange(candles: readonly CandleData[], config: ImportedIndicator): SessionRange | null {
  const last = candles[candles.length-1];
  if (!last || !Number.isFinite(last.time)) return null;
  const fmt = new Intl.DateTimeFormat("en-GB", {timeZone:config.timezone, year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
  const now = parts(last.time*1000, fmt);
  const o = minutes(config.open), c = minutes(config.close);
  const day = now.day - (now.minute < o ? 1 : 0);
  if (!config.days.includes(new Date(day*86400000).getUTCDay())) return null;
  const start = civilTime(day,o,fmt), end = civilTime(day+(c<=o?1:0),c,fmt);
  if (start === null || end === null) return null;
  let out: SessionRange | null = null;
  for (const bar of candles) {
    if (bar.time < start || bar.time >= end) continue;
    if (![bar.open,bar.high,bar.low,bar.close].every(Number.isFinite)) continue;
    if (!out) out = {start,end,open:bar.open,high:bar.high,low:bar.low,close:bar.close,highTime:bar.time,lowTime:bar.time};
    else {
      if (bar.high>out.high) {out.high=bar.high;out.highTime=bar.time;}
      if (bar.low<out.low) {out.low=bar.low;out.lowTime=bar.time;}
      out.close=bar.close;
    }
  }
  return out;
}
