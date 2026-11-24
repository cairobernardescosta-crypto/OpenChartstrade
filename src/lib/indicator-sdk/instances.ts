import {useSyncExternalStore} from "react";
import {persistState,hydrateState} from "./database";
import {indicatorSchema,type ImportedIndicator} from "./schema";
export type ChartScope="primary"|"secondary";
type Overrides=Record<ChartScope,ImportedIndicator[]>;
const KEY="opencharts.indicator-overrides.v1";
let state:Overrides={primary:[],secondary:[]};
let revision=0;
try{const raw=localStorage.getItem(KEY);if(raw){const p=JSON.parse(raw);state={primary:indicatorSchema.array().max(100).parse(p.primary),secondary:indicatorSchema.array().max(100).parse(p.secondary)};}}catch{/* invalid storage */}
const listeners=new Set<()=>void>();
function subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};}
const snapshot=()=>state;
export function useOverrides(scope:ChartScope){return useSyncExternalStore(subscribe,snapshot,snapshot)[scope];}
function commit(next:Overrides){revision++;state=next;persistState(KEY,next);listeners.forEach(f=>f());}
export function saveOverride(scope:ChartScope,entry:ImportedIndicator){const v=indicatorSchema.parse(entry);const next=[...state[scope].filter(x=>x.id!==v.id),v];if(next.length>100)throw new Error("Too many overrides");commit({...state,[scope]:next});}
export function resetOverride(scope:ChartScope,id:string){commit({...state,[scope]:state[scope].filter(x=>x.id!==id)});}
export function clearOverrides(id:string){commit({primary:state.primary.filter(x=>x.id!==id),secondary:state.secondary.filter(x=>x.id!==id)});}
export function resolveIndicator(entry:ImportedIndicator,overrides:readonly ImportedIndicator[]){return overrides.find(x=>x.id===entry.id&&x.kind===entry.kind&&x.version===entry.version)??entry;}

export function exportOverrides(){return JSON.stringify(state);}
export function restoreOverrides(source:string){if(source.length>2_000_000)throw new Error("Overrides backup too large");const raw=JSON.parse(source);commit({primary:indicatorSchema.array().max(100).parse(raw.primary),secondary:indicatorSchema.array().max(100).parse(raw.secondary)});}
function validateOverrides(raw:unknown):Overrides{if(!raw||typeof raw!=="object")throw new Error("Invalid overrides");const r=raw as Record<string,unknown>;return {primary:indicatorSchema.array().max(100).parse(r.primary),secondary:indicatorSchema.array().max(100).parse(r.secondary)};}
void hydrateState(KEY,state,validateOverrides,raw=>{state=validateOverrides(raw);listeners.forEach(f=>f());},()=>revision===0);

export function replaceChartOverrides(scope:ChartScope,values:unknown){const rows=indicatorSchema.array().max(100).parse(values);if(new Set(rows.map(x=>x.id)).size!==rows.length)throw new Error("Duplicate chart settings");commit({...state,[scope]:rows});}
