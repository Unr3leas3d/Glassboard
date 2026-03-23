const STORAGE_KEY = "glasboard_session_window_debug";
const MAX_ENTRIES = 50;

interface SessionWindowDebugEntry {
  timestamp: string;
  event: string;
  data?: unknown;
}

export function recordSessionWindowDebug(event: string, data?: unknown) {
  if (!(import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV) {
    return;
  }

  const entry: SessionWindowDebugEntry = {
    timestamp: new Date().toISOString(),
    event,
    data,
  };

  console.info("[Glassboard debug]", entry);

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const existing = raw ? (JSON.parse(raw) as SessionWindowDebugEntry[]) : [];
    existing.push(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing.slice(-MAX_ENTRIES)));
  } catch {
    // Ignore localStorage failures during debug tracing.
  }
}
