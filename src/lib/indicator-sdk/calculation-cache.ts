import type {CandleData,IndicatorPoint} from "../indicators";
import {runBoundedExpression} from "./runtime";
import {sma,ema} from "../indicators";
import {aggregateCompleted} from "./aggregate";
import {parameterValues,type ImportedIndicator} from "./schema";
const same=(a:CandleData,b:CandleData)=>a===b||a.time===b.time&&Object.is(a.open,b.open)&&Object.is(a.high,b.high)&&Object.is(a.low,b.low)&&Object.is(a.close,b.close)&&Object.is(a.volume,b.volume);
export function sharedPrefix(a:readonly CandleData[],b:readonly CandleData[]){let i=0;while(i<Math.min(a.length,b.length)&&same(a[i]!,b[i]!))i++;return i;}
type Entry={signature:string;input:CandleData[];output:IndicatorPoint[]};
export class CalculationCache{
 private entries=new Map<string,Entry>();
 stats(){return {entries:this.entries.size,points:[...this.entries.values()].reduce((n,e)=>n+e.input.length+e.output.length,0)};}
 constructor(private maxEntries=12,private maxPoints=100000){}
 get pointBudget(){return this.maxPoints;}
 calculate(config:ImportedIndicator,bars:CandleData[]):{points:IndicatorPoint[];cached:boolean;incremental:boolean}{
  const signature=JSON.stringify([config.kind,config.period,config.expression,parameterValues(config),config.aggregation,config.historySource]);
  const old=this.entries.get(config.id);
  const prefix=old?.signature===signature?sharedPrefix(old.input,bars):0;
  if(old&&old.signature===signature&&prefix===old.input.length&&prefix===bars.length){this.entries.delete(config.id);this.entries.set(config.id,old);return {points:old.output,cached:true,incremental:false};}
  let output:IndicatorPoint[];let incremental=false;
  if(config.kind==="expression"){
   if(old&&prefix>0&&old.signature===signature){
    const tail=runBoundedExpression(bars.slice(prefix),config.expression,parameterValues(config));
    const cutoff=bars[prefix-1]!.time;
    output=[...old.output.filter(p=>p.time<=cutoff),...tail];incremental=true;
   }else output=runBoundedExpression(bars,config.expression,parameterValues(config));
  }else if(old&&prefix>=config.period&&old.signature===signature){
   output=old.output.filter(p=>p.time<=bars[prefix-1]!.time);const period=config.period;let value=output[output.length-1]!.value;let sum=bars.slice(prefix-period,prefix).reduce((n,b)=>n+b.close,0);const k=2/(period+1);
   for(let i=prefix;i<bars.length;i++){if(config.kind==="sma"){sum+=bars[i]!.close-bars[i-period]!.close;value=sum/period;}else value=bars[i]!.close*k+value*(1-k);output.push({time:bars[i]!.time,value});}incremental=true;
  }else output=(config.kind==="sma"?sma:ema)(bars,config.period);
  this.entries.delete(config.id);
  if(bars.length+output.length<=this.maxPoints)this.entries.set(config.id,{signature,input:bars.map(b=>({...b})),output});
  while(this.entries.size>this.maxEntries||[...this.entries.values()].reduce((n,e)=>n+e.input.length+e.output.length,0)>this.maxPoints){const key=this.entries.keys().next().value;if(key===undefined)break;this.entries.delete(key);}
  return {points:output,cached:false,incremental};
 }
 prune(ids:ReadonlySet<string>){for(const id of this.entries.keys())if(!ids.has(id))this.entries.delete(id);}
 clear(){this.entries.clear();}
}
export class AggregationCache{
 private input:CandleData[]=[];
 private step=0;
 private values=new Map<number,CandleData[]>();
 prepare(input:CandleData[],step:number){if(this.step!==step||input.length!==this.input.length||sharedPrefix(this.input,input)!==input.length){this.input=input.map(x=>({...x}));this.step=step;this.values.clear();}}
 get(minutes:number){let value=this.values.get(minutes);if(!value){value=aggregateCompleted(this.input,minutes,this.step);this.values.set(minutes,value);}return value;}
}
