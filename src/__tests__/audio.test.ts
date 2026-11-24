import { beforeEach, describe, expect, it, vi } from "vitest";
import { applySoundProfile, getSoundSettings, playSound, resetSoundSettings, updateSoundCategory, updateSoundSettings } from "../services/audio.ts";

class AudioMock {
  static instances: AudioMock[] = [];
  src: string;
  preload = "";
  volume = 1;
  currentTime = 0;
  play = vi.fn(async () => undefined);
  pause = vi.fn();
  load = vi.fn();
  addEventListener = vi.fn();
  constructor(src: string) { this.src = src; AudioMock.instances.push(this); }
}

describe("audio service", () => {
  beforeEach(() => {
    vi.stubGlobal("Audio", AudioMock);
    AudioMock.instances = [];
    resetSoundSettings();
  });

  it("uses the quiet minimal profile by default", () => {
    const settings = getSoundSettings();
    expect(settings.profile).toBe("minimal");
    expect(settings.categories.interface.enabled).toBe(false);
    expect(settings.categories.notifications.enabled).toBe(true);
  });

  it("persists profile, global volume and category controls", () => {
    applySoundProfile("complete");
    updateSoundSettings({ masterVolume: 0.4 });
    updateSoundCategory("drawings", { volume: 0.5, enabled: false });
    expect(getSoundSettings()).toMatchObject({ profile: "complete", masterVolume: 0.4, categories: { drawings: { volume: 0.5, enabled: false } } });
  });

  it("does not create audio for a disabled category", async () => {
    expect(await playSound("ui", "interface")).toBe(false);
    expect(AudioMock.instances).toHaveLength(0);
  });

  it("plays a forced preview with bounded combined volume", async () => {
    updateSoundSettings({ masterVolume: 0.5 });
    updateSoundCategory("interface", { volume: 0.4 });
    expect(await playSound("ui", "interface", true)).toBe(true);
    expect(AudioMock.instances[0]?.src).toBe("/audio/ui.wav");
    expect(AudioMock.instances[0]?.volume).toBeCloseTo(0.2);
  });

  it("rate-limits duplicate effects", async () => {
    applySoundProfile("complete");
    expect(await playSound("alert", "notifications")).toBe(true);
    expect(await playSound("alert", "notifications")).toBe(false);
  });
});
