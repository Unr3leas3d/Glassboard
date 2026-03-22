import { useState, useCallback, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

/**
 * Hook to manage draw mode (click-through toggle).
 *
 * - Draw mode OFF → clicks pass through the overlay to apps below
 * - Draw mode ON  → the overlay captures clicks for drawing
 */
export function useDrawMode() {
  const [isDrawMode, setIsDrawMode] = useState(true);

  useEffect(() => {
    const appWindow = getCurrentWindow();
    // When draw mode is OFF, ignore cursor events so clicks pass through
    // When draw mode is ON, capture cursor events for drawing
    appWindow.setIgnoreCursorEvents(!isDrawMode).catch(console.error);
  }, [isDrawMode]);

  const toggleDrawMode = useCallback(() => {
    setIsDrawMode((prev) => !prev);
  }, []);

  const enableDrawMode = useCallback(() => {
    setIsDrawMode(true);
  }, []);

  const disableDrawMode = useCallback(() => {
    setIsDrawMode(false);
  }, []);

  return {
    isDrawMode,
    toggleDrawMode,
    enableDrawMode,
    disableDrawMode,
  };
}
