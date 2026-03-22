export type QuestionType = "choice" | "multi" | "text";

export interface Question {
  id: string;
  type: QuestionType;
  question: string;
  options?: string[];
  required: boolean;
  /** Return true to skip this question based on previous answers */
  skipIf?: (answers: Record<string, unknown>) => boolean;
}

export const questions: Question[] = [
  {
    id: "role",
    type: "choice",
    question: "What best describes your role?",
    options: ["Designer", "Engineer", "PM", "Leadership", "Other"],
    required: true,
  },
  {
    id: "team_size",
    type: "choice",
    question: "How big is the team you collaborate with most?",
    options: ["Just me", "2–5", "6–15", "16+"],
    required: true,
  },
  {
    id: "pain_story",
    type: "text",
    question:
      "Think about the last time you were on a screen share and something was hard to communicate. What happened?",
    required: true,
  },
  {
    id: "frequency",
    type: "choice",
    question: "How often does something like that happen?",
    options: [
      "Rarely",
      "A few times a month",
      "Weekly",
      "Almost every call",
    ],
    required: true,
  },
  {
    id: "workaround",
    type: "text",
    question:
      "What do you currently do when that happens? Walk me through your workaround.",
    required: true,
  },
  {
    id: "tools",
    type: "multi",
    question:
      "Which tools are part of your screen sharing workflow?",
    options: ["Zoom", "Meet", "Slack", "Teams", "Discord", "Loom", "Other"],
    required: true,
    skipIf: (answers) => answers.frequency === "Rarely",
  },
  {
    id: "wishlist",
    type: "text",
    question:
      "Anything else you wish screen sharing tools did better?",
    required: false,
  },
];
