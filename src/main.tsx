import React from "react";
import ReactDOM from "react-dom/client";
import { initPlatform } from "@/utils/platform";
import {
  ALWAYS_DARK_WINDOW_TYPES,
  TRANSPARENT_WINDOW_TYPES,
} from "@/services/sessionWindows/definitions";
import "./App.css";

const params = new URLSearchParams(window.location.search);
const windowType = params.get("window");

// Transparent window types need transparent html/body
if (TRANSPARENT_WINDOW_TYPES.includes((windowType ?? "") as (typeof TRANSPARENT_WINDOW_TYPES)[number])) {
  document.documentElement.classList.add("overlay-window");
  document.body.classList.add("overlay-window");
}

// Theme initialization (synchronous, before React renders to prevent FOUC)
if (ALWAYS_DARK_WINDOW_TYPES.includes((windowType ?? "") as (typeof ALWAYS_DARK_WINDOW_TYPES)[number])) {
  document.documentElement.classList.add("dark");
} else {
  // Management / landing windows: read persisted theme
  const storedTheme = localStorage.getItem("glasboard_theme") || "dark";
  const resolved =
    storedTheme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : storedTheme;
  if (resolved === "dark") {
    document.documentElement.classList.add("dark");
  }
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

async function renderApp() {
  await initPlatform();

  let AppComponent: React.ComponentType;

  // Detect if we are running inside the Tauri Desktop App.
  const isDesktop = typeof window.__TAURI_INTERNALS__ !== "undefined" || window.location.protocol.startsWith('tauri');

  if (windowType === "overlay") {
    const { OverlayApp } = await import("./windows/overlay/OverlayApp");
    AppComponent = OverlayApp;
  } else if (windowType === "dock") {
    const { DockApp } = await import("./windows/dock/DockApp");
    AppComponent = DockApp;
  } else if (windowType === "chat") {
    const { ChatWidget } = await import("./widgets/chat/ChatWidget");
    AppComponent = ChatWidget;
  } else if (windowType === "screen-share") {
    const { ScreenShareWidget } = await import("./widgets/screen-share/ScreenShareWidget");
    AppComponent = ScreenShareWidget;
  } else if (windowType === "session") {
    const { SessionWidget } = await import("./widgets/session/SessionWidget");
    AppComponent = SessionWidget;
  } else if (windowType === "testuser") {
    const { TestUserApp } = await import("./windows/testuser/TestUserApp");
    AppComponent = TestUserApp;
  } else if (windowType === "admin") {
    const { AdminApp } = await import("./windows/admin/AdminApp");
    AppComponent = AdminApp;
  } else if (isDesktop || import.meta.env.VITE_DEV_DESKTOP_VIEW === 'true') {
    const { ManagementApp } = await import("./windows/management/ManagementApp");
    AppComponent = ManagementApp;
  } else {
    const { LandingApp } = await import("./windows/landing/LandingApp");
    AppComponent = LandingApp;
  }

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <AppComponent />
    </React.StrictMode>,
  );
}

renderApp();
