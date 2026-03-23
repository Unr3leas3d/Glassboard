import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  getSessionWindowStorageKey,
  isSessionWindowId,
  sanitizeSessionWindowPosition,
} from "../src/services/sessionWindows/coordinator";
import {
  getSessionWindowDefinition,
  SESSION_WINDOW_DEFINITIONS,
} from "../src/services/sessionWindows/definitions";

const labels = new Set<string>();
const routes = new Set<string>();

for (const def of SESSION_WINDOW_DEFINITIONS) {
  assert.ok(def.id);
  assert.ok(def.label);
  assert.ok(def.route);
  assert.equal(labels.has(def.label), false, `duplicate label: ${def.label}`);
  assert.equal(routes.has(def.route), false, `duplicate route: ${def.route}`);
  labels.add(def.label);
  routes.add(def.route);
}

assert.ok(labels.has("dock"));
assert.ok(labels.has("chat"));
assert.ok(labels.has("session"));
assert.ok(labels.has("screen-share"));

assert.equal(getSessionWindowStorageKey("chat"), "glasboard_session_window_chat");
assert.equal(isSessionWindowId("dock"), true);
assert.equal(isSessionWindowId("widget-chat"), false);

const dockDefinition = getSessionWindowDefinition("dock");
assert.ok(dockDefinition);
assert.deepEqual(
  sanitizeSessionWindowPosition(
    dockDefinition,
    { x: 2636, y: 3860 },
    { width: 1440, height: 900, top: 25 },
  ),
  {
    x: Math.round((1440 - dockDefinition.defaultSize.width) / 2),
    y: 25 + 900 - dockDefinition.defaultSize.height,
  },
);

const chatDefinition = getSessionWindowDefinition("chat");
assert.ok(chatDefinition);
assert.deepEqual(
  sanitizeSessionWindowPosition(
    chatDefinition,
    { x: 99999, y: -500 },
    { width: 1440, height: 900, top: 25 },
  ),
  {
    x: 1440 - chatDefinition.defaultSize.width,
    y: 25,
  },
);
assert.equal(existsSync("src-tauri/capabilities/dock.json"), true);
assert.equal(existsSync("src-tauri/capabilities/chat.json"), true);
assert.equal(existsSync("src-tauri/capabilities/session.json"), true);
assert.equal(existsSync("src-tauri/capabilities/screen-share.json"), true);
assert.equal(existsSync("src-tauri/capabilities/bottombar.json"), false);
assert.equal(existsSync("src-tauri/capabilities/sessionbar.json"), false);

const overlayAppSource = readFileSync("src/windows/overlay/OverlayApp.tsx", "utf8");
assert.equal(overlayAppSource.includes("useCaptureDetection"), false);
assert.equal(overlayAppSource.includes("dockRef"), false);
assert.equal(overlayAppSource.includes("chatRef"), false);
assert.equal(overlayAppSource.includes("new WebviewWindow"), false);
assert.equal(overlayAppSource.includes("widget-chat"), false);
assert.equal(
  overlayAppSource.includes("sessionWindowCoordinator.ensureWindow(\"dock\""),
  true,
);
assert.equal(
  overlayAppSource.includes("sessionWindowCoordinator.ensureWindow(\"chat\""),
  true,
);
assert.equal(
  overlayAppSource.includes("sessionWindowCoordinator.destroyAll()"),
  true,
);

const coordinatorSource = readFileSync("src/services/sessionWindows/coordinator.ts", "utf8");
assert.equal(coordinatorSource.includes("window.isVisible()"), true);
assert.equal(coordinatorSource.includes("instance.window.show()"), true);

console.log("session window contracts: ok");
