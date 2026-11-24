import {useSyncExternalStore} from "react";
import {z} from "zod";
import {persistState,hydrateState} from "./database";
export const adminSchema=z.object({maxActive:z.number().int().min(1).max(30).default(10),maxBars:z.number().int().min(100).max(20000).default(5000),diagnostics:z.boolean().default(true)}).strict();
export type IndicatorAdmin=z.infer<typeof schema>;
const KEY="opencharts.indicator-admin.v1";
let config=adminSchema.parse({});
let revision=0;
try{const raw=localStorage.getItem(KEY);if(raw)config=adminSchema.parse(JSON.parse(raw));}catch{/* defaults */}
const listeners=new Set<()=>void>();
function subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};}
const snapshot=()=>config;
export function useIndicatorAdmin(){return useSyncExternalStore(subscribe,snapshot,snapshot);}
export function saveIndicatorAdmin(next:IndicatorAdmin){const v=adminSchema.parse(next);revision++;persistState(KEY,v);config=v;listeners.forEach(fn=>fn());}

void hydrateState(KEY,config,raw=>adminSchema.parse(raw),raw=>{config=adminSchema.parse(raw);listeners.forEach(fn=>fn());},()=>revision===0);

export function getIndicatorAdmin(){return config;}
