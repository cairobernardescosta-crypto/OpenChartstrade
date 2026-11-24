import type {CandleData,IndicatorPoint} from "../indicators";
import {validMarketBar,type MarketGapPolicy} from "./market-gaps";
import {aggregateCompleted} from "./aggregate";
export const HISTORY_LIMIT=5000;
export function historyPlan(minutes:number):{timeframe:string;seconds:number;aggregate:number}|null{
 switch(minutes){
 case 15:return {timeframe:"15m",seconds:900,aggregate:0};
 case 30:return {timeframe:"30m",seconds:1800,aggregate:0};
 case 60:return {timeframe:"1h",seconds:3600,aggregate:0};
 case 120:case 360:case 720:return {timeframe:"1h",seconds:3600,aggregate:minutes};
 case 240:return {timeframe:"4h",seconds:14400,aggregate:0};
 case 1440:return {timeframe:"1d",seconds:86400,aggregate:0};
 case 10080:case 43200:return {timeframe:"1d",seconds:86400,aggregate:minutes};
 default:return null;
 }
}
export function completedHistory(rows:readonly CandleData[],minutes:number,cutoff:number,policy:MarketGapPolicy="continuous"):CandleData[]{
 const plan=historyPlan(minutes);if(!plan)return [];
 const unique=new Map<number,CandleData>();
 for(const c of rows)if(validMarketBar(c)&&c.time+plan.seconds<=cutoff)unique.set(c.time,{...c});
 const bars=[...unique.values()].sort((a,b)=>a.time-b.time).slice(-HISTORY_LIMIT);
 if(!plan.aggregate)return bars.map(c=>({...c,time:c.time+plan.seconds}));
 return aggregateCompleted(bars,plan.aggregate,plan.seconds,true,policy).map(c=>({...c,time:c.time+plan.seconds}));
}
export function alignHistoryPoints(points:readonly IndicatorPoint[],chart:readonly CandleData[],maxAge=Infinity):IndicatorPoint[]{
 const result:IndicatorPoint[]=[];let i=0;let current:IndicatorPoint|undefined;
 for(const bar of chart){while(i<points.length&&points[i]!.time<=bar.time)current=points[i++];if(current&&bar.time-current.time<maxAge)result.push({time:bar.time,value:current.value});}
 return result;
}
type Loader=(symbol:string,timeframe:string,limit:number,toMs:number)=>Promise<readonly CandleData[]>;
type CacheRow={expires:number;promise:Promise<CandleData[]>};
export class IndependentHistoryCache{
 private cache=new Map<string,CacheRow>();
 constructor(private load:Loader,private now=Date.now){}
 get(symbol:string,minutes:number,cutoff:number,policy:MarketGapPolicy="continuous"){
  const plan=historyPlan(minutes);if(!plan)return Promise.resolve([]);
  const boundary=Math.floor(cutoff/plan.seconds)*plan.seconds;
  const key=JSON.stringify([symbol,minutes,boundary,policy]);const old=this.cache.get(key);
  if(old&&old.expires>this.now())return old.promise;
  const promise=this.load(symbol,plan.timeframe,HISTORY_LIMIT,boundary*1000).then(rows=>completedHistory(rows,minutes,boundary,policy));
  const row={expires:this.now()+30000,promise};this.cache.set(key,row);
  promise.catch(()=>{if(this.cache.get(key)===row)this.cache.delete(key);});
  while(this.cache.size>16){const first=this.cache.keys().next().value;if(first===undefined)break;this.cache.delete(first);}
  return promise;
 }
}

export function historyMaxAge(minutes:number){return minutes===43200?31*86400:minutes*60;}
