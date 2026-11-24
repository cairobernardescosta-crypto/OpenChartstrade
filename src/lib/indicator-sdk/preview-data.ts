import type {CandleData} from "../indicators";
import {validMarketBar} from "./market-gaps";
export function normalizePreviewCandles(rows:readonly CandleData[],step:number,cutoff:number,limit:number){const unique=new Map<number,CandleData>();for(const row of rows)if(validMarketBar(row)&&row.time+step<=cutoff)unique.set(row.time,row);return [...unique.values()].sort((a,b)=>a.time-b.time).slice(-limit);}
export function previewStep(tf:string){return ({"1m":60,"5m":300,"15m":900,"30m":1800,"1h":3600,"4h":14400,"1d":86400,"1w":604800} as Record<string,number>)[tf]??60;}
