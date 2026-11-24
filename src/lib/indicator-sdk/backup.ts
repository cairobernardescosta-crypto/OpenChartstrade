import {exportLibrary,applyRestoredLibrary,validateLibraryBackup,assertLibraryReady} from "./storage";
import {exportOverrides,applyRestoredOverrides,validateOverrides,assertOverridesReady} from "./instances";
import {adminSchema,getIndicatorAdmin,applyRestoredAdmin} from "./admin";
import {restoreTransaction} from "./database";
import {api} from "../../services/api";
import {chartTemplatesApi} from "../../services/api/chart-templates";
import {safeStorage} from "../safe-storage";
import {drawingGroupsSchema,templatesBackupSchema,workspacePreferencesSchema} from "./chart-backup-schema";
export const MAX_BACKUP_SIZE=16_000_000;
const SAFE_KEYS=new Set(["trader_prefs","watchlist_favorites","opencharts.sound-settings.v1","theme","tvEconCalendar"]);
const SAFE_PREFIXES=["trader_prefs:","opencharts.workspace.","opencharts.persistence."];
export function isWorkspacePreferenceKey(key:string){return SAFE_KEYS.has(key)||SAFE_PREFIXES.some(prefix=>key.startsWith(prefix));}
export function exportWorkspacePreferences(){const rows:Record<string,string>={};if(typeof localStorage==="undefined")return rows;for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(!key||!isWorkspacePreferenceKey(key))continue;const value=safeStorage.getItem(key);if(value!==null)rows[key]=value;}return workspacePreferencesSchema.parse(rows);}
export function restoreWorkspacePreferences(raw:unknown){const rows=workspacePreferencesSchema.parse(raw);for(const key of Object.keys(rows))if(!isWorkspacePreferenceKey(key))throw new Error("Unsupported workspace preference key");const previous:Record<string,string|null>={};const applied:string[]=[];try{for(const [key,value] of Object.entries(rows)){previous[key]=safeStorage.getItem(key);if(!safeStorage.setItem(key,value))throw new Error("Could not persist workspace preferences");applied.push(key);}}catch(e){for(const key of applied){const value=previous[key]??null;if(value===null)safeStorage.removeItem(key);else safeStorage.setItem(key,value);}throw e;}return()=>{for(const [key,value] of Object.entries(previous)){const ok=value===null?safeStorage.removeItem(key):safeStorage.setItem(key,value);if(!ok)throw new Error("Could not roll back workspace preferences");}};}
export function exportIndicatorBackup(){assertLibraryReady();assertOverridesReady();return JSON.stringify({format:"opencharts-indicators",version:1,library:JSON.parse(exportLibrary()),overrides:JSON.parse(exportOverrides()),admin:getIndicatorAdmin()},null,2);}
export async function exportWorkspaceBackup(){const base=JSON.parse(exportIndicatorBackup());const result=JSON.stringify({...base,version:3,templates:chartTemplatesApi.exportAll(),drawings:await api.chartDrawings.exportAll(),preferences:exportWorkspacePreferences()},null,2);if(result.length>MAX_BACKUP_SIZE)throw new Error("Backup too large");return result;}
export function validateIndicatorBackup(source:string){
 if(source.length>MAX_BACKUP_SIZE)throw new Error("Backup too large");
 const raw=JSON.parse(source);if(!raw||raw.format!=="opencharts-indicators"||(raw.version!==1&&raw.version!==2&&raw.version!==3))throw new Error("Unsupported backup format");
 const library=validateLibraryBackup(JSON.stringify(raw.library));
 const overrides=validateOverrides(raw.overrides);
 const admin=adminSchema.parse(raw.admin);
 return {library,overrides,admin,templates:raw.version>=2?templatesBackupSchema.parse(raw.templates):undefined,drawings:raw.version>=2?drawingGroupsSchema.parse(raw.drawings):undefined,preferences:raw.version===3?workspacePreferencesSchema.parse(raw.preferences):undefined};
}
export async function restoreIndicatorBackup(source:string){
 assertLibraryReady();assertOverridesReady();
 const data=validateIndicatorBackup(source);
 // Validate every section before mutating any store. Native adapter storage has no transaction API; compensate on failure.
 let undoDrawings:(()=>Promise<void>)|undefined;let undoTemplates:(()=>void)|undefined;let undoPreferences:(()=>void)|undefined;
 try{if(data.preferences)undoPreferences=restoreWorkspacePreferences(data.preferences);if(data.drawings)undoDrawings=await api.chartDrawings.importAll(data.drawings);if(data.templates)undoTemplates=chartTemplatesApi.importAll(data.templates);
 await restoreTransaction({"opencharts.indicator-library.v1":data.library.indicators,"opencharts.indicator-library.v1.history":data.library.history,"opencharts.indicator-overrides.v1":data.overrides,"opencharts.indicator-admin.v1":data.admin},()=>{applyRestoredLibrary(data.library);applyRestoredOverrides(data.overrides);applyRestoredAdmin(data.admin);});
 }catch(e){const rollbackErrors:unknown[]=[];try{undoTemplates?.();}catch(error){rollbackErrors.push(error);}try{await undoDrawings?.();}catch(error){rollbackErrors.push(error);}try{undoPreferences?.();}catch(error){rollbackErrors.push(error);}if(rollbackErrors.length)throw new Error("Restore failed and rollback incomplete: "+String(e));throw e; }
}
