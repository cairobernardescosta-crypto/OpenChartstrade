import { useSyncExternalStore } from "react";
import { safeStorage } from "../lib/safe-storage.ts";

export type SoundCategory = "interface" | "indicators" | "drawings" | "replay" | "notifications" | "financial" | "connection";
export type SoundEffect = "ui" | "toggle" | "success" | "warning" | "error" | "alert" | "connection" | "financial";
export type SoundProfile = "minimal" | "balanced" | "complete" | "silent";

export interface SoundSettings {
  enabled: boolean;
  profile: SoundProfile;
  masterVolume: number;
  categories: Record<SoundCategory, { enabled: boolean; volume: number }>;
}

const STORAGE_KEY = "opencharts.sound-settings.v1";
const categories: SoundCategory[] = ["interface", "indicators", "drawings", "replay", "notifications", "financial", "connection"];
const listeners = new Set<() => void>();
const active = new Set<HTMLAudioElement>();
const lastPlayed = new Map<SoundEffect, number>();
const MIN_INTERVAL_MS = 120;
const MAX_SIMULTANEOUS = 4;
const unavailableAudio = () => typeof Audio === "undefined" || (typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent) && Audio.name === "Audio");

const files: Record<SoundEffect, string> = {
  ui: "/audio/ui.wav",
  toggle: "/audio/toggle.wav",
  success: "/audio/success.wav",
  warning: "/audio/warning.wav",
  error: "/audio/error.wav",
  alert: "/audio/alert.wav",
  connection: "/audio/connection.wav",
  financial: "/audio/financial.wav",
};

const effectCategory: Record<SoundEffect, SoundCategory> = {
  ui: "interface",
  toggle: "interface",
  success: "notifications",
  warning: "notifications",
  error: "notifications",
  alert: "notifications",
  connection: "connection",
  financial: "financial",
};

function categoryState(enabled: SoundCategory[], volume = 0.65): SoundSettings["categories"] {
  return Object.fromEntries(categories.map((category) => [category, { enabled: enabled.includes(category), volume }])) as SoundSettings["categories"];
}

export const SOUND_PROFILES: Record<SoundProfile, SoundSettings> = {
  minimal: { enabled: true, profile: "minimal", masterVolume: 0.45, categories: categoryState(["notifications", "financial", "connection"], 0.65) },
  balanced: { enabled: true, profile: "balanced", masterVolume: 0.5, categories: categoryState(["interface", "indicators", "drawings", "replay", "notifications", "financial", "connection"], 0.65) },
  complete: { enabled: true, profile: "complete", masterVolume: 0.6, categories: categoryState(categories, 0.75) },
  silent: { enabled: false, profile: "silent", masterVolume: 0.45, categories: categoryState([], 0.65) },
};

function clamp(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
}

function readSettings(): SoundSettings {
  const fallback = SOUND_PROFILES.minimal;
  const raw = safeStorage.getJSON<Partial<SoundSettings> | null>(STORAGE_KEY, null);
  if (!raw || typeof raw !== "object") return structuredClone(fallback);
  const savedCategories = raw.categories as Partial<SoundSettings["categories"]> | undefined;
  const profile = raw.profile && raw.profile in SOUND_PROFILES ? raw.profile : "minimal";
  return {
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : fallback.enabled,
    profile,
    masterVolume: clamp(raw.masterVolume, fallback.masterVolume),
    categories: Object.fromEntries(categories.map((category) => {
      const saved = savedCategories?.[category];
      const base = fallback.categories[category];
      return [category, { enabled: typeof saved?.enabled === "boolean" ? saved.enabled : base.enabled, volume: clamp(saved?.volume, base.volume) }];
    })) as SoundSettings["categories"],
  };
}

let settings = readSettings();
const emit = () => { for (const listener of [...listeners]) listener(); };

export function getSoundSettings(): SoundSettings { return settings; }
export function subscribeSoundSettings(listener: () => void): () => void { listeners.add(listener); return () => listeners.delete(listener); }
export function useSoundSettings(): SoundSettings { return useSyncExternalStore(subscribeSoundSettings, getSoundSettings, getSoundSettings); }

export function updateSoundSettings(patch: Partial<SoundSettings>): void {
  settings = { ...settings, ...patch, categories: patch.categories ?? settings.categories };
  safeStorage.setJSON(STORAGE_KEY, settings);
  emit();
}

export function updateSoundCategory(category: SoundCategory, patch: Partial<SoundSettings["categories"][SoundCategory]>): void {
  updateSoundSettings({ categories: { ...settings.categories, [category]: { ...settings.categories[category], ...patch } } });
}

export function applySoundProfile(profile: SoundProfile): void {
  settings = structuredClone(SOUND_PROFILES[profile]);
  safeStorage.setJSON(STORAGE_KEY, settings);
  emit();
}

export function resetSoundSettings(): void { applySoundProfile("minimal"); }

export async function playSound(effect: SoundEffect, category = effectCategory[effect], force = false): Promise<boolean> {
  if (unavailableAudio()) return false;
  const categorySettings = settings.categories[category];
  if (!force && (!settings.enabled || !categorySettings.enabled)) return false;
  const now = Date.now();
  if (!force && now - (lastPlayed.get(effect) ?? 0) < MIN_INTERVAL_MS) return false;
  if (active.size >= MAX_SIMULTANEOUS) return false;
  lastPlayed.set(effect, now);
  const audio = new Audio(files[effect]);
  audio.preload = "auto";
  audio.volume = clamp(settings.masterVolume * categorySettings.volume, 0.3);
  active.add(audio);
  const release = () => active.delete(audio);
  audio.addEventListener("ended", release, { once: true });
  audio.addEventListener("error", release, { once: true });
  try { await audio.play(); return true; } catch { release(); return false; }
}

export function preloadSounds(): void {
  if (unavailableAudio()) return;
  for (const effect of ["ui", "success", "warning", "error", "alert"] satisfies SoundEffect[]) {
    const audio = new Audio(files[effect]);
    audio.preload = "auto";
    audio.load();
  }
}

export function stopAllSounds(): void {
  for (const audio of [...active]) { audio.pause(); audio.currentTime = 0; }
  active.clear();
}

