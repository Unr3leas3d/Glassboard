// src/windows/overlay/OverlayApp.tsx
import { useRef, useState, useCallback, useEffect } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { emit, listen } from "@tauri-apps/api/event";
import { useGlobalHotkey } from "../../hooks/useGlobalHotkey";
import { useHotkeySettings } from "../../hooks/useHotkeySettings";
import { useLaserMode } from "../../hooks/useLaserMode";
import { useSessionChannel } from "../../hooks/useSessionChannel";
import { useRealtimeAnnotations } from "../../hooks/useRealtimeAnnotations";
import { useRealtimeCursors } from "../../hooks/useRealtimeCursors";
import { usePresence } from "../../hooks/usePresence";
import { useScreenMirror } from "../../hooks/useScreenMirror";
import { ExcalidrawCanvas } from "../../components/ExcalidrawCanvas";
import { RemoteCursorsOverlay } from "../../components/RemoteCursorsOverlay";
import { ScreenMirrorView } from "../../components/ScreenMirrorView";
import { MonitorPicker } from "../../components/MonitorPicker";
import { supabase } from "../../supabase";
import { EVENTS } from "../../types/events";
import type {
  OverlayPayload,
  BottomBarPayload,
  OverlayStatePayload,
} from "../../types/events";
import type { Session } from "../../hooks/useSessions";

function readPayload(): OverlayPayload {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("payload");
  if (!raw) throw new Error("No payload in overlay URL");
  return JSON.parse(atob(raw));
}

function buildWindowUrl(windowType: string, payload: unknown): string {
  const baseUrl = import.meta.env.DEV ? "http://localhost:1421" : "index.html";
  const encoded = encodeURIComponent(btoa(JSON.stringify(payload)));
  return `${baseUrl}?window=${windowType}&payload=${encoded}`;
}

export function OverlayApp() {
  const [payload] = useState<OverlayPayload>(readPayload);
  const { userId, userName, userAvatarUrl, activeSession: initialSession } = payload;

  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const [session] = useState<Session>(initialSession);
  const isHost = session.host_id === userId;

  // Realtime
  const { channel, isConnected } = useSessionChannel(session.id);
  const { broadcastChanges } = useRealtimeAnnotations(channel, apiRef, isConnected);
  const { cursors } = useRealtimeCursors(channel, isConnected, userId, userName, userAvatarUrl);
  const { participants } = usePresence(channel, isConnected, userId, userName, isHost);
  const { isSharing, remoteFrame, shareScreen, stopSharing } =
    useScreenMirror(channel, isConnected);

  // Verify identity on startup — ensure payload matches authenticated user
  const [verified, setVerified] = useState(false);
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== userId) {
        console.error("[Glassboard] Overlay auth mismatch — destroying window");
        await getCurrentWindow().destroy();
        return;
      }
      // Verify session is still active
      const { data: sessionData } = await supabase
        .from("sessions")
        .select("*")
        .eq("id", initialSession.id)
        .eq("status", "active")
        .single();
      if (!sessionData) {
        console.error("[Glassboard] Session no longer active — destroying overlay");
        await emit(EVENTS.SESSION_ENDED);
        await getCurrentWindow().destroy();
        return;
      }
      setVerified(true);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- run once on mount

  // Laser / draw mode
  const { isLaserActive, toggleLaser } = useLaserMode(apiRef);
  const [screenshotsEnabled, setScreenshotsEnabled] = useState(false);

  // Monitor selection for screen sharing
  const [showMonitorPicker, setShowMonitorPicker] = useState(false);
  const selectedMonitorRef = useRef<number | undefined>(undefined);

  // Temporarily disable click-through when MonitorPicker is visible
  useEffect(() => {
    if (showMonitorPicker) {
      getCurrentWindow().setIgnoreCursorEvents(false).catch(console.error);
    } else if (!isLaserActive) {
      // Restore click-through only if laser is off (laser already disables it)
      getCurrentWindow().setIgnoreCursorEvents(true).catch(console.error);
    }
  }, [showMonitorPicker, isLaserActive]);

  const toggleScreenshots = useCallback(async () => {
    const next = !screenshotsEnabled;
    await getCurrentWindow().setContentProtected(!next);
    setScreenshotsEnabled(next);
  }, [screenshotsEnabled]);

  // Hotkeys (owned by overlay — reads customized bindings from localStorage)
  const { getBinding } = useHotkeySettings();
  useGlobalHotkey(getBinding("toggle-laser"), toggleLaser);
  useGlobalHotkey(getBinding("toggle-screenshots"), toggleScreenshots);

  // --- Spawn bottom bar window ---
  const bottomBarRef = useRef<WebviewWindow | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Delay creation slightly so React StrictMode cleanup can finish
    // before we attempt to create windows with the same labels.
    const timer = setTimeout(() => {
      if (cancelled) return;

      const sw = window.screen.availWidth;
      const sh = window.screen.availHeight;
      const screenTop = (window.screen as { availTop?: number }).availTop ?? 0;

      const bbPayload: BottomBarPayload = {
        isLaserActive: false,
        screenshotsEnabled: false,
        isSharing: false,
        session,
        isHost,
        participants: [],
      };
      const bbHeight = 60;
      const bbWidth = 340; // 6 buttons × 44px + 5 gaps × 8px + padding
      const bb = new WebviewWindow("bottombar", {
        url: buildWindowUrl("bottombar", bbPayload),
        transparent: true,
        decorations: false,
        alwaysOnTop: true,
        resizable: false,
        width: bbWidth,
        height: bbHeight,
        x: Math.round((sw - bbWidth) / 2),
        y: screenTop + sh - bbHeight,
      });
      bb.once("tauri://error", (e) => {
        console.error("[Glassboard] Bottom bar window error:", e);
      });
      bottomBarRef.current = bb;
    }, 100);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      bottomBarRef.current?.destroy().catch(() => {});
      bottomBarRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- run once on mount

  // --- Broadcast state to UI windows ---
  useEffect(() => {
    const state: OverlayStatePayload = {
      isLaserActive,
      screenshotsEnabled,
      isSharing,
      participants,
    };
    emit(EVENTS.OVERLAY_STATE, state);
  }, [isLaserActive, screenshotsEnabled, isSharing, participants]);

  // --- Listen for actions from UI windows ---
  useEffect(() => {
    const unsubs = [
      listen(EVENTS.UI_TOGGLE_LASER, () => toggleLaser()),
      listen(EVENTS.UI_TOGGLE_SCREENSHOTS, () => toggleScreenshots()),
      listen(EVENTS.UI_SHOW_MANAGEMENT, () => handleShowManagement()),
      listen(EVENTS.UI_SIGN_OUT, () => handleSignOut()),
      listen(EVENTS.UI_SHARE_SCREEN, () => {
        if (selectedMonitorRef.current !== undefined) {
          shareScreen(selectedMonitorRef.current);
        } else {
          setShowMonitorPicker(true);
        }
      }),
      listen(EVENTS.UI_STOP_SHARING, () => stopSharing()),
      listen<{ sessionId: string }>(EVENTS.UI_END_SESSION, (e) =>
        handleEndSession(e.payload.sessionId),
      ),
      listen(EVENTS.UI_LEAVE_SESSION, () => handleLeaveSession()),
    ];

    return () => {
      unsubs.forEach((p) => p.then((fn) => fn()));
    };
  }); // intentionally no deps — handlers reference latest closures

  // Scene change handler
  const handleSceneChange = useCallback(
    (elements: readonly unknown[]) => {
      if (isConnected) {
        broadcastChanges(elements as readonly { id: string; version: number }[]);
      }
    },
    [isConnected, broadcastChanges],
  );

  // Destroy UI windows helper
  const destroyUIWindows = useCallback(async () => {
    await bottomBarRef.current?.destroy().catch(() => {});
    bottomBarRef.current = null;
  }, []);

  // End session handler — only host can end, double-checked via RLS
  const handleEndSession = useCallback(
    async (sessionId: string) => {
      if (!isHost) return;

      const { error } = await supabase
        .from("sessions")
        .update({ status: "ended", ended_at: new Date().toISOString() })
        .eq("id", sessionId)
        .eq("host_id", userId); // defense-in-depth: RLS also enforces this

      if (error) {
        console.error("[Glassboard] Failed to end session:", error);
        return;
      }

      await destroyUIWindows();
      await emit(EVENTS.SESSION_ENDED);
      await getCurrentWindow().destroy();
    },
    [isHost, userId, destroyUIWindows],
  );

  // Leave session handler
  const handleLeaveSession = useCallback(async () => {
    await destroyUIWindows();
    await emit(EVENTS.SESSION_ENDED);
    await getCurrentWindow().destroy();
  }, [destroyUIWindows]);

  // Dashboard button handler
  const handleShowManagement = useCallback(async () => {
    if (isLaserActive) {
      toggleLaser();
    }
    await emit(EVENTS.REQUEST_SHOW_MANAGEMENT);
  }, [isLaserActive, toggleLaser]);

  // Sign out handler
  const handleSignOut = useCallback(async () => {
    await emit(EVENTS.REQUEST_SIGN_OUT);
  }, []);

  // Listen for deactivate-laser event from management window (Cmd+Shift+D)
  const isLaserActiveRef = useRef(isLaserActive);
  isLaserActiveRef.current = isLaserActive;

  useEffect(() => {
    const unlisten = listen(EVENTS.DEACTIVATE_LASER, () => {
      if (isLaserActiveRef.current) {
        toggleLaser();
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [toggleLaser]);

  // Listen for auth sign-out (if management signs us out)
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        destroyUIWindows();
        getCurrentWindow().destroy().catch(console.error);
      }
    });
    return () => subscription.unsubscribe();
  }, [destroyUIWindows]);

  const handleMonitorSelect = useCallback((monitorIndex: number) => {
    selectedMonitorRef.current = monitorIndex;
    setShowMonitorPicker(false);
    shareScreen(monitorIndex);
  }, [shareScreen]);

  if (!verified) return null;

  return (
    <>
      {remoteFrame && <ScreenMirrorView frameUrl={remoteFrame} />}
      <ExcalidrawCanvas
        isDrawMode={isLaserActive}
        apiRef={apiRef}
        onSceneChange={handleSceneChange}
      />
      <RemoteCursorsOverlay cursors={cursors} />
      {showMonitorPicker && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-[9999]">
          <MonitorPicker
            onSelect={handleMonitorSelect}
            onCancel={() => setShowMonitorPicker(false)}
          />
        </div>
      )}
    </>
  );
}
