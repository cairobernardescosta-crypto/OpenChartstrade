// IndexedDB persistence mirror with a synchronous compatibility cache.
// The cache remains authoritative when storage is unavailable or a mirror write fails.
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
export function mirrorState(key:string,value:unknown){
  queue=queue.then(async()=>{
    const db=await openDatabase();
    await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction("state","readwrite");
      tx.objectStore("state").put(value,key);
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error);
      tx.onabort=()=>reject(tx.error);
    });
    lastError="";
  }).catch(e=>{lastError=String(e);database=undefined;});
}
export async function readMirror(key:string):Promise<unknown>{
  await queue;
  const db=await openDatabase();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction("state","readonly");
    const req=tx.objectStore("state").get(key);
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
