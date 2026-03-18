import React from "react";
import ReactDOM from "react-dom/client";
import "./App.css";

const params = new URLSearchParams(window.location.search);
const windowType = params.get("window");

if (windowType === "overlay") {
  document.body.classList.add("overlay-window");
}

async function renderApp() {
  let AppComponent: React.ComponentType;

  if (windowType === "overlay") {
    const { OverlayApp } = await import("./windows/overlay/OverlayApp");
    AppComponent = OverlayApp;
  } else {
    const { ManagementApp } = await import("./windows/management/ManagementApp");
    AppComponent = ManagementApp;
  }

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <AppComponent />
    </React.StrictMode>,
  );
}

renderApp();
