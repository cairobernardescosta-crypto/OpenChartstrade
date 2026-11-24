import {useSyncExternalStore} from "react";
const DB="opencharts-indicators";
let database:Promise<IDBDatabase>|undefined;
let lastError="";
let locked=false;
const listeners=new Set<()=>void>();
function notify(){listeners.forEach(fn=>fn());}
function setError(value:string){lastError=value;notify();}
export function persistenceError(){return lastError;}
export function usePersistenceError(){return useSyncExternalStore(fn=>{listeners.add(fn);return()=>{listeners.delete(fn);};},persistenceError,persistenceError);}
export function assertWritable(){if(locked)throw new Error("Backup restoration in progress");}
function openDatabase():Promise<IDBDatabase>{
 if(!database)database=new Promise((resolve,reject)=>{
  if(typeof indexedDB==="undefined"){reject(new Error("IndexedDB unavailable"));return;}
  const req=indexedDB.open(DB,1);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains("state"))req.result.createObjectStore("state");};
  req.onsuccess=()=>{const db=req.result;db.onversionchange=()=>{db.close();database=undefined;};resolve(db);};
  req.onerror=()=>reject(req.error);req.onblocked=()=>reject(new Error("IndexedDB blocked"));
 });
 return database;
}
let queue:Promise<void>=Promise.resolve();
type Envelope={format:"oc-revision-1";revision:number;value:unknown};
function envelope(raw:unknown):Envelope{if(raw&&typeof raw==="object"&&"format" in raw&&raw.format==="oc-revision-1"&&"revision" in raw&&typeof raw.revision==="number"&&"value" in raw)return raw as Envelope;return {format:"oc-revision-1",revision:0,value:raw};}
let clock=0;
function make(value:unknown):Envelope{clock=Math.max(Date.now(),clock+1);return {format:"oc-revision-1",revision:clock,value};}
function cached(key:string):Envelope|undefined{try{const raw=localStorage.getItem(key+".revision");return raw?envelope(JSON.parse(raw)):undefined;}catch{return undefined;}}
function cache(key:string,row:Envelope){try{localStorage.setItem(key+".revision",JSON.stringify(row));localStorage.setItem(key,JSON.stringify(row.value));}catch(e){setError("Recovery cache: "+String(e));}}
async function write(rows:Record<string,Envelope>){const db=await openDatabase();await new Promise<void>((resolve,reject)=>{const tx=db.transaction("state","readwrite");for(const [key,value] of Object.entries(rows))tx.objectStore("state").put(value,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
export function persistState(key:string,value:unknown){assertWritable();const row=make(value);cache(key,row);queue=queue.then(()=>write({[key]:row})).catch(e=>{setError("IndexedDB write failed: "+String(e));database=undefined;});}
export const mirrorState=persistState;
async function readRaw(key:string):Promise<unknown>{await queue;const db=await openDatabase();return new Promise((resolve,reject)=>{const req=db.transaction("state","readonly").objectStore("state").get(key);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
export async function readMirror(key:string):Promise<unknown>{return envelope(await readRaw(key)).value;}
export async function hydrateState(key:string,legacy:unknown,validate:(raw:unknown)=>unknown,apply:(raw:unknown)=>void,isCurrent:()=>boolean){
 try{const stored=envelope(await readRaw(key));const local=cached(key);clock=Math.max(clock,stored.revision,local?.revision??0);if(!isCurrent())return;
 const chosen=local&&local.revision>stored.revision?local:stored;
 const value=validate(chosen.value===undefined?legacy:chosen.value);
 if(chosen.value===undefined||chosen===local)persistState(key,value);
 if(isCurrent())apply(value);
 }catch(e){setError("IndexedDB read failed: "+String(e));database=undefined;try{const local=cached(key);if(local&&isCurrent())apply(validate(local.value));}catch{/* preserve current fallback */}}
}
export async function restoreTransaction(values:Record<string,unknown>,apply:()=>void){
 assertWritable();locked=true;
 try{await queue;const rows=Object.fromEntries(Object.entries(values).map(([key,value])=>[key,make(value)]));await write(rows);for(const [key,row] of Object.entries(rows))cache(key,row);apply();}
 catch(e){setError("Backup restore failed: "+String(e));throw e;}finally{locked=false;}
}
