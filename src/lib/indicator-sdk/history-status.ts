import {useSyncExternalStore} from "react";
import type {ChartScope} from "./instances";
export type HistoryPhase="loading"|"refreshing"|"ready"|"empty"|"error"|"limited";
export type HistoryStatus={id:string;scope:ChartScope;symbol:string;phase:HistoryPhase;bars:number;message:string;updatedAt:number};
let rows:HistoryStatus[]=[];
const listeners=new Set<()=>void>();
const notify=()=>listeners.forEach(f=>f());
const subscribe=(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};};
const snapshot=()=>rows;
export function useHistoryStatuses(){return useSyncExternalStore(subscribe,snapshot,snapshot);}
export function publishHistory(scope:ChartScope,symbol:string,id:string,phase:HistoryPhase,bars=0,message=""){
 const old=rows.find(r=>r.scope===scope&&r.id===id);
 if(old&&old.symbol===symbol&&old.phase===phase&&old.bars===bars&&old.message===message)return;
 rows=[...rows.filter(r=>r.scope!==scope||r.id!==id),{scope,symbol,id,phase,bars,message,updatedAt:Date.now()}];notify();
}
export function retainHistoryStatuses(scope:ChartScope,ids:readonly string[]){const next=rows.filter(r=>r.scope!==scope||ids.includes(r.id));if(next.length!==rows.length){rows=next;notify();}}
export function historyPhase(bars:number,error=""):HistoryPhase{return error?"error":bars>0?"ready":"empty";}
export function historyStatusLabel(phase:HistoryPhase){return {loading:"Carregando histórico…",refreshing:"Atualizando histórico…",ready:"Histórico disponível",empty:"Sem velas disponíveis",error:"Falha no histórico",limited:"Limite de histórico atingido"}[phase];}
