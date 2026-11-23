import { beforeEach, describe, expect, it } from "vitest";
import {
  isAddressAllowedForTrading,
  resetScreening,
  screenAddress,
  setAddressScreener,
} from "../compliance/screen.ts";

describe("wallet screening trading guard", () => {
  beforeEach(() => {
    setAddressScreener(undefined);
    resetScreening();
  });

  it("preserves trading when optional screening is not configured", () => {
    expect(isAddressAllowedForTrading("0xabc")).toBe(true);
  });

  it("blocks trading until configured screening explicitly allows the wallet", async () => {
    let finish!: (result: { allowed: boolean }) => void;
    setAddressScreener({
      screen: () => new Promise((resolve) => { finish = resolve; }),
    });

    const pending = screenAddress("0xABC");
    expect(isAddressAllowedForTrading("0xabc")).toBe(false);

    finish({ allowed: true });
    await pending;
    expect(isAddressAllowedForTrading("0xabc")).toBe(true);
  });

  it("keeps trading blocked when screening refuses the wallet", async () => {
    setAddressScreener({ screen: async () => ({ allowed: false }) });
    await screenAddress("0xDEF");
    expect(isAddressAllowedForTrading("0xdef")).toBe(false);
  });
});
