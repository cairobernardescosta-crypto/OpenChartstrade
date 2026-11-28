import type { CandleData } from "../indicators";
import type { ImportedIndicator } from "./schema";
import {missingOpenBars,validMarketBar} from "./market-gaps";

export interface SessionRange {
  start: number; end: number; open: number; high: number; low: number; close: number;
  highTime: number; lowTime: number;
  sessionStart?:number; sessionEnd?:number; closed?:boolean;
}

// Convert a civil minute to UTC, respecting IANA zone offsets. Reject nonexistent
// local times rather than silently moving a session boundary.
function civilTime(day:number,minute:number,fmt:Intl.DateTimeFormat,prefer:"earlier"|"later"="earlier"):number|null {
  const target=day*86400000+minute*60000;let guess=target;
  for(let i=0;i<6;i++){const p=parts(guess,fmt),actual=p.day*86400000+p.minute*60000,delta=target-actual;if(delta===0)break;guess+=delta;}
  const candidates:number[]=[];
  for(let offset=-180;offset<=180;offset+=30){const candidate=guess+offset*60000,p=parts(candidate,fmt);if(p.day*86400000+p.minute*60000===target)candidates.push(candidate);}
  if(!candidates.length)return null;
  return (prefer==="later"?Math.max(...candidates):Math.min(...candidates))/1000;
}
function parts(ms: number, fmt: Intl.DateTimeFormat) {
  const p = Object.fromEntries(fmt.formatToParts(new Date(ms)).map(x => [x.type, x.value]));
  return { day: Date.UTC(Number(p.year), Number(p.month)-1, Number(p.day))/86400000,
    minute: Number(p.hour)*60+Number(p.minute) };
}
const minutes = (s: string) => Number(s.slice(0,2))*60+Number(s.slice(3));

export function sessionBounds(config:ImportedIndicator,cursor:number){
  if(!Number.isFinite(cursor))return null;
  if(config.sessionSchedule==="utc-24h")config={...config,timezone:"UTC",open:"00:00",close:"00:00",days:[0,1,2,3,4,5,6]};
  const fmt = new Intl.DateTimeFormat("en-GB", {timeZone:config.timezone, year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
  const now = parts(cursor*1000, fmt);
  const o = minutes(config.open), c = minutes(config.close);
  let day = now.day - (now.minute < o ? 1 : 0);
  const calendar=config.sessionMinutes==="week"||config.sessionMinutes==="month";
  // Keep the last eligible session frozen through non-trading days.
  if(!calendar){let eligible=false;for(let i=0;i<7;i++,day--){if(config.days.includes(new Date(day*86400000).getUTCDay())){eligible=true;break;}}if(!eligible)return null;}
  let endDay=day+(c<=o?1:0);
  if(config.sessionMinutes==="week"){const weekday=new Date(day*86400000).getUTCDay();day-=(weekday+6)%7;endDay=day+7;}else if(config.sessionMinutes==="month"){const date=new Date(day*86400000);day=Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),1)/86400000;endDay=Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,1)/86400000;}
  const start = civilTime(day,o,fmt,"earlier"), end = civilTime(endDay,calendar?o:c,fmt,"later");
  if (start === null || end === null || end<=start) return null;
  const duration=config.sessionMinutes==="session"||calendar?0:Number(config.sessionMinutes)*60;
  const segment=duration?Math.max(0,Math.floor((Math.min(cursor,end-1)-start)/duration)):0;
  const rangeStart=start+segment*duration;
  const rangeEnd=duration?Math.min(end,rangeStart+duration):end;
  return {start,end,rangeStart,rangeEnd};
}

export function sessionRange(candles:readonly CandleData[],config:ImportedIndicator,sourceSeconds?:number,clockSeconds?:number,closedOnly=false):SessionRange|null{
  const last=candles[candles.length-1];if(!last)return null;
  const cursor=clockSeconds??last.time;
  const bounds=sessionBounds(config,cursor);if(!bounds)return null;
  const {start,end,rangeStart,rangeEnd}=bounds;
  if(sourceSeconds!==undefined&&(!Number.isInteger(sourceSeconds)||sourceSeconds<=0))return null;
  const calendar=config.sessionMinutes==="week"||config.sessionMinutes==="month";
  const policy=config.sessionSchedule==="utc-24h"?"continuous":config.gapPolicy;
  const firstComplete=sourceSeconds===undefined?rangeStart:Math.ceil(rangeStart/sourceSeconds)*sourceSeconds;
  const sessionThrough=sourceSeconds===undefined?rangeEnd:Math.floor(rangeEnd/sourceSeconds)*sourceSeconds;
  if(sourceSeconds!==undefined&&firstComplete>=rangeEnd)return null;
  let expected=firstComplete;
  let out: SessionRange | null = null;
  for (const bar of candles) {
    if (bar.time < firstComplete || bar.time >= rangeEnd || bar.time>cursor || (sourceSeconds!==undefined&&bar.time+sourceSeconds>rangeEnd) || (closedOnly&&sourceSeconds!==undefined&&bar.time+sourceSeconds>cursor)) continue;
    if (!validMarketBar(bar)){if(sourceSeconds!==undefined)return null;continue;}
    if(sourceSeconds!==undefined){if(bar.time!==expected&&(!calendar||missingOpenBars(expected,bar.time,sourceSeconds,policy)!==0))return null;expected=bar.time+sourceSeconds;}
    if (!out) out = {start:rangeStart,end:rangeEnd,open:bar.open,high:bar.high,low:bar.low,close:bar.close,highTime:bar.time,lowTime:bar.time};
    else {
      if (bar.high>out.high) {out.high=bar.high;out.highTime=bar.time;}
      if (bar.low<out.low) {out.low=bar.low;out.lowTime=bar.time;}
      out.close=bar.close;
    }
  }
  if(out&&sourceSeconds!==undefined&&(cursor>=rangeEnd||closedOnly)){const through=Math.min(sessionThrough,Math.floor(cursor/sourceSeconds)*sourceSeconds);if(expected!==through&&(!calendar||missingOpenBars(expected,through,sourceSeconds,policy)!==0))return null;}
  if(out){out.sessionStart=start;out.sessionEnd=end;out.closed=cursor>=rangeEnd;}
  return out;
}

export function sessionPeriodLabel(config:Pick<ImportedIndicator,"sessionMinutes">){const n=Number(config.sessionMinutes);return config.sessionMinutes==="week"?"1W":config.sessionMinutes==="month"?"1M":config.sessionMinutes==="session"?"1D":n<60?n+"m":n/60+"H";}
export function projectedCandleX(lastX:number,step:number,offset:number,width:number,viewport:number,closeX:number|null){const limit=Math.min(viewport-width/2-5,closeX===null?Infinity:closeX-width/2-2);const x=Math.min(lastX+step*offset,limit);return x>lastX+width/2?x:null;}
