import { useEffect } from "react";
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";

/**
 * Hook to register a global hotkey.
 *
 * @param shortcut  Tauri accelerator string, e.g. "CommandOrControl+Shift+G"
 * @param onToggle  Callback fired on key press
 */
export function useGlobalHotkey(shortcut: string, onToggle: () => void) {
  useEffect(() => {
    let cancelled = false;

    async function setup() {
      try {
        // Unregister first to avoid "already registered" errors
        // (handles React StrictMode double-mount and hot-reload)
        await unregister(shortcut).catch(() => {});

        if (cancelled) return;

        await register(shortcut, (event) => {
          if (event.state === "Pressed") {
            onToggle();
          }
        });
        console.log("[Glassboard] Global shortcut registered:", shortcut);
      } catch (err) {
        console.error("[Glassboard] Failed to register shortcut:", err);
      }
    }

    setup();

    return () => {
      cancelled = true;
      unregister(shortcut).catch(() => {});
    };
  }, [shortcut, onToggle]);
}
