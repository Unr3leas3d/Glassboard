import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { useCallback, useEffect, useState } from "react";
import type { RefObject } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

interface ExcalidrawCanvasProps {
  isDrawMode: boolean;
  apiRef: RefObject<ExcalidrawImperativeAPI | null>;
  onSceneChange?: (elements: readonly unknown[]) => void;
}

/**
 * Full-viewport Excalidraw canvas with transparent background.
 */
export function ExcalidrawCanvas({ isDrawMode, apiRef, onSceneChange }: ExcalidrawCanvasProps) {
  const [mousePos, setMousePos] = useState({ x: -100, y: -100 });

  useEffect(() => {
    if (!isDrawMode) return;
    const onMove = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [isDrawMode]);

  const handleChange = useCallback(
    (elements: readonly unknown[]) => {
      const api = apiRef.current;
      if (!api) return;
      const appState = api.getAppState();
      if (appState.viewBackgroundColor !== "transparent") {
        api.updateScene({
          appState: { viewBackgroundColor: "transparent" },
        });
      }
      onSceneChange?.(elements);
    },
    [onSceneChange],
  );

  return (
    <div
      className={isDrawMode ? "excalidraw-wrapper--laser-active" : undefined}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: isDrawMode ? "auto" : "none",
        zIndex: 1000,
      }}
    >
      {isDrawMode && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: 20,
            height: 20,
            transform: `translate(${mousePos.x - 10}px, ${mousePos.y - 10}px)`,
            borderRadius: "50%",
            border: "2px solid rgba(255, 50, 50, 0.85)",
            backgroundColor: "rgba(255, 50, 50, 0.18)",
            pointerEvents: "none",
            zIndex: 9999,
            willChange: "transform",
          }}
        />
      )}
      <Excalidraw
        excalidrawAPI={(api) => {
          apiRef.current = api;
        }}
        initialData={{
          appState: {
            viewBackgroundColor: "transparent",
            activeTool: { type: "laser", lastActiveTool: null, locked: false, customType: null },
            currentItemStrokeColor: "#ffffff",
          },
        }}
        UIOptions={{
          canvasActions: {
            changeViewBackgroundColor: false,
            clearCanvas: false,
            export: false,
            loadScene: false,
            saveToActiveFile: false,
            saveAsImage: false,
            toggleTheme: false,
          },
          tools: {
            image: false,
          },
        }}
        theme="dark"
        onChange={handleChange}
      />
    </div>
  );
}
