import {useSyncExternalStore} from "react";
import {indicatorSchema,type ImportedIndicator} from "./schema";
export type ChartScope="primary"|"secondary";
type Overrides=Record<ChartScope,ImportedIndicator[]>;
const KEY="opencharts.indicator-overrides.v1";
let state:Overrides={primary:[],secondary:[]};
try{const raw=localStorage.getItem(KEY);if(raw){const p=JSON.parse(raw);state={primary:indicatorSchema.array().max(100).parse(p.primary),secondary:indicatorSchema.array().max(100).parse(p.secondary)};}}catch{/* invalid storage */}
const listeners=new Set<()=>void>();
function subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};}
const snapshot=()=>state;
export function useOverrides(scope:ChartScope){return useSyncExternalStore(subscribe,snapshot,snapshot)[scope];}
function commit(next:Overrides){localStorage.setItem(KEY,JSON.stringify(next));state=next;listeners.forEach(f=>f());}
export function saveOverride(scope:ChartScope,entry:ImportedIndicator){const v=indicatorSchema.parse(entry);const next=[...state[scope].filter(x=>x.id!==v.id),v];if(next.length>100)throw new Error("Too many overrides");commit({...state,[scope]:next});}
export function resetOverride(scope:ChartScope,id:string){commit({...state,[scope]:state[scope].filter(x=>x.id!==id)});}
export function clearOverrides(id:string){commit({primary:state.primary.filter(x=>x.id!==id),secondary:state.secondary.filter(x=>x.id!==id)});}
export function resolveIndicator(entry:ImportedIndicator,overrides:readonly ImportedIndicator[]){return overrides.find(x=>x.id===entry.id&&x.kind===entry.kind&&x.version===entry.version)??entry;}
