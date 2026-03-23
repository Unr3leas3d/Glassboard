import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildWindowUrl,
  decodeWindowPayload,
  encodeWindowPayload,
} from "../src/services/sessionWindows/payload";

const unicodePayload = {
  userId: "user-123",
  userName: "Zoe 李 🚀",
  activeSession: {
    id: "session-123",
    title: "Brainstorm — café",
  },
};

const encodedPayload = encodeWindowPayload(unicodePayload);
assert.equal(typeof encodedPayload, "string");
assert.equal(encodedPayload.length > 0, true);

const decodedPayload = decodeWindowPayload(
  decodeURIComponent(encodedPayload),
  "Expected encoded payload to decode",
);
assert.deepEqual(decodedPayload, unicodePayload);

const overlayUrl = buildWindowUrl("overlay", unicodePayload);
const overlayParams = new URL(overlayUrl, "http://localhost").searchParams;
assert.deepEqual(
  decodeWindowPayload(overlayParams.get("payload"), "Expected payload in overlay URL"),
  unicodePayload,
);

const dockSource = readFileSync("src/windows/dock/DockApp.tsx", "utf8");
assert.equal(dockSource.includes("decodeWindowPayload<BottomBarPayload>("), true);
assert.equal(dockSource.includes("JSON.parse(atob(raw))"), false);

const chatSource = readFileSync("src/widgets/chat/ChatWidget.tsx", "utf8");
assert.equal(chatSource.includes("decodeWindowPayload<ChatPayload>("), true);
assert.equal(chatSource.includes("JSON.parse(atob(raw))"), false);

const sessionSource = readFileSync("src/widgets/session/SessionWidget.tsx", "utf8");
assert.equal(sessionSource.includes("decodeWindowPayload<BottomBarPayload>("), true);
assert.equal(sessionSource.includes("JSON.parse(atob(raw))"), false);

const sessionBarSource = readFileSync("src/windows/sessionbar/SessionBarApp.tsx", "utf8");
assert.equal(sessionBarSource.includes("decodeWindowPayload<SessionBarPayload>("), true);
assert.equal(sessionBarSource.includes("JSON.parse(atob(raw))"), false);

const managementSource = readFileSync("src/windows/management/ManagementApp.tsx", "utf8");
assert.equal(managementSource.includes('buildWindowUrl("overlay", payload)'), true);
assert.equal(managementSource.includes("btoa(JSON.stringify(payload))"), false);
