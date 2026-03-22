// src/types/events.ts
import type { Session } from "../hooks/useSessions";
import type { Organization } from "../hooks/useOrganizations";
import type { PresenceUser } from "../hooks/usePresence";

/** Payload passed from management window to overlay via URL query param */
export interface OverlayPayload {
  userId: string;
  userName: string;
  userAvatarUrl?: string;
  activeSession: Session;
  currentOrg: Organization;
}

/** Payload passed to the bottom bar window */
export interface BottomBarPayload {
  isLaserActive: boolean;
  screenshotsEnabled: boolean;
  isSharing: boolean;
  session?: Session;
  isHost?: boolean;
  participants?: PresenceUser[];
}

/** @deprecated Session bar merged into bottom bar */
export interface SessionBarPayload {
  session: Session;
  isHost: boolean;
  participants: PresenceUser[];
}

/** State broadcast from overlay to UI windows */
export interface OverlayStatePayload {
  isLaserActive: boolean;
  screenshotsEnabled: boolean;
  isSharing: boolean;
  participants: PresenceUser[];
}

/** Tauri event names for cross-window communication */
export const EVENTS = {
  // Management ↔ Overlay
  SESSION_ENDED: "session-ended",
  REQUEST_SHOW_MANAGEMENT: "request-show-management",
  REQUEST_SIGN_OUT: "request-sign-out",
  DEACTIVATE_LASER: "deactivate-laser",

  // Overlay → UI windows (state broadcasts)
  OVERLAY_STATE: "overlay:state",

  // UI windows → Overlay (actions)
  UI_TOGGLE_LASER: "ui:toggle-laser",
  UI_END_SESSION: "ui:end-session",
  UI_LEAVE_SESSION: "ui:leave-session",
  UI_SHOW_MANAGEMENT: "ui:show-management",
  UI_SIGN_OUT: "ui:sign-out",
  UI_TOGGLE_SCREENSHOTS: "ui:toggle-screenshots",
  UI_SHARE_SCREEN: "ui:share-screen",
  UI_STOP_SHARING: "ui:stop-sharing",
} as const;
