import type { DrawingTool } from "./constants.ts";
import { safeStorage } from "../../lib/safe-storage.ts";

const KEY = "opencharts.drawing-tools.favorites";
export const DRAWING_TOOL_FAVORITES_EVENT = "opencharts:drawing-tool-favorites";

export function getDrawingToolFavorites(): DrawingTool[] {
  const value = safeStorage.getJSON<unknown>(KEY, []);
  return Array.isArray(value) ? value.filter((item): item is DrawingTool => typeof item === "string" && item !== "none") : [];
}

export function setDrawingToolFavorite(tool: DrawingTool, favorite: boolean): void {
  const next = new Set(getDrawingToolFavorites());
  if (favorite) next.add(tool); else next.delete(tool);
  safeStorage.setJSON(KEY, [...next]);
  window.dispatchEvent(new Event(DRAWING_TOOL_FAVORITES_EVENT));
}
