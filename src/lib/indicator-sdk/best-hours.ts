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

function median(values:readonly number[]){const sorted=[...values].sort((a,b)=>a-b);const middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]!:(sorted[middle-1]!+sorted[middle]!)/2;}
function standardDeviation(values:readonly number[],average:number){return Math.sqrt(values.reduce((sum,value)=>sum+(value-average)**2,0)/values.length);}
function localParts(time:number,timezone:string){const formatter=new Intl.DateTimeFormat("en-CA",{timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",hourCycle:"h23"});const parts=Object.fromEntries(formatter.formatToParts(new Date(time*1000)).map(part=>[part.type,part.value]));const year=Number(parts.year),month=Number(parts.month),day=Number(parts.day),hour=Number(parts.hour);return {year,month,day,hour,date:`${year}-${pad(month)}-${pad(day)}`};}
function expectedDays(period:BestHoursPeriod,cutoff:number,config:ImportedIndicator){const days=new Set<string>();for(let offset=0;offset<period+2;offset++){const parts=localParts(cutoff-offset*86400-1,config.timezone);const weekday=new Date(Date.UTC(parts.year,parts.month-1,parts.day)).getUTCDay();if(config.days.includes(weekday))days.add(parts.date);}return Math.min(period,days.size);}
function confidence(period:BestHoursPeriod,observations:number,minimum:number,coverage:number):BestHoursConfidence {if(period===1)return "provisional";if(observations<minimum||coverage<50)return "low";if(coverage>=80&&observations>=minimum*2)return "high";return "moderate";}

export function analyzeBestHours(candles:readonly CandleData[],config:ImportedIndicator,period:BestHoursPeriod=config.bestHoursPeriod,cutoff=Math.floor(Date.now()/1000)):BestHoursAnalysis {
 const minimum=minimums[period],from=cutoff-period*86400,expected=Math.max(1,expectedDays(period,cutoff,config));
 const unique=new Map<string,{hour:number;date:string;amplitude:number}>();
 for(const candle of candles){
  if(candle.time<from||candle.time+3600>cutoff||!validMarketBar(candle)||candle.low<=0)continue;
  const bounds=sessionBounds(config,candle.time);if(!bounds||candle.time<bounds.start||candle.time+3600>bounds.end)continue;
  const local=localParts(candle.time,config.timezone);const key=`${local.date}:${local.hour}`;
  if(!unique.has(key))unique.set(key,{hour:local.hour,date:local.date,amplitude:(candle.high-candle.low)/candle.low*100});
 }
 const groups=new Map<number,Array<{date:string;amplitude:number}>>();for(const row of unique.values()){const rows=groups.get(row.hour)??[];rows.push(row);groups.set(row.hour,rows);}
 const hours=[...groups].map(([hour,rows])=>{const values=rows.map(row=>row.amplitude),average=mean(values),deviation=standardDeviation(values,average),observedDays=new Set(rows.map(row=>row.date)).size,coverage=Math.min(100,observedDays/expected*100),ratio=average===0?Infinity:deviation/average;return {hour,startLabel:`${pad(hour)}:00`,endLabel:`${pad((hour+1)%24)}:00`,mean:average,median:median(values),standardDeviation:deviation,observations:values.length,observedDays,expectedDays:expected,coverage,consistency:ratio<.3?"stable" as const:ratio<.65?"moderate" as const:"high-dispersion" as const,confidence:confidence(period,values.length,minimum,coverage)};}).sort((a,b)=>a.hour-b.hour);
 const ranking=hours.filter(row=>row.observations>=minimum).sort((a,b)=>b.mean-a.mean||b.observedDays-a.observedDays||a.hour-b.hour).slice(0,3);
 return {period,timezone:config.timezone,minimumObservations:minimum,hours,ranking,insufficient:ranking.length===0};
}
