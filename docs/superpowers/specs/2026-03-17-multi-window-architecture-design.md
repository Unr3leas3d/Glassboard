# Multi-Window Architecture Design

## Summary

Split Glasboard into two separate Tauri windows: a **management window** for auth, org management, and session setup, and a **transparent overlay window** for the Excalidraw annotation canvas. The overlay only spawns after the user joins a session. Similar to Whisper Flow's separation of control panel and tool.

## Motivation

Currently, auth UI, org management, and the transparent overlay all live in a single window. This means the transparent always-on-top window must also handle opaque UI flows (login, org creation, session join), requiring `setIgnoreCursorEvents` toggling and a fragile single-window state machine. Splitting into two windows gives each a clear purpose and eliminates the need to switch window properties at runtime.

## Architecture

### Window Definitions

**Management window** (`label: "management"`):
- Defined statically in `tauri.conf.json`
- Frameless compact panel, fixed size (460x640), centered, not always-on-top
- No transparency, no click-through
- Launched at app startup

**Overlay window** (`label: "overlay"`):
- Created programmatically via `new WebviewWindow()` from the management window
- Transparent, decorations off, always-on-top, maximized, not resizable
- `macOSPrivateApi: true` is app-level (process-wide), so transparency works
- `contentProtected: true` set explicitly in constructor options
- Click-through by default (`setIgnoreCursorEvents(true)`)

Exact `WebviewWindow` constructor options:
```typescript
const baseUrl = import.meta.env.DEV
  ? "http://localhost:1420"
  : "index.html";

new WebviewWindow("overlay", {
  url: `${baseUrl}?window=overlay&payload=${encodeURIComponent(btoa(JSON.stringify(sessionPayload)))}`,
  transparent: true,
  decorations: false,
  alwaysOnTop: true,
  maximized: true,
  resizable: false,
  contentProtected: true,
});
```

### Window Lifecycle

1. **App startup**: Only the management window opens. User authenticates and selects/creates an org.
2. **Session start**: User creates or joins a session. Management window checks if an overlay with label "overlay" already exists (and destroys it if so), then spawns a new overlay with session data encoded in the URL query param. Management window hides itself.
3. **Return to management**: User presses `Cmd+Shift+D` or clicks dashboard button on BottomBar. Management window shows and focuses. Overlay stays alive. **Laser is automatically deactivated** when management window shows, so the overlay returns to click-through mode and doesn't block interaction with management.
4. **Session end**: User ends/leaves session. Overlay emits `session-ended` then self-destructs. Management window listens for `session-ended` and also for `tauri://destroyed` on the overlay label (to catch crashes/force-quits), then shows itself and clears session state.
5. **Sign out**: Overlay destroyed (if exists), auth cleared, management shows login. Overlay also listens for `SIGNED_OUT` from Supabase's `onAuthStateChange` and self-destructs if triggered.
6. **App quit**: Closing the management window (Cmd+Q or window close) destroys the overlay and exits the app.

### Session Data Passing

Session data is passed via URL query parameter (base64-encoded JSON), **not** via Tauri events. This eliminates the race condition where the overlay's event listener might not be registered before the management window emits.

The overlay reads the payload synchronously on mount:
```typescript
const params = new URLSearchParams(window.location.search);
const payload = JSON.parse(atob(params.get("payload")!));
// payload: { userId, userName, activeSession, currentOrg }
```

### Cross-Window Communication

Uses Tauri's event system (`emit` / `listen`) for runtime events only (not initial data).

**Overlay -> Management events:**
- `session-ended`: User ended/left the session from the overlay.
- `request-show-management`: User wants to see the management window (hotkey or button).
- `request-sign-out`: User clicked sign out from the overlay BottomBar.

**Management listens for:**
- `session-ended` and `tauri://destroyed` (on overlay label) for cleanup.
- `request-show-management` to show and focus itself.
- `request-sign-out` to trigger sign-out flow.

No Management -> Overlay events needed at runtime (initial data is in the URL).

**Auth token sharing:** Both windows share the same WebView data store (same origin in Tauri v2), so Supabase auth state is shared via localStorage automatically. The overlay does **not** run `useAuth` — it trusts the payload for user identity and only uses the Supabase client for realtime channel operations. The overlay listens to `supabase.auth.onAuthStateChange` for `SIGNED_OUT` to self-destruct if the user signs out from management.

### Frontend Router

`src/main.tsx` reads `window.location.search`:
- No `window` param or `?window=management` -> renders `ManagementApp`
- `?window=overlay` -> renders `OverlayApp`

Both share the same `index.html` and JS bundle. Single Vite entrypoint, no build config changes.

**Dev mode:** The overlay URL uses `http://localhost:1420?window=overlay&payload=...` in dev mode and `index.html?window=overlay&payload=...` in production. The management window detects the environment via `import.meta.env.DEV`.

## File Structure

```
src/
  main.tsx                          # Router: reads ?window= param, renders correct root
  supabase.ts                       # Shared Supabase client (unchanged)
  types/
    events.ts                       # Shared types for session payload and event contracts
  hooks/                            # All existing hooks (unchanged, shared)
  components/                       # All existing components (unchanged, shared)
  windows/
    management/
      ManagementApp.tsx             # Root: auth, org, session setup, overlay lifecycle
    overlay/
      OverlayApp.tsx                # Root: reads payload from URL, runs canvas + realtime
```

### ManagementApp.tsx

Responsibilities:
- Auth flow (LoginPage, OfflineBanner)
- Org management (ManagementPanel, OrgSwitcher, CreateOrgDialog, MembersList)
- Session controls (CreateSessionButton, JoinSessionDialog)
- Overlay lifecycle: spawn on session start, destroy on session end
- Listen for overlay events (session-ended, request-show-management, request-sign-out)
- Listen for `tauri://destroyed` on overlay label for crash recovery
- Register `Cmd+Shift+D` hotkey to show self
- Error handling: if `new WebviewWindow()` fails, show error to user instead of silently failing

### OverlayApp.tsx

Responsibilities:
- Read session payload from URL query param on mount
- Render ExcalidrawCanvas, BottomBar, SessionBar, RemoteCursorsOverlay, ParticipantList, ScreenMirrorView
- Initialize own realtime hooks: useSessionChannel, useRealtimeAnnotations, useRealtimeCursors, usePresence, useScreenMirror
- useLaserMode + useGlobalHotkey for `Cmd+Shift+G` and `Cmd+Shift+S`
- On session end/leave: emit `session-ended`, then `getCurrentWindow().destroy()`
- Listen for `SIGNED_OUT` from `supabase.auth.onAuthStateChange` and self-destruct

### App.tsx

Becomes unused — replaced by ManagementApp and OverlayApp. Will be deleted.

## Tauri Config Changes

### tauri.conf.json

Windows array changes from overlay to management:
```json
"windows": [
  {
    "label": "management",
    "title": "Glasboard",
    "transparent": false,
    "decorations": false,
    "alwaysOnTop": false,
    "width": 460,
    "height": 640,
    "resizable": false,
    "center": true
  }
]
```

### capabilities/default.json

Add management window and new permissions:
```json
{
  "windows": ["management", "overlay"],
  "permissions": [
    "core:default",
    "opener:default",
    "core:window:allow-set-content-protected",
    "core:window:allow-set-focus",
    "core:window:allow-set-ignore-cursor-events",
    "core:window:allow-create",
    "core:window:allow-hide",
    "core:window:allow-show",
    "core:window:allow-destroy",
    "core:window:allow-close",
    "core:window:allow-set-always-on-top",
    "core:event:default",
    "global-shortcut:default",
    "global-shortcut:allow-register",
    "global-shortcut:allow-unregister",
    "deep-link:default"
  ]
}
```

## BottomBar Changes

Add a dashboard button (grid/home icon) as the first button in the pill bar, before the laser toggle. On click, emits `request-show-management` via Tauri events. Same visual style as existing pill buttons.

The sign-out button in the overlay BottomBar emits `request-sign-out` instead of calling `supabase.auth.signOut()` directly, so the management window can coordinate cleanup.

## Global Hotkeys

All global hotkeys are **process-wide** (Tauri global shortcuts are not window-scoped). Ownership model:

| Hotkey | Action | Owner | Registered When |
|--------|--------|-------|-----------------|
| `Cmd+Shift+G` | Toggle laser pointer | Overlay | Overlay mounts |
| `Cmd+Shift+D` | Show management window | Management | Management mounts |
| `Cmd+Shift+S` | Toggle screenshots | Overlay | Overlay mounts |

Each window only registers its own hotkeys. `Cmd+Shift+D` is always owned by management (which is always alive). `Cmd+Shift+G` and `Cmd+Shift+S` are registered when the overlay mounts and unregistered when it unmounts/destroys. No overlap.

When `Cmd+Shift+D` fires (showing management), the management window emits no event — it just shows itself. The overlay's laser should be deactivated so the transparent overlay doesn't block clicks on the management window. This is handled by: when showing management, the management window calls `setFocus()` on itself, and the overlay's `useLaserMode` detects blur/focus-loss and deactivates the laser automatically (existing behavior: `(document.activeElement as HTMLElement)?.blur()` + `setIgnoreCursorEvents(true)`).

## Online Status

The overlay does not render `OfflineBanner`. If the network drops during a session, the realtime channel will disconnect. The overlay continues to function in a degraded state (local drawing still works, remote sync pauses). When the network returns, the Supabase client reconnects automatically. The management window handles offline gating for the auth/org flows as before.

## No Backend Changes

No Rust changes needed. No Supabase schema changes. The Tauri Rust backend (`lib.rs`) already has all required plugins registered. If crash-recovery detection via Rust `on_window_event` is desired in the future, that would be a separate enhancement.
