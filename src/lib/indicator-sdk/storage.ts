import { useSyncExternalStore } from "react";
import {persistState,readMirror,hydrateState} from "./database";
import { indicatorSchema, type ImportedIndicator } from "./schema";
const KEY="opencharts.indicator-library.v1";
const HISTORY=KEY+".history";
let library:ImportedIndicator[]=[];
let history:Record<string,ImportedIndicator[]>=Object.create(null) as Record<string,ImportedIndicator[]>;
let error="";
let revision=0;
try{const raw=localStorage.getItem(KEY);if(raw)library=indicatorSchema.array().max(100).parse(JSON.parse(raw));const h=localStorage.getItem(HISTORY);if(h){const value=JSON.parse(h) as Record<string,unknown>;for(const [id,rows] of Object.entries(value)){if(/^[a-z][a-z0-9-]{0,63}$/.test(id)&&id!=="constructor")history[id]=indicatorSchema.array().max(5).parse(rows);}}}catch(e){error=String(e);}
const listeners=new Set<()=>void>();
function subscribe(fn:()=>void){listeners.add(fn);return ()=>{listeners.delete(fn);};}
export function getLibrary(){return library;}
export function useIndicatorLibrary(){return useSyncExternalStore(subscribe,getLibrary,getLibrary);}
export function getLibraryError(){return error;}
function save(next:ImportedIndicator[]){revision++;library=next;persistState(KEY,next);listeners.forEach(fn=>fn());}
export function installIndicator(value:ImportedIndicator){const entry=indicatorSchema.parse(value);if(library.some(x=>x.id===entry.id))throw new Error("Indicator ID already installed");if(library.length>=100)throw new Error("Library limit reached");save([...library,entry]);}
export function updateIndicator(value:ImportedIndicator){const entry=indicatorSchema.parse(value);const old=library.find(x=>x.id===entry.id);if(!old)throw new Error("Indicator not installed");const previous=Object.hasOwn(history,entry.id)?history[entry.id]!:[];const next={...history,[entry.id]:[old,...previous].slice(0,5)};history=next;persistState(HISTORY,next);save(library.map(x=>x.id===entry.id?entry:x));}
export function removeIndicator(id:string){save(library.filter(x=>x.id!==id));}
export async function recoverLibraryMirror(){const rows=indicatorSchema.array().max(100).parse(await readMirror(KEY));if(new Set(rows.map(x=>x.id)).size!==rows.length)throw new Error("Duplicate IDs in mirror");save(rows);}
export function versions(id:string){return Object.hasOwn(history,id)?history[id]!:[];}
export function duplicateIndicator(id:string){const entry=library.find(x=>x.id===id);if(!entry)throw new Error("Indicator not installed");let n=1;let next=id.slice(0,50)+"-copy-"+n;while(library.some(x=>x.id===next)){n++;next=id.slice(0,50)+"-copy-"+n;}installIndicator({...entry,id:next,name:(entry.name+" copy "+n).slice(0,80),favorite:false});}
export function exportLibrary(){return JSON.stringify({sdk:1,indicators:library,history},null,2);}
export function restoreLibrary(source:string){if(source.length>2_000_000)throw new Error("Backup too large");const raw=JSON.parse(source) as {sdk?:unknown;indicators?:unknown;history?:unknown};if(raw.sdk!==1)throw new Error("Unsupported backup");const rows=indicatorSchema.array().max(100).parse(raw.indicators);if(new Set(rows.map(x=>x.id)).size!==rows.length)throw new Error("Duplicate IDs");const nextHistory:Record<string,ImportedIndicator[]>=Object.create(null) as Record<string,ImportedIndicator[]>;if(raw.history&&typeof raw.history==="object"){for(const [id,items] of Object.entries(raw.history)){if(rows.some(x=>x.id===id))nextHistory[id]=indicatorSchema.array().max(5).parse(items);}}save(rows);history=nextHistory;persistState(HISTORY,nextHistory);}

const initialRevision=revision;
function validRows(raw:unknown){const rows=indicatorSchema.array().max(100).parse(raw);if(new Set(rows.map(x=>x.id)).size!==rows.length)throw new Error("Duplicate indicator IDs");return rows;}
void hydrateState(KEY,library,validRows,raw=>{library=validRows(raw);listeners.forEach(fn=>fn());},()=>revision===initialRevision);
function validHistory(raw:unknown){const result:Record<string,ImportedIndicator[]>=Object.create(null) as Record<string,ImportedIndicator[]>;if(!raw||typeof raw!=="object")throw new Error("Invalid history");for(const [id,items] of Object.entries(raw).slice(0,100)){if(/^[a-z][a-z0-9-]{0,63}$/.test(id))result[id]=indicatorSchema.array().max(5).parse(items).filter(x=>x.id===id);}return result;}
void hydrateState(HISTORY,history,validHistory,raw=>{history=validHistory(raw);library=[...library];listeners.forEach(fn=>fn());},()=>revision===initialRevision);

export function installMissingDefinitions(values:unknown){const entries=indicatorSchema.array().max(100).parse(values);if(new Set(entries.map(x=>x.id)).size!==entries.length)throw new Error("Duplicate template indicators");const missing=entries.filter(x=>!library.some(y=>y.id===x.id));if(library.length+missing.length>100)throw new Error("Library limit reached");if(missing.length)save([...library,...missing]);}
