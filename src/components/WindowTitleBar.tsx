import { getCurrentWindow } from "@tauri-apps/api/window";
import { isMac } from "@/utils/platform";

export function WindowTitleBar() {
  if (isMac) {
    // Invisible drag region — macOS renders native traffic light buttons
    return (
      <div
        data-tauri-drag-region
        className="fixed top-0 left-0 right-0 h-10 z-50 bg-background"
      />
    );
  }

  // Windows: drag region (left) + window control buttons (right, outside drag region)
  const win = getCurrentWindow();

  return (
    <div className="fixed top-0 left-0 right-0 h-8 z-50 bg-background flex items-center">
      <div data-tauri-drag-region className="flex-1 h-full" />
      <div className="flex">
        <button
          onClick={() => win.minimize().catch(console.error)}
          className="inline-flex items-center justify-center w-11 h-8 text-foreground/70 hover:bg-foreground/10 transition-colors"
          aria-label="Minimize"
        >
          <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor">
            <rect width="10" height="1" />
          </svg>
        </button>
        <button
          onClick={() => win.toggleMaximize().catch(console.error)}
          className="inline-flex items-center justify-center w-11 h-8 text-foreground/70 hover:bg-foreground/10 transition-colors"
          aria-label="Maximize"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
            <rect x="0.5" y="0.5" width="9" height="9" />
          </svg>
        </button>
        <button
          onClick={() => win.close().catch(console.error)}
          className="inline-flex items-center justify-center w-11 h-8 text-foreground/70 hover:bg-red-500 hover:text-white transition-colors"
          aria-label="Close"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
            <line x1="1" y1="1" x2="9" y2="9" />
            <line x1="9" y1="1" x2="1" y2="9" />
          </svg>
        </button>
      </div>
    </div>
  );
}
