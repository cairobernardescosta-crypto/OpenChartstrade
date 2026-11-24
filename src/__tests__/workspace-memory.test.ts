import { beforeEach, describe, expect, it } from "vitest";
import {
  exportWorkspaceEnvironment,
  getWorkspaceMemorySettings,
  importWorkspaceEnvironment,
  resetWorkspaceMemorySettings,
  updateWorkspaceMemorySettings,
} from "../services/workspace-memory.ts";

describe("workspace memory", () => {
  beforeEach(() => {
    localStorage.clear();
    resetWorkspaceMemorySettings();
  });

  it("keeps automatic persistence enabled by default", () => {
    expect(getWorkspaceMemorySettings()).toMatchObject({
      restoreSession: true,
      assets: true,
      indicators: true,
      drawings: true,
      layout: true,
    });
  });

  it("does not delete stored data when a category is disabled", () => {
    localStorage.setItem("opencharts.workspace.primary-symbol.v1", "xyz:GOLD");
    expect(updateWorkspaceMemorySettings({ assets: false })).toBe(true);
    expect(localStorage.getItem("opencharts.workspace.primary-symbol.v1")).toBe("xyz:GOLD");
  });

  it("exports only allowlisted non-sensitive entries", () => {
    localStorage.setItem("opencharts.workspace.primary-symbol.v1", "xyz:GOLD");
    localStorage.setItem("access_token", "secret");
    const backup = JSON.parse(exportWorkspaceEnvironment()) as { entries: Record<string, string> };
    expect(backup.entries["opencharts.workspace.primary-symbol.v1"]).toBe("xyz:GOLD");
    expect(backup.entries.access_token).toBeUndefined();
  });

  it("rejects incompatible files without changing storage", () => {
    expect(() => importWorkspaceEnvironment('{"format":"other","version":1,"entries":{}}')).toThrow();
    expect(localStorage.getItem("opencharts.workspace.primary-symbol.v1")).toBeNull();
  });
});
