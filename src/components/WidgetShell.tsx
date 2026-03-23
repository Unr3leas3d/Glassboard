// src/components/WidgetShell.tsx
import { useState, useCallback, type ReactNode } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Pin, Minimize2, X } from "lucide-react";
import type { SessionWindowId } from "../services/sessionWindows/definitions";
import { sessionWindowCoordinator } from "../services/sessionWindows/coordinator";

interface WidgetShellProps {
  widgetId: SessionWindowId;
  title: string;
  children: ReactNode;
  /** Hide the title bar controls (for widgets that manage their own chrome) */
  hideControls?: boolean;
}

export function WidgetShell({
  widgetId,
  title,
  children,
  hideControls = false,
}: WidgetShellProps) {
  const [pinned, setPinned] = useState(true); // Widgets are created with alwaysOnTop: true
  const [collapsed, setCollapsed] = useState(false);

  const handleDragStart = useCallback(() => {
    getCurrentWindow().startDragging().catch(console.error);
  }, []);

  const handlePin = useCallback(async () => {
    const next = !pinned;
    try {
      await getCurrentWindow().setAlwaysOnTop(next);
      setPinned(next);
    } catch (err) {
      console.error("[WidgetShell] Failed to set always-on-top:", err);
    }
  }, [pinned]);

  const handleCollapse = useCallback(async () => {
    try {
      if (collapsed) {
        await sessionWindowCoordinator.expandWidget(widgetId);
        setCollapsed(false);
      } else {
        await sessionWindowCoordinator.collapseWidget(widgetId);
        setCollapsed(true);
      }
    } catch (err) {
      console.error("[WidgetShell] Failed to toggle collapse:", err);
    }
  }, [widgetId, collapsed]);

  const handleClose = useCallback(async () => {
    sessionWindowCoordinator.closeWidget(widgetId).catch(console.error);
  }, [widgetId]);

  if (collapsed) {
    return (
      <div
        className="flex items-center justify-center w-11 h-11 rounded-xl bg-zinc-900/90 border border-zinc-700/50 backdrop-blur-sm cursor-pointer hover:bg-zinc-800/90 transition-colors"
        onClick={handleCollapse}
        title={`Expand ${title}`}
      >
        <span className="text-xs font-bold text-zinc-300">
          {title.slice(0, 2).toUpperCase()}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full rounded-xl bg-zinc-900/95 border border-zinc-700/50 backdrop-blur-sm overflow-hidden">
      {/* Title bar / drag handle */}
      {!hideControls && (
        <div
          className="flex items-center justify-between h-8 px-2 border-b border-zinc-800 cursor-grab active:cursor-grabbing select-none shrink-0"
          onMouseDown={handleDragStart}
        >
          <span className="text-xs font-medium text-zinc-400 truncate">
            {title}
          </span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={handlePin}
              className={`p-1 rounded hover:bg-zinc-700 transition-colors ${pinned ? "text-blue-400" : "text-zinc-500"}`}
              title={pinned ? "Unpin" : "Pin on top"}
            >
              <Pin size={12} />
            </button>
            <button
              onClick={handleCollapse}
              className="p-1 rounded text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300 transition-colors"
              title="Collapse"
            >
              <Minimize2 size={12} />
            </button>
            <button
              onClick={handleClose}
              className="p-1 rounded text-zinc-500 hover:bg-red-900/50 hover:text-red-400 transition-colors"
              title="Close"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Widget content */}
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
