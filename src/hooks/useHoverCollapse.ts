import { useCallback, useEffect, useRef, useState } from "react";

export const HOVER_PANEL_OPEN_DELAY_MS = 600;
export const HOVER_PANEL_CLOSE_DELAY_MS = 5_000;

/**
 * Delayed hover expansion shared by desktop terminal panels.
 * Each hook instance owns its own timers and expanded state.
 */
export function useHoverCollapse() {
  const [isExpanded, setIsExpanded] = useState(false);
  const isExpandedRef = useRef(false);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearOpenTimer = useCallback(() => {
    if (openTimerRef.current !== null) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  }, []);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const onPointerEnter = useCallback(() => {
    clearCloseTimer();
    if (isExpandedRef.current || openTimerRef.current !== null) return;

    openTimerRef.current = setTimeout(() => {
      openTimerRef.current = null;
      isExpandedRef.current = true;
      setIsExpanded(true);
    }, HOVER_PANEL_OPEN_DELAY_MS);
  }, [clearCloseTimer, isExpanded]);

  const onPointerLeave = useCallback(() => {
    clearOpenTimer();
    if (!isExpandedRef.current) return;

    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      isExpandedRef.current = false;
      setIsExpanded(false);
    }, HOVER_PANEL_CLOSE_DELAY_MS);
  }, [clearCloseTimer, clearOpenTimer, isExpanded]);

  useEffect(
    () => () => {
      clearOpenTimer();
      clearCloseTimer();
    },
    [clearOpenTimer, clearCloseTimer],
  );

  return { isExpanded, onPointerEnter, onPointerLeave };
}
