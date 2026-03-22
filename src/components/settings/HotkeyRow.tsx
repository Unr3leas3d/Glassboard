import { useState, useEffect, useCallback } from "react";
import { RotateCcw } from "lucide-react";
import { formatAccelerator, keyEventToAccelerator } from "../../utils/hotkeyFormat";
import type { HotkeyBinding } from "../../hooks/useHotkeySettings";

interface HotkeyRowProps {
  binding: HotkeyBinding;
  defaultAccelerator: string;
  allBindings: HotkeyBinding[];
  onUpdate: (id: string, accelerator: string) => void;
  onReset: (id: string) => void;
}

export function HotkeyRow({
  binding,
  defaultAccelerator,
  allBindings,
  onUpdate,
  onReset,
}: HotkeyRowProps) {
  const [recording, setRecording] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);
  const isModified = binding.accelerator !== defaultAccelerator;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        setRecording(false);
        setConflict(null);
        return;
      }

      const accelerator = keyEventToAccelerator(e);
      if (!accelerator) return;

      // Check for conflicts
      const conflicting = allBindings.find(
        (b) => b.id !== binding.id && b.accelerator === accelerator,
      );
      if (conflicting) {
        setConflict(`Already used by "${conflicting.label}"`);
        return;
      }

      setConflict(null);
      setRecording(false);
      onUpdate(binding.id, accelerator);
    },
    [binding.id, allBindings, onUpdate],
  );

  useEffect(() => {
    if (!recording) return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [recording, handleKeyDown]);

  // Close recording on blur
  useEffect(() => {
    if (!recording) return;
    const handleBlur = () => {
      setRecording(false);
      setConflict(null);
    };
    window.addEventListener("blur", handleBlur);
    return () => window.removeEventListener("blur", handleBlur);
  }, [recording]);

  return (
    <div className="flex items-center justify-between py-2">
      <div className="space-y-0.5 min-w-0 flex-1 mr-3">
        <p className="text-sm text-foreground">{binding.label}</p>
        <p className="text-xs text-muted-foreground">{binding.description}</p>
        {conflict && (
          <p className="text-xs text-red-400">{conflict}</p>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => {
            setRecording(true);
            setConflict(null);
          }}
          className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors ${
            recording
              ? "bg-[rgba(193,185,126,0.12)] text-[var(--gold)] border border-[rgba(193,185,126,0.40)] animate-pulse"
              : "bg-secondary text-muted-foreground border border-input hover:border-[rgba(193,185,126,0.25)] hover:text-[var(--gold-dim)]"
          }`}
          style={!recording ? { boxShadow: '0 1px 0 var(--border)' } : undefined}
        >
          {recording ? "Press keys..." : formatAccelerator(binding.accelerator)}
        </button>
        {isModified && (
          <button
            onClick={() => onReset(binding.id)}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
            title="Reset to default"
          >
            <RotateCcw className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
