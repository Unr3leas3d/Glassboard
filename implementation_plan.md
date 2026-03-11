# Glasboard — Phased Implementation Plan

> A step-by-step build guide for an AI agent, aligned with the [PRD](file:///Users/ayubmohamed/.gemini/antigravity/brain/477fb404-e8fa-4b84-81a2-4fdb4cd9d92f/prd.md).

---

## Phase 1 — Foundation (Weeks 1–3)

> Goal: A working Tauri desktop app with a transparent overlay, Excalidraw embedded on the canvas, Supabase auth, and online connectivity check.

---

### Step 1.1 — Scaffold the Tauri v2 + React + TypeScript Project

**Commands:**
```bash
# Create the project
npm create tauri-app@latest glasboard -- --template react-ts

# Enter project and install dependencies
cd glasboard
npm install
```

**Post-scaffold setup:**
- Verify the project runs: `npm run tauri dev`
- Confirm the default Tauri + React window opens

**Files created:** Full Tauri v2 scaffold with `src/` (React), `src-tauri/` (Rust)

---

### Step 1.2 — Install UI Dependencies

```bash
# Tailwind CSS v4+
npm install -D tailwindcss @tailwindcss/vite

# shadcn/ui setup
npx shadcn@latest init

# Excalidraw
npm install @excalidraw/excalidraw

# Supabase client
npm install @supabase/supabase-js
```

**Post-install:**
- Configure Tailwind in `vite.config.ts` (add `@tailwindcss/vite` plugin)
- Configure `components.json` for shadcn/ui
- Verify build still compiles: `npm run tauri dev`

---

### Step 1.3 — Configure the Transparent Overlay Window

**File:** `src-tauri/tauri.conf.json`

Configure the main window:
```json
{
  "app": {
    "windows": [
      {
        "label": "overlay",
        "title": "Glasboard",
        "transparent": true,
        "decorations": false,
        "alwaysOnTop": true,
        "fullscreen": true,
        "resizable": false
      }
    ]
  }
}
```

**File:** `src-tauri/capabilities/default.json`

Enable required permissions:
- `core:window:allow-set-ignore-cursor-events` — for click-through toggle
- `global-shortcut:allow-register` — for hotkey registration

**File:** `src/index.css`

```css
html, body, #root {
  background: transparent !important;
  margin: 0;
  padding: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}
```

> [!IMPORTANT]
> On macOS, transparent windows require `"macos": { "transparent_titlebar": true }` in the window config. On Windows, no extra config is needed.

**Verification:** Run `npm run tauri dev` — the window should be transparent with no frame.

---

### Step 1.4 — Implement Click-Through / Draw Mode Toggle

**File:** `src/hooks/useDrawMode.ts`

Create a custom React hook:
- Use `@tauri-apps/api/window` → `getCurrentWindow().setIgnoreCursorEvents(true/false)`
- Track draw mode state: `isDrawMode: boolean`
- When draw mode is OFF → `setIgnoreCursorEvents(true)` (clicks pass through)
- When draw mode is ON → `setIgnoreCursorEvents(false)` (canvas captures clicks)

**File:** `src/hooks/useGlobalHotkey.ts`

- Use `@tauri-apps/plugin-global-shortcut` to register `Cmd+Shift+G` (macOS) / `Ctrl+Shift+G` (Windows)
- Hotkey toggles `isDrawMode`

**File:** `src/components/ModeIndicator.tsx`

- A small floating badge in the corner showing "DRAW MODE" or "VIEW MODE"
- Uses shadcn/ui `Badge` component
- Semi-transparent background so it doesn't obstruct content

---

### Step 1.5 — Embed Excalidraw on the Transparent Canvas

**File:** `src/components/ExcalidrawCanvas.tsx`

```tsx
import { Excalidraw } from "@excalidraw/excalidraw";

// Key configuration:
// - Set viewBackgroundColor to "transparent"
// - Pass UIOptions to customize visible tools
// - Hide Excalidraw's default UI chrome for overlay mode
// - Only render when isDrawMode is true
```

**Excalidraw configuration:**
- `initialData.appState.viewBackgroundColor` = `"transparent"`
- `UIOptions.canvasActions.clearCanvas` = `true`
- `UIOptions.canvasActions.export` = `false` (not needed for overlay)
- `UIOptions.canvasActions.loadScene` = `false`
- `UIOptions.canvasActions.saveToActiveFile` = `false`
- Style the Excalidraw container to fill the full viewport with `pointer-events: none` when not in draw mode

**File:** `src/App.tsx`

- Compose `ExcalidrawCanvas` + `ModeIndicator`
- Wire up `useDrawMode` hook
- Pass `isDrawMode` to control pointer-events on the Excalidraw container

**Verification:** Toggle draw mode via hotkey → draw on screen → annotations appear on transparent overlay.

---

### Step 1.6 — Supabase Project Setup

**Supabase Dashboard (manual or via MCP):**
1. Create a new Supabase project called "glasboard"
2. Enable Email auth + Google OAuth provider
3. Apply initial database migration with tables from the PRD data model:
   - `organizations` (id, name, created_by, created_at)
   - `org_members` (id, org_id, user_id, role, joined_at)
   - `sessions` (id, org_id, host_id, join_code, status, created_at, ended_at)
   - `annotations` (id, session_id, user_id, type, data, created_at, deleted_at)
4. Enable Row Level Security (RLS) on all tables
5. Create RLS policies:
   - Users can read orgs they belong to
   - Users can read/write sessions in their orgs
   - Users can read/write annotations in sessions they have access to
6. Enable Supabase Realtime on the `annotations` table and for broadcast channels

**File:** `src/lib/supabase.ts`

```typescript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

**File:** `.env` (gitignored)

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

---

### Step 1.7 — User Authentication (Email + Google OAuth)

**File:** `src/components/auth/LoginPage.tsx`

- Full-page auth screen (NOT transparent — this is a normal window)
- Email + password sign-in/sign-up form
- Google OAuth "Sign in with Google" button
- Uses shadcn/ui components: `Card`, `Input`, `Button`, `Label`
- Styled with Tailwind CSS, dark theme background

**File:** `src/hooks/useAuth.ts`

- Wraps `supabase.auth.signInWithPassword()`, `supabase.auth.signUp()`, `supabase.auth.signInWithOAuth()`
- Manages auth state via `supabase.auth.onAuthStateChange()`
- Provides `user`, `session`, `signIn`, `signUp`, `signOut`

**File:** `src/App.tsx` (update)

- If no authenticated user → show `LoginPage`
- If authenticated → show overlay with `ExcalidrawCanvas`

**Tauri-specific auth considerations:**
- For OAuth, use `supabase.auth.signInWithOAuth()` with `skipBrowserRedirect: true`
- Open the OAuth URL in the system browser via Tauri's `shell.open()`
- Handle the redirect callback using Tauri's deep link plugin (`tauri-plugin-deep-link`)

---

### Step 1.8 — Online Connectivity Check

**File:** `src/hooks/useOnlineStatus.ts`

- Use `navigator.onLine` + `window.addEventListener('online'/'offline')` to detect connectivity
- Optionally ping Supabase URL to verify actual connectivity

**File:** `src/components/OfflineBanner.tsx`

- When offline, render a centered card with the message:
  > *"Glasboard needs an internet connection to collaborate. Please check your connection and try again."*
- Uses shadcn/ui `Card` component with a subtle animation
- Blocks access to the overlay until back online

---

## Phase 2 — Collaboration (Weeks 4–6)

> Goal: Multi-user real-time annotation sessions with org management, live cursor sync, and screen mirroring.

---

### Step 2.1 — Organization CRUD

**Files:**
- `src/components/org/CreateOrgDialog.tsx` — shadcn `Dialog` + form to create a new org
- `src/components/org/OrgSwitcher.tsx` — dropdown to switch between orgs the user belongs to
- `src/components/org/MembersList.tsx` — list org members with roles
- `src/components/org/InviteMemberDialog.tsx` — invite users by email
- `src/hooks/useOrganizations.ts` — CRUD operations against `organizations` + `org_members` tables via Supabase

**Supabase:**
- Add RLS policies for org member management
- Admins can update org settings and manage members
- Members can read org info

---

### Step 2.2 — Session Creation with Join Codes

**Files:**
- `src/components/session/CreateSessionButton.tsx` — presenters start a session; generates a 6-char alphanumeric `join_code`
- `src/components/session/JoinSessionDialog.tsx` — members enter a join code
- `src/components/session/SessionBar.tsx` — floating toolbar showing active session info, join code, participant count
- `src/hooks/useSessions.ts` — create/join/end sessions via Supabase
- `src/utils/joinCode.ts` — generate random 6-char alphanumeric codes, check uniqueness

**Join code generation:**
```typescript
// Generate a unique 6-character alphanumeric code
function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude ambiguous: 0/O, 1/I/L
  return Array.from({ length: 6 }, () => 
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}
```

---

### Step 2.3 — Real-Time Annotation Sync via Supabase Realtime

**File:** `src/hooks/useRealtimeSync.ts`

Use Supabase Realtime **Broadcast** channels (not database changes) for low-latency sync:

```typescript
// Create a channel per session
const channel = supabase.channel(`session:${sessionId}`);

// Broadcast annotation events
channel.send({
  type: 'broadcast',
  event: 'annotation',
  payload: { type, data, userId, color }
});

// Listen for annotation events
channel.on('broadcast', { event: 'annotation' }, (payload) => {
  // Render remote annotation on Excalidraw canvas
});
```

**Integration with Excalidraw:**
- Use Excalidraw's `onChange` callback to detect local drawing changes
- Diff the `elements` array to find new/modified elements
- Broadcast only the changed elements (not the full scene)
- On receiving remote changes, merge them into the local Excalidraw state via `updateScene()`

---

### Step 2.4 — Multi-User Cursors with Name Labels

**File:** `src/hooks/useRealtimeCursors.ts`

- Broadcast cursor position via the same Supabase Realtime channel (separate event type: `cursor`)
- Throttle cursor broadcasts to ~30fps (every ~33ms)
- Each user gets a unique color assigned on session join

**File:** `src/components/session/RemoteCursor.tsx`

- Render a small colored dot + name label for each remote user's cursor
- Smooth animation between cursor positions using CSS transitions
- Fade out cursor if no update received for 3+ seconds

---

### Step 2.5 — Presence Indicators

**File:** `src/hooks/usePresence.ts`

Use Supabase Realtime **Presence** feature:

```typescript
channel.on('presence', { event: 'sync' }, () => {
  const state = channel.presenceState();
  // Update participant list
});

channel.track({
  user_id: user.id,
  name: user.email,
  color: assignedColor,
  joined_at: new Date().toISOString()
});
```

**File:** `src/components/session/ParticipantList.tsx`

- Floating panel showing who's in the session
- Each participant shown with their assigned color dot + name
- Online/offline status indicators

---

### Step 2.6 — Screen Mirroring (Presenter → Members)

> [!WARNING]
> This is the most complex feature in Phase 2. It requires capturing the presenter's screen and streaming it to members.

**Approach:** Use Tauri's Rust backend to capture screenshots at intervals, compress as JPEG, and send to members.

**File:** `src-tauri/src/screen_capture.rs`

- Use the `screenshots` Rust crate to capture the primary display
- Compress to JPEG (quality ~60%) to reduce bandwidth
- Expose a Tauri command: `capture_screen() -> Vec<u8>`

**File:** `src/hooks/useScreenMirror.ts`

**Presenter side:**
- Capture screen every ~500ms (2fps) via Tauri IPC command
- Encode as base64 and broadcast via Supabase Realtime channel (event: `screen_frame`)
- Consider chunking if frame size exceeds Realtime message limits

**Member side:**
- Receive screen frames and render as a background `<img>` behind the Excalidraw canvas
- CSS: `object-fit: contain; opacity: 0.95;`

> [!IMPORTANT]
> Supabase Realtime Broadcast has a message size limit (~1MB). Screen frames at 1080p JPEG ~60% quality are typically 100-300KB, which is within limits. For 4K displays, consider downscaling or using a lower quality.

---

## Phase 3 — Screenshot & Persistence (Weeks 7–8)

> Goal: Screenshot capture, annotation auto-save, and session history.

---

### Step 3.1 — Screenshot Capture (Overlay + Screen)

**File:** `src-tauri/src/screenshot.rs`

- Capture the screen using the `screenshots` crate
- Capture the overlay content by calling `Excalidraw.exportToBlob()` from the frontend
- Composite the overlay PNG on top of the screen capture using the `image` Rust crate
- Save to a temp file and return the path

**File:** `src/hooks/useScreenshot.ts`

- Register global hotkey `Cmd+Shift+S` / `Ctrl+Shift+S`
- On trigger: call `exportToBlob()` on Excalidraw, invoke Tauri command to composite + save
- Upload the resulting image to Supabase Storage under `screenshots/{session_id}/{timestamp}.jpg`

---

### Step 3.2 — Screenshot Sharing

**File:** `src/components/session/ScreenshotPreview.tsx`

- After capture, show a brief toast/preview
- Options: "Copy to clipboard" or "Share link"
- Copy to clipboard: use `navigator.clipboard.write()` with the image blob
- Share link: generate a signed Supabase Storage URL

---

### Step 3.3 — Annotation Persistence (Auto-Save)

**File:** `src/hooks/useAnnotationPersistence.ts`

- On every Excalidraw `onChange`, debounce (1 second) and save the full Excalidraw scene JSON to the `annotations` table
- Store as a single JSONB row per session: `{ session_id, user_id, data: excalidrawElements }`
- On session rejoin, load the saved scene and pass as `initialData` to Excalidraw

**Supabase:**
- Add a `session_snapshots` table:
  | Column | Type | Description |
  |---|---|---|
  | `id` | uuid | Primary key |
  | `session_id` | uuid | FK → sessions |
  | `elements` | jsonb | Full Excalidraw scene JSON |
  | `updated_at` | timestamptz | Last update time |

---

### Step 3.4 — Session History & Browsing

**File:** `src/components/session/SessionHistory.tsx`

- List past sessions for the current org (sorted by date)
- Show: date, duration, participant count, screenshot thumbnails
- Click to view saved annotations (read-only Excalidraw view)

**File:** `src/components/session/SessionDetail.tsx`

- Load the session snapshot and render in a read-only Excalidraw instance
- Display screenshots from the session in a gallery

---

## Phase 4 — Polish & Distribution (Weeks 9–10)

> Goal: Presenter moderation controls, auto-updates, platform builds, landing page, and tier gating.

---

### Step 4.1 — Presenter Controls

**File:** `src/components/session/PresenterToolbar.tsx`

A floating toolbar (only visible to the session host) with:
- **Lock/Unlock drawing** — broadcast a `lock` event; members disable Excalidraw input
- **Hide/Show annotations** — toggle visibility of all annotations
- **Clear all** — broadcast a `clear` event; all clients call `excalidrawAPI.resetScene()`
- **End session** — update session status to `ended` in Supabase

**File:** `src/hooks/usePresenterControls.ts`

- Listen for `lock`, `clear`, `hide` events on the Realtime channel
- Enforce controls on the member's client (disable Excalidraw, hide elements, etc.)

---

### Step 4.2 — Auto-Updater

**File:** `src-tauri/tauri.conf.json`

```json
{
  "plugins": {
    "updater": {
      "pubkey": "YOUR_PUBLIC_KEY",
      "endpoints": ["https://your-update-server.com/{{target}}/{{arch}}/{{current_version}}"]
    }
  }
}
```

**File:** `src/hooks/useAutoUpdate.ts`

- Use `@tauri-apps/plugin-updater` to check for updates on launch
- Show a shadcn `Dialog` prompting the user to update
- Install and restart on confirmation

--- 

### Step 4.3 — Platform Builds

**macOS:**
```bash
npm run tauri build -- --target universal-apple-darwin
# Produces: .dmg installer
# Post-build: notarize via `xcrun notarytool`
```

**Windows:**
```bash
npm run tauri build -- --target x86_64-pc-windows-msvc
# Produces: .msi installer
# Post-build: sign with code signing certificate
```

**CI/CD:** Set up GitHub Actions with `tauri-action` for automated builds on tag push.

---

### Step 4.4 — Landing Page

Build a standalone marketing website (separate repo or `/landing` directory):
- **Tech:** Next.js or Vite + React (static export)
- **Pages:** Hero, Features, Pricing, Download
- **Design:** Dark theme matching the app, animated demos, shadcn/ui components
- **Deploy:** Vercel

---

### Step 4.5 — Free / Pro Tier Gating

**File:** `src/hooks/useTierLimits.ts`

- On session create, check:
  - Free users: max 1 org, 3 members, 5 sessions/month, 30-min limit
  - If limit exceeded, show upgrade prompt
- Store tier info in a `subscriptions` table or via Supabase user metadata

**Supabase:**
- Add a `subscriptions` table:
  | Column | Type | Description |
  |---|---|---|
  | `id` | uuid | Primary key |
  | `user_id` | uuid | FK → auth.users |
  | `tier` | enum | `free`, `pro`, `team`, `enterprise` |
  | `stripe_customer_id` | text | Nullable |
  | `expires_at` | timestamptz | Nullable |

**Payment integration:** Stripe Checkout for Pro/Team upgrades (can be added later or at launch).

---

## Project Structure (Final)

```
glasboard/
├── src/                          # React frontend
│   ├── components/
│   │   ├── auth/
│   │   │   └── LoginPage.tsx
│   │   ├── org/
│   │   │   ├── CreateOrgDialog.tsx
│   │   │   ├── OrgSwitcher.tsx
│   │   │   ├── MembersList.tsx
│   │   │   └── InviteMemberDialog.tsx
│   │   ├── session/
│   │   │   ├── CreateSessionButton.tsx
│   │   │   ├── JoinSessionDialog.tsx
│   │   │   ├── SessionBar.tsx
│   │   │   ├── SessionHistory.tsx
│   │   │   ├── SessionDetail.tsx
│   │   │   ├── PresenterToolbar.tsx
│   │   │   ├── ParticipantList.tsx
│   │   │   ├── RemoteCursor.tsx
│   │   │   └── ScreenshotPreview.tsx
│   │   ├── ExcalidrawCanvas.tsx
│   │   ├── ModeIndicator.tsx
│   │   └── OfflineBanner.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useDrawMode.ts
│   │   ├── useGlobalHotkey.ts
│   │   ├── useOnlineStatus.ts
│   │   ├── useOrganizations.ts
│   │   ├── useSessions.ts
│   │   ├── useRealtimeSync.ts
│   │   ├── useRealtimeCursors.ts
│   │   ├── usePresence.ts
│   │   ├── useScreenMirror.ts
│   │   ├── useScreenshot.ts
│   │   ├── useAnnotationPersistence.ts
│   │   ├── usePresenterControls.ts
│   │   ├── useAutoUpdate.ts
│   │   └── useTierLimits.ts
│   ├── lib/
│   │   └── supabase.ts
│   ├── utils/
│   │   └── joinCode.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── main.rs
│   │   ├── screen_capture.rs
│   │   └── screenshot.rs
│   ├── capabilities/
│   │   └── default.json
│   ├── tauri.conf.json
│   └── Cargo.toml
├── .env
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
└── components.json              # shadcn/ui config
```

---

## Verification Plan

### Phase 1 Verification
1. **Tauri app launches** — `npm run tauri dev` opens without errors
2. **Transparent window** — underlying desktop content is visible through the app
3. **Click-through** — in view mode, clicks pass through to apps below
4. **Draw mode** — `Cmd+Shift+G` toggles draw mode; Excalidraw tools become active
5. **Excalidraw renders** — can draw freehand, shapes, text on the transparent canvas
6. **Auth works** — can sign up, sign in with email, sign in with Google
7. **Offline detection** — disconnect network → friendly message shown → reconnect → message dismissed

### Phase 2 Verification
1. **Org CRUD** — create org, invite member, switch orgs
2. **Session lifecycle** — create session → get join code → join from another instance → end session
3. **Real-time sync** — draw on one client → appears on the other within <500ms
4. **Cursors** — move mouse on one client → cursor appears on the other with name label
5. **Presence** — join/leave session → participant list updates
6. **Screen mirror** — presenter's screen visible as background on member's client

### Phase 3 Verification
1. **Screenshot** — `Cmd+Shift+S` captures overlay + screen composite
2. **Copy to clipboard** — paste screenshot into another app
3. **Auto-save** — draw annotations → close app → rejoin session → annotations restored
4. **Session history** — browse past sessions, view saved annotations

### Phase 4 Verification
1. **Presenter controls** — lock drawing, hide annotations, clear all → reflected on member clients
2. **Builds** — `.dmg` installs on macOS, `.msi` installs on Windows
3. **Auto-update** — deploy a new version → existing app detects and prompts to update
4. **Tier gating** — free user hits session limit → upgrade prompt shown

> [!TIP]
> For Phase 1–2 testing, run two instances of the app side-by-side (or one in dev mode and one built). Use two different Supabase auth accounts to simulate presenter + member.
