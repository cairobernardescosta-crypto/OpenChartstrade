import { describe, expect, it } from "vitest";
import { resolveIndicatorSettingsScope } from "../pages/trading/chart-linking.ts";

describe("linked chart indicator settings scope", () => {
  it("uses the selected source for both charts while linked", () => {
    expect(resolveIndicatorSettingsScope("primary", true, "secondary")).toBe("secondary");
    expect(resolveIndicatorSettingsScope("secondary", true, "secondary")).toBe("secondary");
    expect(resolveIndicatorSettingsScope("primary", true, "primary")).toBe("primary");
    expect(resolveIndicatorSettingsScope("secondary", true, "primary")).toBe("primary");
  });

  it("keeps each chart's own settings scope while unlinked", () => {
    expect(resolveIndicatorSettingsScope("primary", false, "secondary")).toBe("primary");
    expect(resolveIndicatorSettingsScope("secondary", false, "primary")).toBe("secondary");
  });
});
