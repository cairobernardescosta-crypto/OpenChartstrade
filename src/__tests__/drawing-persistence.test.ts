import { createDemoAdapter } from "@/adapter/demo";
import { setAdapter } from "@/adapter/registry";
import type { StorageDriver } from "@/adapter/types";
import { api } from "@/services/api";
import { chartTemplatesApi, type ChartTemplate } from "@/services/api/chart-templates";
import { afterEach, describe, expect, it } from "vitest";

class MemoryDriver implements StorageDriver {
  readonly values = new Map<string, string>();
  failWrites = false;
  async get(key: string) { return this.values.get(key) ?? null; }
  async set(key: string, value: string) {
    if (this.failWrites) throw new Error("storage unavailable");
    await Promise.resolve();
    this.values.set(key, value);
  }
  async remove(key: string) {
    if (this.failWrites) throw new Error("storage unavailable");
    this.values.delete(key);
  }
}

class FailIndexOnceDriver extends MemoryDriver {
  private failed = false;
  override async set(key: string, value: string) {
    if (key === "oc_drawings_index" && !this.failed) {
      this.failed = true;
      throw new Error("index unavailable");
    }
    return super.set(key, value);
  }
}

const restores: Array<() => void> = [];
afterEach(() => {
  while (restores.length) restores.pop()!();
  localStorage.removeItem("oc_chart_templates");
});

function useStorage(storage: StorageDriver) {
  restores.push(setAdapter({ ...createDemoAdapter(), storage }));
}

const drawing = (id: string) => ({ id, type: "horizontal" as const, price: 100, color: "#fff" });

describe("drawing persistence", () => {
  it("serializes concurrent saves without losing drawings", async () => {
    const storage = new MemoryDriver();
    useStorage(storage);
    await Promise.all([
      api.chartDrawings.save("DELISTED", "1m", drawing("one")),
      api.chartDrawings.save("DELISTED", "1m", drawing("two")),
    ]);
    await expect(api.chartDrawings.list("DELISTED")).resolves.toEqual([
      drawing("one"), drawing("two"),
    ]);
  });

  it("propagates storage failures instead of reporting a successful save", async () => {
    const storage = new MemoryDriver();
    storage.failWrites = true;
    useStorage(storage);
    await expect(api.chartDrawings.save("EURUSD", "1m", drawing("one")))
      .rejects.toThrow("storage unavailable");
  });

  it("rolls back a drawing when updating its index fails", async () => {
    const storage = new FailIndexOnceDriver();
    storage.values.set("oc_drawings_EURUSD", JSON.stringify([drawing("old")]));
    useStorage(storage);
    await expect(api.chartDrawings.save("EURUSD", "1m", drawing("new")))
      .rejects.toThrow("index unavailable");
    await expect(api.chartDrawings.list("EURUSD")).resolves.toEqual([drawing("old")]);
    expect(storage.values.has("oc_drawings_index")).toBe(false);
  });

  it("removes drawings for symbols present only in the persisted index", async () => {
    const storage = new MemoryDriver();
    storage.values.set("oc_drawings_index", JSON.stringify(["DELISTED"]));
    storage.values.set("oc_drawings_DELISTED", JSON.stringify([drawing("old")]));
    useStorage(storage);
    await api.chartDrawings.remove("old");
    await expect(api.chartDrawings.list("DELISTED")).resolves.toEqual([]);
  });

  it("restores a workspace drawing snapshot by replacement", async () => {
    const storage = new MemoryDriver();
    storage.values.set("oc_drawings_index", JSON.stringify(["OLD"]));
    storage.values.set("oc_drawings_OLD", JSON.stringify([drawing("old")]));
    useStorage(storage);
    const undo = await api.chartDrawings.importAll([
      { symbol: "NEW", drawings: [drawing("new")] },
    ]);
    expect(storage.values.has("oc_drawings_OLD")).toBe(false);
    await expect(api.chartDrawings.list("NEW")).resolves.toEqual([drawing("new")]);
    await undo();
    await expect(api.chartDrawings.list("OLD")).resolves.toEqual([drawing("old")]);
  });
});

describe("template backup restoration", () => {
  it("replaces the current template snapshot and supports rollback", () => {
    const content = { version: 1 as const, prefs: {}, indicators: [], plugins: [] };
    const oldTemplate: ChartTemplate = { id: "old", name: "Old", layoutType: "SINGLE", isDefault: false, panels: [content], updatedAt: "2026-01-01" };
    const newTemplate: ChartTemplate = { ...oldTemplate, id: "new", name: "New" };
    localStorage.setItem("oc_chart_templates", JSON.stringify([oldTemplate]));
    const undo = chartTemplatesApi.importAll([newTemplate]);
    expect(chartTemplatesApi.exportAll()).toEqual([newTemplate]);
    undo();
    expect(chartTemplatesApi.exportAll()).toEqual([oldTemplate]);
  });
});
