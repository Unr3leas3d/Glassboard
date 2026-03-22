# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

**Glasboard** is a macOS collaborative annotation overlay built with Tauri v2 + React 19 + TypeScript. It has two windows: a **management window** for auth, orgs, and session controls, and a **transparent overlay window** that renders a full-screen, always-on-top, click-through Excalidraw canvas for real-time collaborative drawing. Multiple users join sessions via 6-character codes and see each other's laser annotations and cursors in real time via Supabase Realtime.

## Commands

```bash
# Full Tauri app (use this for actual development)
npm run tauri dev

# Frontend-only dev server (no Tauri shell — limited usefulness)
npm run dev

# Build distributable app
npm run tauri build

# TypeScript type-check
npx tsc --noEmit
```

No test suite is configured. The `postinstall` script (`scripts/patch-excalidraw-laser.mjs`) patches Excalidraw's laser decay timing to be 25% more persistent — runs automatically on `npm install`.

## Environment Setup

Copy `.env.example` to `.env` and fill in Supabase credentials:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Architecture

### Multi-window system

The app uses two Tauri windows that communicate via the Tauri event system:

**Management window** (`src/windows/management/ManagementApp.tsx`): The primary window defined in `tauri.conf.json`. A 460×640 non-transparent window for auth, organization management, and session controls. It spawns and destroys the overlay window.

**Overlay window** (`src/windows/overlay/OverlayApp.tsx`): Created dynamically via `new WebviewWindow("overlay", ...)` when a session starts. Full-screen, transparent, always-on-top, click-through. Hosts the Excalidraw canvas and all real-time collaboration UI.

**Window routing** (`src/main.tsx`): Reads the `?window=` URL parameter to decide which React app to render. The overlay window receives session/user data via a base64-encoded `?payload=` query parameter.

**Cross-window events** (`src/types/events.ts`):
- `SESSION_ENDED` — overlay tells management the session ended
- `REQUEST_SHOW_MANAGEMENT` — overlay asks management to show itself
- `REQUEST_SIGN_OUT` — overlay requests sign-out (management owns auth)
- `DEACTIVATE_LASER` — management tells overlay to deactivate laser mode

### Click-through / Draw mode toggle

The core mechanic is Tauri's `setIgnoreCursorEvents`:
- **Inactive (default)**: `setIgnoreCursorEvents(true)` — clicks pass through to apps underneath.
- **Active (draw mode)**: `setIgnoreCursorEvents(false)` — overlay captures input, Excalidraw laser tool activates.

`useLaserMode` (`src/hooks/useLaserMode.ts`) owns this state. It uses the `ExcalidrawImperativeAPI` ref to switch tools, and manages focus on the `.excalidraw` element so keyboard events work correctly. Toggle hotkey: `Cmd+Shift+G`.

### Global hotkeys

`useGlobalHotkey` (`src/hooks/useGlobalHotkey.ts`) registers system-wide shortcuts via `@tauri-apps/plugin-global-shortcut`. These fire even when the window has no focus (essential for the click-through overlay). The hook unregisters before re-registering to handle React StrictMode double-mounts.

- `Cmd+Shift+G` — toggle laser/draw mode (overlay)
- `Cmd+Shift+D` — show management window and deactivate laser (management)

### Real-time collaboration

All real-time features use Supabase Realtime channels scoped to `session:{id}`:

- `useSessionChannel` — creates/manages the channel lifecycle
- `useRealtimeAnnotations` — broadcasts and receives Excalidraw element changes (throttled to 50ms)
- `useRealtimeCursors` — sends/receives cursor positions, cleans up stale cursors after 5s
- `usePresence` — tracks active participants via Supabase presence
- `useScreenMirror` — broadcasts/receives screen capture frames

### Auth flow

`useAuth` (`src/hooks/useAuth.ts`) wraps Supabase auth (email/password and Google OAuth). The management window gates all functionality behind auth: `OfflineBanner` → `LoginPage` → `ManagementPanel`. Google OAuth opens in the system browser via the Tauri opener plugin.

### Sessions and organizations

- `useSessions` — create, join (by 6-char code), end, and leave sessions with collision-resistant code generation
- `useOrganizations` — load/switch/create orgs, invite members, persists current org to localStorage

### Rust backend

`src-tauri/src/lib.rs` registers plugins (opener, global-shortcut, deep-link) and Tauri commands. `screen_capture.rs` provides a `capture_screen` command that captures the primary display, resizes, JPEG-encodes, and returns a base64 data URL.

### Excalidraw canvas

`ExcalidrawCanvas` (`src/components/ExcalidrawCanvas.tsx`) forces `viewBackgroundColor` to `"transparent"` via an `onChange` watcher. Most Excalidraw UI is disabled (export, save, theme toggle) since this is a live annotation tool. The laser tool's decay time is patched post-install to be more persistent.

## Key Dependencies

| Package | Purpose |
|---|---|
| `@tauri-apps/plugin-global-shortcut` | System-wide hotkeys (works when window is click-through) |
| `@tauri-apps/plugin-opener` | Opens OAuth URLs in system browser |
| `@tauri-apps/plugin-deep-link` | `glasboard://` URI scheme |
| `@excalidraw/excalidraw` | Drawing canvas (laser tool, patched post-install) |
| `@supabase/supabase-js` | Auth, database, realtime channels, presence |
| Tailwind CSS v4 + shadcn/ui | Styling (via `@tailwindcss/vite`, not PostCSS) |

## Path Alias

`@` is aliased to `./src` in `vite.config.ts` (e.g., `import { supabase } from "@/supabase"`).
