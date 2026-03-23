import { useState, useCallback, useEffect } from "react";

export interface HotkeyBinding {
  id: string;
  label: string;
  description: string;
  accelerator: string;
}

export const DEFAULT_HOTKEY_BINDINGS: HotkeyBinding[] = [
  {
    id: "toggle-laser",
    label: "Toggle Laser",
    description: "Activate/deactivate the laser drawing mode",
    accelerator: "CommandOrControl+Shift+G",
  },
  {
    id: "end-or-leave-session",
    label: "End or Leave Session",
    description:
      "Prompt to end the current session if you're the host, or leave it if you're a participant.",
    accelerator: "CommandOrControl+Shift+E",
  },
  {
    id: "show-management",
    label: "Show Dashboard",
    description: "Show the management window and deactivate laser",
    accelerator: "CommandOrControl+Shift+D",
  },
  {
    id: "toggle-screenshots",
    label: "Toggle Screenshots",
    description: "Allow/block screenshots of the overlay",
    accelerator: "CommandOrControl+Shift+S",
  },
];

const STORAGE_KEY = "glasboard_hotkey_bindings";

function loadBindings(): HotkeyBinding[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [...DEFAULT_HOTKEY_BINDINGS];

    const parsed: HotkeyBinding[] = JSON.parse(stored);
    // Merge with defaults to handle new bindings added in future versions
    return DEFAULT_HOTKEY_BINDINGS.map((def) => {
      const saved = parsed.find((b) => b.id === def.id);
      return saved ? { ...def, accelerator: saved.accelerator } : { ...def };
    });
  } catch {
    return [...DEFAULT_HOTKEY_BINDINGS];
  }
}

function saveBindings(bindings: HotkeyBinding[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings));
}

export function useHotkeySettings() {
  const [bindings, setBindings] = useState<HotkeyBinding[]>(loadBindings);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        setBindings(loadBindings());
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const getBinding = useCallback(
    (id: string): string => {
      const binding = bindings.find((b) => b.id === id);
      return binding?.accelerator ?? DEFAULT_HOTKEY_BINDINGS.find((b) => b.id === id)!.accelerator;
    },
    [bindings],
  );

  const updateBinding = useCallback(
    (id: string, accelerator: string) => {
      setBindings((current) => {
        const next = current.map((binding) =>
          binding.id === id ? { ...binding, accelerator } : binding,
        );
        saveBindings(next);
        return next;
      });
    },
    [],
  );

  const resetBinding = useCallback(
    (id: string) => {
      const def = DEFAULT_HOTKEY_BINDINGS.find((b) => b.id === id);
      if (!def) return;
      updateBinding(id, def.accelerator);
    },
    [updateBinding],
  );

  const resetToDefaults = useCallback(() => {
    const defaults = [...DEFAULT_HOTKEY_BINDINGS];
    setBindings(defaults);
    saveBindings(defaults);
  }, []);

  return { bindings, getBinding, updateBinding, resetBinding, resetToDefaults };
}
