// src/windows/overlay/OverlayApp.tsx
import { useRef, useState, useCallback, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { emit, emitTo, listen } from "@tauri-apps/api/event";
import { useGlobalHotkey } from "../../hooks/useGlobalHotkey";
import { useHotkeySettings } from "../../hooks/useHotkeySettings";
import { useLaserMode } from "../../hooks/useLaserMode";
import { useSessionChannel } from "../../hooks/useSessionChannel";
import { useRealtimeAnnotations } from "../../hooks/useRealtimeAnnotations";
import { useRealtimeCursors } from "../../hooks/useRealtimeCursors";
import { usePresence } from "../../hooks/usePresence";
import { useScreenMirror } from "../../hooks/useScreenMirror";
import { sessionWindowCoordinator } from "../../services/sessionWindows/coordinator";
import { recordSessionWindowDebug } from "../../services/sessionWindows/debug";
import { decodeWindowPayload } from "../../services/sessionWindows/payload";
import {
  transitionShareState,
  type ShareState,
} from "../../services/sessionWindows/shareState";
import type { SessionWindowId } from "../../services/sessionWindows/definitions";
import { AnnotationCanvas } from "../../annotations/AnnotationCanvas";
import { RemoteCursorsOverlay } from "../../components/RemoteCursorsOverlay";
import { ScreenMirrorView } from "../../components/ScreenMirrorView";
import { SessionExitDialog } from "../../components/session/SessionExitDialog";
import { supabase } from "../../supabase";
import { EVENTS } from "../../types/events";
import type {
  BottomBarPayload,
  OpenSessionWindowPayload,
  OverlayPayload,
  OverlayStatePayload,
  OverlayValidationResultPayload,
  SessionUiState,
  ShareScreenCommandPayload,
  WidgetStateChangePayload,
} from "../../types/events";
import type { Session } from "../../hooks/useSessions";
import type { Stroke } from "../../annotations/types";
import { userColor } from "../../utils/userColor";

interface ChatWindowPayload {
  sessionId: string;
  userId: string;
  userName: string;
}

function readPayload(): OverlayPayload {
  const params = new URLSearchParams(window.location.search);
  return decodeWindowPayload<OverlayPayload>(params.get("payload"), "No payload in overlay URL");
}

export function OverlayApp() {
  const [payload] = useState<OverlayPayload>(readPayload);
  const { userId, userName, userAvatarUrl, activeSession: initialSession } = payload;

  const [session] = useState<Session>(initialSession);
  const isHost = session.host_id === userId;

  const { channel, isConnected } = useSessionChannel(session.id);
  const { remoteStrokes, broadcastStroke } = useRealtimeAnnotations(
    channel,
    isConnected,
    userId,
    userColor(userId),
  );
  const { cursors } = useRealtimeCursors(channel, isConnected, userId, userName, userAvatarUrl);
  const { participants } = usePresence(channel, isConnected, userId, userName, isHost);
  const { isSharing, remoteFrame, shareError, shareScreen, stopSharing } =
    useScreenMirror(channel, isConnected);

  const [verified, setVerified] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const requestId = crypto.randomUUID();
    const currentWindow = getCurrentWindow();

    const teardownOverlay = async (options?: { emitSessionEnded?: boolean }) => {
      await sessionWindowCoordinator.destroyAll().catch(() => {});

      if (options?.emitSessionEnded) {
        await emit(EVENTS.SESSION_ENDED).catch(() => {});
      }

      await currentWindow.destroy().catch(() => {});
    };

    const unlistenPromise = listen<OverlayValidationResultPayload>(
      EVENTS.OVERLAY_VALIDATION_RESULT,
      async (event) => {
        if (cancelled || event.payload.requestId !== requestId) {
          return;
        }

        cancelled = true;
        window.clearTimeout(timeoutId);

        if (event.payload.valid) {
          recordSessionWindowDebug("overlay:verified", {
            sessionId: initialSession.id,
            reason: event.payload.reason,
          });
          setVerified(true);
          return;
        }

        recordSessionWindowDebug("overlay:validation-failed", {
          sessionId: initialSession.id,
          reason: event.payload.reason,
        });

        if (event.payload.reason === "session-ended") {
          await teardownOverlay({ emitSessionEnded: true });
          return;
        }

        await teardownOverlay();
      },
    );

    const timeoutId = window.setTimeout(() => {
      if (cancelled) {
        return;
      }

      cancelled = true;
      recordSessionWindowDebug("overlay:validation-timeout", {
        sessionId: initialSession.id,
      });
      teardownOverlay().catch(() => {});
    }, 5000);

    (async () => {
      recordSessionWindowDebug("overlay:request-validation", {
        sessionId: initialSession.id,
        userId,
      });
      await emitTo("management", EVENTS.REQUEST_OVERLAY_VALIDATION, {
        requestId,
        expectedUserId: userId,
        sessionId: initialSession.id,
      });
    })().catch(async (error) => {
      if (cancelled) {
        return;
      }

      cancelled = true;
      window.clearTimeout(timeoutId);
      console.error("[Glassboard] Overlay startup failed:", error);
      recordSessionWindowDebug("overlay:startup-failed", error);
      await teardownOverlay();
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      unlistenPromise.then((fn) => fn());
    };
  }, [initialSession.id, userId]);

  const [sessionExitDialog, setSessionExitDialog] = useState<{
    open: boolean;
    mode: "end" | "leave";
    pending: boolean;
    error: string | null;
  }>({
    open: false,
    mode: isHost ? "end" : "leave",
    pending: false,
    error: null,
  });

  const { isLaserActive, toggleLaser } = useLaserMode(sessionExitDialog.open);
  const isDrawMode = isLaserActive && !sessionExitDialog.open;
  const [screenshotsEnabled, setScreenshotsEnabled] = useState(false);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [shareState, setShareState] = useState<ShareState>({ status: "idle" });
  const [selectedMonitor, setSelectedMonitor] = useState<number | undefined>(undefined);
  const selectedMonitorRef = useRef<number | undefined>(undefined);
  const [widgetsHidden, setWidgetsHidden] = useState(false);
  const [showDebugBeacon, setShowDebugBeacon] = useState(import.meta.env.DEV);

  useEffect(() => {
    recordSessionWindowDebug("overlay:mounted", {
      sessionId: initialSession.id,
      userId,
    });
  }, [initialSession.id, userId]);

  useEffect(() => {
    if (!showDebugBeacon) {
      return;
    }

    const timer = window.setTimeout(() => setShowDebugBeacon(false), 3000);
    return () => window.clearTimeout(timer);
  }, [showDebugBeacon]);

  const toggleScreenshots = useCallback(async () => {
    const next = !screenshotsEnabled;
    await getCurrentWindow().setContentProtected(!next);
    await sessionWindowCoordinator.setAllContentProtected(!next);
    setScreenshotsEnabled(next);
  }, [screenshotsEnabled]);

  const toggleWidgetVisibility = useCallback(async () => {
    const nextHidden = !widgetsHidden;

    if (nextHidden) {
      await sessionWindowCoordinator.hideAll();
    } else {
      await sessionWindowCoordinator.showAll();
    }

    setWidgetsHidden(nextHidden);
  }, [widgetsHidden]);

  const buildCompanionPayload = useCallback(
    (): BottomBarPayload => ({
      isLaserActive,
      screenshotsEnabled,
      isSharing,
      session,
      isHost,
      participants,
    }),
    [isLaserActive, screenshotsEnabled, isSharing, session, isHost, participants],
  );

  const buildChatPayload = useCallback(
    (): ChatWindowPayload => ({
      sessionId: session.id,
      userId,
      userName,
    }),
    [session.id, userId, userName],
  );

  const handleOpenWindow = useCallback(
    async (id: SessionWindowId) => {
      if (id === "dock") {
        await sessionWindowCoordinator.ensureWindow("dock", buildCompanionPayload());
        return;
      }

      if (id === "chat") {
        await sessionWindowCoordinator.ensureWindow("chat", buildChatPayload());
        return;
      }

      if (id === "session") {
        await sessionWindowCoordinator.ensureWindow("session", buildCompanionPayload());
        return;
      }

      await sessionWindowCoordinator.ensureWindow("screen-share");
    },
    [buildChatPayload, buildCompanionPayload],
  );

  const handleOpenChat = useCallback(async () => {
    await sessionWindowCoordinator.ensureWindow("chat", buildChatPayload());
  }, [buildChatPayload]);

  const handleCloseWindow = useCallback(async (id: SessionWindowId) => {
    await sessionWindowCoordinator.closeWindow(id);
  }, []);

  useEffect(() => {
    if (!verified) {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) {
        return;
      }

      const dockPayload: BottomBarPayload = {
        isLaserActive: false,
        screenshotsEnabled: false,
        isSharing: false,
        session,
        isHost,
        participants: [],
      };

      recordSessionWindowDebug("overlay:ensure-dock", {
        sessionId: session.id,
      });
      sessionWindowCoordinator.ensureWindow("dock", dockPayload).catch(console.error);
    }, 100);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      sessionWindowCoordinator.closeWindow("dock").catch(() => {});
    };
  }, [verified, session, isHost]);

  const { getBinding } = useHotkeySettings();
  const handleSessionExitDialogOpenChange = useCallback(
    (open: boolean) => {
      setSessionExitDialog((current) => {
        if (current.pending) {
          return current;
        }

        return {
          open,
          mode: isHost ? "end" : "leave",
          pending: false,
          error: null,
        };
      });
    },
    [isHost],
  );

  const openSessionExitDialog = useCallback(() => {
    if (sessionExitDialog.open) {
      getCurrentWindow().setFocus().catch(console.error);
      return;
    }

    setSessionExitDialog({
      open: true,
      mode: isHost ? "end" : "leave",
      pending: false,
      error: null,
    });
  }, [isHost, sessionExitDialog.open]);

  const handleToggleLaser = useCallback(() => {
    if (sessionExitDialog.open) {
      getCurrentWindow().setFocus().catch(console.error);
      return;
    }

    toggleLaser();
  }, [sessionExitDialog.open, toggleLaser]);

  useGlobalHotkey(getBinding("toggle-laser"), handleToggleLaser);
  useGlobalHotkey(getBinding("end-or-leave-session"), openSessionExitDialog);
  useGlobalHotkey(getBinding("toggle-screenshots"), toggleScreenshots);
  useGlobalHotkey("CommandOrControl+Shift+H", toggleWidgetVisibility);

  useEffect(() => {
    if (isSharing || shareError) {
      return;
    }

    setShareState((state) =>
      state.status === "sharing" ? transitionShareState(state, { type: "STOP" }) : state,
    );
  }, [isSharing, shareError]);

  useEffect(() => {
    if (!shareError) {
      return;
    }

    setShareState((state) =>
      transitionShareState(state, {
        type: "CAPTURE_FAILED",
        message: shareError,
      }),
    );
  }, [shareError]);

  useEffect(() => {
    if (!verified) {
      return;
    }

    const uiState: SessionUiState = {
      laserActive: isLaserActive,
      screenshotsAllowed: screenshotsEnabled,
      participants,
      session,
      chatUnreadCount,
      shareStatus: shareState.status,
      shareSource: selectedMonitor,
      widgetsHidden,
    };

    const state: OverlayStatePayload = {
      isLaserActive,
      screenshotsEnabled,
      isSharing,
      participants,
      uiState,
    };

    emit(EVENTS.OVERLAY_STATE, state).catch(console.error);
  }, [
    verified,
    isLaserActive,
    screenshotsEnabled,
    participants,
    session,
    chatUnreadCount,
    shareState.status,
    selectedMonitor,
    widgetsHidden,
    isSharing,
  ]);

  const handleStroke = useCallback(
    (stroke: Stroke) => {
      if (isConnected) {
        broadcastStroke(stroke);
      }
    },
    [isConnected, broadcastStroke],
  );

  const handleStrokeUpdate = useCallback(
    (stroke: Stroke) => {
      if (isConnected) {
        broadcastStroke(stroke);
      }
    },
    [isConnected, broadcastStroke],
  );

  const destroyUIWindows = useCallback(async () => {
    await sessionWindowCoordinator.destroyAll();
  }, []);

  const handleEndSession = useCallback(
    async (sessionId: string) => {
      if (!isHost) {
        return "Only the host can end this session.";
      }

      try {
        const { error } = await supabase
          .from("sessions")
          .update({ status: "ended", ended_at: new Date().toISOString() })
          .eq("id", sessionId)
          .eq("host_id", userId);

        if (error) {
          console.error("[Glassboard] Failed to end session:", error);
          return "Failed to end the session. Please try again.";
        }

        await destroyUIWindows();
        await emit(EVENTS.SESSION_ENDED);
        await getCurrentWindow().destroy();
        return null;
      } catch (error) {
        console.error("[Glassboard] Failed to end session:", error);
        return "Failed to end the session. Please try again.";
      }
    },
    [isHost, userId, destroyUIWindows],
  );

  const handleLeaveSession = useCallback(async () => {
    try {
      await destroyUIWindows();
      await emit(EVENTS.SESSION_ENDED);
      await getCurrentWindow().destroy();
      return null;
    } catch (error) {
      console.error("[Glassboard] Failed to leave session:", error);
      return "Failed to leave the session. Please try again.";
    }
  }, [destroyUIWindows]);

  const handleSessionExitDialogConfirm = useCallback(async () => {
    const mode = sessionExitDialog.mode;

    setSessionExitDialog((current) => ({
      ...current,
      pending: true,
      error: null,
    }));

    const error =
      mode === "end" ? await handleEndSession(session.id) : await handleLeaveSession();

    if (!error) {
      return;
    }

    setSessionExitDialog((current) => ({
      ...current,
      pending: false,
      error,
    }));
  }, [handleEndSession, handleLeaveSession, session.id, sessionExitDialog.mode]);

  const handleShowManagement = useCallback(async () => {
    if (isLaserActive) {
      toggleLaser();
    }
    await emit(EVENTS.REQUEST_SHOW_MANAGEMENT);
  }, [isLaserActive, toggleLaser]);

  const handleSignOut = useCallback(async () => {
    await emit(EVENTS.REQUEST_SIGN_OUT);
  }, []);

  const handleShareScreen = useCallback(
    async (monitorIndex?: number) => {
      if (monitorIndex === undefined) {
        setShareState((state) => transitionShareState(state, { type: "OPEN_PICKER" }));
        await handleOpenWindow("screen-share");
        return;
      }

      selectedMonitorRef.current = monitorIndex;
      setSelectedMonitor(monitorIndex);
      const started = await shareScreen(monitorIndex);
      setShareState((state) =>
        started
          ? { status: "sharing", source: monitorIndex }
          : transitionShareState(state, {
              type: "CAPTURE_FAILED",
              message: "Failed to start screen sharing",
            }),
      );
    },
    [handleOpenWindow, shareScreen],
  );

  const handleStopSharing = useCallback(() => {
    stopSharing();
    setShareState((state) => transitionShareState(state, { type: "STOP" }));
  }, [stopSharing]);

  const handlersRef = useRef({
    toggleLaser: handleToggleLaser,
    toggleScreenshots,
    toggleWidgetVisibility,
    handleShowManagement,
    handleSignOut,
    handleShareScreen,
    handleStopSharing,
    handleEndSession,
    handleLeaveSession,
    handleOpenChat,
    handleOpenWindow,
    handleCloseWindow,
  });
  handlersRef.current = {
    toggleLaser: handleToggleLaser,
    toggleScreenshots,
    toggleWidgetVisibility,
    handleShowManagement,
    handleSignOut,
    handleShareScreen,
    handleStopSharing,
    handleEndSession,
    handleLeaveSession,
    handleOpenChat,
    handleOpenWindow,
    handleCloseWindow,
  };

  useEffect(() => {
    const unsubs = [
      listen(EVENTS.UI_TOGGLE_LASER, () => handlersRef.current.toggleLaser()),
      listen(EVENTS.UI_TOGGLE_SCREENSHOTS, () => handlersRef.current.toggleScreenshots()),
      listen(EVENTS.UI_SHOW_MANAGEMENT, () => handlersRef.current.handleShowManagement()),
      listen(EVENTS.UI_SIGN_OUT, () => handlersRef.current.handleSignOut()),
      listen<ShareScreenCommandPayload>(EVENTS.UI_SHARE_SCREEN, (e) =>
        handlersRef.current.handleShareScreen(e.payload?.monitorIndex),
      ),
      listen(EVENTS.UI_STOP_SHARING, () => handlersRef.current.handleStopSharing()),
      listen<{ sessionId: string }>(EVENTS.UI_END_SESSION, (e) =>
        handlersRef.current.handleEndSession(e.payload.sessionId),
      ),
      listen(EVENTS.UI_LEAVE_SESSION, () => handlersRef.current.handleLeaveSession()),
      listen(EVENTS.UI_OPEN_CHAT, () => handlersRef.current.handleOpenChat()),
      listen<OpenSessionWindowPayload>(EVENTS.UI_OPEN_WINDOW, (e) =>
        handlersRef.current.handleOpenWindow(e.payload.id),
      ),
      listen<OpenSessionWindowPayload>(EVENTS.UI_CLOSE_WINDOW, (e) =>
        handlersRef.current.handleCloseWindow(e.payload.id),
      ),
      listen<WidgetStateChangePayload>(EVENTS.WIDGET_STATE_CHANGE, (e) => {
        if (e.payload.widgetId === "chat" && typeof e.payload.unreadCount === "number") {
          setChatUnreadCount(e.payload.unreadCount);
        }
      }),
    ];

    return () => {
      unsubs.forEach((p) => p.then((fn) => fn()));
    };
  }, []);

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

  if (!verified) {
    return showDebugBeacon ? (
      <div className="pointer-events-none fixed right-4 top-4 z-[99999] rounded-full bg-amber-500/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-black">
        Overlay Mount
      </div>
    ) : null;
  }

  return (
    <>
      {showDebugBeacon && (
        <div className="pointer-events-none fixed right-4 top-4 z-[99999] rounded-full bg-emerald-400/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-black">
          Overlay Verified
        </div>
      )}
      <SessionExitDialog
        open={sessionExitDialog.open}
        mode={sessionExitDialog.mode}
        pending={sessionExitDialog.pending}
        error={sessionExitDialog.error}
        onOpenChange={handleSessionExitDialogOpenChange}
        onConfirm={handleSessionExitDialogConfirm}
      />
      {remoteFrame && <ScreenMirrorView frameUrl={remoteFrame} />}
      <AnnotationCanvas
        isDrawMode={isDrawMode}
        localUserId={userId}
        remoteStrokes={remoteStrokes}
        onStroke={handleStroke}
        onStrokeUpdate={handleStrokeUpdate}
      />
      <RemoteCursorsOverlay cursors={cursors} />
    </>
  );
}
