import { useState, useEffect, useCallback, useRef } from "react";
import { listen, emitTo } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize, LogicalPosition } from "@tauri-apps/api/dpi";
import { BottomBar } from "../../components/BottomBar";
import { EVENTS } from "../../types/events";
import type { BottomBarPayload, OverlayStatePayload } from "../../types/events";
import type { PresenceUser } from "../../hooks/usePresence";

const COLLAPSED_HEIGHT = 60;
const EXPANDED_HEIGHT = 240;
const BAR_WIDTH = 340; // 6 buttons × 44px + 5 gaps × 8px + padding

function readPayload(): BottomBarPayload {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("payload");
  if (!raw) return { isLaserActive: false, screenshotsEnabled: false, isSharing: false };
  return JSON.parse(atob(raw));
}

export function BottomBarApp() {
  const [payload] = useState<BottomBarPayload>(readPayload);
  const [state, setState] = useState({
    isLaserActive: payload.isLaserActive,
    screenshotsEnabled: payload.screenshotsEnabled,
    isSharing: payload.isSharing,
    participants: (payload.participants ?? []) as PresenceUser[],
  });

  // Store screen dimensions for resize calculations
  const screenDims = useRef({
    width: window.screen.availWidth,
    height: window.screen.availHeight,
    top: (window.screen as { availTop?: number }).availTop ?? 0,
  });

  const handlePanelToggle = useCallback(async (isOpen: boolean) => {
    const { width, height, top } = screenDims.current;
    const newHeight = isOpen ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT;
    const win = getCurrentWindow();
    await win.setSize(new LogicalSize(BAR_WIDTH, newHeight));
    await win.setPosition(new LogicalPosition(Math.round((width - BAR_WIDTH) / 2), top + height - newHeight));
  }, []);

  // Focus window on hover so clicks register immediately
  useEffect(() => {
    const handleMouseEnter = () => {
      getCurrentWindow().setFocus();
    };
    document.addEventListener("mouseenter", handleMouseEnter);
    return () => document.removeEventListener("mouseenter", handleMouseEnter);
  }, []);

  // Listen for state updates from overlay
  useEffect(() => {
    const unlisten = listen<OverlayStatePayload>(EVENTS.OVERLAY_STATE, (e) => {
      setState({
        isLaserActive: e.payload.isLaserActive,
        screenshotsEnabled: e.payload.screenshotsEnabled,
        isSharing: e.payload.isSharing,
        participants: e.payload.participants,
      });
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  // Mirror privacy mode from overlay: protect bottom bar from screenshots too
  useEffect(() => {
    getCurrentWindow().setContentProtected(!state.screenshotsEnabled);
  }, [state.screenshotsEnabled]);

  const toggleLaser = useCallback(() => emitTo("overlay", EVENTS.UI_TOGGLE_LASER), []);
  const toggleScreenshots = useCallback(() => emitTo("overlay", EVENTS.UI_TOGGLE_SCREENSHOTS), []);
  const signOut = useCallback(() => emitTo("overlay", EVENTS.UI_SIGN_OUT), []);
  const shareScreen = useCallback(() => emitTo("overlay", EVENTS.UI_SHARE_SCREEN), []);
  const stopSharing = useCallback(() => emitTo("overlay", EVENTS.UI_STOP_SHARING), []);
  const showManagement = useCallback(() => emitTo("overlay", EVENTS.UI_SHOW_MANAGEMENT), []);
  const endSession = useCallback(
    (sessionId: string) => emitTo("overlay", EVENTS.UI_END_SESSION, { sessionId }),
    [],
  );
  const leaveSession = useCallback(() => emitTo("overlay", EVENTS.UI_LEAVE_SESSION), []);

  return (
    <BottomBar
      isActive={state.isLaserActive}
      onToggleLaser={toggleLaser}
      screenshotsEnabled={state.screenshotsEnabled}
      onToggleScreenshots={toggleScreenshots}
      onSignOut={signOut}
      isSharing={state.isSharing}
      onShareScreen={shareScreen}
      onStopSharing={stopSharing}
      onShowManagement={showManagement}
      session={payload.session}
      isHost={payload.isHost}
      participants={state.participants}
      onEndSession={endSession}
      onLeaveSession={leaveSession}
      onPanelToggle={handlePanelToggle}
    />
  );
}
