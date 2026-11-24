import {exportLibrary,applyRestoredLibrary,validateLibraryBackup,assertLibraryReady} from "./storage";
import {exportOverrides,applyRestoredOverrides,validateOverrides,assertOverridesReady} from "./instances";
import {adminSchema,getIndicatorAdmin,applyRestoredAdmin} from "./admin";
import {restoreTransaction} from "./database";
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
export async function restoreIndicatorBackup(source:string){
 assertLibraryReady();assertOverridesReady();
 const data=validateIndicatorBackup(source);
 // Validate every section before mutating any store.
 await restoreTransaction({"opencharts.indicator-library.v1":data.library.indicators,"opencharts.indicator-library.v1.history":data.library.history,"opencharts.indicator-overrides.v1":data.overrides,"opencharts.indicator-admin.v1":data.admin},()=>{applyRestoredLibrary(data.library);applyRestoredOverrides(data.overrides);applyRestoredAdmin(data.admin);});
}
