import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface MonitorInfo {
  index: number;
  name: string;
  width: number;
  height: number;
  is_primary: boolean;
}

interface MonitorPickerProps {
  onSelect: (monitorIndex: number) => void;
  onCancel: () => void;
}

const STORAGE_KEY = "glasboard_selected_monitor";

export function MonitorPicker({ onSelect, onCancel }: MonitorPickerProps) {
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoke<MonitorInfo[]>("list_monitors")
      .then((result) => {
        if (result.length <= 1) {
          // Single monitor — skip picker, select immediately
          onSelect(0);
          return;
        }

        setMonitors(result);
        setLoading(false);

        // Auto-select if a previous selection is stored
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored !== null) {
          const idx = parseInt(stored, 10);
          if (idx >= 0 && idx < result.length) {
            onSelect(idx);
          }
        }
      })
      .catch((err) => {
        console.error("[Glassboard] Failed to list monitors:", err);
        // Fallback: select primary/first monitor
        onSelect(0);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return null;

  function handleSelect(index: number) {
    localStorage.setItem(STORAGE_KEY, String(index));
    onSelect(index);
  }

  return (
    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden min-w-[220px]">
      <div className="px-3 py-2 text-xs font-medium text-zinc-400 border-b border-zinc-700">
        Select Monitor
      </div>
      {monitors.map((m) => (
        <button
          key={m.index}
          onClick={() => handleSelect(m.index)}
          className="w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800 transition-colors flex items-center gap-2"
        >
          <span className="flex-1 truncate">
            {m.name} ({m.width}&times;{m.height})
          </span>
          {m.is_primary && (
            <span className="text-[10px] text-zinc-500 font-medium">Primary</span>
          )}
        </button>
      ))}
      <button
        onClick={onCancel}
        className="w-full px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-800 transition-colors border-t border-zinc-700"
      >
        Cancel
      </button>
    </div>
  );
}
