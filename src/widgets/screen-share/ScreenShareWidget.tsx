// src/widgets/screen-share/ScreenShareWidget.tsx
import { useState, useEffect, useCallback } from "react";
import { listen, emitTo } from "@tauri-apps/api/event";
import { WidgetShell } from "../../components/WidgetShell";
import { Monitor, MonitorOff, RefreshCcw } from "lucide-react";
import { MonitorPicker } from "../../components/MonitorPicker";
import { EVENTS } from "../../types/events";
import type {
  OverlayStatePayload,
  ShareScreenCommandPayload,
  SessionUiState,
} from "../../types/events";

const INITIAL_UI_STATE: SessionUiState = {
  laserActive: false,
  screenshotsAllowed: false,
  participants: [],
  chatUnreadCount: 0,
  shareStatus: "idle",
  widgetsHidden: false,
};

export function ScreenShareWidget() {
  const [uiState, setUiState] = useState<SessionUiState>(INITIAL_UI_STATE);
  const [showMonitorPicker, setShowMonitorPicker] = useState(false);

  useEffect(() => {
    const unlisten = listen<OverlayStatePayload>(EVENTS.OVERLAY_STATE, (e) => {
      setUiState(e.payload.uiState);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const startSharing = useCallback(() => {
    setShowMonitorPicker(true);
  }, []);

  const stopSharing = useCallback(() => {
    emitTo("overlay", EVENTS.UI_STOP_SHARING).catch(console.error);
  }, []);

  const handleMonitorSelect = useCallback((monitorIndex: number) => {
    emitTo("overlay", EVENTS.UI_SHARE_SCREEN, {
      monitorIndex,
    } satisfies ShareScreenCommandPayload).catch(console.error);
    setShowMonitorPicker(false);
  }, []);

  const isSharing = uiState.shareStatus === "sharing";
  const shareLabel =
    uiState.shareSource === undefined ? "No source selected" : `Sharing monitor ${uiState.shareSource + 1}`;

  return (
    <WidgetShell widgetId="screen-share" title="Screen Share">
      <div className="relative flex h-full flex-col items-center justify-center gap-4 p-4">
        <div className={`rounded-full p-4 ${isSharing ? "bg-red-500/20" : "bg-zinc-800"}`}>
          {isSharing ? (
            <MonitorOff size={32} className="text-red-400" />
          ) : (
            <Monitor size={32} className="text-zinc-400" />
          )}
        </div>

        <div className="space-y-1 text-center">
          <p className="text-sm text-zinc-300">
            {isSharing ? "Screen sharing is active" : "Choose a screen to share with the session"}
          </p>
          <p className="text-xs text-zinc-500">{shareLabel}</p>
          {uiState.shareStatus === "error" && (
            <p className="text-xs text-red-400">Screen sharing failed. Pick a source and try again.</p>
          )}
        </div>

        <div className="flex gap-2">
          {isSharing ? (
            <button
              onClick={stopSharing}
              className="rounded-lg border border-red-500/30 bg-red-500/20 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/30"
            >
              Stop Sharing
            </button>
          ) : (
            <button
              onClick={startSharing}
              className="rounded-lg border border-blue-500/30 bg-blue-500/20 px-4 py-2 text-sm font-medium text-blue-400 transition-colors hover:bg-blue-500/30"
            >
              Choose Screen
            </button>
          )}
          <button
            onClick={startSharing}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
            title="Pick a different monitor"
          >
            <RefreshCcw size={14} />
          </button>
        </div>

        {showMonitorPicker && (
          <div className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2">
            <MonitorPicker
              onSelect={handleMonitorSelect}
              onCancel={() => setShowMonitorPicker(false)}
            />
          </div>
        )}
      </div>
    </WidgetShell>
  );
}
