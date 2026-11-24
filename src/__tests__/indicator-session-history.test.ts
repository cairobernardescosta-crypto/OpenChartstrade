import {describe,it,expect} from "vitest";
import {indicatorSchema} from "../lib/indicator-sdk/schema";
import {SessionHistoryCache,sessionHistoryPlan} from "../lib/indicator-sdk/session-history";
const config=indicatorSchema.parse({sdk:1,id:"htf",name:"HTF",version:"1.0.0",kind:"session-candle",sessionSchedule:"utc-24h",sessionMinutes:"60"});
const start=Date.UTC(2026,10,24)/1000;
describe("independent session source",()=>{it("requests only the current segment and excludes future bars",async()=>{const cutoff=start+180;const plan=sessionHistoryPlan(config,cutoff,5000)!;expect(plan.rangeStart).toBe(start);const loader=async()=>Array.from({length:5},(_,i)=>({time:start+i*60,open:1,high:2,low:1,close:2}));const result=await new SessionHistoryCache(loader).get("xyz:GOLD",config,cutoff,5000);expect(result.rows).toHaveLength(3);expect(result.error).toBe("");});it("rejects incomplete history",async()=>{const result=await new SessionHistoryCache(async()=>[{time:start,open:1,high:2,low:1,close:2}]).get("xyz:GOLD",config,start+180,5000);expect(result.rows).toEqual([]);expect(result.error).toContain("Incomplete");});});
