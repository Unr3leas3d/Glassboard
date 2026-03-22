# WhisperFlow-Style Bottom Bar — Design Spec

**Date:** 2026-03-12
**Status:** Approved

---

## Overview

Replace the current Excalidraw-toolbar-injection approach with a minimal WhisperFlow-style pill bar at the bottom of the screen. The bar is icon-only and serves a single purpose: toggling the laser pointer on and off. All other toolbar chrome is removed.

---

## Goals

- Remove Excalidraw's native top toolbar entirely (no shapes, no tools, no UI chrome)
- Replace with a small black pill bar, fixed bottom-center
- Bar only appears when in draw mode; invisible in view mode
- Clicking the bar toggles the laser pointer — no menu, no popover
- Idle state: black pill with dim grey laser icon
- Active state: same pill with red laser icon + red border glow
- Draw/view mode toggle remains keyboard-only (⌘⇧G / Ctrl⇧G)

---

## Non-Goals

- No additional tools in the bar (no draw tool, eraser, etc.)
- No text labels in the bar
- No popover or expanding menu
- No changes to the hotkey system

---

## Architecture

### New component: `BottomBar.tsx`

A pure React component, fully outside Excalidraw's DOM. Renders only when `isDrawMode` is true.

**Props:**
```ts
interface BottomBarProps {
  isLaserActive: boolean;
  onToggleLaser: () => void;
}
```

**Behaviour:**
- `position: fixed`, bottom-center, high z-index (above Excalidraw)
- Single clickable pill containing only the laser SVG icon
- Idle: `background: #1a1a1a`, icon stroke `#555`, border `rgba(255,255,255,0.1)`
- Active: icon stroke `#ff4444`, border `rgba(255,60,60,0.4)`, subtle red glow shadow
- `pointer-events: auto` always (does not inherit the canvas's pass-through mode)

### New hook: `useLaserMode.ts`

Encapsulates laser on/off state and the Excalidraw API call.

```ts
function useLaserMode(apiRef: RefObject<ExcalidrawImperativeAPI | null>) {
  const [isLaserActive, setIsLaserActive] = useState(false);

  const toggleLaser = useCallback(() => {
    const api = apiRef.current;
    if (!api) return;
    setIsLaserActive((prev) => {
      const next = !prev;
      // When deactivating, fall back to freedraw (the app's default drawing tool)
      api.setActiveTool(next ? { type: "laser" } : { type: "freedraw" });
      return next;
    });
  }, [apiRef]);

  return { isLaserActive, toggleLaser };
}
```

### Changes to `ExcalidrawCanvas.tsx`

- Remove all DOM injection logic (MutationObserver, button injection, `buttonsInjected` ref, `modeToggleRef`)
- Remove the `useEffect` that injects the laser and mode buttons
- Remove the `useEffect` that watches for shape tools and removes them
- Remove `removeShapeTools` function
- Accept `apiRef` as a prop (type `RefObject<ExcalidrawImperativeAPI | null>`) instead of owning it internally — `App.tsx` creates the ref and passes it down
- Keep: `handleChange` (transparency enforcement), `initialData`, `UIOptions`

### Changes to `App.tsx`

- Create `apiRef` (`useRef<ExcalidrawImperativeAPI | null>(null)`) and pass it as a prop to `ExcalidrawCanvas`
- Pass the same `apiRef` to `useLaserMode`
- Remove the `ModeIndicator` import and any usage
- Compose `useDrawMode`, `useLaserMode`, `useGlobalHotkey`
- Render `<BottomBar>` (only when `isDrawMode`) alongside `<ExcalidrawCanvas>`

### Changes to `App.css`

- Remove: `.glasboard-laser-btn`, `.glasboard-mode-btn`, `.glasboard-mode-active`, `.glasboard-toolbar-sep`
- Add: `.App-toolbar-container { display: none !important }` to hide the Excalidraw toolbar globally
- Add: styles for the new `.glasboard-bottom-bar` pill

### Remove `ModeIndicator.tsx`

No longer used.

---

## File Change Summary

| File | Action |
|------|--------|
| `src/components/BottomBar.tsx` | **Create** |
| `src/hooks/useLaserMode.ts` | **Create** |
| `src/components/ExcalidrawCanvas.tsx` | **Modify** — strip DOM injection |
| `src/App.tsx` | **Modify** — compose new hooks, render BottomBar |
| `src/App.css` | **Modify** — remove old styles, add bar styles, hide toolbar |
| `src/components/ModeIndicator.tsx` | **Delete** |

---

## Visual Spec

```
┌─────────────────────────────────────────────┐
│                                             │
│           transparent canvas               │
│                                             │
│                                             │
│          ┌──────────────────┐               │
│          │  [laser icon]    │  ← pill bar   │
│          └──────────────────┘               │
└─────────────────────────────────────────────┘

Idle:   border: rgba(255,255,255,0.10)  icon: #555
Active: border: rgba(255,60,60,0.40)   icon: #ff4444  + box-shadow glow
```
