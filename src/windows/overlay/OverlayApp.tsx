// src/windows/overlay/OverlayApp.tsx
import { useRef, useState, useCallback, useEffect } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { emit, listen } from "@tauri-apps/api/event";
import { useGlobalHotkey } from "../../hooks/useGlobalHotkey";
import { useLaserMode } from "../../hooks/useLaserMode";
import { useSessionChannel } from "../../hooks/useSessionChannel";
import { useRealtimeAnnotations } from "../../hooks/useRealtimeAnnotations";
import { useRealtimeCursors } from "../../hooks/useRealtimeCursors";
import { usePresence } from "../../hooks/usePresence";
import { useScreenMirror } from "../../hooks/useScreenMirror";
import { ExcalidrawCanvas } from "../../components/ExcalidrawCanvas";
import { BottomBar } from "../../components/BottomBar";
import { SessionBar } from "../../components/session/SessionBar";
import { RemoteCursorsOverlay } from "../../components/RemoteCursorsOverlay";
import { ParticipantList } from "../../components/session/ParticipantList";
import { ScreenMirrorView } from "../../components/ScreenMirrorView";
import { supabase } from "../../supabase";
import { EVENTS } from "../../types/events";
import type { OverlayPayload } from "../../types/events";
import type { Session } from "../../hooks/useSessions";

function readPayload(): OverlayPayload {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("payload");
  if (!raw) throw new Error("No payload in overlay URL");
  // URLSearchParams.get() already decodes URI components, so just atob + parse
  return JSON.parse(atob(raw));
}

export function OverlayApp() {
  const [payload] = useState<OverlayPayload>(readPayload);
  const { userId, userName, activeSession: initialSession, currentOrg } = payload;

  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const [session, setSession] = useState<Session>(initialSession);
  const isHost = session.host_id === userId;

  // Realtime
  const { channel, isConnected } = useSessionChannel(session.id);
  const { broadcastChanges } = useRealtimeAnnotations(channel, apiRef, isConnected);
  const { cursors } = useRealtimeCursors(channel, isConnected, userId, userName);
  const { participants } = usePresence(channel, isConnected, userId, userName, isHost);
  const { isSharing, remoteFrame, shareScreen, stopSharing } =
    useScreenMirror(channel, isConnected);

  // Laser / draw mode
  const canvasReady = true; // Overlay only exists when session is active
  const { isLaserActive, toggleLaser } = useLaserMode(apiRef, canvasReady);
  const [screenshotsEnabled, setScreenshotsEnabled] = useState(false);

  const toggleScreenshots = useCallback(async () => {
    const next = !screenshotsEnabled;
    await getCurrentWindow().setContentProtected(!next);
    setScreenshotsEnabled(next);
  }, [screenshotsEnabled]);

  // Hotkeys (owned by overlay)
  useGlobalHotkey("CommandOrControl+Shift+G", toggleLaser);
  useGlobalHotkey("CommandOrControl+Shift+S", toggleScreenshots);

  // Scene change handler
  const handleSceneChange = useCallback(
    (elements: readonly unknown[]) => {
      if (isConnected) {
        broadcastChanges(elements as readonly { id: string; version: number }[]);
      }
    },
    [isConnected, broadcastChanges],
  );

  // End session handler
  const handleEndSession = useCallback(
    async (sessionId: string) => {
      const { error } = await supabase
        .from("sessions")
        .update({ status: "ended", ended_at: new Date().toISOString() })
        .eq("id", sessionId);

      if (error) {
        console.error("[Glasboard] Failed to end session:", error);
        return;
      }

      await emit(EVENTS.SESSION_ENDED);
      await getCurrentWindow().destroy();
    },
    [],
  );

  // Leave session handler
  const handleLeaveSession = useCallback(async () => {
    await emit(EVENTS.SESSION_ENDED);
    await getCurrentWindow().destroy();
  }, []);

  // Dashboard button handler — deactivate laser so overlay doesn't block management clicks
  const handleShowManagement = useCallback(async () => {
    if (isLaserActive) {
      toggleLaser();
    }
    await emit(EVENTS.REQUEST_SHOW_MANAGEMENT);
  }, [isLaserActive, toggleLaser]);

  // Sign out handler — delegate to management
  const handleSignOut = useCallback(async () => {
    await emit(EVENTS.REQUEST_SIGN_OUT);
  }, []);

  // Listen for deactivate-laser event from management window (Cmd+Shift+D)
  useEffect(() => {
    const unlisten = listen(EVENTS.DEACTIVATE_LASER, () => {
      if (isLaserActive) {
        toggleLaser();
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [isLaserActive, toggleLaser]);

  // Listen for auth sign-out (if management signs us out)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        getCurrentWindow().destroy().catch(console.error);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <>
      {remoteFrame && <ScreenMirrorView frameUrl={remoteFrame} />}
      <ExcalidrawCanvas
        isDrawMode={isLaserActive}
        apiRef={apiRef}
        onSceneChange={handleSceneChange}
      />
      <RemoteCursorsOverlay cursors={cursors} />
      <SessionBar
        session={session}
        isHost={isHost}
        onEnd={handleEndSession}
        onLeave={handleLeaveSession}
      >
        <ParticipantList participants={participants} />
      </SessionBar>
      <BottomBar
        isActive={isLaserActive}
        onToggleLaser={toggleLaser}
        screenshotsEnabled={screenshotsEnabled}
        onToggleScreenshots={toggleScreenshots}
        onSignOut={handleSignOut}
        isSharing={isSharing}
        onShareScreen={shareScreen}
        onStopSharing={stopSharing}
        onShowManagement={handleShowManagement}
      />
    </>
  );
}
