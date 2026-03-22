import { Sun, Moon, Monitor } from "lucide-react";
import { Button } from "../ui/button";
import { useHotkeySettings, DEFAULT_HOTKEY_BINDINGS } from "../../hooks/useHotkeySettings";
import { HotkeyRow } from "./HotkeyRow";
import type { ThemeMode } from "../../hooks/useTheme";

interface AppTabProps {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
}

const themeOptions: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function AppTab({ theme, setTheme }: AppTabProps) {
  const { bindings, updateBinding, resetBinding, resetToDefaults } = useHotkeySettings();

  const hasModified = bindings.some(
    (b) => b.accelerator !== DEFAULT_HOTKEY_BINDINGS.find((d) => d.id === b.id)?.accelerator,
  );

  return (
    <div className="space-y-4">
      {/* Appearance card */}
      <div className="relative bg-card rounded-xl p-5 space-y-3 overflow-hidden"
        style={{ border: '1px solid rgba(193,185,126,0.18)', backgroundImage: 'radial-gradient(ellipse 70% 40% at 50% 0%, rgba(193,185,126,0.04) 0%, transparent 70%)' }}
      >
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--gold-dim)]">Appearance</h2>
        <div className="flex rounded-lg bg-secondary p-1 gap-0.5">
          {themeOptions.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium transition-all ${
                theme === value
                  ? "bg-card text-[var(--gold)] shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Hotkeys card */}
      <div className="relative bg-card rounded-xl p-5 space-y-2 overflow-hidden"
        style={{ border: '1px solid rgba(193,185,126,0.18)', backgroundImage: 'radial-gradient(ellipse 70% 40% at 50% 0%, rgba(193,185,126,0.04) 0%, transparent 70%)' }}
      >
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--gold-dim)] mb-3">Keyboard Shortcuts</h2>

        <div className="divide-y divide-border">
          {bindings.map((binding) => {
            const def = DEFAULT_HOTKEY_BINDINGS.find((d) => d.id === binding.id)!;
            return (
              <HotkeyRow
                key={binding.id}
                binding={binding}
                defaultAccelerator={def.accelerator}
                allBindings={bindings}
                onUpdate={updateBinding}
                onReset={resetBinding}
              />
            );
          })}
        </div>

        {hasModified && (
          <div className="pt-3 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={resetToDefaults}
            >
              Reset All to Defaults
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
