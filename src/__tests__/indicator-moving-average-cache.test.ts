import {describe,it,expect} from "vitest";
import {CalculationCache} from "../lib/indicator-sdk/calculation-cache";
import {indicatorSchema} from "../lib/indicator-sdk/schema";
import {sma,ema} from "../lib/indicators";
describe("incremental moving averages",()=>{for(const kind of ["sma","ema"] as const)it(kind,()=>{const c=new CalculationCache();const config=indicatorSchema.parse({sdk:1,id:"moving",name:"Moving",version:"1.0.0",kind,period:3});const bars=Array.from({length:10},(_,i)=>({time:i,open:i,high:i+1,low:i,close:i+0.5}));c.calculate(config,bars.slice(0,7));const result=c.calculate(config,bars);expect(result.incremental).toBe(true);const expected=(kind==="sma"?sma:ema)(bars,3);result.points.forEach((p,i)=>expect(p.value).toBeCloseTo(expected[i]!.value,10));});});
