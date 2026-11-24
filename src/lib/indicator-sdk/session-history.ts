import type {CandleData} from "../indicators";
import type {ImportedIndicator} from "./schema";
import {sessionBounds,sessionRange} from "./session";
import {validMarketBar} from "./market-gaps";
type Loader=(symbol:string,timeframe:string,limit:number,range:{fromMs:number;toMs:number})=>Promise<readonly CandleData[]>;
export type SessionHistory={rows:CandleData[];step:number;error:string;coveredThrough:number};
const frames=[{timeframe:"1m",step:60},{timeframe:"5m",step:300},{timeframe:"15m",step:900},{timeframe:"30m",step:1800},{timeframe:"1h",step:3600},{timeframe:"4h",step:14400},{timeframe:"1d",step:86400}];
export function sessionHistoryPlan(config:ImportedIndicator,cutoff:number,maxBars:number){
 const bounds=sessionBounds(config,cutoff);if(!bounds)return null;
 const frame=frames.find(f=>bounds.rangeStart%f.step===0&&bounds.rangeEnd%f.step===0&&Math.ceil((bounds.rangeEnd-bounds.rangeStart)/f.step)<=maxBars);
 if(!frame)return null;
 return {...frame,...bounds,through:Math.min(bounds.rangeEnd,Math.floor(cutoff/frame.step)*frame.step)};
}
export class SessionHistoryCache{
 private rows=new Map<string,{expires:number;promise:Promise<SessionHistory>}>();
 constructor(private load:Loader,private now=Date.now){}
 get(symbol:string,config:ImportedIndicator,cutoff:number,maxBars:number){
 const plan=sessionHistoryPlan(config,cutoff,maxBars);
 if(!plan)return Promise.resolve({rows:[],step:60,error:"A sessão excede o limite de histórico disponível",coveredThrough:0});
 const key=JSON.stringify([symbol,plan.timeframe,plan.rangeStart,plan.rangeEnd,plan.through,config.sessionSchedule,config.gapPolicy]);
 const cached=this.rows.get(key);if(cached&&cached.expires>this.now())return cached.promise;
 const promise=this.fetch(symbol,config,cutoff,plan).catch(e=>{this.rows.delete(key);throw e;});
 this.rows.set(key,{expires:this.now()+15000,promise});while(this.rows.size>24){const first=this.rows.keys().next().value;if(first===undefined)break;this.rows.delete(first);}return promise;
 }
 private async fetch(symbol:string,config:ImportedIndicator,cutoff:number,plan:NonNullable<ReturnType<typeof sessionHistoryPlan>>):Promise<SessionHistory>{
 const {step,timeframe,rangeStart,through}=plan;const data=new Map<number,CandleData>();
 if(through<=rangeStart)return {rows:[],step,error:"Aguardando a primeira vela fechada",coveredThrough:rangeStart};
 for(let end=through;end>rangeStart;){const start=Math.max(rangeStart,end-5000*step);const rows=await this.load(symbol,timeframe,Math.ceil((end-start)/step),{fromMs:start*1000,toMs:end*1000});for(const c of rows)if(validMarketBar(c)&&c.time%step===0&&c.time>=start&&c.time+step<=end)data.set(c.time,c);end=start;}
 const rows=[...data.values()].sort((a,b)=>a.time-b.time);
 const valid=sessionRange(rows,config,step,cutoff,true);
 return {rows:valid?rows:[],step,error:valid?"":"Histórico da sessão incompleto — faltam velas fechadas",coveredThrough:valid?through:rangeStart};
 }
}
