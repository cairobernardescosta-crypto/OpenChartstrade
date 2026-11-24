// IndexedDB is the durable primary store; localStorage is a recovery cache.
const DB="opencharts-indicators";
let database:Promise<IDBDatabase>|undefined;
let lastError="";
export function persistenceError(){return lastError;}
function openDatabase():Promise<IDBDatabase>{
 if(!database)database=new Promise((resolve,reject)=>{
  if(typeof indexedDB==="undefined"){reject(new Error("IndexedDB unavailable"));return;}
  const req=indexedDB.open(DB,1);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains("state"))req.result.createObjectStore("state");};
  req.onsuccess=()=>{const db=req.result;db.onversionchange=()=>{db.close();database=undefined;};resolve(db);};
  req.onerror=()=>reject(req.error);
  req.onblocked=()=>reject(new Error("IndexedDB blocked"));
 });
 return database;
}
let queue:Promise<void>=Promise.resolve();
export function persistState(key:string,value:unknown){
 // Cache writes are best effort; a quota failure must not block IndexedDB.
 try{localStorage.setItem(key,JSON.stringify(value));}catch(e){lastError=String(e);}
 queue=queue.then(async()=>{
  const db=await openDatabase();
  await new Promise<void>((resolve,reject)=>{
   const tx=db.transaction("state","readwrite");
   tx.objectStore("state").put(value,key);
   tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
  lastError="";
 }).catch(e=>{lastError=String(e);database=undefined;});
}
export const mirrorState=persistState;
export async function readMirror(key:string):Promise<unknown>{
 await queue;
 const db=await openDatabase();
 return new Promise((resolve,reject)=>{
  const req=db.transaction("state","readonly").objectStore("state").get(key);
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
 });
}
// Migrate only if the new canonical record does not exist. Never overwrite it
// with a stale legacy mirror on startup.
export async function hydrateState(key:string,legacy:unknown,validate:(raw:unknown)=>unknown,apply:(raw:unknown)=>void,isCurrent:()=>boolean){
 try{
  let raw=await readMirror(key);
  if(!isCurrent())return;
  if(raw===undefined){raw=validate(legacy);persistState(key,raw);}
  else raw=validate(raw);
  if(isCurrent())apply(raw);
 }catch(e){lastError=String(e);database=undefined;}
}
