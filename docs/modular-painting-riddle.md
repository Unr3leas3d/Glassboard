# Glasboard Widget Framework Refactor

## Context

Glasboard currently uses Excalidraw as the annotation engine, but only the laser tool is used. The bottom bar is a fixed 340×60px Tauri window with 6 hardcoded buttons. Adding new collaborative tools (chat, expanded annotations) requires ad-hoc window creation and event wiring each time.

**Goal**: Refactor into a modular widget framework where any tool (laser, chat, screen share, future tools) is a self-contained widget — its own Tauri window that can be collapsed to an icon, dragged anywhere on screen, and pinned. Replace Excalidraw with a lightweight custom annotation engine. Add screen capture hiding (auto-detect + manual). Add a real-time chat widget.

## Design Decisions (Agreed)

| Decision | Choice |
|---|---|
| Architecture | Widget Registry + Window Manager |
| Widget hosting | Each widget = separate Tauri window |
| Toolbar | Floating dock (draggable, orientation-aware) |
| Icons | Lucide icons throughout |
| Excalidraw | Remove — replace with custom canvas + AnnotationTool interface |
| Screen hiding | Auto-detect screen capture + manual Cmd+Shift+H toggle |
| MVP widgets | Laser, Session Info, Chat (new), Screen Share |
| Widget behavior | Collapsible to 44px icon, draggable, pinnable, position persisted |

## Phase 1: Core Framework (Widget Registry + Window Manager + Communication Bus)

### 1.1 Widget Registry

Create `src/widgets/registry.ts` — static config array:

```ts
interface WidgetDefinition {
  id: string;               // 'laser', 'chat', 'screen-share', 'session'
  title: string;
  icon: string;             // Lucide icon name: 'Pen', 'MessageCircle', 'Monitor', 'Users'
  defaultSize: { width: number; height: number };
  collapsedSize: { width: 44; height: 44 };
  defaultPosition: { x: number; y: number };  // relative to screen
  windowOptions: Partial<WebviewWindowOptions>;  // transparent, alwaysOnTop, etc.
  route: string;            // URL path for the widget: '?window=chat', etc.
}
```

### 1.2 Window Manager

Create `src/services/WindowManager.ts`:

- `openWidget(id)` — creates Tauri WebviewWindow from registry config, applies saved position from localStorage
- `closeWidget(id)` — destroys the window
- `collapseWidget(id)` — resizes window to 44×44, sets collapsed flag
- `expandWidget(id)` — restores to full size
- `hideAllWidgets()` / `showAllWidgets()` — for screen capture hiding
- `setContentProtected(id, protected)` — wraps Tauri's `setContentProtected()`
- Tracks open/collapsed/hidden state per widget
- Persists widget positions to localStorage on drag end
- Emits state changes via Tauri events so dock can update badges/glow

### 1.3 Communication Bus

Create `src/services/CommunicationBus.ts`:

- Wraps the existing `useSessionChannel` Supabase Realtime channel
- Provides `broadcast(topic: string, payload: unknown)` and `subscribe(topic: string, handler)`
- Topics: `annotations`, `chat`, `cursors`, `screen`, `presence`
- Each widget subscribes to its relevant topics
- Bus owns channel lifecycle (connect on session start, disconnect on end)
- Cross-window: Bus lives in a "coordinator" context; widget windows communicate via Tauri events to the coordinator, which relays to Supabase

### 1.4 Window Routing Update

Modify `src/main.tsx`:

- Expand `?window=` parameter to handle: `management`, `overlay`, `dock`, `chat`, `screen-share`, `session`, plus any future widget IDs
- Each widget route renders `<WidgetShell>` wrapping the widget's content component
- `<WidgetShell>` provides: title bar (drag handle), pin/collapse/close buttons, resize handling

**Files to create:**
- `src/widgets/registry.ts`
- `src/services/WindowManager.ts`
- `src/services/CommunicationBus.ts`
- `src/components/WidgetShell.tsx` — common wrapper with title bar, pin, collapse, close

**Files to modify:**
- `src/main.tsx` — expand window routing
- `src/types/events.ts` — add widget lifecycle events (WIDGET_OPENED, WIDGET_CLOSED, WIDGET_COLLAPSED, etc.)

## Phase 2: Floating Dock

### 2.1 Replace Bottom Bar

Create `src/windows/dock/DockApp.tsx` to replace `src/windows/bottombar/BottomBarApp.tsx`:

- Reads widget definitions from registry
- Renders Lucide icons for each widget
- Click icon → emits Tauri event to open/collapse widget via WindowManager
- Active widget gets colored glow border
- Notification badges (red dot) for unread state (chat messages, etc.)
- Separator between session tools and system tools (dashboard)
- Drag handle for repositioning dock on any screen edge
- Orientation-aware: vertical when on left/right edges, horizontal on top/bottom

### 2.2 Dock Window Config

- Tauri window: transparent, always-on-top, decorations off
- Size: ~52px wide (vertical) or ~52px tall (horizontal) × N icons
- `setContentProtected(true)` for screen capture hiding
- Position persisted to localStorage

**Files to create:**
- `src/windows/dock/DockApp.tsx`
- `src/components/DockIcon.tsx` — single icon button with badge/glow support

**Files to modify:**
- `src/windows/management/ManagementApp.tsx` — spawn dock instead of bottom bar
- `tauri.conf.json` — remove old bottom bar window config if statically defined

**Files to delete:**
- `src/windows/bottombar/BottomBarApp.tsx`
- `src/components/BottomBar.tsx`

## Phase 3: Custom Annotation Engine (Replace Excalidraw)

### 3.1 Annotation Tool Interface

Create `src/annotations/types.ts`:

```ts
interface AnnotationTool {
  id: string;
  icon: string;
  cursor: string;
  onPointerDown(ctx: AnnotationContext, point: Point): void;
  onPointerMove(ctx: AnnotationContext, point: Point): void;
  onPointerUp(ctx: AnnotationContext, point: Point): void;
  render(ctx: CanvasRenderingContext2D, stroke: Stroke, opacity: number): void;
  serialize(stroke: Stroke): unknown;
  deserialize(payload: unknown): Stroke;
}
```

### 3.2 Laser Tool

Create `src/annotations/tools/LaserTool.ts`:

- Collects points on mousemove → builds smooth path (quadratic bezier interpolation)
- Each stroke has a birth timestamp; render with opacity = max(0, 1 - (now - birth) / decayMs)
- Decay: ~2000ms (configurable, matching current patched Excalidraw behavior)
- Visual: red glow via canvas shadow blur + semi-transparent wider stroke underneath
- Cursor: bright dot with glow halo (replaces current CSS-based red circle)
- Broadcasts point arrays via Communication Bus `annotations` topic
- Remote strokes rendered with sender's assigned color

### 3.3 Annotation Canvas

Create `src/components/AnnotationCanvas.tsx`:

- Full-viewport HTML5 Canvas element
- requestAnimationFrame loop for rendering active + fading strokes
- Transparent background (same as current Excalidraw setup)
- Receives active tool from context/props
- Delegates pointer events to current tool's handlers

### 3.4 Overlay Window Update

Modify `src/windows/overlay/OverlayApp.tsx`:

- Replace `<ExcalidrawCanvas>` with `<AnnotationCanvas>`
- Remove all Excalidraw-related imports and hooks (`useRealtimeAnnotations` in its current form)
- Keep `useLaserMode` hook for click-through toggle (setIgnoreCursorEvents), adapted to work with new canvas
- Keep remote cursor rendering (`useRealtimeCursors` — already generic)
- Wire annotation broadcasts through Communication Bus instead of direct Supabase

**Files to create:**
- `src/annotations/types.ts`
- `src/annotations/tools/LaserTool.ts`
- `src/annotations/AnnotationCanvas.tsx`

**Files to modify:**
- `src/windows/overlay/OverlayApp.tsx` — swap Excalidraw for AnnotationCanvas
- `src/hooks/useLaserMode.ts` — adapt from ExcalidrawImperativeAPI to AnnotationCanvas ref

**Files to delete:**
- `src/components/ExcalidrawCanvas.tsx`
- `src/hooks/useRealtimeAnnotations.ts` (replaced by Communication Bus subscription)
- `scripts/patch-excalidraw-laser.mjs` (no longer needed)

**Dependencies to remove:**
- `@excalidraw/excalidraw`

## Phase 4: Chat Widget (New)

### 4.1 Chat Component

Create `src/widgets/chat/ChatWidget.tsx`:

- Message list with auto-scroll
- Input field with send button
- Messages show sender avatar (colored circle), name, timestamp
- Subscribes to Communication Bus `chat` topic
- Broadcasts `{ userId, name, text, timestamp }` on send
- Message history stored in React state (ephemeral — lives only during session)
- Unread count tracked when widget is collapsed → communicated to dock via Tauri event

### 4.2 Chat Data

Create `src/widgets/chat/types.ts`:

```ts
interface ChatMessage {
  id: string;
  userId: string;
  name: string;
  text: string;
  timestamp: number;
  color: string;  // sender's assigned color
}
```

**Files to create:**
- `src/widgets/chat/ChatWidget.tsx`
- `src/widgets/chat/types.ts`

## Phase 5: Port Screen Share & Session Info Widgets

### 5.1 Screen Share Widget

Create `src/widgets/screen-share/ScreenShareWidget.tsx`:

- Port existing `useScreenMirror` logic
- Presenter view: "Start Sharing" / "Stop Sharing" buttons
- Viewer view: renders received frames
- Wrapped in WidgetShell (collapsible, draggable)

### 5.2 Session Info Widget

Create `src/widgets/session/SessionWidget.tsx`:

- Port existing session panel from BottomBar (join code, participants, end/leave)
- Participant avatars with color coding and host badge
- Copy join code button
- Wrapped in WidgetShell

**Files to create:**
- `src/widgets/screen-share/ScreenShareWidget.tsx`
- `src/widgets/session/SessionWidget.tsx`

**Hooks to keep (already generic):**
- `src/hooks/useRealtimeCursors.ts` — works as-is
- `src/hooks/usePresence.ts` — works as-is
- `src/hooks/useScreenMirror.ts` — works as-is, may move to widget dir
- `src/hooks/useSessions.ts` — works as-is

## Phase 6: Screen Capture Hiding

### 6.1 Content Protection

- Call `setContentProtected(true)` on all widget windows via WindowManager
- This makes window content appear black in screen captures (macOS native API)
- Tauri v2 supports this via the window API

### 6.2 Auto-Detection (Rust)

Add to `src-tauri/src/screen_capture.rs`:

- New Tauri command: `is_screen_being_captured()` → bool
- Uses macOS `CGWindowListCopyWindowInfo` to detect active screen recording/sharing sessions
- Frontend polls this every ~2s when a session is active
- On detection: WindowManager.hideAllWidgets() (sets windows to invisible)
- On stop: WindowManager.showAllWidgets()

### 6.3 Manual Toggle

- Hotkey: `Cmd+Shift+H` — toggle all widget visibility
- Registered via `useGlobalHotkey` (existing pattern)
- Dock shows a visibility indicator when manually hidden

**Files to modify:**
- `src-tauri/src/screen_capture.rs` — add `is_screen_being_captured` command
- `src-tauri/src/lib.rs` — register new command

## File Summary

### New files
```
src/widgets/registry.ts
src/services/WindowManager.ts
src/services/CommunicationBus.ts
src/components/WidgetShell.tsx
src/windows/dock/DockApp.tsx
src/components/DockIcon.tsx
src/annotations/types.ts
src/annotations/tools/LaserTool.ts
src/annotations/AnnotationCanvas.tsx
src/widgets/chat/ChatWidget.tsx
src/widgets/chat/types.ts
src/widgets/screen-share/ScreenShareWidget.tsx
src/widgets/session/SessionWidget.tsx
```

### Modified files
```
src/main.tsx — expanded window routing
src/types/events.ts — widget lifecycle events
src/windows/overlay/OverlayApp.tsx — swap Excalidraw → AnnotationCanvas
src/windows/management/ManagementApp.tsx — spawn dock instead of bottom bar
src/hooks/useLaserMode.ts — adapt to new canvas
src-tauri/src/screen_capture.rs — add capture detection
src-tauri/src/lib.rs — register new commands
tauri.conf.json — window config updates
package.json — remove @excalidraw/excalidraw dep
```

### Deleted files
```
src/components/ExcalidrawCanvas.tsx
src/components/BottomBar.tsx
src/windows/bottombar/BottomBarApp.tsx
src/hooks/useRealtimeAnnotations.ts
scripts/patch-excalidraw-laser.mjs
```

## Verification

### After Phase 1 (Framework)
- `npm run tauri dev` starts without errors
- Window routing resolves all widget types
- WindowManager can create/destroy test windows

### After Phase 2 (Dock)
- Dock appears when session starts
- Icons are clickable and toggle test widget windows
- Dock is draggable to screen edges
- Orientation flips between horizontal/vertical

### After Phase 3 (Annotations)
- Cmd+Shift+G toggles laser mode
- Drawing produces fading red laser trails
- Remote participants see each other's laser strokes
- Excalidraw fully removed from bundle (`npm ls @excalidraw/excalidraw` returns empty)

### After Phase 4 (Chat)
- Chat widget opens from dock
- Messages sent are visible to all session participants in real-time
- Unread badge appears on dock icon when chat is collapsed
- Widget collapses to icon, expands back, remembers position

### After Phase 5 (Screen Share + Session)
- Screen sharing works as before but in widget form
- Session info shows participants, join code, end/leave
- All widgets: collapsible, draggable, pinnable

### After Phase 6 (Screen Hiding)
- `Cmd+Shift+H` hides/shows all widgets
- Starting a Zoom screen share auto-hides widgets
- Stopping screen share auto-shows widgets
- Content appears black in screenshots when protected
