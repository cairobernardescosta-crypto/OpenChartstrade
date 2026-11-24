import {exportLibrary,restoreLibrary,validateLibraryBackup,assertLibraryReady} from "./storage";
import {exportOverrides,restoreOverrides,validateOverrides,assertOverridesReady} from "./instances";
import {adminSchema,getIndicatorAdmin,saveIndicatorAdmin} from "./admin";
export const MAX_BACKUP_SIZE=16_000_000;
export function exportIndicatorBackup(){assertLibraryReady();assertOverridesReady();return JSON.stringify({format:"opencharts-indicators",version:1,library:JSON.parse(exportLibrary()),overrides:JSON.parse(exportOverrides()),admin:getIndicatorAdmin()},null,2);}
export function validateIndicatorBackup(source:string){
 if(source.length>MAX_BACKUP_SIZE)throw new Error("Backup too large");
 const raw=JSON.parse(source);if(!raw||raw.format!=="opencharts-indicators"||raw.version!==1)throw new Error("Unsupported backup format");
 const library=validateLibraryBackup(JSON.stringify(raw.library));
 const overrides=validateOverrides(raw.overrides);
 const admin=adminSchema.parse(raw.admin);
 return {library,overrides,admin};
}
export function restoreIndicatorBackup(source:string){
 assertLibraryReady();assertOverridesReady();
 const data=validateIndicatorBackup(source);
 // Validate every section before mutating any store.
 restoreLibrary(JSON.stringify(data.library));restoreOverrides(JSON.stringify(data.overrides));saveIndicatorAdmin(data.admin);
}
