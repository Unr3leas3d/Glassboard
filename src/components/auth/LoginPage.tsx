import { useState } from "react";
import { WindowTitleBar } from "../WindowTitleBar";
import { Button } from "@/components/ui/button";
import type { useAuth } from "../../hooks/useAuth";

type AuthHook = ReturnType<typeof useAuth>;

interface LoginPageProps {
  onSignIn: AuthHook["signIn"];
  onSignUp: AuthHook["signUp"];
  onSignInWithGoogle: AuthHook["signInWithGoogle"];
}

export function LoginPage({ onSignIn, onSignUp, onSignInWithGoogle }: LoginPageProps) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    const err = mode === "signin"
      ? await onSignIn(email, password)
      : await onSignUp(email, password);

    setLoading(false);
    if (err) {
      setError(err.message);
    } else if (mode === "signup") {
      setMessage("Check your email to confirm your account.");
    }
  }

  async function handleGoogle() {
    setError(null);
    const err = await onSignInWithGoogle();
    if (err) setError(err.message);
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4"
      style={{
        background: 'var(--background)',
        backgroundImage: 'radial-gradient(ellipse 80% 60% at 50% 20%, rgba(193,185,126,0.04) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 80% 80%, rgba(140,120,80,0.03) 0%, transparent 50%)',
      }}
    >
      <WindowTitleBar />
      <div className="w-full max-w-sm space-y-6 pt-10">
        <div className="text-center space-y-1">
          <h1 className="text-[28px] font-semibold text-foreground leading-tight tracking-tight">
            Glass<span className="text-[var(--gold)]">board</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            {mode === "signin" ? "Sign in to your account" : "Create your account"}
          </p>
        </div>

        <div className="bg-card rounded-xl p-6 space-y-4 overflow-hidden"
          style={{
            border: '1px solid rgba(193,185,126,0.18)',
            backgroundImage: 'radial-gradient(ellipse 70% 40% at 50% 0%, rgba(193,185,126,0.04) 0%, transparent 70%)',
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full h-9 rounded-md border border-input bg-muted px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="you@example.com"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                className="w-full h-9 rounded-md border border-input bg-muted px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}
            {message && (
              <p className="text-xs text-green-400">{message}</p>
            )}

            <Button type="submit" className="w-full text-[#1A1A1E] font-semibold border-none" disabled={loading}
              style={{ background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-warm) 100%)' }}
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {mode === "signin" ? "Signing in..." : "Creating account..."}
                </span>
              ) : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-input" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <Button variant="outline" className="w-full" onClick={handleGoogle}>
            <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </Button>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); setMessage(null); }}
            className="text-foreground underline-offset-4 hover:underline"
          >
            {mode === "signin" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
