import { WindowTitleBar } from "./WindowTitleBar";

export function OfflineBanner() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <WindowTitleBar />
      <div className="bg-card border border-border rounded-xl p-8 max-w-sm w-full text-center space-y-3">
        <div className="flex justify-center text-muted-foreground">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
            <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
            <circle cx="12" cy="20" r="1" fill="currentColor" />
          </svg>
        </div>
        <h2 className="text-base font-semibold text-foreground">No internet connection</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Glassboard needs an internet connection to collaborate. Please check your connection and try again.
        </p>
      </div>
    </div>
  );
}
