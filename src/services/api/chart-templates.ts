import {templatesBackupSchema} from "../../lib/indicator-sdk/chart-backup-schema";
import { safeStorage } from "../../lib/safe-storage.ts";
// Chart templates persist to localStorage in demo mode (no backend).

export interface ChartTemplateContent {
  version: 1;
  /** Snapshot of the TEMPLATE_PREF_KEYS subset of ChartPreferences. */
  prefs: Record<string, string | boolean>;
  indicators: string[];
  plugins: string[];
  importedDefinitions?: import('../../lib/indicator-sdk/schema').ImportedIndicator[];
  importedOverrides?: import('../../lib/indicator-sdk/schema').ImportedIndicator[];
}

export interface ChartTemplate {
  id: string;
  name: string;
  layoutType: string;
  isDefault: boolean;
  panels: ChartTemplateContent[];
  updatedAt: string;
}

const KEY = "oc_chart_templates";

function readAll(): ChartTemplate[] {
  try {
    const rows = JSON.parse(safeStorage.getItem(KEY) ?? "[]") as ChartTemplate[];
    const normalized = new Map<string, ChartTemplate>();
    // Templates used to be hidden behind a "[secondary] " prefix. Keep those
    // records compatible, but expose one shared catalogue for both charts.
    for (const row of rows) {
      const name = row.name.startsWith("[secondary] ") ? row.name.slice(12) : row.name;
      const current = normalized.get(name);
      if (!current || !row.name.startsWith("[secondary] ")) {
        normalized.set(name, { ...row, name });
      }
    }
    return [...normalized.values()];
  } catch {
    return [];
  }
}
function writeAll(list: ChartTemplate[]): void {
  if (!safeStorage.setJSON(KEY, list)) throw new Error("Could not persist templates");
}

export const chartTemplatesApi = {
  list: () => Promise.resolve(readAll()),
  exportAll:()=>templatesBackupSchema.parse(readAll()),
  importAll:(raw:unknown)=>{const rows=templatesBackupSchema.parse(raw);const previous=readAll();if(!safeStorage.setJSON(KEY,rows))throw new Error("Could not persist templates");return ()=>{if(!safeStorage.setJSON(KEY,previous))throw new Error("Could not roll back templates");};},

  /** Upserts by name (unique per user). */
  save: (name: string, content: ChartTemplateContent, isDefault = false) => {
    const previous = readAll().find((t) => t.name === name);
    const list = readAll().filter((t) => t.name !== name);
    const template: ChartTemplate = {
      id: previous?.id ?? crypto.randomUUID(),
      name,
      layoutType: "SINGLE",
      isDefault: isDefault || previous?.isDefault === true,
      panels: [content],
      updatedAt: new Date().toISOString(),
    };
    list.push(template);
    writeAll(list);
    return Promise.resolve(template);
  },

  remove: (id: string) => {
    writeAll(readAll().filter((t) => t.id !== id));
    return Promise.resolve({ deleted: true });
  },
};
