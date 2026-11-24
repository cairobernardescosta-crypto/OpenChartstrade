import {useSyncExternalStore} from "react";
import {getAdapter,hasAdapter,onAdapterChange} from "../../adapter/registry";
import type {OpenChartsAdapter} from "../../adapter/types";
import type {ImportedIndicator} from "./schema";
const current=()=>hasAdapter()?getAdapter():null;
const subscribe=(listener:()=>void)=>onAdapterChange(()=>listener());
export function useMarketAdapter(){return useSyncExternalStore(subscribe,current,()=>null);}
export function providerLabel(adapter:Pick<OpenChartsAdapter,"name">|null){return !adapter?"Provedor indisponível":adapter.name==="demo"?"Demonstração · histórico e simulação":adapter.name==="hyperliquid"?"Hyperliquid":adapter.name||"Adaptador sem identificação";}
export type DataPath="chart"|"independent"|"provider"|"sample";
export function configuredPath(config:ImportedIndicator):DataPath{return config.kind!=="graphics"&&config.historySource==="independent"&&(config.kind==="session-candle"||config.aggregation!==0)?"independent":"chart";}
export function dataPathLabel(path:DataPath,replay=false){if(path==="sample")return "Amostra ilustrativa · dados sintéticos";return (replay?"Replay · ":"")+(path==="chart"?"Velas do gráfico":path==="independent"?"Histórico independente":"Consulta ao provedor");}
export function resolutionLabel(seconds:number){return seconds===604800?"1 semana":seconds===86400?"1 dia":seconds%3600===0?seconds/3600+" h":seconds/60+" min";}

const adapterIds=new WeakMap<OpenChartsAdapter,number>();let nextAdapterId=0;
export function adapterIdentity(adapter:OpenChartsAdapter|null){if(!adapter)return 0;let id=adapterIds.get(adapter);if(id===undefined){id=++nextAdapterId;adapterIds.set(adapter,id);}return id;}
