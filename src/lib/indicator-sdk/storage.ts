import { useSyncExternalStore } from "react";
import { indicatorSchema, type ImportedIndicator } from "./schema";

const KEY = "opencharts.indicator-library.v1";
let library: ImportedIndicator[] = [];
try {
  const raw = localStorage.getItem(KEY);
  if (raw) library = indicatorSchema.array().max(100).parse(JSON.parse(raw));
} catch { /* unavailable or invalid storage */ }
const listeners = new Set<() => void>();
function subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
export function getLibrary() { return library; }
export function useIndicatorLibrary() { return useSyncExternalStore(subscribe, getLibrary, getLibrary); }
function save(next: ImportedIndicator[]) {
  localStorage.setItem(KEY, JSON.stringify(next));
  library = next;
  listeners.forEach(fn => fn());
}
export function installIndicator(value: ImportedIndicator) {
  const entry = indicatorSchema.parse(value);
  if (library.some(x => x.id === entry.id)) throw new Error("Indicator ID already installed");
  if (library.length >= 100) throw new Error("Library limit reached");
  save([...library, entry]);
}
export function updateIndicator(value: ImportedIndicator) {
  const entry = indicatorSchema.parse(value);
  if (!library.some(x=>x.id===entry.id)) throw new Error("Indicator not installed");
  save(library.map(x=>x.id===entry.id?entry:x));
}
export function removeIndicator(id: string) { save(library.filter(x=>x.id!==id)); }
