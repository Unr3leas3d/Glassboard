import React, { useState, useEffect } from "react";
import { supabase } from "@/supabase";
import { Sparkles, Layers, Sun, Moon, CheckCircle2 } from "lucide-react";
import { QuestionnaireFlow } from "./QuestionnaireFlow";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const LandingApp = () => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [waitlistId, setWaitlistId] = useState<string | null>(null);
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [isReturningUser, setIsReturningUser] = useState(false);

  useEffect(() => {
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(isDark ? "dark" : "light");
  }, []);

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  // Check for direct questionnaire URL: ?view=questionnaire&email=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("view") === "questionnaire" && params.get("email")) {
      const urlEmail = params.get("email")!.trim().toLowerCase();
      setEmail(urlEmail);
      supabase.rpc("join_waitlist", { input_email: urlEmail }).then(({ data, error }) => {
        if (!error && data) {
          const result = typeof data === "object" ? data : { id: data, is_new: true };
          setWaitlistId(result.id);
          setShowQuestionnaire(true);
        }
      });
    }
  }, []);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setStatus("error");
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    setStatus("loading");
    setErrorMessage("");

    try {
      const { data, error } = await supabase.rpc("join_waitlist", {
        input_email: normalizedEmail,
      });

      if (error || !data) {
        throw error ?? new Error("Failed to join waitlist.");
      }

      const result = typeof data === "object" ? data : { id: data, is_new: true };
      setEmail(normalizedEmail);
      setWaitlistId(result.id);
      setStatus("success");

      if (result.is_new) {
        setShowQuestionnaire(true);
      } else {
        setIsReturningUser(true);
      }
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setErrorMessage(err.message || "Failed to join waitlist. Please try again.");
    }
  };

  const handleBackToHome = () => {
    setShowQuestionnaire(false);
    setIsReturningUser(false);
    setStatus("idle");
    setEmail("");
    setWaitlistId(null);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a] text-neutral-900 dark:text-neutral-50 selection:bg-neutral-200 dark:selection:bg-neutral-800 flex flex-col font-sans transition-colors duration-200 relative">
      {/* Top Elements */}
      <header className="absolute top-0 left-0 w-full p-6 flex items-center justify-between z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-neutral-900 dark:bg-white flex items-center justify-center shadow-sm">
            <Layers className="w-5 h-5 text-white dark:text-neutral-950" />
          </div>
          <span className="font-semibold text-lg tracking-tight">Glassboard</span>
        </div>
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-[5vh] overflow-y-auto">
        <div className="max-w-4xl w-full text-center space-y-8">
          
          {!showQuestionnaire && (
            <>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-transparent border border-neutral-200 dark:border-neutral-800 text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-2 transition-colors duration-200">
                <Sparkles className="w-4 h-4 text-[#C1B97E] dark:text-[#D4CB88]" />
                <span>Currently in Private Beta</span>
              </div>

              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-neutral-900 dark:text-white leading-[1.15] transition-colors duration-200">
                The missing communication layer<br className="hidden md:block" />
                <span className="text-[#C1B97E] dark:text-[#D4CB88]"> during screen sharing.</span>
              </h1>

              <p className="text-lg md:text-xl text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto leading-relaxed transition-colors duration-200">
                A transparent communication layer that lets you draw directly over any app during presentations and team reviews.
              </p>
            </>
          )}

          <div className="max-w-2xl mx-auto pt-10">
            {showQuestionnaire && waitlistId ? (
              <QuestionnaireFlow email={email} waitlistId={waitlistId} onBackToHome={handleBackToHome} />
            ) : isReturningUser && waitlistId ? (
              <div className="w-full max-w-lg mx-auto px-4 sm:px-6 py-12 text-center animate-in fade-in duration-500">
                <div className="w-16 h-16 rounded-full bg-[#C1B97E]/20 dark:bg-[#D4CB88]/20 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-8 h-8 text-[#C1B97E] dark:text-[#D4CB88]" />
                </div>
                <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-3">
                  You're already on the waitlist!
                </h2>
                <p className="text-neutral-600 dark:text-neutral-400 text-lg leading-relaxed mb-8">
                  Your spot is confirmed. We'll reach out when Glassboard is ready for you.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={() => {
                      setIsReturningUser(false);
                      setShowQuestionnaire(true);
                    }}
                    className="px-6 py-3 rounded-xl bg-[#C1B97E] dark:bg-[#D4CB88] text-neutral-900 font-semibold text-base transition-all hover:opacity-90"
                  >
                    Complete Questionnaire
                  </button>
                  <button
                    onClick={handleBackToHome}
                    className="px-6 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 font-medium text-base transition-all hover:bg-neutral-50 dark:hover:bg-neutral-900"
                  >
                    Back to Home
                  </button>
                </div>
              </div>
            ) : (
              <>
                <form onSubmit={handleSubmit} className="flex items-center w-full max-w-[500px] mx-auto p-1.5 bg-[#C1B97E] dark:bg-[#D4CB88] rounded-full shadow-[0_16px_40px_-12px_rgba(193,185,126,0.5)] dark:shadow-[0_16px_40px_-12px_rgba(212,203,136,0.3)] transition-all">
                  <input
                    type="email"
                    placeholder="Enter your email"
                    className="flex-1 h-[56px] w-full min-w-0 bg-[#f4f4f6] dark:bg-[#1a1a1a] rounded-full px-6 text-lg text-neutral-900 dark:text-white outline-none placeholder:text-neutral-500 border border-transparent focus-visible:ring-2 focus-visible:ring-black/10 dark:focus-visible:ring-white/20 transition-all"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={status === "loading"}
                    autoComplete="off"
                    data-1p-ignore="true"
                    data-lpignore="true"
                    data-form-type="other"
                    required
                  />
                  <button
                    type="submit"
                    className="px-8 text-neutral-900 dark:text-neutral-900 font-semibold text-lg whitespace-nowrap hover:opacity-80 transition-opacity"
                    disabled={status === "loading"}
                  >
                    {status === "loading" ? "Joining..." : "Join Waitlist"}
                  </button>
                </form>
                {status === "error" && (
                  <p className="text-red-500 dark:text-red-400 text-base mt-4 text-center">{errorMessage}</p>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
