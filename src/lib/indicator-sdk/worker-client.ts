import type {ImportedIndicator} from "./schema";
import type {CandleData,IndicatorPoint} from "../indicators";
type Result={points:IndicatorPoint[];cached:boolean;incremental:boolean};
type Reply={id:number;result?:Result;error?:string;ms:number;stats:{entries:number;points:number}};
export class IndicatorWorkerClient{
 private worker:Worker|undefined;private serial=0;private pending=new Map<number,{resolve:(value:Reply)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
 calculate(config:ImportedIndicator,bars:CandleData[]):Promise<Reply>{
 if(!this.worker){this.worker=new Worker(new URL("./calculation.worker.ts",import.meta.url),{type:"module"});this.worker.onmessage=(event:MessageEvent<Reply>)=>{const r=event.data;const p=this.pending.get(r.id);if(!p)return;clearTimeout(p.timer);this.pending.delete(r.id);if(r.error)p.reject(new Error(r.error));else p.resolve(r);};this.worker.onerror=()=>this.stop("Indicator worker failed");}
 if(bars.length>20000||this.pending.size>=4)return Promise.reject(new Error("Worker input or queue limit exceeded"));
 const id=++this.serial;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>this.stop("Indicator worker deadline exceeded"),2000);this.pending.set(id,{resolve,reject,timer});try{this.worker!.postMessage({id,config,bars});}catch(e){clearTimeout(timer);this.pending.delete(id);reject(new Error(String(e)));}});
 }
 stop(reason="Indicator worker disposed"){this.worker?.terminate();this.worker=undefined;for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error(reason));}this.pending.clear();}
}
