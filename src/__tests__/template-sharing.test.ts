import { beforeEach, describe, expect, it } from "vitest";
import { chartTemplatesApi, type ChartTemplate } from "../services/api/chart-templates.ts";

const content = { version: 1 as const, prefs: {}, indicators: ["EMA"], plugins: ["session-highlighting"] };

describe("shared chart templates", () => {
  beforeEach(() => localStorage.removeItem("oc_chart_templates"));

  it("exposes legacy secondary templates in the shared catalogue", async () => {
    const legacy: ChartTemplate = { id: "legacy", name: "[secondary] Momentum", layoutType: "SINGLE", isDefault: false, panels: [content], updatedAt: "2026-01-01" };
    localStorage.setItem("oc_chart_templates", JSON.stringify([legacy]));
    await expect(chartTemplatesApi.list()).resolves.toMatchObject([{ id: "legacy", name: "Momentum" }]);
  });

  it("updates a shared template without changing its stable id", async () => {
    const first = await chartTemplatesApi.save("Shared", content);
    const second = await chartTemplatesApi.save("Shared", { ...content, indicators: ["RSI"] });
    expect(second.id).toBe(first.id);
    await expect(chartTemplatesApi.list()).resolves.toHaveLength(1);
  });
});
