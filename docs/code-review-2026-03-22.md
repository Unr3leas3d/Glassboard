# Code Review: Architecture Refactoring (Custom Canvas + Widget/Dock System)

**Reviewer:** Claude Opus 4.6
**Date:** 2026-03-22
**Scope:** Uncommitted working tree changes on `windows-compatibility` branch (base: 6338c7a)

---

## What Was Done Well

- The custom Canvas2D annotation system (`src/annotations/`) is cleanly architected with a proper tool abstraction (`AnnotationTool` interface), separation of types, and smooth rendering with quadratic bezier curves and a glow effect.
- The widget system introduces a thoughtful multi-window architecture: `WindowManager` handles lifecycle, position persistence, collapse/expand; `WidgetShell` provides consistent chrome; `registry.ts` centralizes definitions.
- The `CommunicationBus` design correctly solves the problem of widget windows needing Supabase relay through the overlay coordinator.
- Removing the Excalidraw dependency and patch script eliminates a fragile post-install hack and reduces bundle size.
- The dock cleanly replaces BottomBar with added chat and session-info buttons.

---

## Critical Issues (Must Fix)

### 1. `useLaserMode` references removed parameter
**File:** `/Users/ayubmohamed/Vibe Coding Projects/Glassboard-v1/src/hooks/useLaserMode.ts` (line 44)

The dependency array references `canvasRef` but `OverlayApp` calls `useLaserMode()` with no argument. The parameter is `canvasRef?: RefObject<HTMLCanvasElement | null>`, so it defaults to `undefined`. This means `toggleLaser` is never recreated when it should be (minor), but more critically, line 33 does `canvasRef?.current?.focus(...)` which is always a no-op since the canvas ref is never passed in. The keyboard focus path for the annotation canvas is broken.

### 2. `useRealtimeChat` registers `channel.on()` without cleanup
**File:** `/Users/ayubmohamed/Vibe Coding Projects/Glassboard-v1/src/hooks/useRealtimeChat.ts` (lines 48-58)

Supabase Realtime `channel.on()` listeners are never removed. If the effect re-runs (e.g., `isConnected` toggles), duplicate listeners accumulate, causing messages to appear multiple times. Supabase channels do not automatically deduplicate `on()` handlers.

### 3. `useRealtimeAnnotations` same listener accumulation bug
**File:** `/Users/ayubmohamed/Vibe Coding Projects/Glassboard-v1/src/hooks/useRealtimeAnnotations.ts` (lines 61-82)

Same issue as above: `channel.on("broadcast", { event: "laser_stroke" }, ...)` is registered in an effect that depends on `[channelRef, isConnected]` but there is no mechanism to remove the previous listener. When `isConnected` toggles, handlers stack.

### 4. `OverlayApp` listener effect runs on every render
**File:** `/Users/ayubmohamed/Vibe Coding Projects/Glassboard-v1/src/windows/overlay/OverlayApp.tsx` (line 252)

The `useEffect` at line 228-252 that registers 9 `listen()` handlers has no dependency array at all (comment says "intentionally no deps"). This means on every single render, all 9 listeners are unsubscribed and re-subscribed. At 60fps animation loop triggering state updates, this creates a flood of subscribe/unsubscribe cycles. This will cause missed events and performance degradation.

### 5. `handleStroke` and `handleStrokeUpdate` are identical
**File:** `/Users/ayubmohamed/Vibe Coding Projects/Glassboard-v1/src/windows/overlay/OverlayApp.tsx` (lines 255-271)

Both callbacks do `broadcastStroke(stroke)`. The `onStroke` fires on pointer-up (completed stroke) and `onStrokeUpdate` fires on every pointer-move. Both broadcast the same way. This means every stroke is broadcast twice on completion (once from `onStrokeUpdate` during the last move, then again from `onStroke` on pointer-up). The completed stroke broadcast should probably set a `completed: true` flag or use a different event so remote peers know to stop expecting updates.

---

## Important Issues (Should Fix)

### 6. `LaserTool` is a module-level singleton shared across all renders
**File:** `/Users/ayubmohamed/Vibe Coding Projects/Glassboard-v1/src/annotations/AnnotationCanvas.tsx` (line 15)

`const laserTool = new LaserTool()` at module scope means it persists across React unmount/remount cycles (StrictMode, hot-reload). Its `activeStroke` state could leak. Should be created inside the component or use a ref.

### 7. `userColor()` function duplicated in 3 files
**Files:**
- `/Users/ayubmohamed/Vibe Coding Projects/Glassboard-v1/src/windows/overlay/OverlayApp.tsx`
- `/Users/ayubmohamed/Vibe Coding Projects/Glassboard-v1/src/widgets/chat/ChatWidget.tsx`

(Plus it exists in `useRealtimeCursors` per the comment.) This should be extracted to a shared utility.

### 8. `CommunicationBus.createBusRelay()` reads `channelRef.current` at setup time only
**File:** `/Users/ayubmohamed/Vibe Coding Projects/Glassboard-v1/src/services/CommunicationBus.ts` (lines 78-83)

The "Supabase to Tauri" direction (lines 78-83) reads `channelRef.current` once at call time. If the channel is null when `createBusRelay` is called and becomes available later, the Supabase-to-Tauri direction never gets wired up. The Tauri-to-Supabase direction (line 67) correctly reads from `channelRef.current` on each event, but the reverse does not.

### 9. `CommunicationBus` is never actually used
The `CommunicationBus` (`createBusRelay`, `busBroadcast`, `busSubscribe`) is defined but never imported or called anywhere in the codebase. The chat widget creates its own `useSessionChannel` + `useRealtimeChat` directly. This is dead code.

### 10. `WindowManager` partially used - chat window bypasses it
**File:** `/Users/ayubmohamed/Vibe Coding Projects/Glassboard-v1/src/windows/overlay/OverlayApp.tsx` (lines 276-309)

The chat window is created manually via `new WebviewWindow("widget-chat", ...)` in `handleOpenChat` rather than going through `windowManager.openWidget("chat")`. This bypasses the WindowManager's lifecycle tracking, position persistence, and destroy-on-close cleanup. The `destroyUIWindows` function also manually destroys chat instead of using `windowManager.destroyAll()`.

### 11. Screen capture detection is easily bypassed and has false positives
**File:** `/Users/ayubmohamed/Vibe Coding Projects/Glassboard-v1/src-tauri/src/screen_capture.rs` (lines 94-122)

The `is_screen_being_captured` function uses `pgrep -f` to match process names. This:
- Will match any process whose command line contains "obs" (e.g., a user editing a file called "observe.txt")
- Will match "zoom.us" even if Zoom is running but not screen-sharing
- Misses many screen recording tools (SharePlay, Screenflow, Camtasia, etc.)
- The `pgrep -f` flag matches against full command-line arguments, making "obs" especially prone to false positives

### 12. Widget `collapsedSize` type is overly restrictive
**File:** `/Users/ayubmohamed/Vibe Coding Projects/Glassboard-v1/src/widgets/registry.ts` (line 10)

`collapsedSize: { width: 44; height: 44 }` uses literal types `44`, meaning every widget must have exactly 44x44 collapsed size. Should be `{ width: number; height: number }`.

---

## Suggestions (Nice to Have)

### 13. `AnnotationCanvas` animation loop runs continuously
The `requestAnimationFrame` loop in `AnnotationCanvas` runs at 60fps even when nothing is being drawn and there are no remote strokes. Consider adding an idle detection that pauses the loop when there are no active or decaying strokes.

### 14. `TestUserSession` is now broken
**File:** `/Users/ayubmohamed/Vibe Coding Projects/Glassboard-v1/src/windows/testuser/TestUserSession.tsx`

The test user session still imports and renders `ExcalidrawCanvas` (which was deleted). The `handleSceneChange` is a no-op, and `useRealtimeAnnotations` was removed from imports but the old Excalidraw canvas component import remains. This file will fail to compile.

### 15. `readPayload()` in `ChatWidget` will throw if the URL is malformed
`JSON.parse(atob(raw))` with no try/catch. A corrupted URL parameter will crash the entire widget window. Other `readPayload` implementations (e.g., DockApp) return a safe default.

### 16. The dock's `BAR_WIDTH` constant is out of sync
**File:** `/Users/ayubmohamed/Vibe Coding Projects/Glassboard-v1/src/windows/dock/DockApp.tsx` (line 25)

DockApp uses `BAR_WIDTH = 392` (comment says "7 buttons"), but the overlay creates the dock with `dockWidth = 340`. The dock will be positioned incorrectly on resize since its calculations use a different width than what it was created with.

### 17. No XSS sanitization on chat messages
Chat messages render `msg.text` directly in JSX, which React escapes by default. However, the message flows through Supabase Realtime broadcast without validation. While React's JSX escaping protects against HTML injection, there's no length limit or content validation on messages, allowing potential abuse (very long messages, Unicode exploits).

---

## Plan Alignment Assessment

The implementation aligns well with the stated goals of architecture modernization:
- Excalidraw replaced with custom Canvas2D (lighter, more controllable)
- Widget system and dock provide extensible UI architecture
- Service layer (CommunicationBus, WindowManager) establishes proper patterns

**Deviations from plan:**
1. The `CommunicationBus` is fully implemented but unused (dead code) -- widgets connect directly to Supabase.
2. The `WindowManager` exists but the chat widget bypasses it, creating an inconsistency.
3. The "laser" widget in the registry (id: "laser") has a route but no corresponding component or main.tsx route.

**Missing from implementation:**
- No `index.ts` barrel exports for `src/annotations/` or `src/services/`
- The CLAUDE.md file is not updated to reflect the new architecture (still references Excalidraw, BottomBar, etc.)

---

## Summary

The architectural direction is sound, but there are 5 critical bugs that need fixing before this can be committed: the listener accumulation bugs (#2, #3, #4), the broken focus path (#1), and the duplicate broadcast on stroke completion (#5). Issue #14 (TestUserSession importing deleted ExcalidrawCanvas) will prevent compilation. The unused CommunicationBus and partially-bypassed WindowManager should either be fully integrated or removed to avoid confusion.
