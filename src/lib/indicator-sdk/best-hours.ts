import type {CandleData} from "../indicators";
import {validMarketBar} from "./market-gaps";
import type {ImportedIndicator} from "./schema";
import {sessionBounds} from "./session";

export type BestHoursPeriod=1|7|15|30;
export type BestHoursConsistency="stable"|"moderate"|"high-dispersion";
export type BestHoursConfidence="provisional"|"low"|"moderate"|"high";
export interface BestHourResult {
 hour:number;startLabel:string;endLabel:string;mean:number;median:number;standardDeviation:number;
 observations:number;observedDays:number;expectedDays:number;coverage:number;
 consistency:BestHoursConsistency;confidence:BestHoursConfidence;
}
export interface BestHoursAnalysis {period:BestHoursPeriod;timezone:string;minimumObservations:number;hours:BestHourResult[];ranking:BestHourResult[];insufficient:boolean;}

const minimums:Record<BestHoursPeriod,number>={1:1,7:3,15:5,30:8};
const pad=(n:number)=>String(n).padStart(2,"0");
const mean=(values:readonly number[])=>values.reduce((sum,value)=>sum+value,0)/values.length;
type CivilParts={day:number;minute:number;second:number;year:number;month:number;date:number;hour:number};
const formatterCache=new Map<string,Intl.DateTimeFormat>();
function formatter(timezone:string){let value=formatterCache.get(timezone);if(!value){value=new Intl.DateTimeFormat("en-GB",{timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"});formatterCache.set(timezone,value);while(formatterCache.size>32)formatterCache.delete(formatterCache.keys().next().value!);}return value;}
function civilParts(timestamp:number,fmt:Intl.DateTimeFormat):CivilParts{const p=Object.fromEntries(fmt.formatToParts(new Date(timestamp*1000)).map(x=>[x.type,x.value]));const year=Number(p.year),month=Number(p.month),date=Number(p.day),hour=Number(p.hour);return {year,month,date,hour,minute:Number(p.minute),second:Number(p.second),day:Date.UTC(year,month-1,date)/86400000};}
function localParts(time:number,timezone:string){const p=civilParts(time,formatter(timezone));return {...p,dateKey:p.year+"-"+pad(p.month)+"-"+pad(p.date)};}
function civilCandidates(targetMs:number,fmt:Intl.DateTimeFormat){let guess=targetMs;for(let i=0;i<6;i++){const p=civilParts(guess/1000,fmt);const actual=Date.UTC(p.year,p.month-1,p.date,p.hour,p.minute,p.second);const delta=targetMs-actual;if(delta===0)break;guess+=delta;}const found:number[]=[];for(let offset=-180;offset<=180;offset+=30){const candidate=guess+offset*60000;const p=civilParts(candidate/1000,fmt);const actual=Date.UTC(p.year,p.month-1,p.date,p.hour,p.minute,p.second);if(actual===targetMs)found.push(candidate);}return [...new Set(found)].sort((a,b)=>a-b);}
function resolveCivil(day:number,hour:number,minute:number,second:number,fmt:Intl.DateTimeFormat,prefer:"earlier"|"later"="earlier",advanceGap=false):number|null{let target=day*86400000+hour*3600000+minute*60000+second*1000;let candidates=civilCandidates(target,fmt);if(!candidates.length&&advanceGap){for(let shift=1;shift<=180&&!candidates.length;shift++){target+=60000;candidates=civilCandidates(target,fmt);}}if(!candidates.length)return null;return (prefer==="later"?candidates[candidates.length-1]!:candidates[0]!)/1000;}
function calendarWindowStart(cutoff:number,period:BestHoursPeriod,timezone:string){const p=localParts(cutoff,timezone);return resolveCivil(p.day-period,p.hour,p.minute,p.second,formatter(timezone),"earlier",true)??cutoff-period*86400;}
function expectedDays(period:BestHoursPeriod,from:number,cutoff:number,config:ImportedIndicator){let timezone=config.timezone,open=config.open,close=config.close,days=config.days;if(config.sessionSchedule==="utc-24h"){timezone="UTC";open="00:00";close="00:00";days=[0,1,2,3,4,5,6];}const fmt=formatter(timezone),first=Math.floor(localParts(from,timezone).day)-1,last=Math.floor(localParts(cutoff-1,timezone).day);const openHour=Number(open.slice(0,2)),openMinute=Number(open.slice(3)),closeHour=Number(close.slice(0,2)),closeMinute=Number(close.slice(3));let count=0;for(let day=first;day<=last;day++){if(!days.includes(new Date(day*86400000).getUTCDay()))continue;const start=resolveCivil(day,openHour,openMinute,0,fmt,"earlier"),endDay=day+(closeHour*60+closeMinute<=openHour*60+openMinute?1:0),end=resolveCivil(endDay,closeHour,closeMinute,0,fmt,"later");if(start!==null&&end!==null&&end>start&&start<cutoff&&end>from)count++;}return Math.max(1,Math.min(period,count));}

function median(values:readonly number[]){const sorted=[...values].sort((a,b)=>a-b);const middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]!:(sorted[middle-1]!+sorted[middle]!)/2;}
function standardDeviation(values:readonly number[],average:number){return Math.sqrt(values.reduce((sum,value)=>sum+(value-average)**2,0)/values.length);}
function confidence(period:BestHoursPeriod,observations:number,minimum:number,coverage:number):BestHoursConfidence {if(period===1)return "provisional";if(observations<minimum||coverage<50)return "low";if(coverage>=80&&observations>=minimum*2)return "high";return "moderate";}

export function analyzeBestHours(candles:readonly CandleData[],config:ImportedIndicator,period:BestHoursPeriod=config.bestHoursPeriod,cutoff=Math.floor(Date.now()/1000)):BestHoursAnalysis {
 const minimum=minimums[period],from=calendarWindowStart(cutoff,period,config.timezone),expected=expectedDays(period,from,cutoff,config);
 const timestamps=new Map<number,CandleData>();for(const candle of candles)if(!timestamps.has(candle.time))timestamps.set(candle.time,candle);
 const unique=new Map<string,{hour:number;dateKey:string;amplitudes:number[]}>();
 for(const candle of timestamps.values()){
  if(candle.time<from||candle.time+3600>cutoff||!validMarketBar(candle)||candle.low<=0)continue;
  const bounds=sessionBounds(config,candle.time);if(!bounds||candle.time<bounds.start||candle.time+3600>bounds.end)continue;
  const local=localParts(candle.time,config.timezone),key=local.dateKey+":"+local.hour;
  const bucket=unique.get(key)??{hour:local.hour,dateKey:local.dateKey,amplitudes:[]};
  bucket.amplitudes.push((candle.high-candle.low)/candle.low*100);unique.set(key,bucket);
 }
 const groups=new Map<number,Array<{dateKey:string;amplitude:number}>>();
 for(const row of unique.values()){const rows=groups.get(row.hour)??[];rows.push({dateKey:row.dateKey,amplitude:mean(row.amplitudes)});groups.set(row.hour,rows);}
 const hours=[...groups].map(([hour,rows])=>{const values=rows.map(row=>row.amplitude),average=mean(values),deviation=standardDeviation(values,average),observedDays=new Set(rows.map(row=>row.dateKey)).size,coverage=Math.min(100,observedDays/expected*100),ratio=average===0?Infinity:deviation/average;return {hour,startLabel:pad(hour)+":00",endLabel:pad((hour+1)%24)+":00",mean:average,median:median(values),standardDeviation:deviation,observations:values.length,observedDays,expectedDays:expected,coverage,consistency:ratio<.3?"stable" as const:ratio<.65?"moderate" as const:"high-dispersion" as const,confidence:confidence(period,values.length,minimum,coverage)};}).sort((a,b)=>a.hour-b.hour);
 const ranking=hours.filter(row=>row.observations>=minimum).sort((a,b)=>b.mean-a.mean||b.observedDays-a.observedDays||a.hour-b.hour).slice(0,3);
 return {period,timezone:config.timezone,minimumObservations:minimum,hours,ranking,insufficient:ranking.length===0};
}

export interface BestHoursSnapshot {analysis:BestHoursAnalysis;rows:CandleData[];}
const sharedBestHours=new Map<string,{expiresAt:number;promise:Promise<BestHoursSnapshot>}>();
/** Deduplicates identical linked-chart fetches and analysis while keeping the cache bounded. */
export function loadBestHoursSnapshot(
 key:string,
 load:()=>Promise<readonly CandleData[]>,
 config:ImportedIndicator,
 period:BestHoursPeriod,
 cutoff:number,
):Promise<BestHoursSnapshot>{
 const now=Date.now(),cached=sharedBestHours.get(key);
 if(cached&&cached.expiresAt>now)return cached.promise;
 const promise=load().then(source=>{const rows=[...source];return {analysis:analyzeBestHours(rows,config,period,cutoff),rows};});
 const entry={expiresAt:now+45_000,promise};sharedBestHours.set(key,entry);
 while(sharedBestHours.size>32){const oldest=sharedBestHours.keys().next().value;if(oldest===undefined)break;sharedBestHours.delete(oldest);}
 void promise.catch(()=>{if(sharedBestHours.get(key)===entry)sharedBestHours.delete(key);});
 return promise;
}
