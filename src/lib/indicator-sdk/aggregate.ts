import type {CandleData} from "../indicators";
import {missingOpenBars,validMarketBar,type MarketGapPolicy} from "./market-gaps";
export const aggregationMinutes=[0,15,30,60,120,240,360,720,1440,10080,43200] as const;
export function calendarPeriodEnd(time:number,minutes:number,sourceSeconds:number){if(minutes===43200){const d=new Date(time*1000);return Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1)/1000;}if(minutes===10080){const span=604800,shift=345600;return Math.floor((time-shift)/span)*span+shift+span;}return time+sourceSeconds;}
// Only fully covered open-market intervals are published. No synthetic candles.
export function aggregateCompleted(candles:readonly CandleData[],minutes:number,sourceSeconds:number,lastClosed=false,policy:MarketGapPolicy="continuous",closedThrough?:number):CandleData[]{
 if(minutes===0)return [...candles];if(!aggregationMinutes.some(x=>x===minutes))return [];
 const span=minutes*60;
 if(!Number.isInteger(sourceSeconds)||sourceSeconds<=0||(minutes===43200?86400%sourceSeconds!==0:span<sourceSeconds||span%sourceSeconds!==0))return [];
 const last=candles[candles.length-1];const cutoff=closedThrough??(last?last.time+(lastClosed?sourceSeconds:0):0);
 const out:CandleData[]=[];let row:CandleData|undefined;let start=0,end=0,expected=0,valid=false;
 const flush=()=>{if(row&&valid&&end<=cutoff&&missingOpenBars(expected,end,sourceSeconds,policy)===0)out.push({...row});};
 for(const c of candles){
  const d=new Date(c.time*1000);const shift=minutes===10080?345600:0;
  const key=minutes===43200?Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1)/1000:Math.floor((c.time-shift)/span)*span+shift;
  const boundary=minutes===43200?Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1)/1000:key+span;
  if(!row||key!==start){flush();start=key;end=boundary;row={...c};valid=validMarketBar(c)&&missingOpenBars(start,c.time,sourceSeconds,policy)===0;}
  else{valid=valid&&validMarketBar(c)&&missingOpenBars(expected,c.time,sourceSeconds,policy)===0;row.high=Math.max(row.high,c.high);row.low=Math.min(row.low,c.low);row.close=c.close;row.time=c.time;row.volume=(row.volume??0)+(c.volume??0);}
  expected=c.time+sourceSeconds;
 }
 flush();return out;
}
