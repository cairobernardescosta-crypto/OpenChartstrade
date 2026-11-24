import {CalculationCache} from "./calculation-cache";
import {indicatorSchema} from "./schema";
import type {CandleData} from "../indicators";
const cache=new CalculationCache();
const port=self as unknown as {onmessage:((event:MessageEvent)=>void)|null;postMessage:(value:unknown)=>void};
port.onmessage=(event)=>{const {id,config,bars}=event.data as {id:number;config:unknown;bars:CandleData[]};try{if(!Array.isArray(bars)||bars.length>20000)throw new Error("History budget exceeded");const entry=indicatorSchema.parse(config);if(!["sma","ema","expression"].includes(entry.kind))throw new Error("Unsupported calculation");const start=performance.now();const result=cache.calculate(entry,bars);port.postMessage({id,result,ms:performance.now()-start,stats:cache.stats()});}catch(e){port.postMessage({id,error:String(e)});}};
