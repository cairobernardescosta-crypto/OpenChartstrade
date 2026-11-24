import {describe,expect,it} from "vitest";
import {TickMarkType,type UTCTimestamp} from "lightweight-charts";
import {formatChartTick,formatChartTime} from "../pages/trading/chart-time";

describe("Brazil chart time",()=>{
  const utc=(Date.UTC(2026,10,24,21,35,12)/1000) as UTCTimestamp;
  it("formats timestamps in São Paulo regardless of browser timezone",()=>{
    expect(formatChartTime(utc)).toBe("24/11/2026, 18:35:12");
    expect(formatChartTick(utc,TickMarkType.Time)).toBe("18:35");
    expect(formatChartTick(utc,TickMarkType.TimeWithSeconds)).toBe("18:35:12");
  });
});
