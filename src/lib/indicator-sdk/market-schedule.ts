import {z} from "zod";
import type {MarketDataSource} from "../../adapter/types";
import type {ImportedIndicator} from "./schema";
const time=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const schedule=z.object({timezone:z.string().max(80).refine(v=>{try{new Intl.DateTimeFormat("en",{timeZone:v});return true;}catch{return false;}}),open:time,close:time,days:z.array(z.number().int().min(0).max(6)).min(1).max(7),source:z.string().min(1).max(200),continuous:z.boolean()}).strict();
export type ResolvedMarketSchedule={config:ImportedIndicator;message:string;fallback:boolean};
export async function resolveMarketSchedule(source:MarketDataSource,symbol:string,config:ImportedIndicator,atMs:number):Promise<ResolvedMarketSchedule>{
 if(config.sessionSchedule!=="automatic")return {config,message:"",fallback:false};
 try{const raw=await source.getMarketSchedule?.(symbol,atMs);if(!raw)throw Error("Provider schedule unavailable");const value=schedule.parse(raw);if(new Set(value.days).size!==value.days.length)throw Error("Duplicate session days");return {config:{...config,sessionSchedule:value.continuous?"utc-24h":"manual",timezone:value.timezone,open:value.open,close:value.close,days:value.days,gapPolicy:value.continuous?"continuous":config.gapPolicy},message:value.source,fallback:false};}catch{return {config:{...config,sessionSchedule:"manual"},message:"Automatic schedule unavailable — manual fallback",fallback:true};}
}
