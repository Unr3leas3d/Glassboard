// src/windows/dock/DockApp.tsx
import { useState, useEffect, useCallback } from "react";
import { listen, emitTo } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  LayoutDashboard,
  Pen,
  Camera,
  CameraOff,
  Monitor,
  MessageCircle,
  Users,
  LogOut,
} from "lucide-react";
import { DockIcon } from "../../components/DockIcon";
import { recordSessionWindowDebug } from "../../services/sessionWindows/debug";
import { decodeWindowPayload } from "../../services/sessionWindows/payload";
import { EVENTS } from "../../types/events";
import type {
  BottomBarPayload,
  OpenSessionWindowPayload,
  OverlayStatePayload,
  SessionUiState,
} from "../../types/events";
import { modifierLabel } from "../../utils/platform";

function readPayload(): BottomBarPayload {
  const params = new URLSearchParams(window.location.search);
  return decodeWindowPayload<BottomBarPayload>(params.get("payload"), "No payload in dock URL");
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

export function DockApp() {
  const [payload] = useState<BottomBarPayload>(readPayload);
  const [state, setState] = useState<OverlayStatePayload>({
    isLaserActive: payload.isLaserActive,
    screenshotsEnabled: payload.screenshotsEnabled,
    isSharing: payload.isSharing,
    participants: payload.participants ?? [],
    uiState: buildInitialUiState(payload),
  });

  useEffect(() => {
    recordSessionWindowDebug("dock:mounted", {
      hasSession: Boolean(payload.session),
    });

    const handleMouseEnter = () => {
      getCurrentWindow().setFocus().catch(console.error);
    };

    document.addEventListener("mouseenter", handleMouseEnter);
    return () => document.removeEventListener("mouseenter", handleMouseEnter);
  }, []);

  useEffect(() => {
    const unlisten = listen<OverlayStatePayload>(EVENTS.OVERLAY_STATE, (e) => {
      setState(e.payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    getCurrentWindow()
      .setContentProtected(!state.uiState.screenshotsAllowed)
      .catch(console.error);
  }, [state.uiState.screenshotsAllowed]);

  const openWindow = useCallback((id: OpenSessionWindowPayload["id"]) => {
    emitTo("overlay", EVENTS.UI_OPEN_WINDOW, { id } satisfies OpenSessionWindowPayload).catch(
      console.error,
    );
  }, []);

  const toggleLaser = useCallback(() => emitTo("overlay", EVENTS.UI_TOGGLE_LASER), []);
  const toggleScreenshots = useCallback(
    () => emitTo("overlay", EVENTS.UI_TOGGLE_SCREENSHOTS),
    [],
  );
  const signOut = useCallback(() => emitTo("overlay", EVENTS.UI_SIGN_OUT), []);
  const showManagement = useCallback(() => emitTo("overlay", EVENTS.UI_SHOW_MANAGEMENT), []);

  return (
    <div className="glasboard-bottom-bar-container">
      <div className="glasboard-bottom-bar-wrapper">
        <DockIcon
          icon={LayoutDashboard}
          label="Open dashboard"
          title={`Open dashboard (${modifierLabel}+Shift+D)`}
          onClick={showManagement}
        />

        <DockIcon
          icon={Pen}
          label={state.uiState.laserActive ? "Deactivate laser pointer" : "Activate laser pointer"}
          title={
            state.uiState.laserActive
              ? `Laser on - click or ${modifierLabel}+Shift+G to deactivate`
              : `Click or ${modifierLabel}+Shift+G to activate laser`
          }
          active={state.uiState.laserActive}
          variant={state.uiState.laserActive ? "active" : "default"}
          onClick={toggleLaser}
        />

        <DockIcon
          icon={state.uiState.screenshotsAllowed ? Camera : CameraOff}
          label={
            state.uiState.screenshotsAllowed
              ? "Disable screenshot mode"
              : "Enable screenshot mode"
          }
          title={
            state.uiState.screenshotsAllowed
              ? "Screenshots enabled - click to re-enable protection"
              : "Click to allow screenshots"
          }
          variant={state.uiState.screenshotsAllowed ? "screenshot" : "default"}
          onClick={toggleScreenshots}
        />

        <DockIcon
          icon={Monitor}
          label="Open screen share controls"
          title="Open screen share controls"
          active={state.uiState.shareStatus === "sharing"}
          variant={state.uiState.shareStatus === "sharing" ? "active" : "default"}
          onClick={() => openWindow("screen-share")}
        />

        <DockIcon
          icon={MessageCircle}
          label="Open chat"
          title="Open chat"
          badge={state.uiState.chatUnreadCount}
          onClick={() => openWindow("chat")}
        />

        <DockIcon
          icon={Users}
          label="Open session details"
          title="Open session details"
          onClick={() => openWindow("session")}
        />

        <DockIcon icon={LogOut} label="Sign out" title="Sign out" onClick={signOut} />
      </div>
    </div>
  );
}
