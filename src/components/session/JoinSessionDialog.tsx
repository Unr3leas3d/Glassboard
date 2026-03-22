import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeJoinCode, isValidJoinCode } from "../../utils/joinCode";

interface JoinSessionDialogProps {
  onJoin: (code: string) => Promise<unknown>;
  error?: string | null;
}

export function JoinSessionDialog({ onJoin, error }: JoinSessionDialogProps) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const normalized = normalizeJoinCode(code);
  const valid = isValidJoinCode(code);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setLoading(true);
    const result = await onJoin(normalized);
    setLoading(false);
    if (result) {
      setOpen(false);
      setCode("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"
          className="border-[rgba(193,185,126,0.25)] text-[var(--gold-dim)] hover:text-[var(--gold)] hover:border-[rgba(193,185,126,0.4)] hover:bg-[rgba(193,185,126,0.08)]"
        >
          Join Session
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Join a Session</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="join-code">
              6-character join code
            </Label>
            <Input
              id="join-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="ABC123"
              className="text-center text-lg tracking-widest font-mono"
              maxLength={6}
              autoFocus
            />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading || !valid}>
            {loading ? "Joining..." : "Join"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
