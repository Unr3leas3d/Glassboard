import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const overlaySource = readFileSync("src/windows/overlay/OverlayApp.tsx", "utf8");
assert.equal(overlaySource.includes("supabase.auth.getUser()"), false);
assert.equal(overlaySource.includes('emitTo("management", EVENTS.REQUEST_OVERLAY_VALIDATION'), true);
assert.equal(overlaySource.includes("EVENTS.OVERLAY_VALIDATION_RESULT"), true);
assert.equal(overlaySource.includes("const handleSessionExitDialogConfirm = useCallback(() => {}, []);"), false);
assert.equal(overlaySource.includes("handleEndSession(session.id)"), true);
assert.equal(overlaySource.includes("handleLeaveSession()"), true);

const dialogSource = readFileSync("src/components/session/SessionExitDialog.tsx", "utf8");
assert.equal(dialogSource.includes("const confirmDisabled = true;"), false);
assert.equal(dialogSource.includes("const confirmDisabled = props.pending;"), true);
assert.equal(dialogSource.includes("Confirmation will be enabled in the next step."), false);

const managementSource = readFileSync("src/windows/management/ManagementApp.tsx", "utf8");
assert.match(
  managementSource,
  /listen<OverlayValidationRequestPayload>\(\s*EVENTS\.REQUEST_OVERLAY_VALIDATION/,
);
assert.match(
  managementSource,
  /emitTo\("overlay",\s*EVENTS\.OVERLAY_VALIDATION_RESULT/,
);

const eventsSource = readFileSync("src/types/events.ts", "utf8");
assert.equal(eventsSource.includes("REQUEST_OVERLAY_VALIDATION"), true);
assert.equal(eventsSource.includes("OVERLAY_VALIDATION_RESULT"), true);
