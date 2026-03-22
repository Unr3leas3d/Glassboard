import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/supabase";
import { questions, type Question } from "./questions";
import { CheckCircle2, ChevronRight, ChevronLeft } from "lucide-react";

interface QuestionnaireFlowProps {
  email: string;
  waitlistId: string;
  onBackToHome?: () => void;
}

interface QuestionnaireState {
  id: string;
  answers: Record<string, unknown>;
  current_step: number;
  completed: boolean;
  edit_token: string;
}

export const QuestionnaireFlow = ({ email, waitlistId, onBackToHome }: QuestionnaireFlowProps) => {
  const storageKey = `glasboard_questionnaire_token:${waitlistId}`;
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState<unknown>(null);
  const [responseId, setResponseId] = useState<string | null>(null);
  const [editToken, setEditToken] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const containerRef = useRef<HTMLDivElement>(null);
  const normalizedEmail = email.trim().toLowerCase();

  // Build the active question list (filtering skipped questions)
  const activeQuestions = questions.filter(
    (q) => !q.skipIf || !q.skipIf(answers)
  );

  const current: Question | undefined = activeQuestions[currentStep];
  const isLast = currentStep === activeQuestions.length - 1;
  const progress = ((currentStep + 1) / activeQuestions.length) * 100;

  // Initialize or resume questionnaire response
  useEffect(() => {
    const init = async () => {
      const storedToken = window.localStorage.getItem(storageKey);
      const { data, error } = await supabase
        .rpc("get_or_create_questionnaire_response", {
          input_waitlist_id: waitlistId,
          input_email: normalizedEmail,
          input_edit_token: storedToken,
        })
        .single<QuestionnaireState>();

      if (error || !data) {
        console.error("[Glassboard] Failed to initialize questionnaire:", error);
        setInitError("We couldn't resume this questionnaire on this device.");
        return;
      }

      window.localStorage.setItem(storageKey, data.edit_token);
      setResponseId(data.id);
      setEditToken(data.edit_token);
      setAnswers((data.answers ?? {}) as Record<string, unknown>);
      setCurrentStep(data.current_step ?? 0);
      if (data.completed) {
        setCompleted(true);
      }
    };
    init();
  }, [normalizedEmail, storageKey, waitlistId]);

  // Load current answer when step changes
  useEffect(() => {
    if (current) {
      const saved = answers[current.id];
      if (current.type === "multi") {
        setCurrentAnswer(saved ?? []);
      } else {
        setCurrentAnswer(saved ?? null);
      }
    }
  }, [currentStep, current?.id]);

  const saveProgress = useCallback(
    async (newAnswers: Record<string, unknown>, step: number, done = false) => {
      if (!responseId || !editToken) return;
      const { error } = await supabase.rpc("save_questionnaire_response", {
        input_response_id: responseId,
        input_edit_token: editToken,
        input_answers: newAnswers,
        input_current_step: step,
        input_completed: done,
      });
      if (error) {
        console.error("[Glassboard] Failed to save questionnaire:", error);
      }
    },
    [responseId, editToken]
  );

  const handleNext = async () => {
    if (!current) return;
    if (current.required && !isAnswerValid()) return;

    setSubmitting(true);
    const newAnswers = { ...answers, [current.id]: currentAnswer };
    setAnswers(newAnswers);

    if (isLast) {
      await saveProgress(newAnswers, currentStep, true);
      setCompleted(true);
    } else {
      const nextStep = currentStep + 1;
      await saveProgress(newAnswers, nextStep);
      setDirection("forward");
      setCurrentStep(nextStep);
    }
    setSubmitting(false);
  };

  const handleBack = () => {
    if (currentStep > 0) {
      // Save current answer before going back
      if (current && currentAnswer !== null) {
        setAnswers((prev) => ({ ...prev, [current.id]: currentAnswer }));
      }
      setDirection("back");
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkipQuestionnaire = async () => {
    // Save whatever they've answered so far
    if (responseId) {
      await saveProgress(answers, currentStep, false);
    }
    setCompleted(true);
  };

  const isAnswerValid = (): boolean => {
    if (!current) return false;
    if (!current.required) return true;
    if (current.type === "multi") {
      return Array.isArray(currentAnswer) && (currentAnswer as string[]).length > 0;
    }
    if (current.type === "text") {
      return typeof currentAnswer === "string" && currentAnswer.trim().length > 0;
    }
    return currentAnswer !== null && currentAnswer !== undefined;
  };

  const toggleMulti = (option: string) => {
    const arr = Array.isArray(currentAnswer) ? [...(currentAnswer as string[])] : [];
    const idx = arr.indexOf(option);
    if (idx >= 0) {
      arr.splice(idx, 1);
    } else {
      arr.push(option);
    }
    setCurrentAnswer(arr);
  };

  if (completed) {
    return (
      <div className="w-full max-w-lg mx-auto px-4 sm:px-6 py-12 text-center animate-in fade-in duration-500">
        <div className="w-16 h-16 rounded-full bg-[#C1B97E]/20 dark:bg-[#D4CB88]/20 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-8 h-8 text-[#C1B97E] dark:text-[#D4CB88]" />
        </div>
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-3">
          Thank you!
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400 text-lg leading-relaxed mb-8">
          Your answers help us build the right thing. We'll reach out when Glassboard is ready for you.
        </p>
        {onBackToHome && (
          <button
            onClick={onBackToHome}
            className="px-6 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 font-medium text-base transition-all hover:bg-neutral-50 dark:hover:bg-neutral-900"
          >
            Back to Home
          </button>
        )}
      </div>
    );
  }

  if (initError) {
    return (
      <div className="w-full max-w-lg mx-auto px-4 sm:px-6 py-12 text-center">
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-3">
          Questionnaire Unavailable
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400 text-lg leading-relaxed">
          {initError}
        </p>
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="w-full max-w-lg mx-auto px-4 sm:px-6 py-8" ref={containerRef}>
      {/* Progress bar */}
      <div className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden mb-8">
        <div
          className="h-full bg-[#C1B97E] dark:bg-[#D4CB88] rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Step indicator */}
      <div className="text-sm text-neutral-500 dark:text-neutral-500 mb-6">
        {currentStep + 1} of {activeQuestions.length}
      </div>

      {/* Question area with transition */}
      <div
        key={current.id}
        className={`animate-in ${direction === "forward" ? "slide-in-from-right-4" : "slide-in-from-left-4"} fade-in duration-300`}
      >
        <h2 className="text-xl sm:text-2xl font-semibold text-neutral-900 dark:text-white mb-8 leading-snug">
          {current.question}
        </h2>

        {/* Choice input */}
        {current.type === "choice" && current.options && (
          <div className="space-y-3">
            {current.options.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setCurrentAnswer(option)}
                className={`w-full min-h-[48px] px-4 py-3 rounded-xl text-left text-base font-medium transition-all border ${
                  currentAnswer === option
                    ? "border-[#C1B97E] dark:border-[#D4CB88] bg-[#C1B97E]/10 dark:bg-[#D4CB88]/10 text-neutral-900 dark:text-white"
                    : "border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-700"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        )}

        {/* Multi-select input */}
        {current.type === "multi" && current.options && (
          <div className="space-y-3">
            {current.options.map((option) => {
              const selected = Array.isArray(currentAnswer) && (currentAnswer as string[]).includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => toggleMulti(option)}
                  className={`w-full min-h-[48px] px-4 py-3 rounded-xl text-left text-base font-medium transition-all border flex items-center gap-3 ${
                    selected
                      ? "border-[#C1B97E] dark:border-[#D4CB88] bg-[#C1B97E]/10 dark:bg-[#D4CB88]/10 text-neutral-900 dark:text-white"
                      : "border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-700"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      selected
                        ? "border-[#C1B97E] dark:border-[#D4CB88] bg-[#C1B97E] dark:bg-[#D4CB88]"
                        : "border-neutral-300 dark:border-neutral-600"
                    }`}
                  >
                    {selected && (
                      <svg className="w-3 h-3 text-white dark:text-neutral-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  {option}
                </button>
              );
            })}
            <p className="text-sm text-neutral-500 dark:text-neutral-500 mt-1">
              Select all that apply
            </p>
          </div>
        )}

        {/* Text input */}
        {current.type === "text" && (
          <textarea
            value={(currentAnswer as string) ?? ""}
            onChange={(e) => setCurrentAnswer(e.target.value)}
            placeholder="Type your answer..."
            rows={4}
            className="w-full min-h-[120px] px-4 py-3 rounded-xl text-base bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-600 outline-none focus:border-[#C1B97E] dark:focus:border-[#D4CB88] focus:ring-2 focus:ring-[#C1B97E]/20 dark:focus:ring-[#D4CB88]/20 transition-all resize-y"
            style={{ fontSize: "16px" }}
          />
        )}
      </div>

      {/* Navigation buttons */}
      <div className="mt-8 flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleNext}
          disabled={submitting || (current.required && !isAnswerValid())}
          className="w-full sm:flex-1 min-h-[48px] px-6 py-3 rounded-xl bg-[#C1B97E] dark:bg-[#D4CB88] text-neutral-900 font-semibold text-base transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 order-1 sm:order-2"
        >
          {submitting ? "Saving..." : isLast ? "Submit" : "Next"}
          {!submitting && !isLast && <ChevronRight className="w-4 h-4" />}
        </button>
        {currentStep > 0 && (
          <button
            onClick={handleBack}
            disabled={submitting}
            className="w-full sm:w-auto min-h-[48px] px-6 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 font-medium text-base transition-all hover:bg-neutral-50 dark:hover:bg-neutral-900 flex items-center justify-center gap-2 order-2 sm:order-1"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
        )}
      </div>

      {/* Skip link */}
      <div className="mt-6 text-center">
        <button
          onClick={handleSkipQuestionnaire}
          className="text-sm text-neutral-400 dark:text-neutral-600 hover:text-neutral-600 dark:hover:text-neutral-400 transition-colors underline underline-offset-2"
        >
          Skip questionnaire
        </button>
      </div>
    </div>
  );
};
