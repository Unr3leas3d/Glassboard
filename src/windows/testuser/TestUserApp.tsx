import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useSessions } from "../../hooks/useSessions";
import { useOrganizations } from "../../hooks/useOrganizations";
import { TestUserSession } from "./TestUserSession";
import { getDisplayName, getAvatarUrl } from "../../utils/displayName";
import "./testuser.css";

export function TestUserApp() {
  const { user, loading: authLoading, signIn, signUp, signOut } = useAuth();
  const { currentOrg } = useOrganizations(user?.id);
  const {
    activeSession,
    loading: sessionLoading,
    error: sessionError,
    joinSession,
    createSession,
    leaveSession,
  } = useSessions(user?.id);

  // Login form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  // Join form state
  const [joinCode, setJoinCode] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthMessage(null);
    if (authMode === "signup") {
      const err = await signUp(email, password);
      if (err) setAuthError(err.message);
      else setAuthMessage("Check your email to confirm your account.");
    } else {
      const err = await signIn(email, password);
      if (err) setAuthError(err.message);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (joinCode.length < 6) return;
    await joinSession(joinCode);
  };

  const handleCreate = async () => {
    await createSession("Test Session");
  };

  const handleLeave = () => {
    leaveSession();
  };

  // Phase 3: In session
  if (user && activeSession) {
    return (
      <div style={{ width: "100vw", height: "100vh", background: "#09090b" }}>
        <TestUserSession
          session={activeSession}
          userId={user.id}
          userName={getDisplayName(user, "Test User")}
          userAvatarUrl={getAvatarUrl(user)}
          onLeave={handleLeave}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#09090b",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div style={{ width: 380, padding: 32 }}>
        {/* Header */}
        <div style={{ marginBottom: 32, textAlign: "center" }}>
          <div
            style={{
              display: "inline-block",
              padding: "4px 12px",
              borderRadius: 999,
              background: "rgba(139,92,246,0.15)",
              color: "#a78bfa",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 1,
              marginBottom: 12,
            }}
          >
            TEST PARTICIPANT
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0, color: "#fff" }}>
            Glasboard
          </h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, margin: "8px 0 0" }}>
            Browser-based test participant for multi-user testing
          </p>
        </div>

        {authLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div
              style={{
                height: 42,
                borderRadius: 8,
                background: "rgba(255,255,255,0.06)",
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
            <div
              style={{
                height: 42,
                borderRadius: 8,
                background: "rgba(255,255,255,0.06)",
                animation: "pulse 1.5s ease-in-out infinite",
                animationDelay: "0.1s",
              }}
            />
            <div
              style={{
                height: 42,
                borderRadius: 8,
                background: "rgba(255,255,255,0.06)",
                animation: "pulse 1.5s ease-in-out infinite",
                animationDelay: "0.2s",
              }}
            />
          </div>
        ) : !user ? (
          /* Phase 1: Login */
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.05)",
                color: "#fff",
                fontSize: 14,
                outline: "none",
              }}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.05)",
                color: "#fff",
                fontSize: 14,
                outline: "none",
              }}
            />
            {authError && (
              <div style={{ color: "#ef4444", fontSize: 13 }}>{authError}</div>
            )}
            {authMessage && (
              <div style={{ color: "#22c55e", fontSize: 13 }}>{authMessage}</div>
            )}
            <button
              type="submit"
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                border: "none",
                background: "#7c3aed",
                color: "#fff",
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              {authMode === "signin" ? "Sign In" : "Sign Up"}
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode(authMode === "signin" ? "signup" : "signin"); setAuthError(null); setAuthMessage(null); }}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                border: "none",
                background: "transparent",
                color: "rgba(255,255,255,0.5)",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {authMode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </form>
        ) : (
          /* Phase 2: Join or create session */
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
              Signed in as <span style={{ color: "#fff" }}>{user.email}</span>
              <button
                onClick={signOut}
                style={{
                  marginLeft: 8,
                  padding: "2px 8px",
                  borderRadius: 4,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "transparent",
                  color: "rgba(255,255,255,0.5)",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Sign out
              </button>
            </div>

            <form
              onSubmit={handleJoin}
              style={{ display: "flex", flexDirection: "column", gap: 12 }}
            >
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 600, letterSpacing: 1 }}>
                JOIN SESSION
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  placeholder="Enter 6-char code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                  maxLength={6}
                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: "rgba(255,255,255,0.05)",
                    color: "#fff",
                    fontSize: 16,
                    fontFamily: "monospace",
                    letterSpacing: 3,
                    textAlign: "center",
                    outline: "none",
                  }}
                />
                <button
                  type="submit"
                  disabled={joinCode.length < 6 || sessionLoading}
                  style={{
                    padding: "10px 18px",
                    borderRadius: 8,
                    border: "none",
                    background: joinCode.length >= 6 ? "#7c3aed" : "rgba(255,255,255,0.1)",
                    color: joinCode.length >= 6 ? "#fff" : "rgba(255,255,255,0.3)",
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: joinCode.length >= 6 ? "pointer" : "default",
                  }}
                >
                  Join
                </button>
              </div>
            </form>

            {currentOrg && (
              <div>
                <div
                  style={{
                    color: "rgba(255,255,255,0.4)",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: 1,
                    marginBottom: 8,
                  }}
                >
                  OR CREATE NEW
                </div>
                <button
                  onClick={handleCreate}
                  disabled={sessionLoading}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: "transparent",
                    color: "rgba(255,255,255,0.7)",
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  Create Session ({currentOrg.name})
                </button>
              </div>
            )}

            {sessionError && (
              <div style={{ color: "#ef4444", fontSize: 13 }}>{sessionError}</div>
            )}
            {sessionLoading && (
              <div
                style={{
                  height: 20,
                  width: 140,
                  borderRadius: 6,
                  background: "rgba(255,255,255,0.06)",
                  animation: "pulse 1.5s ease-in-out infinite",
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
