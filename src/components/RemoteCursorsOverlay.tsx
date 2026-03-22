import { RemoteCursor } from "./RemoteCursor";
import type { RemoteCursorState } from "../hooks/useRealtimeCursors";

interface RemoteCursorsOverlayProps {
  cursors: Map<string, RemoteCursorState>;
}

export function RemoteCursorsOverlay({ cursors }: RemoteCursorsOverlayProps) {
  if (cursors.size === 0) return null;

  return (
    <div className="glasboard-cursors-overlay">
      {Array.from(cursors.values()).map((cursor) => (
        <RemoteCursor key={cursor.userId} cursor={cursor} />
      ))}
    </div>
  );
}
