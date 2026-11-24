import { useSyncExternalStore } from "react";
import {persistState,readMirror,hydrateState,assertWritable} from "./database";
import { indicatorSchema, type ImportedIndicator } from "./schema";
import {parseRevisions,sortedRevisions,archiveRevision,type IndicatorRevision} from "./revisions";
const KEY="opencharts.indicator-library.v1";
const HISTORY=KEY+".history";
let library:ImportedIndicator[]=[];
let history:Record<string,IndicatorRevision[]>=Object.create(null) as Record<string,IndicatorRevision[]>;
let error="";
let revision=0;
try{const raw=localStorage.getItem(KEY);if(raw)library=indicatorSchema.array().max(100).parse(JSON.parse(raw));const h=localStorage.getItem(HISTORY);if(h){const value=JSON.parse(h) as Record<string,unknown>;for(const [id,rows] of Object.entries(value)){if(/^[a-z][a-z0-9-]{0,63}$/.test(id)&&id!=="constructor")history[id]=parseRevisions(rows).filter(x=>x.definition.id===id);}}}catch(e){error=String(e);}
const listeners=new Set<()=>void>();
function subscribe(fn:()=>void){listeners.add(fn);return ()=>{listeners.delete(fn);};}
export function getLibrary(){return library;}
export function useIndicatorLibrary(){return useSyncExternalStore(subscribe,getLibrary,getLibrary);}
export function getLibraryError(){return error;}
function save(next:ImportedIndicator[]){assertLibraryReady();assertWritable();revision++;library=next;persistState(KEY,next);listeners.forEach(fn=>fn());}
export function installIndicator(value:ImportedIndicator){const entry=indicatorSchema.parse(value);if(library.some(x=>x.id===entry.id))throw new Error("Indicator ID already installed");if(library.length>=100)throw new Error("Library limit reached");save([...library,entry]);}
export function updateIndicator(value:ImportedIndicator){assertLibraryReady();assertWritable();const entry=indicatorSchema.parse(value);const old=library.find(x=>x.id===entry.id);if(!old)throw new Error("Indicator not installed");const previous=Object.hasOwn(history,entry.id)?history[entry.id]!:[];const next={...history,[entry.id]:archiveRevision(old,previous)};history=next;persistState(HISTORY,next);save(library.map(x=>x.id===entry.id?entry:x));}
export function removeIndicator(id:string){assertLibraryReady();save(library.filter(x=>x.id!==id));}
export async function recoverLibraryMirror(){assertLibraryReady();const before=revision;const rows=indicatorSchema.array().max(100).parse(await readMirror(KEY));if(new Set(rows.map(x=>x.id)).size!==rows.length)throw new Error("Duplicate IDs in mirror");if(revision!==before)throw new Error("Library changed during recovery");save(rows);}
export function revisionEntries(id:string){return sortedRevisions(Object.hasOwn(history,id)?history[id]!:[]);}
export function versions(id:string){return revisionEntries(id).map(x=>x.revision.definition);}
export function restoreRevisionEntry(id:string,index:number,expected:IndicatorRevision){const row=history[id]?.[index];if(!row||row!==expected||row.definition.id!==id)throw new Error("A revisão mudou. Reabra o histórico.");updateIndicator(row.definition);}
export function duplicateIndicator(id:string){const entry=library.find(x=>x.id===id);if(!entry)throw new Error("Indicator not installed");let n=1;let next=id.slice(0,50)+"-copy-"+n;while(library.some(x=>x.id===next)){n++;next=id.slice(0,50)+"-copy-"+n;}installIndicator({...entry,id:next,name:(entry.name+" copy "+n).slice(0,80),favorite:false});}
export function exportLibrary(){return JSON.stringify({sdk:1,indicators:library,history},null,2);}
export function restoreLibrary(source:string){assertLibraryReady();assertWritable();const data=validateLibraryBackup(source);history=data.history;persistState(HISTORY,history);save(data.indicators);}

const initialRevision=revision;
function validRows(raw:unknown){const rows=indicatorSchema.array().max(100).parse(raw);if(new Set(rows.map(x=>x.id)).size!==rows.length)throw new Error("Duplicate indicator IDs");return rows;}
const libraryHydration=hydrateState(KEY,library,validRows,raw=>{library=validRows(raw);listeners.forEach(fn=>fn());},()=>revision===initialRevision);
function validHistory(raw:unknown){const result:Record<string,IndicatorRevision[]>=Object.create(null) as Record<string,IndicatorRevision[]>;if(!raw||typeof raw!=="object")throw new Error("Invalid history");for(const [id,items] of Object.entries(raw).slice(0,100)){if(/^[a-z][a-z0-9-]{0,63}$/.test(id))result[id]=parseRevisions(items).filter(x=>x.definition.id===id);}return result;}
const historyHydration=hydrateState(HISTORY,history,validHistory,raw=>{history=validHistory(raw);library=[...library];listeners.forEach(fn=>fn());},()=>revision===initialRevision);

export function installMissingDefinitions(values:unknown){assertLibraryReady();const entries=indicatorSchema.array().max(100).parse(values);if(new Set(entries.map(x=>x.id)).size!==entries.length)throw new Error("Duplicate template indicators");const missing=entries.filter(x=>!library.some(y=>y.id===x.id));if(library.length+missing.length>100)throw new Error("Library limit reached");if(missing.length)save([...library,...missing]);}

let ready=false;
export function isLibraryReady(){return ready;}
export function assertLibraryReady(){if(!ready)throw new Error("Indicator storage is loading; retry shortly");}
void Promise.all([libraryHydration,historyHydration]).finally(()=>{ready=true;library=[...library];listeners.forEach(fn=>fn());});
export function validateLibraryBackup(source:string){if(source.length>12_000_000)throw new Error("Backup too large");const raw=JSON.parse(source);if(!raw||raw.sdk!==1)throw new Error("Unsupported library backup");return {sdk:1,indicators:validRows(raw.indicators),history:validHistory(raw.history??{})};}
export function restoreVersion(id:string,index:number){const previous=versions(id)[index];if(!previous||previous.id!==id)throw new Error("Unknown revision");updateIndicator(previous);}

export function applyRestoredLibrary(data:ReturnType<typeof validateLibraryBackup>){revision++;library=data.indicators;history=data.history;listeners.forEach(fn=>fn());}

export function setIndicatorFavorite(id:string,favorite:boolean){const entry=library.find(x=>x.id===id);if(!entry)throw new Error("Indicator not installed");save(library.map(x=>x.id===id?{...x,favorite}:x));}
