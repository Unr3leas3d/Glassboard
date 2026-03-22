import { useState } from "react";
import { modifierLabel } from "@/utils/platform";
import type { Session } from "../hooks/useSessions";
import type { PresenceUser } from "../hooks/usePresence";

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
  session?: Session;
  isHost?: boolean;
  participants?: PresenceUser[];
  onEndSession?: (sessionId: string) => void;
  onLeaveSession?: () => void;
  onPanelToggle?: (isOpen: boolean) => void;
}

export function BottomBar({
  isActive,
  onToggleLaser,
  screenshotsEnabled,
  onToggleScreenshots,
  onSignOut,
  isSharing,
  onShareScreen,
  onStopSharing,
  onShowManagement,
  session,
  isHost,
  participants = [],
  onEndSession,
  onLeaveSession,
  onPanelToggle,
}: BottomBarProps) {
  const [showSessionInfo, setShowSessionInfo] = useState(false);
  const [copied, setCopied] = useState(false);

  function copyCode() {
    if (!session) return;
    navigator.clipboard.writeText(session.join_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="glasboard-bottom-bar-container">
      {/* Session info panel (expands above bar) */}
      {showSessionInfo && session && (
        <div className="glasboard-session-panel">
          {session.title && (
            <div className="text-sm font-medium text-white truncate">
              {session.title}
            </div>
          )}

          <button
            onClick={copyCode}
            className="flex items-center gap-1.5 rounded-md bg-zinc-800 px-2.5 py-1 text-xs font-mono text-zinc-300 hover:bg-zinc-700 transition-colors self-start"
            title="Click to copy join code"
          >
            <span className="tracking-widest">{session.join_code}</span>
            <span className="text-zinc-500">{copied ? "Copied!" : "Copy"}</span>
          </button>

          {participants.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex items-center -space-x-1.5">
                {participants.slice(0, 5).map((p) => (
                  <div
                    key={p.userId}
                    className="flex items-center justify-center size-6 rounded-full border-2 border-zinc-800 text-[9px] font-semibold text-white relative"
                    style={{ backgroundColor: p.color }}
                    title={`${p.name}${p.isHost ? " (Host)" : ""}`}
                  >
                    {p.name.slice(0, 2).toUpperCase()}
                    {p.isHost && (
                      <svg
                        className="absolute -top-1 -right-1 size-2.5 text-amber-400"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" />
                      </svg>
                    )}
                  </div>
                ))}
                {participants.length > 5 && (
                  <div className="flex items-center justify-center size-6 rounded-full border-2 border-zinc-800 bg-zinc-700 text-[9px] font-semibold text-zinc-300">
                    +{participants.length - 5}
                  </div>
                )}
              </div>
              <span className="text-xs text-zinc-400">
                {participants.length} online
              </span>
            </div>
          )}

          {isHost ? (
            <button
              onClick={() => onEndSession?.(session.id)}
              className="glasboard-session-panel-btn glasboard-session-panel-btn--danger"
            >
              End Session
            </button>
          ) : (
            <button
              onClick={() => onLeaveSession?.()}
              className="glasboard-session-panel-btn"
            >
              Leave
            </button>
          )}
        </div>
      )}

      {/* Bottom bar icons */}
      <div className="glasboard-bottom-bar-wrapper">
        {onShowManagement && (
          <button
            className="glasboard-bottom-bar glasboard-bottom-bar--idle"
            onClick={onShowManagement}
            title={`Open dashboard (${modifierLabel}+Shift+D)`}
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
          title={isActive ? `Laser on — click or ${modifierLabel}+Shift+G to deactivate` : `Click or ${modifierLabel}+Shift+G to activate laser`}
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

        {/* Session info toggle */}
        {session && (
          <button
            className={`glasboard-bottom-bar ${showSessionInfo ? "glasboard-bottom-bar--active" : "glasboard-bottom-bar--idle"}`}
            onClick={() => {
              const next = !showSessionInfo;
              setShowSessionInfo(next);
              onPanelToggle?.(next);
            }}
            title="Session info"
            aria-label="Session info"
            aria-pressed={showSessionInfo}
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
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
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
    </div>
  );
}
