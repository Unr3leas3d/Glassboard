import type { WebviewOptions } from "@tauri-apps/api/webview";
import type { WindowOptions } from "@tauri-apps/api/window";

export const SESSION_WINDOW_IDS = [
  "dock",
  "chat",
  "session",
  "screen-share",
] as const;

export type SessionWindowId = (typeof SESSION_WINDOW_IDS)[number];

export interface SessionWindowDefinition {
  id: SessionWindowId;
  label: SessionWindowId;
  route: SessionWindowId;
  title: string;
  legacyLabels?: string[];
  defaultSize: { width: number; height: number };
  collapsedSize: { width: number; height: number };
  defaultPosition: { x: number; y: number };
  windowOptions: Partial<
    Omit<WebviewOptions, "x" | "y" | "width" | "height"> & WindowOptions
  >;
}

export const SESSION_WINDOW_DEFINITIONS: SessionWindowDefinition[] = [
  {
    id: "dock",
    label: "dock",
    route: "dock",
    title: "Dock",
    defaultSize: { width: 392, height: 60 },
    collapsedSize: { width: 392, height: 60 },
    defaultPosition: { x: 0, y: 0 },
    windowOptions: {
      transparent: true,
      decorations: false,
      alwaysOnTop: true,
      resizable: false,
    },
  },
  {
    id: "chat",
    label: "chat",
    route: "chat",
    title: "Chat",
    legacyLabels: ["widget-chat"],
    defaultSize: { width: 320, height: 480 },
    collapsedSize: { width: 44, height: 44 },
    defaultPosition: { x: 100, y: 80 },
    windowOptions: {
      transparent: true,
      decorations: false,
      alwaysOnTop: true,
      resizable: true,
    },
  },
  {
    id: "session",
    label: "session",
    route: "session",
    title: "Session",
    defaultSize: { width: 300, height: 400 },
    collapsedSize: { width: 44, height: 44 },
    defaultPosition: { x: 200, y: 200 },
    windowOptions: {
      transparent: true,
      decorations: false,
      alwaysOnTop: true,
      resizable: true,
    },
  },
  {
    id: "screen-share",
    label: "screen-share",
    route: "screen-share",
    title: "Screen Share",
    defaultSize: { width: 400, height: 300 },
    collapsedSize: { width: 44, height: 44 },
    defaultPosition: { x: 200, y: 100 },
    windowOptions: {
      transparent: true,
      decorations: false,
      alwaysOnTop: true,
      resizable: true,
    },
  },
] as const;

export const SESSION_WINDOW_ROUTES = SESSION_WINDOW_DEFINITIONS.map(
  (definition) => definition.route,
);

export function getSessionWindowDefinition(id: string) {
  return SESSION_WINDOW_DEFINITIONS.find((definition) => definition.id === id);
}

export const TRANSPARENT_WINDOW_TYPES = ["overlay", ...SESSION_WINDOW_ROUTES] as const;

export const ALWAYS_DARK_WINDOW_TYPES = [
  "overlay",
  ...SESSION_WINDOW_ROUTES,
  "testuser",
] as const;
