// ── Global toast store ──────────────────────────────────────
// Lightweight pub-sub so any module can fire toasts without React context.

import { playSound, type SoundCategory, type SoundEffect } from "./audio.ts";

export interface ToastPayload {
  type: "info" | "success" | "warning" | "error";
  title: string;
  message: string;
}

type Listener = (t: ToastPayload) => void;
const listeners = new Set<Listener>();

export const toast = {
  /** Fire a toast (the ToastContainer picks it up). */
  fire(type: ToastPayload["type"], title: string, message: string) {
    // Snapshot: a listener may unsubscribe while handling the event. Isolate
    // failures so one broken subscriber cannot silence every later toast —
    // toasts are how the terminal reports rejected orders.
    for (const fn of [...listeners]) {
      try {
        fn({ type, title, message });
      } catch (err) {
        console.error("[toast] listener threw", err);
      }
    }
    const text = `${title} ${message}`;
    const financial = /order|position|trade|take profit|stop loss|leverage|close(d| failed)?/i.test(text);
    const connection = /connect|data feed|network|offline|online/i.test(text);
    const alert = /alert|price|cross/i.test(text);
    const category: SoundCategory = financial ? "financial" : connection ? "connection" : "notifications";
    const effect: SoundEffect = financial ? "financial" : connection ? "connection" : alert ? "alert" : type === "error" ? "error" : type === "warning" ? "warning" : type === "success" ? "success" : "ui";
    if (type !== "info" || financial || connection || alert) void playSound(effect, category);
  },

  success(title: string, message: string) {
    toast.fire("success", title, message);
  },
  error(title: string, message: string) {
    toast.fire("error", title, message);
  },
  info(title: string, message: string) {
    toast.fire("info", title, message);
  },
  warning(title: string, message: string) {
    toast.fire("warning", title, message);
  },

  /** Subscribe — returns unsubscribe function. */
  subscribe(fn: Listener) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
