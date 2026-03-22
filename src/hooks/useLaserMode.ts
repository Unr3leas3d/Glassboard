import { useState, useCallback, useEffect } from "react";
import type { RefObject } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { getCurrentWindow } from "@tauri-apps/api/window";

/**
 * Manages laser pointer on/off state.
 *
 * UI controls (BottomBar, SessionBar) live in separate always-interactive
 * Tauri windows, so the overlay can safely be fully click-through.
 *
 * When laser is inactive: overlay ignores cursor events (click-through).
 * When laser is active:   overlay captures events, Excalidraw laser tool is set.
 */
export function useLaserMode(
  apiRef: RefObject<ExcalidrawImperativeAPI | null>,
) {
  const [isLaserActive, setIsLaserActive] = useState(false);

  // Start click-through on mount
  useEffect(() => {
    getCurrentWindow().setIgnoreCursorEvents(true).catch(console.error);
  }, []);

  const toggleLaser = useCallback(() => {
    const api = apiRef.current;
    setIsLaserActive((prev) => {
      const next = !prev;
      if (next) {
        if (api) {
          api.setActiveTool({ type: "laser" });
        }
        (async () => {
          try {
            await getCurrentWindow().setIgnoreCursorEvents(false);
            await getCurrentWindow().setFocus();
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
            document.querySelector<HTMLElement>(".excalidraw")?.focus({ preventScroll: true });
          } catch (err) {
            console.error("[Glassboard] Failed to acquire focus:", err);
          }
        })();
      } else {
        (document.activeElement as HTMLElement)?.blur();
        getCurrentWindow().setIgnoreCursorEvents(true).catch(console.error);
      }
      return next;
    });
  }, [apiRef]);

  return { isLaserActive, toggleLaser };
}
