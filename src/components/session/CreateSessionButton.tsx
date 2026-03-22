import { useState } from "react";
import { Input } from "@/components/ui/input";

interface CreateSessionButtonProps {
  onCreate: (title?: string) => Promise<unknown>;
  disabled?: boolean;
}

export function CreateSessionButton({ onCreate, disabled }: CreateSessionButtonProps) {
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    setLoading(true);
    await onCreate(title.trim() || undefined);
    setLoading(false);
    setTitle("");
  }

  return (
    <div className="flex gap-2">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Session title (optional)"
        className="flex-1"
        onKeyDown={(e) => {
          if (e.key === "Enter") handleCreate();
        }}
      />
      <button
        onClick={handleCreate}
        disabled={disabled || loading}
        className="h-9 px-5 rounded-lg border-none text-[13px] font-semibold cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        style={{
          background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-warm) 100%)',
          color: '#1A1A1E',
        }}
      >
        {loading ? "Creating..." : "Start"}
      </button>
    </div>
  );
}
