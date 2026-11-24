import { useSyncExternalStore } from "react";
import { safeStorage } from "../lib/safe-storage.ts";

export type WorkspaceSaveState = "restoring" | "saving" | "saved" | "dirty" | "error" | "recovered";
export interface WorkspaceMemorySettings {
  restoreSession: boolean;
  assets: boolean;
  timeframes: boolean;
  indicators: boolean;
  drawings: boolean;
  favorites: boolean;
  drawingTemplates: boolean;
  layout: boolean;
  viewport: boolean;
  appearance: boolean;
  recoverLastValid: boolean;
}

const SETTINGS_KEY = "opencharts.workspace-memory.v1";
export const DEFAULT_WORKSPACE_MEMORY: WorkspaceMemorySettings = {
  restoreSession: true, assets: true, timeframes: true, indicators: true, drawings: true,
  favorites: true, drawingTemplates: true, layout: true, viewport: true, appearance: true,
  recoverLastValid: true,
};
const listeners = new Set<() => void>();
let settings = readSettings();
let status: { state: WorkspaceSaveState; at: number | null; message?: string } = { state: "saved", at: null };

function readSettings(): WorkspaceMemorySettings {
  const raw = safeStorage.getJSON<Partial<WorkspaceMemorySettings>>(SETTINGS_KEY, {});
  return Object.fromEntries(Object.entries(DEFAULT_WORKSPACE_MEMORY).map(([key, fallback]) => [key, typeof raw[key as keyof WorkspaceMemorySettings] === "boolean" ? raw[key as keyof WorkspaceMemorySettings] : fallback])) as unknown as WorkspaceMemorySettings;
}
function emit() { for (const listener of listeners) listener(); }
export function getWorkspaceMemorySettings() { return settings; }
export function getWorkspaceSaveStatus() { return status; }
export function subscribeWorkspaceMemory(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); }
export function useWorkspaceMemorySettings() { return useSyncExternalStore(subscribeWorkspaceMemory, getWorkspaceMemorySettings, getWorkspaceMemorySettings); }
export function useWorkspaceSaveStatus() { return useSyncExternalStore(subscribeWorkspaceMemory, getWorkspaceSaveStatus, getWorkspaceSaveStatus); }
export function setWorkspaceSaveStatus(state: WorkspaceSaveState, message?: string) {
  status = { state, at: state === "saved" || state === "recovered" ? Date.now() : status.at, message };
  emit();
}
export function updateWorkspaceMemorySettings(patch: Partial<WorkspaceMemorySettings>): boolean {
  const next = { ...settings, ...patch };
  setWorkspaceSaveStatus("saving");
  if (!safeStorage.setJSON(SETTINGS_KEY, next)) { setWorkspaceSaveStatus("error", "Não foi possível salvar as preferências."); return false; }
  settings = next; setWorkspaceSaveStatus("saved"); emit(); return true;
}
export function resetWorkspaceMemorySettings() { return updateWorkspaceMemorySettings(DEFAULT_WORKSPACE_MEMORY); }

const SAFE_PREFIXES = ["opencharts.", "trader_prefs", "watchlist_", "oc_chart_templates", "chartDrawings", "bottomPanelHeight"];
const BLOCKED = /token|secret|private|wallet|credential|account|order|position|journal/i;
export interface WorkspaceEnvironmentFile { format: "opencharts-workspace"; version: 1; createdAt: string; entries: Record<string, string>; }
export function exportWorkspaceEnvironment(): string {
  const entries: Record<string, string> = {};
  if (typeof localStorage !== "undefined") for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i); if (!key || BLOCKED.test(key) || !SAFE_PREFIXES.some((prefix) => key.startsWith(prefix))) continue;
    const value = safeStorage.getItem(key); if (value != null) entries[key] = value;
  }
  return JSON.stringify({ format: "opencharts-workspace", version: 1, createdAt: new Date().toISOString(), entries } satisfies WorkspaceEnvironmentFile, null, 2);
}
export function importWorkspaceEnvironment(source: string): number {
  const parsed = JSON.parse(source) as Partial<WorkspaceEnvironmentFile>;
  if (parsed.format !== "opencharts-workspace" || parsed.version !== 1 || !parsed.entries || typeof parsed.entries !== "object") throw new Error("Backup de ambiente incompatível.");
  const valid = Object.entries(parsed.entries).filter(([key, value]) => typeof value === "string" && !BLOCKED.test(key) && SAFE_PREFIXES.some((prefix) => key.startsWith(prefix)));
  setWorkspaceSaveStatus("restoring");
  for (const [key, value] of valid) if (!safeStorage.setItem(key, value)) { setWorkspaceSaveStatus("error", `Falha ao restaurar ${key}.`); throw new Error(`Falha ao restaurar ${key}.`); }
  settings = readSettings(); setWorkspaceSaveStatus("recovered"); emit(); return valid.length;
}
