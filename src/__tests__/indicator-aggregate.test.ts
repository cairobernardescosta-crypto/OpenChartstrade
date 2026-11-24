import {describe,it,expect} from "vitest";
import {aggregateCompleted} from "../lib/indicator-sdk/aggregate";
const bars=Array.from({length:16},(_,i)=>({time:i*60,open:i,high:i+2,low:i-1,close:i+1,volume:2}));
describe("completed aggregation",()=>{
 it("aggregates without backdating",()=>expect(aggregateCompleted(bars,15,60)).toEqual([{time:840,open:0,high:16,low:-1,close:15,volume:30}]));
 it("excludes the live bucket",()=>expect(aggregateCompleted(bars.slice(0,15),15,60)).toEqual([]));
 it("rejects gaps",()=>expect(aggregateCompleted(bars.filter(b=>b.time!==60),15,60)).toEqual([]));
 it("rejects incompatible resolutions",()=>expect(aggregateCompleted(bars,15,120)).toEqual([]));
});
