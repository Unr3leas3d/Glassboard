// src/windows/management/ManagementApp.tsx
import { useState, useCallback, useEffect, useRef } from "react";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen, emit, emitTo } from "@tauri-apps/api/event";
import { useAuth } from "../../hooks/useAuth";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { useOrganizations } from "../../hooks/useOrganizations";
import { useSessions } from "../../hooks/useSessions";
import { useGlobalHotkey } from "../../hooks/useGlobalHotkey";
import { useHotkeySettings } from "../../hooks/useHotkeySettings";
import { useTheme } from "../../hooks/useTheme";
import { LoginPage } from "../../components/auth/LoginPage";
import { ManagementPanel } from "../../components/ManagementPanel";
import { SettingsPage } from "../../components/settings/SettingsPage";
import type { SettingsTab } from "../../components/settings/SettingsPage";
import { OfflineBanner } from "../../components/OfflineBanner";
import { WindowTitleBar } from "../../components/WindowTitleBar";
import { Skeleton } from "../../components/ui/skeleton";
import { SessionList } from "../../components/session/SessionList";
import { NewSessionForm } from "../../components/session/NewSessionForm";
import { useActiveSessions } from "../../hooks/useActiveSessions";
import { supabase } from "../../supabase";
import { sessionWindowCoordinator } from "../../services/sessionWindows/coordinator";
import { recordSessionWindowDebug } from "../../services/sessionWindows/debug";
import { buildWindowUrl } from "../../services/sessionWindows/payload";
import type {
  OverlayPayload,
  OverlayValidationRequestPayload,
  OverlayValidationResultPayload,
} from "../../types/events";
import { EVENTS } from "../../types/events";
import type { Session } from "../../hooks/useSessions";
import { getDisplayName, getAvatarUrl } from "../../utils/displayName";
import { isWindows } from "@/utils/platform";

export function ManagementApp() {
  const { user, loading: authLoading, signIn, signUp, signInWithGoogle, signOut } = useAuth();
  const isOnline = useOnlineStatus();
  const {
    orgs,
    currentOrg,
    members,
    loading: orgsLoading,
    setCurrentOrg,
    createOrg,
    inviteMember,
    renameOrg,
    leaveOrg,
    deleteOrg,
    removeMember,
    updateMemberRole,
  } = useOrganizations(user?.id);
  const {
    createSession,
    joinSession,
    leaveSession,
  } = useSessions(user?.id);
  const { groups: activeSessionGroups, loading: sessionsLoading } = useActiveSessions(user?.id, orgs);

  const [overlayError, setOverlayError] = useState<string | null>(null);
  const overlayRef = useRef<WebviewWindow | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [initialSettingsTab, setInitialSettingsTab] = useState<SettingsTab>("account");
  const { getBinding } = useHotkeySettings();
  const { theme, setTheme } = useTheme();

  // Show management window via hotkey — also deactivates overlay laser
  const showManagement = useCallback(async () => {
    await emit(EVENTS.DEACTIVATE_LASER);
    const win = getCurrentWindow();
    await win.show();
    await win.setFocus();
  }, []);

  useGlobalHotkey(getBinding("show-management"), showManagement);

  // On Windows, remove native decorations so custom WindowTitleBar takes over
  useEffect(() => {
    if (isWindows) {
      getCurrentWindow().setDecorations(false).catch(console.error);
    }
  }, []);

  // Auto-create org on first login
  const autoCreatedRef = useRef(false);
  useEffect(() => {
    if (!user || orgsLoading || orgs.length > 0 || autoCreatedRef.current) return;
    autoCreatedRef.current = true;
    const name = getDisplayName(user, "My");
    createOrg(`${name}'s Team`);
  }, [user, orgsLoading, orgs.length, createOrg]);

  // Destroy overlay and its child UI windows
  const destroyOverlay = useCallback(async () => {
    await sessionWindowCoordinator.destroyAll();
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

    const p4 = listen<OverlayValidationRequestPayload>(
      EVENTS.REQUEST_OVERLAY_VALIDATION,
      async (event) => {
        const request = event.payload;
        let result: OverlayValidationResultPayload;

        if (!user) {
          result = {
            requestId: request.requestId,
            valid: false,
            reason: "auth-missing",
          };
        } else if (user.id !== request.expectedUserId) {
          result = {
            requestId: request.requestId,
            valid: false,
            reason: "auth-mismatch",
          };
        } else {
          const { data: sessionData, error: sessionError } = await supabase
            .from("sessions")
            .select("id")
            .eq("id", request.sessionId)
            .eq("status", "active")
            .maybeSingle();

          if (sessionError) {
            recordSessionWindowDebug("management:overlay-session-lookup-error", sessionError);
            result = {
              requestId: request.requestId,
              valid: true,
              reason: "session-lookup-error",
            };
          } else if (!sessionData) {
            result = {
              requestId: request.requestId,
              valid: false,
              reason: "session-ended",
            };
          } else {
            result = {
              requestId: request.requestId,
              valid: true,
              reason: "verified",
            };
          }
        }

        emitTo("overlay", EVENTS.OVERLAY_VALIDATION_RESULT, result).catch(console.error);
      },
    );

    return () => {
      p1.then((fn) => fn());
      p2.then((fn) => fn());
      p3.then((fn) => fn());
      p4.then((fn) => fn());
    };
  }, [destroyOverlay, leaveSession, showManagement, signOut, user]);

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
        userName: getDisplayName(user),
        userAvatarUrl: getAvatarUrl(user),
        activeSession: session,
        currentOrg: currentOrg!,
      };

      const url = buildWindowUrl("overlay", payload);

      try {
        recordSessionWindowDebug("management:spawn-overlay", {
          sessionId: session.id,
          userId: user.id,
        });

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
          console.error("[Glassboard] Overlay window error:", e);
          recordSessionWindowDebug("management:overlay-error", e);
          setOverlayError("Failed to open overlay window. Please try again.");
          overlayRef.current = null;
        });

        overlay.once("tauri://destroyed", () => {
          recordSessionWindowDebug("management:overlay-destroyed");
          // Only run crash recovery if session-ended hasn't already handled cleanup
          if (overlayRef.current) {
            overlayRef.current = null;
            leaveSession();
            showManagement();
          }
        });

        overlayRef.current = overlay;

        // Wait for overlay to be created before hiding management
        overlay.once("tauri://created", async () => {
          recordSessionWindowDebug("management:overlay-created");
          await getCurrentWindow().hide();
        });
      } catch (err) {
        console.error("[Glassboard] Failed to create overlay:", err);
        recordSessionWindowDebug("management:overlay-create-threw", err);
        setOverlayError("Failed to open overlay window. Please try again.");
      }
    },
    [user, currentOrg, destroyOverlay, leaveSession, showManagement],
  );

  // Wrap createSession to spawn overlay on success
  const handleCreateSession = useCallback(
    async (orgId: string, title?: string) => {
      const session = await createSession(orgId, title);
      if (session) {
        await spawnOverlay(session);
      }
      return session;
    },
    [createSession, spawnOverlay],
  );

  // Wrap joinSession to spawn overlay on success
  const handleJoinSession = useCallback(
    async (sessionId: string) => {
      const session = await joinSession(sessionId);
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

  // Settings handlers
  const handleUpdateDisplayName = useCallback(async (name: string) => {
    const { error } = await supabase.auth.updateUser({ data: { full_name: name } });
    if (error) return { error: error.message };
    return {};
  }, []);

  const handleChangePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: error.message };
    return {};
  }, []);

  const handleDeleteAccount = useCallback(async () => {
    return { error: "Account deletion coming soon. Contact support@glasboard.com for assistance." };
  }, []);

  const openSettings = useCallback((tab: SettingsTab = "account") => {
    setInitialSettingsTab(tab);
    setShowSettings(true);
  }, []);

  // Offline
  if (!isOnline) {
    return <OfflineBanner />;
  }

  // Loading auth — show skeleton matching the management panel layout
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <WindowTitleBar />
        <div className="w-full max-w-md space-y-6 pt-10">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-32 rounded-md" />
          </div>
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
        </div>
      </div>
    );
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

  // Settings page (replaces management panel when open)
  if (showSettings) {
    return (
      <SettingsPage
        user={user}
        onBack={() => setShowSettings(false)}
        onUpdateDisplayName={handleUpdateDisplayName}
        onChangePassword={handleChangePassword}
        onDeleteAccount={handleDeleteAccount}
        theme={theme}
        setTheme={setTheme}
        initialTab={initialSettingsTab}
        userId={user.id}
        orgs={orgs}
        currentOrg={currentOrg}
        members={members}
        onSelectOrg={setCurrentOrg}
        onCreateOrg={createOrg}
        onInviteMember={inviteMember}
        onRenameOrg={renameOrg}
        onLeaveOrg={leaveOrg}
        onDeleteOrg={deleteOrg}
        onRemoveMember={removeMember}
        onUpdateMemberRole={updateMemberRole}
      />
    );
  }

  // Management panel (always shown when management window is visible)
  return (
    <ManagementPanel
      user={user}
      orgs={orgs}
      currentOrg={currentOrg}
      loading={orgsLoading}
      onSelectOrg={setCurrentOrg}
      onSignOut={handleSignOut}
      onOpenSettings={() => openSettings("account")}
      onOpenOrgSettings={() => openSettings("organization")}
    >
      {overlayError && (
        <p className="text-sm text-red-400 text-center">{overlayError}</p>
      )}
      <NewSessionForm
        orgs={orgs}
        currentOrg={currentOrg}
        onCreate={handleCreateSession}
      />
      <SessionList
        groups={activeSessionGroups}
        loading={sessionsLoading}
        userId={user.id}
        onJoin={handleJoinSession}
      />
    </ManagementPanel>
  );
}
