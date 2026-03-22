import React from "react";
import ReactDOM from "react-dom/client";
import "./App.css";

const params = new URLSearchParams(window.location.search);
const windowType = params.get("window");

// Transparent window types need transparent html/body
const transparentWindows = ["overlay", "bottombar"];
if (transparentWindows.includes(windowType ?? "")) {
  document.documentElement.classList.add("overlay-window");
  document.body.classList.add("overlay-window");
}

// Theme initialization (synchronous, before React renders to prevent FOUC)
const alwaysDarkWindows = ["overlay", "bottombar", "sessionbar", "testuser"];
if (alwaysDarkWindows.includes(windowType ?? "")) {
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
  let AppComponent: React.ComponentType;

  // Detect if we are running inside the Tauri Desktop App.
  const isDesktop = typeof window.__TAURI_INTERNALS__ !== "undefined" || window.location.protocol.startsWith('tauri');

  if (windowType === "overlay") {
    const { OverlayApp } = await import("./windows/overlay/OverlayApp");
    AppComponent = OverlayApp;
  } else if (windowType === "bottombar") {
    const { BottomBarApp } = await import("./windows/bottombar/BottomBarApp");
    AppComponent = BottomBarApp;
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
