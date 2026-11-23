import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useHoverCollapse } from "./useHoverCollapse.ts";

describe("useHoverCollapse", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("opens only after the 600 ms hover delay", () => {
    const { result } = renderHook(() => useHoverCollapse());

    act(() => result.current.onPointerEnter());
    act(() => vi.advanceTimersByTime(599));
    expect(result.current.isExpanded).toBe(false);

    act(() => vi.advanceTimersByTime(1));
    expect(result.current.isExpanded).toBe(true);
  });

  it("cancels a pending open when the pointer leaves early", () => {
    const { result } = renderHook(() => useHoverCollapse());

    act(() => result.current.onPointerEnter());
    act(() => vi.advanceTimersByTime(300));
    act(() => result.current.onPointerLeave());
    act(() => vi.advanceTimersByTime(1_000));

    expect(result.current.isExpanded).toBe(false);
  });

  it("waits five seconds before closing and cancels closing on re-entry", () => {
    const { result } = renderHook(() => useHoverCollapse());

    act(() => result.current.onPointerEnter());
    act(() => vi.advanceTimersByTime(600));
    expect(result.current.isExpanded).toBe(true);

    act(() => result.current.onPointerLeave());
    act(() => vi.advanceTimersByTime(4_999));
    expect(result.current.isExpanded).toBe(true);

    act(() => result.current.onPointerEnter());
    act(() => vi.advanceTimersByTime(1_000));
    expect(result.current.isExpanded).toBe(true);

    act(() => result.current.onPointerLeave());
    act(() => vi.advanceTimersByTime(5_000));
    expect(result.current.isExpanded).toBe(false);
  });

  it("keeps two panel instances independent", () => {
    const right = renderHook(() => useHoverCollapse());
    const bottom = renderHook(() => useHoverCollapse());

    act(() => right.result.current.onPointerEnter());
    act(() => vi.advanceTimersByTime(600));

    expect(right.result.current.isExpanded).toBe(true);
    expect(bottom.result.current.isExpanded).toBe(false);

    act(() => bottom.result.current.onPointerEnter());
    act(() => vi.advanceTimersByTime(600));
    expect(bottom.result.current.isExpanded).toBe(true);

    act(() => right.result.current.onPointerLeave());
    act(() => vi.advanceTimersByTime(5_000));
    expect(right.result.current.isExpanded).toBe(false);
    expect(bottom.result.current.isExpanded).toBe(true);
  });

  it("clears pending timers when the panel unmounts", () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    const { result, unmount } = renderHook(() => useHoverCollapse());

    act(() => result.current.onPointerEnter());
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});
