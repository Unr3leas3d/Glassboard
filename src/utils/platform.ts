// Platform detection — initialized once before React render via initPlatform().
// Uses navigator.platform which works in both WebKit (macOS) and WebView2 (Windows).

export let isMac = false;
export let isWindows = false;

export let modifierSymbols: Record<string, string> = {};
export let modifierLabel = "";

export async function initPlatform(): Promise<void> {
  const p = navigator.platform ?? "";
  isMac = p.startsWith("Mac");
  isWindows = p.startsWith("Win");

  if (isMac) {
    modifierSymbols = {
      CommandOrControl: "⌘",
      Command: "⌘",
      Control: "⌃",
      Shift: "⇧",
      Alt: "⌥",
      Option: "⌥",
    };
    modifierLabel = "Cmd";
  } else {
    modifierSymbols = {
      CommandOrControl: "Ctrl",
      Command: "Ctrl",
      Control: "Ctrl",
      Shift: "Shift",
      Alt: "Alt",
      Option: "Alt",
    };
    modifierLabel = "Ctrl";
  }
}
