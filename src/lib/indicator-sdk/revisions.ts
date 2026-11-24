import {z} from "zod";
import {indicatorSchema,type ImportedIndicator} from "./schema";
export type IndicatorRevision={definition:ImportedIndicator;archivedAt:number|null};
const revisionSchema=z.object({definition:indicatorSchema,archivedAt:z.number().int().min(0).max(8640000000000000).nullable()}).strict();
export function parseRevisions(raw:unknown):IndicatorRevision[]{return z.array(z.union([revisionSchema,indicatorSchema.transform(definition=>({definition,archivedAt:null}))])).max(20).parse(raw);}
export function sortedRevisions(rows:readonly IndicatorRevision[]){return rows.map((revision,index)=>({revision,index})).sort((a,b)=>(b.revision.archivedAt??-1)-(a.revision.archivedAt??-1)||a.index-b.index);}
export function archiveRevision(definition:ImportedIndicator,rows:readonly IndicatorRevision[],now=Date.now()){return [{definition,archivedAt:now},...sortedRevisions(rows).map(x=>x.revision)].slice(0,20);}
