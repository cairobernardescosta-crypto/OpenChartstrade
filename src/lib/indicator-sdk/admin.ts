import {useSyncExternalStore} from "react";
import {z} from "zod";
const schema=z.object({maxActive:z.number().int().min(1).max(30).default(10),maxBars:z.number().int().min(100).max(20000).default(5000),diagnostics:z.boolean().default(true)}).strict();
export type IndicatorAdmin=z.infer<typeof schema>;
const KEY="opencharts.indicator-admin.v1";
let config=schema.parse({});
try{const raw=localStorage.getItem(KEY);if(raw)config=schema.parse(JSON.parse(raw));}catch{/* defaults */}
const listeners=new Set<()=>void>();
function subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};}
const snapshot=()=>config;
export function useIndicatorAdmin(){return useSyncExternalStore(subscribe,snapshot,snapshot);}
export function saveIndicatorAdmin(next:IndicatorAdmin){const v=schema.parse(next);localStorage.setItem(KEY,JSON.stringify(v));config=v;listeners.forEach(fn=>fn());}
