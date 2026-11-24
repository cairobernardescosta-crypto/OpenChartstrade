import {describe,it,expect} from "vitest";
import {aggregateCompleted} from "../lib/indicator-sdk/aggregate";
import {CalculationCache} from "../lib/indicator-sdk/calculation-cache";
import {indicatorSchema,parseIndicator} from "../lib/indicator-sdk/schema";
import {alignHistoryPoints} from "../lib/indicator-sdk/independent-history";
const bar=(time:number,close=2)=>({time,open:1,high:Math.max(close,3),low:0,close,volume:10});
describe("indicator regression protections",()=>{
 it("excludes the live aggregate and aligns completed values after close",()=>{const rows=Array.from({length:16},(_,i)=>bar(i*60));const data=aggregateCompleted(rows,15,60);expect(data).toHaveLength(1);expect(alignHistoryPoints(data.map(x=>({time:x.time+60,value:x.close})),rows)).toEqual([{time:900,value:2}]);});
 it("rejects unsupported aggregation",()=>expect(aggregateCompleted([bar(0)],1,60,true)).toEqual([]));
 it("does not retain replay future points on rewind",()=>{const c=new CalculationCache();const config=indicatorSchema.parse({sdk:1,id:"rewind",name:"Rewind",version:"1.0.0",kind:"expression"});c.calculate(config,[bar(0),bar(60),bar(120)]);expect(c.calculate(config,[bar(0)]).points).toEqual([{time:0,value:2}]);});
 it("rejects executable imports",()=>expect(()=>parseIndicator('export default (()=>fetch("https://example.com"))();')).toThrow());
});
