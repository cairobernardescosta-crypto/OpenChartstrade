import {compileExpression} from "./expression";
import type {CandleData,IndicatorPoint} from "../indicators";
export const MAX_RUNTIME_BARS=20000;
export const MAX_CONSECUTIVE_FAILURES=3;
export class RuntimeGuard {
 private failures=new Map<string,number>();
 blocked(key:string){return (this.failures.get(key)??0)>=MAX_CONSECUTIVE_FAILURES;}
 success(key:string){this.failures.delete(key);}
 fail(key:string){const count=Math.min(MAX_CONSECUTIVE_FAILURES,(this.failures.get(key)??0)+1);this.failures.set(key,count);return count;}
 reset(){this.failures.clear();}
}
export function runBoundedExpression(candles:readonly CandleData[],source:string,parameters:Readonly<Record<string,number>>={},budgetMs=100):IndicatorPoint[]{
 if(candles.length>MAX_RUNTIME_BARS)throw new Error("Indicator history limit exceeded");
 const evaluate=compileExpression(source,parameters);
 const deadline=performance.now()+budgetMs;
 const result:IndicatorPoint[]=[];
 for(let i=0;i<candles.length;i++){
  if((i&63)===0&&performance.now()>deadline)throw new Error("Indicator execution budget exceeded");
  const c=candles[i]!;const value=evaluate(c);
  if(Number.isFinite(value))result.push({time:c.time,value});
 }
 if(performance.now()>deadline)throw new Error("Indicator execution budget exceeded");
 return result;
}
