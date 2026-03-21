# Windows Compatibility Design Spec

**Date:** 2026-03-21
**Goal:** Full feature parity Windows build alongside existing macOS build
**Approach:** Platform abstraction layer (centralized platform detection with per-platform UI mappings)

---

## Context

Glasboard is a macOS collaborative annotation overlay built with Tauri v2 + React 19. It uses a transparent, always-on-top, click-through overlay window for real-time Excalidraw laser drawing, plus a 640×640 management window for auth, orgs, and session controls. The user wants to ship production builds for both macOS and Windows with full feature parity.

### Audit Summary

An audit identified these categories of issues:

- **Build blockers:** `macos-private-api` feature unconditionally enabled, no Windows bundler config
- **UI/UX issues:** Hardcoded macOS keyboard symbols and labels, macOS-only titlebar style
- **Feature gaps:** Screen capture limited to primary monitor, content protection weaker on Windows
- **Missing infrastructure:** No platform detection anywhere in the codebase

---

## Design

### 1. Platform Detection & Abstraction Layer

**New file: `src/utils/platform.ts`**

Calls Tauri's `platform()` API once at app initialization and exports cached, synchronous values:

```ts
export const isMac: boolean;
export const isWindows: boolean;

// UI label mappings — resolved per platform
export const modifierSymbols: Record<string, string>;
// macOS: { CommandOrControl: "⌘", Shift: "⇧", Alt: "⌥" }
// Windows: { CommandOrControl: "Ctrl", Shift: "Shift", Alt: "Alt" }

export const modifierLabel: string; // "Cmd" or "Ctrl"

// Called once from main.tsx before React render
export async function initPlatform(): Promise<void>;
```

**Files that consume this:**

| File | Change |
|------|--------|
| `src/utils/hotkeyFormat.ts` | Replace hardcoded `MODIFIER_SYMBOLS` map with import from `platform.ts` |
| `src/components/BottomBar.tsx` | Replace `"Cmd+Shift+D"` / `"Cmd+Shift+G"` tooltip strings with `${modifierLabel}+Shift+D` etc. |
| `src/main.tsx` | Call `initPlatform()` before `ReactDOM.createRoot()` |

**`initPlatform()` scope:** Since `main.tsx` is the shared entry point for all window types (management, overlay, bottombar, sessionbar), a single `initPlatform()` call covers all windows. No per-window initialization needed.

**What doesn't change:** The actual hotkey accelerator strings in `useHotkeySettings.ts` already use `CommandOrControl` — Tauri handles the mapping. No changes to registration logic.

---

### 2. Rust-Side Platform Conditioning

**`Cargo.toml` — conditional `macos-private-api` feature:**

Remove the existing `tauri` entry from `[dependencies]` and replace with platform-specific entries:

```toml
[target.'cfg(target_os = "macos")'.dependencies]
tauri = { version = "2", features = ["macos-private-api"] }

[target.'cfg(not(target_os = "macos"))'.dependencies]
tauri = { version = "2", features = [] }
```

**Note:** The existing `tauri = { version = "2", features = ["macos-private-api"] }` line in `[dependencies]` must be fully removed — Cargo unifies features across sections, so leaving it would pull `macos-private-api` on all platforms.

**New dependency: `tauri-plugin-single-instance`**

Add to `Cargo.toml`:
```toml
tauri-plugin-single-instance = "2"
```

On Windows, deep link activations (`glasboard://`) can launch a second app instance instead of routing to the running one. This plugin ensures single-instance behavior: the second launch forwards its URL to the already-running instance. Register in `lib.rs` with `.plugin(tauri_plugin_single_instance::init(...))`.

**`tauri.conf.json`:**

- `macOSPrivateApi: true` — stays, Tauri ignores it on non-macOS
- `titleBarStyle: "Overlay"` — stays, ignored on Windows

**Screen capture — swap `screenshots` crate for `xcap`:**

The `screenshots` crate (v0.2) is dated. Replace with `xcap` which is actively maintained and provides native multi-monitor support on macOS, Windows, and Linux.

Remove from `Cargo.toml`:
```toml
screenshots = "0.2"
```

Add to `Cargo.toml` (verify latest version on crates.io before implementation):
```toml
xcap = "0.0.13"
```

**New Tauri command: `list_monitors`**

```rust
#[derive(serde::Serialize)]
pub struct MonitorInfo {
    pub index: usize,
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub is_primary: bool,
}

#[tauri::command]
pub fn list_monitors() -> Result<Vec<MonitorInfo>, String>;
```

**Modified command: `capture_screen`**

Add optional `monitor_index` parameter:

```rust
#[tauri::command]
pub fn capture_screen(
    window: WebviewWindow,
    quality: Option<u8>,
    max_width: Option<u32>,
    monitor_index: Option<usize>,  // NEW
) -> Result<String, String>;
```

Behavior:
- If `monitor_index` is provided, capture that specific monitor
- If omitted, capture the primary monitor (backwards compatible)
- Same resize → JPEG encode → base64 pipeline as current

**Internal pipeline change:** The `screenshots` crate returns PNG-encoded bytes that are decoded via `image::load_from_memory_with_format()` before re-encoding as JPEG. The `xcap` crate returns `image::RgbaImage` directly, so the intermediate PNG decode step is eliminated. The pipeline becomes: `xcap::Monitor::capture_image()` → `RgbaImage` → resize → JPEG encode → base64. The `image` crate dependency stays but `image::load_from_memory_with_format` is no longer needed.

---

### 3. Window Management & Titlebar

**Overlay window:** No changes. `decorations: false`, `transparent: true`, `alwaysOnTop: true` work cross-platform in Tauri v2. `setIgnoreCursorEvents()` maps to `WS_EX_TRANSPARENT` + `WS_EX_LAYERED` on Windows.

**Bottombar window:** No changes. Already frameless and transparent.

**Management window — hybrid frameless on Windows:**

On macOS: current behavior preserved (`titleBarStyle: "Overlay"`, native traffic light buttons).

On Windows: the management window's decorations are removed at runtime. Since `tauri.conf.json` is static JSON (cannot branch per-platform), the config keeps `"decorations": true`. At startup, `ManagementApp.tsx` calls `getCurrentWindow().setDecorations(false)` when `isWindows` is true. `WindowTitleBar.tsx` then becomes platform-aware:

```tsx
// WindowTitleBar.tsx
export function WindowTitleBar() {
  if (isMac) {
    // Invisible drag region — macOS renders native traffic lights
    return <div data-tauri-drag-region className="fixed top-0 left-0 right-0 h-10 z-50 bg-background" />;
  }
  // Windows: drag region + custom window control buttons (top-right)
  return (
    <div data-tauri-drag-region className="fixed top-0 left-0 right-0 h-8 z-50 bg-background flex justify-end">
      <button onClick={minimize}>─</button>
      <button onClick={maximize}>□</button>
      <button onClick={close} className="hover:bg-red-500">✕</button>
    </div>
  );
}
```

Buttons import `getCurrentWindow` from `@tauri-apps/api/window` and `isMac` from `@/utils/platform`, then call `.minimize()`, `.toggleMaximize()`, `.close()`.

**`ManagementApp.tsx` change:** At startup, if `isWindows`, call `getCurrentWindow().setDecorations(false)`. Overlay creation params are already cross-platform — no changes needed there.

---

### 4. Windows Bundler Configuration

**`tauri.conf.json` additions:**

```json
"bundle": {
  "active": true,
  "targets": "all",
  "icon": [
    "icons/32x32.png",
    "icons/128x128.png",
    "icons/128x128@2x.png",
    "icons/icon.icns",
    "icons/icon.ico"
  ],
  "windows": {
    "nsis": {
      "installMode": "currentUser",
      "displayLanguageSelector": false
    },
    "wix": {
      "language": "en-US"
    }
  }
}
```

Produces both `.exe` (NSIS) and `.msi` (WiX) installers.

**WebView2 runtime:** Tauri v2 on Windows requires the Microsoft Edge WebView2 runtime. Add `webviewInstallMode` to the NSIS config to auto-bootstrap it for end users who don't have it:

```json
"nsis": {
  "installMode": "currentUser",
  "displayLanguageSelector": false
}
```

Tauri v2's NSIS template downloads WebView2 bootstrapper by default if not present. No additional config needed beyond what's shown above, but this behavior should be verified during Windows build testing.

**Deep link protocol:** `glasboard://` is automatically registered in the Windows registry by NSIS/WiX during installation via `tauri-plugin-deep-link`. No code changes needed.

**Icons:** `icon.ico` already exists in `src-tauri/icons/`. No work needed.

---

### 5. Monitor Picker for Screen Sharing

**New component: `src/components/MonitorPicker.tsx`**

A small dropdown that appears when the user clicks the screen share button and multiple monitors are detected:

- Calls `list_monitors` Tauri command to enumerate available displays
- Renders a list: "Monitor 1 (2560×1440)", "Monitor 2 (1920×1080)", etc.
- Single click selects and starts capturing
- Remembers last selection in `localStorage`
- **If only one monitor:** skips picker, captures directly (preserves current UX)

**Integration in `OverlayApp.tsx`:**

Before first capture:
1. Invoke `list_monitors`
2. If 1 monitor → capture immediately (no UX change)
3. If 2+ monitors → show `MonitorPicker` anchored above the share button
4. After selection, pass `monitor_index` to all subsequent `capture_screen` calls

This improvement applies to both platforms — macOS users with multiple displays benefit equally.

---

### 6. Content Protection

**Approach:** Best-effort, no code changes.

Existing `setContentProtected()` calls remain as-is. On Windows:
- Windows 10 2004+ → Tauri maps to `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)` — works
- Older Windows → silently does nothing

No runtime detection or warning UI. Acceptable trade-off given the target audience.

---

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/utils/platform.ts` | **Create** | Platform detection + UI mappings |
| `src/components/MonitorPicker.tsx` | **Create** | Monitor selection dropdown for screen sharing |
| `src/utils/hotkeyFormat.ts` | **Modify** | Import symbols from platform.ts |
| `src/components/BottomBar.tsx` | **Modify** | Dynamic tooltip labels using modifierLabel |
| `src/components/WindowTitleBar.tsx` | **Modify** | Platform-aware titlebar with Windows controls |
| `src/main.tsx` | **Modify** | Call initPlatform() before render |
| `src/windows/overlay/OverlayApp.tsx` | **Modify** | Integrate MonitorPicker before capture |
| `src/windows/management/ManagementApp.tsx` | **Modify** | Decorations config based on platform |
| `src-tauri/Cargo.toml` | **Modify** | Conditional macos-private-api, swap screenshots→xcap |
| `src-tauri/src/screen_capture.rs` | **Modify** | Multi-monitor support via xcap, list_monitors command |
| `src-tauri/src/lib.rs` | **Modify** | Register list_monitors command + single-instance plugin |
| `src-tauri/tauri.conf.json` | **Modify** | Add NSIS + WiX bundle config |
| `src-tauri/capabilities/overlay.json` | **Modify** | Add permissions for `list_monitors`, `capture_screen` commands |
| `src-tauri/capabilities/management.json` | **Modify** | Add `core:window:allow-set-decorations`, `core:window:allow-toggle-maximize` permissions |

## Files Unchanged

| File | Reason |
|------|--------|
| `src/hooks/useGlobalHotkey.ts` | Already uses CommandOrControl |
| `src/hooks/useHotkeySettings.ts` | Accelerator strings are cross-platform |
| `src/hooks/useLaserMode.ts` | setIgnoreCursorEvents works cross-platform |
| `src/hooks/useAuth.ts` | OAuth flow is platform-agnostic |
| `src/supabase.ts` | No platform dependency |
| `scripts/patch-excalidraw-laser.mjs` | Already cross-platform Node.js |
| `src/App.css` | No macOS-specific CSS |
| All realtime hooks | Supabase channels are platform-agnostic |

## Testing Strategy

1. **macOS regression:** Run `npm run tauri dev` and `npm run tauri build` on macOS — verify no regressions
2. **Windows build:** Run `npm run tauri build` on Windows — verify NSIS and WiX installers are produced
3. **Windows runtime testing on actual hardware:**
   - Overlay transparency and click-through toggle
   - Laser draw mode activation/deactivation via Ctrl+Shift+G
   - Management window custom titlebar (minimize, maximize, close)
   - Monitor picker with multi-monitor setup
   - Screen sharing on selected monitor
   - Content protection (Windows 10 2004+ only)
   - Deep link `glasboard://` protocol
   - Google OAuth flow opening in default browser
4. **Cross-platform collaboration:** macOS user and Windows user in the same session — verify real-time annotations, cursors, and presence work between platforms

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| `setIgnoreCursorEvents` unreliable on some Windows configs | Medium | Test on multiple Windows versions; if broken, investigate `SetWindowLong` with custom flags via Rust command |
| `xcap` crate has different capture behavior on Windows | Low | The crate is actively maintained with Windows CI; test multi-monitor capture on hardware |
| Transparent overlay has rendering artifacts on Windows | Medium | Test with WebView2; if issues, investigate `WS_EX_LAYERED` with `SetLayeredWindowAttributes` |
| NSIS/WiX build tools not installed on Windows build machine | Low | Document prerequisite: install NSIS and WiX toolset before building |
| WebView2 not installed on end-user Windows machine | Low | Tauri NSIS installer auto-bootstraps WebView2; verify during testing |
| Deep link launches second app instance on Windows | Medium | `tauri-plugin-single-instance` forwards deep link URL to running instance |
| `xcap` crate API instability (v0.0.x) | Low | Pin version, verify latest before implementation; fallback: revert to `screenshots` crate |
| WebView2 vs WebKit CSS/rendering differences | Low | Excalidraw is Chromium-tested; verify transparent background rendering on WebView2 |
