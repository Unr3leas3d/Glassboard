interface BottomBarProps {
  isActive: boolean;
  onToggleLaser: () => void;
  screenshotsEnabled: boolean;
  onToggleScreenshots: () => void;
  onSignOut?: () => void;
  isSharing?: boolean;
  onShareScreen?: () => void;
  onStopSharing?: () => void;
  onShowManagement?: () => void;
}

/**
 * Pill bar always visible when the canvas is mounted.
 * Shows laser-on state when active, idle state when inactive.
 * Clicking toggles laser mode.
 */
export function BottomBar({ isActive, onToggleLaser, screenshotsEnabled, onToggleScreenshots, onSignOut, isSharing, onShareScreen, onStopSharing, onShowManagement }: BottomBarProps) {
  return (
    <div className="glasboard-bottom-bar-wrapper">
      {onShowManagement && (
        <button
          className="glasboard-bottom-bar glasboard-bottom-bar--idle"
          onClick={onShowManagement}
          title="Open dashboard (Cmd+Shift+D)"
          aria-label="Open dashboard"
        >
          <svg
            aria-hidden="true"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
          </svg>
        </button>
      )}

      <button
        className={`glasboard-bottom-bar ${isActive ? "glasboard-bottom-bar--active" : "glasboard-bottom-bar--idle"}`}
        onClick={onToggleLaser}
        title={isActive ? "Laser on — click or Cmd+Shift+G to deactivate" : "Click or Cmd+Shift+G to activate laser"}
        aria-label={isActive ? "Deactivate laser pointer" : "Activate laser pointer"}
        aria-pressed={isActive}
      >
        <svg
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        </svg>
      </button>

      <button
        className={`glasboard-bottom-bar ${screenshotsEnabled ? "glasboard-bottom-bar--screenshot-on" : "glasboard-bottom-bar--idle"}`}
        onClick={onToggleScreenshots}
        title={screenshotsEnabled ? "Screenshots enabled — click to re-enable protection" : "Click to allow screenshots"}
        aria-label={screenshotsEnabled ? "Disable screenshot mode" : "Enable screenshot mode"}
        aria-pressed={screenshotsEnabled}
      >
        {screenshotsEnabled ? (
          // Camera icon (screenshots on)
          <svg
            aria-hidden="true"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
            <circle cx="12" cy="13" r="3" />
          </svg>
        ) : (
          // Camera-off icon (protected)
          <svg
            aria-hidden="true"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="2" y1="2" x2="22" y2="22" />
            <path d="M7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16" />
            <path d="M9.5 4h5L17 7h3a2 2 0 0 1 2 2v7.5" />
            <path d="M14.121 15.121A3 3 0 1 1 9.88 10.88" />
          </svg>
        )}
      </button>

      {onShareScreen && (
        <button
          className={`glasboard-bottom-bar ${isSharing ? "glasboard-bottom-bar--active" : "glasboard-bottom-bar--idle"}`}
          onClick={isSharing ? onStopSharing : onShareScreen}
          title={isSharing ? "Stop sharing screen" : "Share screen snapshot"}
          aria-label={isSharing ? "Stop sharing screen" : "Share screen snapshot"}
          aria-pressed={isSharing}
        >
          <svg
            aria-hidden="true"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        </button>
      )}

      {onSignOut && (
        <button
          className="glasboard-bottom-bar glasboard-bottom-bar--idle"
          onClick={onSignOut}
          title="Sign out"
          aria-label="Sign out"
        >
          <svg
            aria-hidden="true"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      )}
    </div>
  );
}
