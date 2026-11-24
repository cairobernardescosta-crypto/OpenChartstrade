import type {CandleData} from "../indicators";
export const aggregationMinutes=[0,15,30,60,120,240,360,720,1440,10080] as const;
// Completed UTC-aligned buckets only. Stamp at the last contributing bar,
// rather than the opening timestamp, to prevent historical lookahead.
export function aggregateCompleted(candles:readonly CandleData[],minutes:number,sourceSeconds:number):CandleData[]{
 if(minutes===0)return [...candles];
 const span=minutes*60;
 if(!Number.isInteger(sourceSeconds)||sourceSeconds<=0||span<sourceSeconds||span%sourceSeconds!==0)return [];
 const out:CandleData[]=[];let bucket:CandleData|undefined;let start=0;let count=0;let valid=false;let previous=0;
 for(const c of candles){
  const key=Math.floor(c.time/span)*span;
  if(!bucket||key!==start){bucket={...c};start=key;count=1;valid=c.time===key;previous=c.time;}
  else{valid=valid&&c.time===previous+sourceSeconds;previous=c.time;count++;bucket.high=Math.max(bucket.high,c.high);bucket.low=Math.min(bucket.low,c.low);bucket.close=c.close;bucket.time=c.time;bucket.volume=(bucket.volume??0)+(c.volume??0);}
  if(valid&&count===span/sourceSeconds&&c.time+sourceSeconds===start+span){out.push({...bucket});bucket=undefined;}
 }
 // The last source candle may still be live: do not publish its bucket.
 const last=candles[candles.length-1];if(last&&out[out.length-1]?.time===last.time)out.pop();
 return out;
}
