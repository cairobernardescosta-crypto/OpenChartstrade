import {indicatorSchema,type ImportedIndicator} from "./schema";
import {resolveIndicator} from "./instances";
export function buildTemplateSnapshot(library:readonly ImportedIndicator[],overrides:readonly ImportedIndicator[],active:readonly string[]){
 const definitions=library.filter(x=>active.includes("custom:"+x.id));
 return {importedDefinitions:definitions,importedOverrides:definitions.map(x=>resolveIndicator(x,overrides))};
}
export function prepareTemplateSnapshot(library:readonly ImportedIndicator[],definitionsRaw:unknown,settingsRaw:unknown,active:readonly string[]){
 const definitions=indicatorSchema.array().max(100).parse(definitionsRaw??[]);
 const settings=indicatorSchema.array().max(100).parse(settingsRaw??[]);
 for(const rows of [definitions,settings])if(new Set(rows.map(x=>x.id)).size!==rows.length)throw new Error("Duplicate template indicator IDs");
 const missing=definitions.filter(x=>!library.some(y=>y.id===x.id));
 if(library.length+missing.length>100)throw new Error("Library limit reached");
 const available=[...library,...missing];
 const overrides:ImportedIndicator[]=[];
 for(const id of new Set(active.filter(x=>x.startsWith("custom:")).map(x=>x.slice(7)))){
  const installed=available.find(x=>x.id===id);
  if(!installed)continue;
  const definition=definitions.find(x=>x.id===id);
  const setting=settings.find(x=>x.id===id);
  const snapshot=setting&&(!definition||setting.version===definition.version&&setting.kind===definition.kind)?setting:definition;
  if(snapshot){
   // Keep the global library unchanged; use a chart-local validated snapshot.
   overrides.push({...snapshot,version:installed.version,kind:installed.kind===snapshot.kind?installed.kind:snapshot.kind});
  }
 }
 return {missing,available,overrides};
}
