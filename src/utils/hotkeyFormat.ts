const MODIFIER_SYMBOLS: Record<string, string> = {
  CommandOrControl: "⌘",
  Command: "⌘",
  Control: "⌃",
  Shift: "⇧",
  Alt: "⌥",
  Option: "⌥",
};

/**
 * Convert a Tauri accelerator string to a human-readable format.
 * e.g. "CommandOrControl+Shift+G" → "⌘ ⇧ G"
 */
export function formatAccelerator(accelerator: string): string {
  return accelerator
    .split("+")
    .map((part) => MODIFIER_SYMBOLS[part] ?? part.toUpperCase())
    .join(" ");
}

/**
 * Convert a KeyboardEvent to a Tauri accelerator string.
 * Returns null if only modifier keys are pressed.
 */
export function keyEventToAccelerator(event: KeyboardEvent): string | null {
  const key = event.key;

  // Ignore if only a modifier key is pressed
  if (["Meta", "Control", "Shift", "Alt"].includes(key)) {
    return null;
  }

  const parts: string[] = [];

  if (event.metaKey || event.ctrlKey) parts.push("CommandOrControl");
  if (event.shiftKey) parts.push("Shift");
  if (event.altKey) parts.push("Alt");

  // Normalize key name for Tauri
  const normalizedKey = normalizeKey(key);
  if (normalizedKey) {
    parts.push(normalizedKey);
  }

  // Must have at least one modifier + one key
  if (parts.length < 2) return null;

  return parts.join("+");
}

function normalizeKey(key: string): string | null {
  // Single letter
  if (/^[a-zA-Z]$/.test(key)) return key.toUpperCase();
  // Single digit
  if (/^[0-9]$/.test(key)) return key;
  // Function keys
  if (/^F\d{1,2}$/.test(key)) return key;
  // Special keys
  const specialMap: Record<string, string> = {
    " ": "Space",
    Enter: "Enter",
    Tab: "Tab",
    Escape: "Escape",
    Backspace: "Backspace",
    Delete: "Delete",
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
    Home: "Home",
    End: "End",
    PageUp: "PageUp",
    PageDown: "PageDown",
    "[": "BracketLeft",
    "]": "BracketRight",
    ";": "Semicolon",
    "'": "Quote",
    ",": "Comma",
    ".": "Period",
    "/": "Slash",
    "\\": "Backslash",
    "`": "Backquote",
    "-": "Minus",
    "=": "Equal",
  };
  return specialMap[key] ?? null;
}
