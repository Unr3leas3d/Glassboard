import { useState } from "react";
import type { RemoteCursorState } from "../hooks/useRealtimeCursors";

interface RemoteCursorProps {
  cursor: RemoteCursorState;
}

export function RemoteCursor({ cursor }: RemoteCursorProps) {
  const [imgError, setImgError] = useState(false);
  const showAvatar = cursor.avatarUrl && !imgError;

  return (
    <div
      className="glasboard-remote-cursor"
      style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)` }}
    >
      {/* Cursor pointer arrow */}
      <svg
        className="glasboard-remote-cursor__arrow"
        width="16"
        height="20"
        viewBox="0 0 16 20"
        fill={cursor.color}
        stroke="white"
        strokeWidth="1.5"
      >
        <path d="M1 1L1 15L5.5 11L10 19L13 17.5L8.5 9.5L14 8L1 1Z" />
      </svg>

      {/* Avatar badge */}
      <div
        className="glasboard-remote-cursor__avatar"
        style={{ borderColor: cursor.color }}
      >
        {showAvatar ? (
          <img
            src={cursor.avatarUrl}
            alt=""
            className="glasboard-remote-cursor__avatar-img"
            onError={() => setImgError(true)}
            referrerPolicy="no-referrer"
          />
        ) : (
          <svg
            className="glasboard-remote-cursor__avatar-icon"
            viewBox="0 0 24 24"
            fill={cursor.color}
          >
            <circle cx="12" cy="8" r="4" />
            <path d="M20 21a8 8 0 0 0-16 0" />
          </svg>
        )}
      </div>

      {/* Name label */}
      <div
        className="glasboard-remote-cursor__label"
        style={{ backgroundColor: cursor.color }}
      >
        {cursor.name}
      </div>
    </div>
  );
}
