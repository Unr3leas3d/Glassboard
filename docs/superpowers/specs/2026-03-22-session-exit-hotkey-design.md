# Session Exit Hotkey Design

Date: 2026-03-22
Status: Approved for planning
Scope: Add a role-aware global session-exit hotkey, expose it in App Settings, and keep shortcut changes synchronized across management and overlay windows.

## Context

Glassboard already has a configurable hotkey system:

- `Toggle Laser` defaults to `CommandOrControl+Shift+G`
- `Show Dashboard` defaults to `CommandOrControl+Shift+D`
- `Toggle Screenshots` defaults to `CommandOrControl+Shift+S`

Those bindings are defined in `useHotkeySettings`, edited from the App tab in Settings, and registered through `useGlobalHotkey` in the relevant window. Session-ending behavior already exists, but only through explicit UI actions:

- hosts can end the session from the session companion window
- participants can leave the session from the same surface
- the overlay owns the real session teardown logic

The current gap is that there is no configurable hotkey for exiting the active session, and the current session-exit UI path does not include a confirmation gate.

## Goals

- Add one configurable shortcut for exiting the current session
- Make the action role-aware:
  - hosts end the session for everyone
  - participants leave the session for themselves
- Require confirmation before the exit action executes for both roles
- Expose the binding in App Settings using the existing shortcut editor model
- Keep the active overlay in sync when shortcut bindings are changed from Settings while a session is live
- Reuse existing window ownership and event patterns instead of introducing a parallel command path

## Non-Goals

- Adding a separate host-only `End Session` shortcut and participant-only `Leave Session` shortcut
- Moving session authority out of the overlay
- Introducing a new settings page or a separate shortcut-management system
- Redesigning unrelated session UI flows beyond the confirmation and shortcut changes needed here

## Recommended Approach

Use a single overlay-owned shortcut with the default accelerator `CommandOrControl+Shift+E`.

Why this approach:

- it matches the existing `CommandOrControl+Shift+<key>` shortcut family
- `E` reads cleanly as `End` for hosts and `Exit` for participants
- the overlay already owns role checks, session teardown, and companion-window cleanup
- keeping the shortcut overlay-owned avoids splitting session authority between management and overlay

Rejected alternatives:

- Management-forwarded shortcut registration: increases coordination between hidden management and active overlay windows without a functional benefit
- Session-window-local shortcut handling: fails the “global hotkey” requirement and works poorly with the click-through overlay model

## User-Facing Behavior

### App Settings

Add a new binding to the App tab keyboard-shortcuts card:

- Label: `End or Leave Session`
- Description: `Prompt to end the current session if you're the host, or leave it if you're a participant.`
- Default accelerator: `CommandOrControl+Shift+E`

Recommended ordering inside the existing shortcut list:

1. `Toggle Laser`
2. `End or Leave Session`
3. `Show Dashboard`
4. `Toggle Screenshots`

This keeps active session controls grouped together without creating a new settings surface.

### Runtime Hotkey Behavior

The new shortcut is only registered while an overlay session is active.

When triggered:

- if the current user is the host, open a confirmation dialog with copy equivalent to:
  - title: `End session for everyone?`
  - confirm action: `End Session`
- if the current user is a participant, open a confirmation dialog with copy equivalent to:
  - title: `Leave this session?`
  - confirm action: `Leave Session`

Cancel closes the dialog and does nothing else.

If the shortcut is pressed while the confirmation dialog is already open, the app should keep focus on the existing dialog rather than opening a second copy.

## Architecture And Data Flow

### Ownership

The new shortcut remains overlay-owned.

- `ManagementApp` does not register or execute the session-exit shortcut
- `OverlayApp` registers the shortcut because it already owns:
  - the active session context
  - host/participant role checks
  - companion-window teardown
  - final `SESSION_ENDED` emission and overlay destruction

### Unified Exit Controller

All session-exit triggers should flow through one overlay-side controller that is responsible for:

- determining whether the action is `end` or `leave`
- opening the confirmation dialog
- choosing the role-appropriate copy and destructive action label
- executing the confirmed session-exit action
- surfacing any failure state

This controller should be used by:

- the new global hotkey
- the existing `UI_END_SESSION` event path
- the existing `UI_LEAVE_SESSION` event path

Using one controller prevents the hotkey path from confirming while button-driven paths bypass confirmation.

### Settings Synchronization

`useHotkeySettings` currently initializes from localStorage per window. That is sufficient for startup, but not for live updates while both management and overlay windows are open.

The design should add cross-window synchronization so that:

- changing a binding in the Settings page updates the management window state immediately
- the overlay window sees that change without requiring the session to restart
- `useGlobalHotkey` re-registers the new accelerator when the stored binding changes

Recommended mechanism:

- continue using the existing localStorage persistence model
- listen for cross-window `storage` events and reload bindings when `glasboard_hotkey_bindings` changes

This keeps the change scoped and avoids introducing a second settings transport layer.

## Confirmation UI

Use the existing Radix/shadcn dialog pattern already present elsewhere in the app.

Requirements:

- single overlay-owned dialog instance
- role-aware title, description, and confirm button text
- destructive styling for the confirm action
- cancel path leaves the session untouched
- dialog can show an inline error message if the confirmed action fails

The dialog should be controlled from overlay state, not duplicated independently in each companion window.

## Error Handling

### Host End Failure

If ending the session fails:

- keep the overlay session active
- keep the confirmation dialog open
- show an inline error message in the dialog
- do not emit `SESSION_ENDED`
- do not destroy the overlay or companion windows

### Participant Leave

Participant leave remains lightweight:

- confirmation opens first
- on confirm, the existing leave flow runs
- overlay and companion windows close
- management becomes the return target

### Missing Session Context

The shortcut is only active in the overlay, so there should be no session-exit action available when no session is active. If the handler is somehow invoked without a valid active session, it should no-op safely.

## Testing And Verification

There is no automated test suite configured in this repo, so verification is limited to type-checking and manual validation.

Required verification:

- `npx tsc --noEmit`

Required manual checks:

1. Host presses the shortcut, cancels the dialog, and the session remains active
2. Host presses the shortcut, confirms, and the session ends for everyone
3. Participant presses the shortcut, cancels the dialog, and remains in session
4. Participant presses the shortcut, confirms, and leaves the session
5. User rebinds the shortcut in App Settings while a session is active and the overlay starts using the new accelerator without restarting the session
6. The hotkey editor still blocks conflicting accelerators
7. Repeated shortcut presses while the confirmation dialog is open do not open duplicate dialogs

## Implementation Boundaries

The implementation plan should stay focused on these areas:

- hotkey binding definition and synchronization in `useHotkeySettings`
- App Settings display and shortcut ordering in the App tab
- overlay hotkey registration and unified session-exit control flow
- confirmation dialog UI and error presentation
- routing existing session-exit commands through the same confirmation-aware path

The implementation plan should not expand into unrelated session-window or management-window refactors.
