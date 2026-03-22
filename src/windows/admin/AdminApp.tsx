import { useState, useEffect, useMemo } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/supabase";
import { questions } from "../landing/questions";
import {
  Download,
  ChevronDown,
  ChevronUp,
  LogOut,
  BarChart3,
  Filter,
} from "lucide-react";

interface QuestionnaireResponse {
  id: string;
  email: string;
  completed: boolean;
  answers: Record<string, unknown>;
  current_step: number;
  created_at: string;
  updated_at: string;
}

type CompletionFilter = "all" | "completed" | "partial";
type RoleFilter = string | null;
type FrequencyFilter = string | null;

function isAdminUser(user: User | null): boolean {
  if (!user) return false;
  const appMeta = user.app_metadata as {
    role?: string;
    roles?: unknown;
    is_admin?: boolean;
  };

  if (appMeta.role === "admin" || appMeta.is_admin === true) {
    return true;
  }

  return Array.isArray(appMeta.roles) && appMeta.roles.includes("admin");
}

export const AdminApp = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [responses, setResponses] = useState<QuestionnaireResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters
  const [completionFilter, setCompletionFilter] = useState<CompletionFilter>("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>(null);
  const [frequencyFilter, setFrequencyFilter] = useState<FrequencyFilter>(null);
  const isAdmin = isAdminUser(session?.user ?? null);

  // Auth check
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Fetch responses
  useEffect(() => {
    if (!session || !isAdmin) {
      setResponses([]);
      setLoading(false);
      return;
    }
    const fetchResponses = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("questionnaire_responses")
        .select("*")
        .order("created_at", { ascending: false });
      if (!error && data) {
        setResponses(data as QuestionnaireResponse[]);
      }
      setLoading(false);
    };
    fetchResponses();
  }, [isAdmin, session]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError("");
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });
    if (error) {
      setLoginError(error.message);
    }
    setLoggingIn(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  // Derived stats & filtering
  const filtered = useMemo(() => {
    return responses.filter((r) => {
      if (completionFilter === "completed" && !r.completed) return false;
      if (completionFilter === "partial" && r.completed) return false;
      if (roleFilter && r.answers.role !== roleFilter) return false;
      if (frequencyFilter && r.answers.frequency !== frequencyFilter) return false;
      return true;
    });
  }, [responses, completionFilter, roleFilter, frequencyFilter]);

  const stats = useMemo(() => {
    const total = responses.length;
    const completed = responses.filter((r) => r.completed).length;
    const partial = total - completed;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, partial, rate };
  }, [responses]);

  const uniqueRoles = useMemo(() => {
    const roles = new Set<string>();
    responses.forEach((r) => {
      if (typeof r.answers.role === "string") roles.add(r.answers.role);
    });
    return Array.from(roles);
  }, [responses]);

  const frequencyOptions = ["Rarely", "A few times a month", "Weekly", "Almost every call"];

  const exportCSV = () => {
    const headers = ["email", "completed", "created_at", ...questions.map((q) => q.id)];
    const rows = filtered.map((r) => [
      r.email,
      r.completed ? "Yes" : "No",
      r.created_at,
      ...questions.map((q) => {
        const val = r.answers[q.id];
        if (Array.isArray(val)) return val.join("; ");
        return typeof val === "string" ? val : "";
      }),
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `questionnaire-responses-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getQuestionLabel = (id: string) => {
    return questions.find((q) => q.id === id)?.question ?? id;
  };

  // Auth loading
  if (authLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-pulse text-neutral-500">Loading...</div>
      </div>
    );
  }

  // Login gate
  if (!session) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0a0a0a] flex items-center justify-center px-4">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm space-y-4 p-8 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900"
        >
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white text-center">
            Admin Login
          </h1>
          <input
            type="email"
            placeholder="Email"
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            className="w-full h-11 px-4 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white outline-none focus:border-[#C1B97E] text-base"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            className="w-full h-11 px-4 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white outline-none focus:border-[#C1B97E] text-base"
            required
          />
          {loginError && (
            <p className="text-red-500 text-sm text-center">{loginError}</p>
          )}
          <button
            type="submit"
            disabled={loggingIn}
            className="w-full h-11 rounded-lg bg-[#C1B97E] dark:bg-[#D4CB88] text-neutral-900 font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loggingIn ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0a0a0a] flex items-center justify-center px-4">
        <div className="w-full max-w-md space-y-4 p-8 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-center">
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white">
            Unauthorized
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            This account does not have access to the admin dashboard.
          </p>
          <button
            onClick={handleLogout}
            className="w-full h-11 rounded-lg bg-[#C1B97E] dark:bg-[#D4CB88] text-neutral-900 font-semibold hover:opacity-90 transition-opacity"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a] text-neutral-900 dark:text-neutral-50">
      {/* Header */}
      <header className="border-b border-neutral-200 dark:border-neutral-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-5 h-5 text-[#C1B97E] dark:text-[#D4CB88]" />
          <h1 className="text-lg font-bold">Questionnaire Responses</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-2 px-4 h-9 rounded-lg border border-neutral-200 dark:border-neutral-800 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 px-4 h-9 rounded-lg text-sm font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total Signups", value: stats.total },
            { label: "Completed", value: stats.completed },
            { label: "Partial", value: stats.partial },
            { label: "Completion Rate", value: `${stats.rate}%` },
          ].map((stat) => (
            <div
              key={stat.label}
              className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900"
            >
              <div className="text-sm text-neutral-500 mb-1">{stat.label}</div>
              <div className="text-2xl font-bold">{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <Filter className="w-4 h-4 text-neutral-400" />

          {/* Completion filter */}
          {(["all", "completed", "partial"] as CompletionFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setCompletionFilter(f)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                completionFilter === f
                  ? "border-[#C1B97E] dark:border-[#D4CB88] bg-[#C1B97E]/10 dark:bg-[#D4CB88]/10 text-neutral-900 dark:text-white"
                  : "border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:border-neutral-300 dark:hover:border-neutral-700"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}

          <span className="text-neutral-300 dark:text-neutral-700">|</span>

          {/* Role filter */}
          {uniqueRoles.map((role) => (
            <button
              key={role}
              onClick={() => setRoleFilter(roleFilter === role ? null : role)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                roleFilter === role
                  ? "border-[#C1B97E] dark:border-[#D4CB88] bg-[#C1B97E]/10 dark:bg-[#D4CB88]/10 text-neutral-900 dark:text-white"
                  : "border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:border-neutral-300 dark:hover:border-neutral-700"
              }`}
            >
              {role}
            </button>
          ))}

          {uniqueRoles.length > 0 && (
            <span className="text-neutral-300 dark:text-neutral-700">|</span>
          )}

          {/* Frequency filter */}
          {frequencyOptions.map((freq) => (
            <button
              key={freq}
              onClick={() => setFrequencyFilter(frequencyFilter === freq ? null : freq)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                frequencyFilter === freq
                  ? "border-[#C1B97E] dark:border-[#D4CB88] bg-[#C1B97E]/10 dark:bg-[#D4CB88]/10 text-neutral-900 dark:text-white"
                  : "border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:border-neutral-300 dark:hover:border-neutral-700"
              }`}
            >
              {freq}
            </button>
          ))}
        </div>

        {/* Response list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-20 rounded-xl bg-neutral-100 dark:bg-neutral-900 animate-pulse"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-neutral-400">
            No responses found.
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((r) => {
              const isExpanded = expandedId === r.id;
              const painSnippet =
                typeof r.answers.pain_story === "string"
                  ? r.answers.pain_story.slice(0, 80) + (r.answers.pain_story.length > 80 ? "..." : "")
                  : "—";

              return (
                <div
                  key={r.id}
                  className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : r.id)}
                    className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-medium truncate">{r.email}</span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            r.completed
                              ? "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400"
                              : "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400"
                          }`}
                        >
                          {r.completed ? "Completed" : "Partial"}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-neutral-500">
                        {typeof r.answers.role === "string" && (
                          <span>{r.answers.role}</span>
                        )}
                        {typeof r.answers.team_size === "string" && (
                          <span>{r.answers.team_size}</span>
                        )}
                        <span className="truncate">{painSnippet}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs text-neutral-400">
                        {new Date(r.created_at).toLocaleDateString()}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-neutral-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-neutral-400" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-5 pb-5 border-t border-neutral-100 dark:border-neutral-800/50 pt-4 space-y-4">
                      {questions.map((q) => {
                        const val = r.answers[q.id];
                        if (val === undefined || val === null) return null;
                        return (
                          <div key={q.id}>
                            <div className="text-sm font-medium text-neutral-500 mb-1">
                              {getQuestionLabel(q.id)}
                            </div>
                            <div className="text-base text-neutral-900 dark:text-white">
                              {Array.isArray(val) ? (val as string[]).join(", ") : String(val)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
