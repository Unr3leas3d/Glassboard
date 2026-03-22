import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { useCallback } from "react";
import type { RefObject } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

interface TestExcalidrawCanvasProps {
  apiRef: RefObject<ExcalidrawImperativeAPI | null>;
  onSceneChange?: (elements: readonly unknown[]) => void;
}

/**
 * Browser-friendly Excalidraw canvas for the test participant.
 * Unlike the overlay canvas: opaque background, selection tool default, full toolbar visible.
 */
export function TestExcalidrawCanvas({ apiRef, onSceneChange }: TestExcalidrawCanvasProps) {
  const handleChange = useCallback(
    (elements: readonly unknown[]) => {
      onSceneChange?.(elements);
    },
    [onSceneChange],
  );

  return (
    <div
      className="testuser-canvas"
      style={{
        width: "100%",
        height: "100%",
        pointerEvents: "auto",
      }}
    >
      <Excalidraw
        excalidrawAPI={(api) => {
          apiRef.current = api;
        }}
        initialData={{
          appState: {
            viewBackgroundColor: "#1a1a2e",
            activeTool: { type: "selection", lastActiveTool: null, locked: false, customType: null },
            currentItemStrokeColor: "#ffffff",
          },
        }}
        UIOptions={{
          canvasActions: {
            changeViewBackgroundColor: false,
            clearCanvas: true,
            export: false,
            loadScene: false,
            saveToActiveFile: false,
            saveAsImage: false,
            toggleTheme: false,
          },
        }}
        theme="dark"
        onChange={handleChange}
      />
    </div>
  );
}
