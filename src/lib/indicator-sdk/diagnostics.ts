import {useSyncExternalStore} from "react";
import type {ChartScope} from "./instances";
export interface IndicatorDiagnostic {id:string;scope:ChartScope;ms:number;bars:number;error:string;failures:number;}
let rows:IndicatorDiagnostic[]=[];
const listeners=new Set<()=>void>();
const subscribe=(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};};
const snapshot=()=>rows;
export function useIndicatorDiagnostics(){return useSyncExternalStore(subscribe,snapshot,snapshot);}
export function reportIndicator(scope:ChartScope,id:string,ms:number,bars:number,error=""){
 const previous=rows.find(x=>x.id===id&&x.scope===scope);
 rows=[...rows.filter(x=>x.id!==id||x.scope!==scope),{id,scope,ms,bars,error:error.slice(0,300),failures:error?(previous?.failures??0)+1:0}].slice(-100);
 listeners.forEach(fn=>fn());
}
export function resetDiagnostics(){rows=[];listeners.forEach(fn=>fn());}
