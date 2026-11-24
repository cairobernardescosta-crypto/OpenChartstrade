import {exportLibrary,applyRestoredLibrary,validateLibraryBackup,assertLibraryReady} from "./storage";
import {exportOverrides,applyRestoredOverrides,validateOverrides,assertOverridesReady} from "./instances";
import {adminSchema,getIndicatorAdmin,applyRestoredAdmin} from "./admin";
import {restoreTransaction} from "./database";
import {api} from "../../services/api";
import {chartTemplatesApi} from "../../services/api/chart-templates";
import {drawingGroupsSchema,templatesBackupSchema} from "./chart-backup-schema";
export const MAX_BACKUP_SIZE=16_000_000;
export function exportIndicatorBackup(){assertLibraryReady();assertOverridesReady();return JSON.stringify({format:"opencharts-indicators",version:1,library:JSON.parse(exportLibrary()),overrides:JSON.parse(exportOverrides()),admin:getIndicatorAdmin()},null,2);}
export async function exportWorkspaceBackup(){const base=JSON.parse(exportIndicatorBackup());const result=JSON.stringify({...base,version:2,templates:chartTemplatesApi.exportAll(),drawings:await api.chartDrawings.exportAll()},null,2);if(result.length>MAX_BACKUP_SIZE)throw new Error("Backup too large");return result;}
export function validateIndicatorBackup(source:string){
 if(source.length>MAX_BACKUP_SIZE)throw new Error("Backup too large");
 const raw=JSON.parse(source);if(!raw||raw.format!=="opencharts-indicators"||(raw.version!==1&&raw.version!==2))throw new Error("Unsupported backup format");
 const library=validateLibraryBackup(JSON.stringify(raw.library));
 const overrides=validateOverrides(raw.overrides);
 const admin=adminSchema.parse(raw.admin);
 return {library,overrides,admin,templates:raw.version===2?templatesBackupSchema.parse(raw.templates):undefined,drawings:raw.version===2?drawingGroupsSchema.parse(raw.drawings):undefined};
}
export async function restoreIndicatorBackup(source:string){
 assertLibraryReady();assertOverridesReady();
 const data=validateIndicatorBackup(source);
 // Validate every section before mutating any store. Native adapter storage has no transaction API; compensate on failure.
 let undoDrawings:(()=>Promise<void>)|undefined;let undoTemplates:(()=>void)|undefined;
 try{if(data.drawings)undoDrawings=await api.chartDrawings.importAll(data.drawings);if(data.templates)undoTemplates=chartTemplatesApi.importAll(data.templates);
 await restoreTransaction({"opencharts.indicator-library.v1":data.library.indicators,"opencharts.indicator-library.v1.history":data.library.history,"opencharts.indicator-overrides.v1":data.overrides,"opencharts.indicator-admin.v1":data.admin},()=>{applyRestoredLibrary(data.library);applyRestoredOverrides(data.overrides);applyRestoredAdmin(data.admin);});
 }catch(e){const rollbackErrors:unknown[]=[];try{undoTemplates?.();}catch(error){rollbackErrors.push(error);}try{await undoDrawings?.();}catch(error){rollbackErrors.push(error);}if(rollbackErrors.length)throw new Error("Restore failed and rollback incomplete: "+String(e));throw e; }
}
