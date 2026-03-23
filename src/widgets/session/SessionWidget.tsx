// src/widgets/session/SessionWidget.tsx
import { useState, useEffect, useCallback } from "react";
import { listen, emitTo } from "@tauri-apps/api/event";
import { WidgetShell } from "../../components/WidgetShell";
import { EVENTS } from "../../types/events";
import type {
  BottomBarPayload,
  OverlayStatePayload,
  SessionUiState,
} from "../../types/events";
import type { PresenceUser } from "../../hooks/usePresence";

function readPayload(): BottomBarPayload {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("payload");
  if (!raw) {
    return { isLaserActive: false, screenshotsEnabled: false, isSharing: false };
  }

  return JSON.parse(atob(raw));
}

function buildInitialUiState(payload: BottomBarPayload): SessionUiState {
  return {
    laserActive: payload.isLaserActive,
    screenshotsAllowed: payload.screenshotsEnabled,
    participants: payload.participants ?? [],
    session: payload.session,
    chatUnreadCount: 0,
    shareStatus: payload.isSharing ? "sharing" : "idle",
    widgetsHidden: false,
  };
}

export function SessionWidget() {
  const [payload] = useState<BottomBarPayload>(readPayload);
  const [uiState, setUiState] = useState<SessionUiState>(buildInitialUiState(payload));
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const unlisten = listen<OverlayStatePayload>(EVENTS.OVERLAY_STATE, (e) => {
      setUiState(e.payload.uiState);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const session = uiState.session ?? payload.session;
  const participants: PresenceUser[] =
    uiState.participants.length > 0 ? uiState.participants : payload.participants ?? [];

  const copyCode = useCallback(() => {
    if (!session) return;
    navigator.clipboard.writeText(session.join_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [session]);

  const endSession = useCallback(() => {
    if (session) {
      emitTo("overlay", EVENTS.UI_END_SESSION, { sessionId: session.id }).catch(console.error);
    }
  }, [session]);

  const leaveSession = useCallback(() => {
    emitTo("overlay", EVENTS.UI_LEAVE_SESSION).catch(console.error);
  }, []);

  return (
    <WidgetShell widgetId="session" title="Session">
      <div className="flex flex-col gap-4 p-4">
        {session?.title && (
          <div className="text-sm font-medium text-white truncate">
            {session.title}
          </div>
        )}

        {session && (
          <button
            onClick={copyCode}
            className="flex items-center gap-1.5 self-start rounded-md bg-zinc-800 px-2.5 py-1.5 text-xs font-mono text-zinc-300 transition-colors hover:bg-zinc-700"
            title="Click to copy join code"
          >
            <span className="tracking-widest text-sm">{session.join_code}</span>
            <span className="text-zinc-500">{copied ? "Copied!" : "Copy"}</span>
          </button>
        )}

        <div>
          <div className="mb-2 text-[10px] uppercase tracking-wider text-zinc-500">
            Participants ({participants.length})
          </div>
          <div className="flex flex-col gap-1.5">
            {participants.map((participant) => (
              <div key={participant.userId} className="flex items-center gap-2">
                <div
                  className="relative flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-semibold text-white"
                  style={{ backgroundColor: participant.color }}
                >
                  {participant.name.slice(0, 2).toUpperCase()}
                  {participant.isHost && (
                    <svg
                      className="absolute -right-1 -top-1 h-2.5 w-2.5 text-amber-400"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" />
                    </svg>
                  )}
                </div>
                <span className="text-sm text-zinc-300">
                  {participant.name}
                  {participant.isHost && <span className="ml-1 text-zinc-500">(Host)</span>}
                </span>
              </div>
            ))}
            {participants.length === 0 && (
              <div className="text-sm text-zinc-500">Waiting for participants...</div>
            )}
          </div>
        </div>

        <div className="mt-2">
          {payload.isHost ? (
            <button
              onClick={endSession}
              className="glasboard-session-panel-btn glasboard-session-panel-btn--danger"
            >
              End Session
            </button>
          ) : (
            <button onClick={leaveSession} className="glasboard-session-panel-btn">
              Leave Session
            </button>
          )}
        </div>
      </div>
    </WidgetShell>
  );
}
