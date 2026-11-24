import {describe,it,expect} from "vitest";
import {aggregateCompleted} from "../lib/indicator-sdk/aggregate";
describe("calendar aggregation",()=>{it("uses actual February length",()=>{const start=Date.UTC(2024,1,1)/1000;const bars=Array.from({length:30},(_,i)=>({time:start+i*86400,open:1,high:3,low:0,close:2,volume:1}));expect(aggregateCompleted(bars,43200,86400)).toEqual([{time:start+28*86400,open:1,high:3,low:0,close:2,volume:29}]);});});
