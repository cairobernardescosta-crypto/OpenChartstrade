import {useSyncExternalStore} from "react";
import type {ChartScope} from "./instances";
import type {BestHoursAnalysis} from "./best-hours";

export interface BestHoursStatus {scope:ChartScope;symbol:string;id:string;analysis?:BestHoursAnalysis;error:string;updatedAt:number;}
let rows:BestHoursStatus[]=[];
const listeners=new Set<()=>void>();
const subscribe=(listener:()=>void)=>{listeners.add(listener);return()=>listeners.delete(listener);};
const snapshot=()=>rows;
export function useBestHoursStatuses(){return useSyncExternalStore(subscribe,snapshot,snapshot);}
export function publishBestHours(status:BestHoursStatus){rows=[...rows.filter(row=>row.scope!==status.scope||row.id!==status.id),status];listeners.forEach(listener=>listener());}
export function retainBestHours(scope:ChartScope,ids:readonly string[]){const next=rows.filter(row=>row.scope!==scope||ids.includes(row.id));if(next.length!==rows.length){rows=next;listeners.forEach(listener=>listener());}}
