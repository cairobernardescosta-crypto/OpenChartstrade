import {useSyncExternalStore} from "react";
import {persistState,hydrateState,assertWritable} from "./database";
import {indicatorSchema,type ImportedIndicator} from "./schema";
export type ChartScope="primary"|"secondary";
export type OverrideScope=ChartScope|"linked";
export type Overrides=Record<OverrideScope,ImportedIndicator[]>;
const KEY="opencharts.indicator-overrides.v1";
let state:Overrides={primary:[],secondary:[],linked:[]};
let revision=0;
try{const raw=localStorage.getItem(KEY);if(raw){const p=JSON.parse(raw);state={primary:indicatorSchema.array().max(100).parse(p.primary),secondary:indicatorSchema.array().max(100).parse(p.secondary),linked:indicatorSchema.array().max(100).parse(p.linked??[])};}}catch{/* invalid storage */}
const listeners=new Set<()=>void>();
function subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};}
const snapshot=()=>state;
export function useOverrides(scope:OverrideScope){return useSyncExternalStore(subscribe,snapshot,snapshot)[scope];}
function commit(next:Overrides){assertOverridesReady();assertWritable();revision++;state=next;persistState(KEY,next);listeners.forEach(f=>f());}
export function saveOverride(scope:OverrideScope,entry:ImportedIndicator){const v=indicatorSchema.parse(entry);const next=[...state[scope].filter(x=>x.id!==v.id),v];if(next.length>100)throw new Error("Too many overrides");commit({...state,[scope]:next});}
export function resetOverride(scope:OverrideScope,id:string){commit({...state,[scope]:state[scope].filter(x=>x.id!==id)});}
export function clearOverrides(id:string){commit({primary:state.primary.filter(x=>x.id!==id),secondary:state.secondary.filter(x=>x.id!==id),linked:state.linked.filter(x=>x.id!==id)});}
export function resolveIndicator(entry:ImportedIndicator,overrides:readonly ImportedIndicator[]){return overrides.find(x=>x.id===entry.id&&(x.snapshotBaseVersion??x.version)===entry.version)??entry;}

export function exportOverrides(){return JSON.stringify(state);}
export function restoreOverrides(source:string){if(source.length>16_000_000)throw new Error("Overrides backup too large");commit(validateOverrides(JSON.parse(source)));}
export function validateOverrides(raw:unknown):Overrides{if(!raw||typeof raw!=="object")throw new Error("Invalid overrides");const r=raw as Record<string,unknown>;const primary=indicatorSchema.array().max(100).parse(r.primary),secondary=indicatorSchema.array().max(100).parse(r.secondary),linked=indicatorSchema.array().max(100).parse(r.linked??[]);for(const rows of [primary,secondary,linked])if(new Set(rows.map(x=>x.id)).size!==rows.length)throw new Error("Duplicate chart settings");return {primary,secondary,linked};}
const hydration=hydrateState(KEY,state,validateOverrides,raw=>{state=validateOverrides(raw);listeners.forEach(f=>f());},()=>revision===0);

export function replaceChartOverrides(scope:OverrideScope,values:unknown){const rows=indicatorSchema.array().max(100).parse(values);if(new Set(rows.map(x=>x.id)).size!==rows.length)throw new Error("Duplicate chart settings");commit({...state,[scope]:rows});}

let ready=false;
export function assertOverridesReady(){if(!ready)throw new Error("Chart settings are loading; retry shortly");}
void hydration.finally(()=>{ready=true;state={...state};listeners.forEach(fn=>fn());});

export function applyRestoredOverrides(data:ReturnType<typeof validateOverrides>){revision++;state=data;listeners.forEach(fn=>fn());}

/** Copies the selected chart settings into the isolated linked scope. The original chart scopes are never modified. */
export function linkedOverridesFrom(source:ChartScope,overrides:Overrides=state):ImportedIndicator[]{return overrides[source].map(entry=>({...entry,parameters:entry.parameters.map(parameter=>({...parameter})),graphics:entry.graphics.map(graphic=>({...graphic}))}));}
export async function syncLinkedOverrides(source:ChartScope){await hydration;commit({...state,linked:linkedOverridesFrom(source)});}
