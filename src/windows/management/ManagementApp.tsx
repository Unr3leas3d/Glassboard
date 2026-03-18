// src/windows/management/ManagementApp.tsx
import { useState, useCallback, useEffect, useRef } from "react";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen, emit } from "@tauri-apps/api/event";
import { useAuth } from "../../hooks/useAuth";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { useOrganizations } from "../../hooks/useOrganizations";
import { useSessions } from "../../hooks/useSessions";
import { useGlobalHotkey } from "../../hooks/useGlobalHotkey";
import { LoginPage } from "../../components/auth/LoginPage";
import { ManagementPanel } from "../../components/ManagementPanel";
import { OfflineBanner } from "../../components/OfflineBanner";
import { CreateSessionButton } from "../../components/session/CreateSessionButton";
import { JoinSessionDialog } from "../../components/session/JoinSessionDialog";
import type { OverlayPayload } from "../../types/events";
import { EVENTS } from "../../types/events";
import type { Session } from "../../hooks/useSessions";

export function ManagementApp() {
  const { user, loading: authLoading, signIn, signUp, signInWithGoogle, signOut } = useAuth();
  const isOnline = useOnlineStatus();
  const {
    orgs,
    currentOrg,
    members,
    setCurrentOrg,
    createOrg,
    inviteMember,
  } = useOrganizations(user?.id);
  const {
    error: sessionError,
    createSession,
    joinSession,
    leaveSession,
  } = useSessions(user?.id, currentOrg?.id);

  const [overlayError, setOverlayError] = useState<string | null>(null);
  const overlayRef = useRef<WebviewWindow | null>(null);

  // Show management window via hotkey — also deactivates overlay laser
  const showManagement = useCallback(async () => {
    await emit(EVENTS.DEACTIVATE_LASER);
    const win = getCurrentWindow();
    await win.show();
    await win.setFocus();
  }, []);

  useGlobalHotkey("CommandOrControl+Shift+D", showManagement);

  // Destroy overlay helper
  const destroyOverlay = useCallback(async () => {
    try {
      if (overlayRef.current) {
        await overlayRef.current.destroy();
      }
    } catch {
      // Already destroyed
    }
    overlayRef.current = null;
  }, []);

  // Listen for overlay events
  useEffect(() => {
    const p1 = listen(EVENTS.SESSION_ENDED, () => {
      overlayRef.current = null;
      leaveSession();
      showManagement();
    });

    const p2 = listen(EVENTS.REQUEST_SHOW_MANAGEMENT, () => {
      showManagement();
    });

    const p3 = listen(EVENTS.REQUEST_SIGN_OUT, () => {
      destroyOverlay();
      signOut();
    });

    return () => {
      p1.then((fn) => fn());
      p2.then((fn) => fn());
      p3.then((fn) => fn());
    };
  }, [leaveSession, showManagement, signOut, destroyOverlay]);

  // Handle app quit: destroy overlay before management window closes
  useEffect(() => {
    const win = getCurrentWindow();
    const unlisten = win.onCloseRequested(async () => {
      await destroyOverlay();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [destroyOverlay]);

  // Spawn overlay when session becomes active
  const spawnOverlay = useCallback(
    async (session: Session) => {
      if (!user) return;

      setOverlayError(null);

      // Destroy any existing overlay
      await destroyOverlay();

      const payload: OverlayPayload = {
        userId: user.id,
        userName: user.email?.split("@")[0] ?? "User",
        activeSession: session,
        currentOrg: currentOrg!,
      };

      const baseUrl = import.meta.env.DEV
        ? "http://localhost:1420"
        : "index.html";

      const encodedPayload = encodeURIComponent(btoa(JSON.stringify(payload)));
      const url = `${baseUrl}?window=overlay&payload=${encodedPayload}`;

      try {
        const overlay = new WebviewWindow("overlay", {
          url,
          transparent: true,
          decorations: false,
          alwaysOnTop: true,
          maximized: true,
          resizable: false,
          contentProtected: true,
        });

        overlay.once("tauri://error", (e) => {
          console.error("[Glasboard] Overlay window error:", e);
          setOverlayError("Failed to open overlay window. Please try again.");
          overlayRef.current = null;
        });

        overlay.once("tauri://destroyed", () => {
          overlayRef.current = null;
          // Crash recovery: show management and clear session state
          leaveSession();
          showManagement();
        });

        overlayRef.current = overlay;

        // Wait for overlay to be created before hiding management
        overlay.once("tauri://created", async () => {
          await getCurrentWindow().hide();
        });
      } catch (err) {
        console.error("[Glasboard] Failed to create overlay:", err);
        setOverlayError("Failed to open overlay window. Please try again.");
      }
    },
    [user, currentOrg, destroyOverlay, leaveSession, showManagement],
  );

  // Wrap createSession to spawn overlay on success
  const handleCreateSession = useCallback(
    async (title?: string) => {
      const session = await createSession(title);
      if (session) {
        await spawnOverlay(session);
      }
      return session;
    },
    [createSession, spawnOverlay],
  );

  // Wrap joinSession to spawn overlay on success
  const handleJoinSession = useCallback(
    async (code: string) => {
      const session = await joinSession(code);
      if (session) {
        await spawnOverlay(session);
      }
      return session;
    },
    [joinSession, spawnOverlay],
  );

  // Destroy overlay on sign out
  const handleSignOut = useCallback(async () => {
    await destroyOverlay();
    await signOut();
  }, [destroyOverlay, signOut]);

  // Offline
  if (!isOnline) {
    return <OfflineBanner />;
  }

  // Loading auth
  if (authLoading) {
    return null;
  }

  // Not authenticated
  if (!user) {
    return (
      <LoginPage
        onSignIn={signIn}
        onSignUp={signUp}
        onSignInWithGoogle={signInWithGoogle}
      />
    );
  }

  // Management panel (always shown when management window is visible)
  return (
    <ManagementPanel
      userId={user.id}
      orgs={orgs}
      currentOrg={currentOrg}
      members={members}
      onSelectOrg={setCurrentOrg}
      onCreateOrg={createOrg}
      onInviteMember={inviteMember}
      onSignOut={handleSignOut}
    >
      {overlayError && (
        <p className="text-sm text-red-400 text-center">{overlayError}</p>
      )}
      <CreateSessionButton onCreate={handleCreateSession} disabled={!currentOrg} />
      <div className="flex items-center gap-2">
        <JoinSessionDialog onJoin={handleJoinSession} error={sessionError} />
      </div>
    </ManagementPanel>
  );
}
