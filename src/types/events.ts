// src/types/events.ts
import type { Session } from "../hooks/useSessions";
import type { Organization } from "../hooks/useOrganizations";

/** Payload passed from management window to overlay via URL query param */
export interface OverlayPayload {
  userId: string;
  userName: string;
  activeSession: Session;
  currentOrg: Organization;
}

/** Tauri event names for cross-window communication */
export const EVENTS = {
  SESSION_ENDED: "session-ended",
  REQUEST_SHOW_MANAGEMENT: "request-show-management",
  REQUEST_SIGN_OUT: "request-sign-out",
  DEACTIVATE_LASER: "deactivate-laser",
} as const;
