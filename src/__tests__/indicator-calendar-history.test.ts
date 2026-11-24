import {describe,it,expect} from "vitest";
import {indicatorSchema} from "../lib/indicator-sdk/schema";
import {sessionBounds,sessionRange} from "../lib/indicator-sdk/session";
import {sessionHistoryPlan} from "../lib/indicator-sdk/session-history";
import {completedHistory,historyPointExpiry} from "../lib/indicator-sdk/independent-history";
const day=86400;const utc=(y:number,m:number,d:number)=>Date.UTC(y,m-1,d)/1000;
const base=indicatorSchema.parse({sdk:1,id:"calendar",name:"Calendar",version:"1.0.0",kind:"session-candle",sessionSchedule:"utc-24h",sessionMinutes:"month"});
const bar=(time:number)=>({time,open:1,high:2,low:1,close:2,volume:1});
describe("calendar HTF history",()=>{
it("uses leap-year February boundaries",()=>{const bounds=sessionBounds(base,utc(2024,2,20))!;expect(bounds.rangeStart).toBe(utc(2024,2,1));expect(bounds.rangeEnd).toBe(utc(2024,3,1));});
it("uses aligned lower resolution when history budget is constrained",()=>{expect(sessionHistoryPlan(base,utc(2024,2,20),100)?.timeframe).toBe("1d");});
it("starts a weekly period on Monday",()=>{expect(sessionBounds({...base,sessionMinutes:"week"},utc(2026,11,24))?.rangeStart).toBe(utc(2026,11,23));});
it("timestamps a completed month at its real boundary even with weekend closure",()=>{const start=utc(2026,1,1),end=utc(2026,2,1);const bars=Array.from({length:31},(_,i)=>bar(start+i*day)).filter(b=>![0,6].includes(new Date(b.time*1000).getUTCDay()));expect(completedHistory(bars,43200,end,"utc-weekdays")[0]?.time).toBe(end);});
it("expires monthly values at the next calendar boundary",()=>expect(historyPointExpiry(utc(2024,2,1),43200)).toBe(utc(2024,3,1)));
it("rejects a missing day in continuous monthly coverage",()=>{const start=utc(2024,2,1);expect(sessionRange([bar(start),bar(start+2*day)],base,day,start+3*day,true)).toBeNull();});
});