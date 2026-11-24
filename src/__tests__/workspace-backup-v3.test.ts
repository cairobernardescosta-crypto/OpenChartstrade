import {afterEach,describe,expect,it,vi} from "vitest";
import {exportWorkspacePreferences,isWorkspacePreferenceKey,restoreWorkspacePreferences} from "../lib/indicator-sdk/backup";

afterEach(()=>{localStorage.clear();vi.restoreAllMocks();});

describe("workspace backup v3 preferences",()=>{
 it("exports only explicitly non-sensitive workspace data",()=>{localStorage.setItem("trader_prefs",'{"theme":"dark"}');localStorage.setItem("opencharts.sound-settings.v1",'{"enabled":true}');localStorage.setItem("access_token","secret");localStorage.setItem("refresh_token","secret");expect(exportWorkspacePreferences()).toEqual({trader_prefs:'{"theme":"dark"}',"opencharts.sound-settings.v1":'{"enabled":true}'});});
 it("accepts scoped native preferences and rejects credentials",()=>{expect(isWorkspacePreferenceKey("trader_prefs:user-1")).toBe(true);expect(isWorkspacePreferenceKey("opencharts.workspace.v1")).toBe(true);expect(isWorkspacePreferenceKey("access_token")).toBe(false);});
 it("restores validated values and can roll them back",()=>{localStorage.setItem("theme","light");const undo=restoreWorkspacePreferences({theme:"dark",watchlist_favorites:'["xyz:GOLD"]'});expect(localStorage.getItem("theme")).toBe("dark");expect(localStorage.getItem("watchlist_favorites")).toBe('["xyz:GOLD"]');undo();expect(localStorage.getItem("theme")).toBe("light");expect(localStorage.getItem("watchlist_favorites")).toBeNull();});
 it("rejects non-allowlisted keys before changing storage",()=>{expect(()=>restoreWorkspacePreferences({access_token:"secret"})).toThrow("Unsupported workspace preference key");expect(localStorage.getItem("access_token")).toBeNull();});
 it("rolls back earlier values when a later write fails",()=>{localStorage.setItem("theme","light");const original=localStorage.setItem.bind(localStorage);vi.spyOn(localStorage,"setItem").mockImplementation((key,value)=>{if(key==="watchlist_favorites")throw new Error("quota");original(key,value);});expect(()=>restoreWorkspacePreferences({theme:"dark",watchlist_favorites:"[]"})).toThrow("Could not persist");expect(localStorage.getItem("theme")).toBe("light");});
});
