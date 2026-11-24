import type {CandleData} from "../indicators";
export const aggregationMinutes=[0,15,30,60,120,240,360,720,1440,10080,43200] as const;
// Completed UTC-aligned buckets only. Stamp at the last contributing bar,
// rather than the opening timestamp, to prevent historical lookahead.
export function aggregateCompleted(candles:readonly CandleData[],minutes:number,sourceSeconds:number,lastClosed=false):CandleData[]{
 if(minutes===0)return [...candles];
 if(minutes===43200)return aggregateMonths(candles,sourceSeconds,lastClosed);
 if(!aggregationMinutes.some(x=>x===minutes))return [];
 const span=minutes*60;
 if(!Number.isInteger(sourceSeconds)||sourceSeconds<=0||span<sourceSeconds||span%sourceSeconds!==0)return [];
 const out:CandleData[]=[];let bucket:CandleData|undefined;let start=0;let count=0;let valid=false;let previous=0;
 for(const c of candles){
  const shift=minutes===10080?345600:0;
  const key=Math.floor((c.time-shift)/span)*span+shift;
  if(!bucket||key!==start){bucket={...c};start=key;count=1;valid=c.time===key;previous=c.time;}
  else{valid=valid&&c.time===previous+sourceSeconds;previous=c.time;count++;bucket.high=Math.max(bucket.high,c.high);bucket.low=Math.min(bucket.low,c.low);bucket.close=c.close;bucket.time=c.time;bucket.volume=(bucket.volume??0)+(c.volume??0);}
  if(valid&&count===span/sourceSeconds&&c.time+sourceSeconds===start+span){out.push({...bucket});bucket=undefined;}
 }
 // The last source candle may still be live: do not publish its bucket.
 const last=candles[candles.length-1];if(!lastClosed&&last&&out[out.length-1]?.time===last.time)out.pop();
 return out;
}

function aggregateMonths(candles:readonly CandleData[],step:number,lastClosed=false):CandleData[]{
 if(!Number.isInteger(step)||step<=0||86400%step!==0)return [];
 const out:CandleData[]=[];let row:CandleData|undefined;let start=0,end=0,previous=0,valid=false;
 for(const c of candles){const d=new Date(c.time*1000);const key=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1)/1000;
 if(!row||key!==start){start=key;end=Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1)/1000;row={...c};valid=c.time===start;}
 else{valid=valid&&c.time===previous+step;row.high=Math.max(row.high,c.high);row.low=Math.min(row.low,c.low);row.close=c.close;row.time=c.time;row.volume=(row.volume??0)+(c.volume??0);}
 previous=c.time;if(valid&&c.time+step===end){out.push({...row});row=undefined;}}
 if(!lastClosed&&out[out.length-1]?.time===candles[candles.length-1]?.time)out.pop();return out;
}
