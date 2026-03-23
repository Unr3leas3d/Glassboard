# Session Window System Design

Date: 2026-03-22
Status: Approved for planning
Scope: Redesign the session-time window system around explicit companion windows, a single coordinator, and correct live screen sharing behavior.

## Context

The current branch mixes two incompatible models:

- ad hoc overlay-owned window refs for `dock` and `chat`
- a partial `windowManager` intended for generic widgets

That split created the current failures:

- capability drift (`bottombar` capability still exists while `dock` is now used)
- inconsistent hide/show and content-protection behavior
- widget chrome actions that only work for windows known to `windowManager`
- destructive overlay teardown when session lookup fails for reasons other than "session ended"
- misleading screen-share behavior that sends a single snapshot while presenting itself as an ongoing share

The redesign should replace the mixed model instead of layering more local fixes onto it.

## Goals

- Replace ad hoc session companion window creation with one orchestration layer
- Make `dock`, `chat`, `session`, and `screen-share` first-class session companion windows
- Keep `management` and `overlay` as the only special-purpose core windows
- Remove automatic capture-detection hiding and keep only manual hide/show controls
- Make screen sharing behave as a real continuously updating share
- Ensure teardown, visibility, content protection, and capability coverage are consistent for every session companion window

## Non-Goals

- Reworking authentication or organization flows
- Changing the collaborative drawing architecture beyond what the window redesign requires
- Introducing OS-native media streaming or AV capture stacks
- Building an extensible marketplace-style widget platform

## Architecture

The app will use three explicit layers.

### 1. Core windows

- `management`: auth, org/session entry, overlay launch, return target after session teardown
- `overlay`: session authority, realtime state, drawing state, share engine, command handling

These two windows remain special and are not managed by the companion coordinator.

### 2. Session companion windows

These windows exist only while a session overlay is active:

- `dock`
- `chat`
- `session`
- `screen-share`

Each companion has:

- one canonical identifier used consistently for label, registry key, and route where practical
- a stable label
- a typed bootstrap payload
- a static window definition
- a matching Tauri capability entry

### 3. Window coordinator

Introduce a single coordinator module that owns all session companion window mechanics:

- window definitions and labels
- create/focus/show/hide/destroy operations
- content-protection propagation
- persisted position/collapsed state where applicable
- cleanup on session end, sign-out, auth mismatch, or overlay shutdown

Rule: if a window is not `management` or `overlay`, it must be created and controlled through the coordinator. No feature component should call `new WebviewWindow(...)` directly for session companion windows.

This coordinator replaces the current generic widget-manager direction with a session-scoped companion-window system. The implementation target is explicit session companions, not an open-ended widget platform.

## State And Event Flow

The redesign uses a strict overlay-centered model.

### Management to overlay

`management` launches `overlay` with bootstrap data only:

- authenticated user identity
- active session metadata
- current org metadata

### Overlay ownership

`overlay` is the source of truth for:

- laser active state
- screenshot/privacy mode
- participant presence
- session metadata
- unread chat count
- share status and share source
- session teardown decisions

### Overlay to companions

`overlay` publishes a typed `SessionUiState` snapshot. Companion windows render from this state and do not become authorities themselves.

Representative fields:

- `laserActive`
- `screenshotsAllowed`
- `participants`
- `session`
- `chatUnreadCount`
- `shareStatus`
- `shareSource`
- `widgetsHidden`

### Companions to overlay

Companion windows emit typed commands only. Examples:

- `toggleLaser`
- `toggleScreenshots`
- `showManagement`
- `signOut`
- `openCompanion`
- `closeCompanion`
- `startShare`
- `stopShare`
- `leaveSession`
- `endSession`

### Overlay to coordinator

`overlay` issues imperative window operations through the coordinator:

- ensure dock exists
- open/focus a companion
- hide/show all companions
- apply content protection to all companions
- destroy all companions during teardown

This prevents peer-to-peer window management and keeps business state separate from window mechanics.

## Companion Window Roles

The redesign intentionally narrows the surface area.

### Dock

Persistent control surface for the active session. Responsibilities:

- show current status
- expose fast actions
- launch/focus `chat`
- launch/focus `session`
- launch/focus `screen-share`
- show dashboard
- leave/end/sign out

The dock should not create sibling windows directly.

### Chat

Dedicated conversation companion window. Responsibilities:

- render messages
- send messages
- surface unread state through overlay-owned UI state

### Session

Dedicated session metadata and participants companion window. Responsibilities:

- show title and join code
- show participants
- expose leave/end actions

The current dock expansion panel should be removed in favor of this dedicated companion.

### Screen-share

Dedicated share control companion window. Responsibilities:

- pick a monitor/source
- show current share state
- stop sharing
- surface share errors and retry actions

The monitor picker should move out of the overlay UI and into this companion flow.

## Screen Share Design

Screen share becomes a real continuously updating snapshot stream rather than a one-shot capture.

### Share state machine

- `idle`
- `selecting-source`
- `sharing`
- `error`

### Behavior

While in `sharing`, the overlay-owned share engine:

- captures frames on an interval
- broadcasts frames over the session channel
- updates `shareStatus` in `SessionUiState`
- stops cleanly on command, disconnect, or failure

### Constraints

- this remains lightweight snapshot broadcasting, not OS-native video streaming
- the UI may keep the label `Share screen` if the cadence feels continuous
- if cadence is intentionally low, copy should be reframed to `Live screen snapshots`

## Privacy And Visibility

- Remove automatic capture-detection hiding entirely
- Keep only manual hide/show control via hotkey and coordinator action
- Apply screenshot/privacy mode consistently through the coordinator to every session companion window and the dock

The capture-detection hook and its Rust support code should be removed unless another concrete use remains.

## Error Handling

### Overlay bootstrap

Overlay startup must distinguish between:

- auth mismatch
- confirmed session ended
- session lookup failure
- permission/capability failure

Only confirmed terminal conditions should destroy the overlay session immediately.

### Companion window failures

A companion window failing to open is a degraded UI failure, not a session failure. The session continues and the dock can offer a retry path.

### Screen share failures

- source selection failure returns to `idle`
- capture loop failure transitions to `error`
- broadcast failure stops sharing and clears share state
- remote peers treat stale frames as share timeout, not permanent sharing

## Capability And Label Strategy

Every surviving companion window needs matching Tauri capability coverage.

At minimum:

- `dock`
- `chat`
- `session`
- `screen-share`
- `management`
- `overlay`

The deprecated `bottombar` and `sessionbar` capability remnants should be removed if those windows no longer exist after the redesign.

Window labels should be stable and declared once in the coordinator definitions so implementation cannot silently drift from capability config.

## Migration Plan

1. Define the new companion window registry, labels, payloads, and command/state contracts
2. Implement the coordinator and move companion creation through it
3. Update dock/chat/session/screen-share to use coordinator-managed lifecycle only
4. Replace overlay-local monitor picker and one-shot share call with the share state machine and loop
5. Remove capture-detection auto-hide and dead window-management paths
6. Remove deprecated bottom-bar/session-bar leftovers and align capabilities to surviving labels

The end state must not leave mixed architecture in place.

## Verification

Required validation:

- `npx tsc --noEmit`
- `npm run typecheck`
- `cargo check`

Manual runtime checks:

- create/join session launches overlay and dock correctly
- dock actions update overlay state correctly
- chat/session/screen-share open, focus, close, and restore correctly
- sign out / leave / end session destroys all session companion windows
- privacy mode propagates to every session companion window
- screen share updates continuously for remote peers and stops cleanly
- companion window failure does not kill the session
- transient lookup failure is no longer treated as confirmed session end

## Risks

- The redesign touches a high-churn area with active local changes
- Tauri window labels and capabilities must be updated atomically
- A low share cadence may still feel laggy even after correctness is fixed

## Recommendation

Implement this as a bounded redesign of the session window system, not as a patch-only bugfix. The current failures share one architectural root cause: mixed window ownership and inconsistent authority boundaries.
