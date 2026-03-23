import { useState, useCallback, useEffect, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

/**
 * Manages laser pointer on/off state.
 *
 * UI controls (Dock) live in separate always-interactive Tauri windows,
 * so the overlay can safely be fully click-through.
 *
 * When laser is inactive: overlay ignores cursor events (click-through).
 * When laser is active:   overlay captures events for the annotation canvas.
 */
export function useLaserMode(interactiveOverride = false) {
  const [isLaserActive, setIsLaserActive] = useState(false);
  const previousInteractiveOverrideRef = useRef(interactiveOverride);

  useEffect(() => {
    const shouldIgnoreCursorEvents = !(isLaserActive || interactiveOverride);
    getCurrentWindow().setIgnoreCursorEvents(shouldIgnoreCursorEvents).catch(console.error);

    if (isLaserActive || interactiveOverride) {
      getCurrentWindow().setFocus().catch(console.error);
    }
  }, [isLaserActive, interactiveOverride]);

  useEffect(() => {
    if (!isLaserActive) {
      (document.activeElement as HTMLElement | null)?.blur();
    }
  }, [isLaserActive]);

  useEffect(() => {
    const wasInteractiveOverrideActive = previousInteractiveOverrideRef.current;
    previousInteractiveOverrideRef.current = interactiveOverride;

    if (wasInteractiveOverrideActive && !interactiveOverride && !isLaserActive) {
      (document.activeElement as HTMLElement | null)?.blur();
      window.blur();
    }
  }, [interactiveOverride, isLaserActive]);

  const toggleLaser = useCallback(() => {
    setIsLaserActive((prev) => !prev);
  }, []);

  return { isLaserActive, toggleLaser };
}
