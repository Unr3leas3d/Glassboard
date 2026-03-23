import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { transitionShareState } from "../src/services/sessionWindows/shareState";

assert.equal(
  transitionShareState({ status: "idle" }, { type: "OPEN_PICKER" }).status,
  "selecting-source",
);
assert.equal(
  transitionShareState({ status: "sharing", source: 0 }, { type: "CAPTURE_FAILED" }).status,
  "error",
);
assert.equal(
  transitionShareState({ status: "sharing", source: 0 }, { type: "STOP" }).status,
  "idle",
);

const dockSource = readFileSync("src/windows/dock/DockApp.tsx", "utf8");
assert.equal(dockSource.includes("showSessionInfo"), false);
assert.equal(dockSource.includes("EVENTS.UI_OPEN_WINDOW"), true);

const sessionWidgetSource = readFileSync("src/widgets/session/SessionWidget.tsx", "utf8");
assert.equal(sessionWidgetSource.includes("uiState"), true);

const screenShareWidgetSource = readFileSync(
  "src/widgets/screen-share/ScreenShareWidget.tsx",
  "utf8",
);
assert.equal(screenShareWidgetSource.includes("MonitorPicker"), true);

const chatWidgetSource = readFileSync("src/widgets/chat/ChatWidget.tsx", "utf8");
assert.equal(chatWidgetSource.includes("EVENTS.WIDGET_STATE_CHANGE"), true);

const screenMirrorSource = readFileSync("src/hooks/useScreenMirror.ts", "utf8");
assert.equal(screenMirrorSource.includes("setInterval"), true);

assert.equal(existsSync("src/hooks/useCaptureDetection.ts"), false);

const tauriLibSource = readFileSync("src-tauri/src/lib.rs", "utf8");
assert.equal(tauriLibSource.includes("is_screen_being_captured"), false);

const screenCaptureSource = readFileSync("src-tauri/src/screen_capture.rs", "utf8");
assert.equal(screenCaptureSource.includes("pub fn is_screen_being_captured"), false);

console.log("share state: ok");
