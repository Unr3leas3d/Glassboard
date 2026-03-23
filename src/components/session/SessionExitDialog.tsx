import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SessionExitDialogProps {
  open: boolean;
  mode: "end" | "leave";
  pending: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
}

export function SessionExitDialog(props: SessionExitDialogProps) {
  const title =
    props.mode === "end" ? "End session for everyone?" : "Leave this session?";
  const confirmLabel = props.mode === "end" ? "End Session" : "Leave Session";
  const pendingLabel = props.mode === "end" ? "Ending..." : "Leaving...";
  const confirmDisabled = props.pending;

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="z-[100000]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {props.mode === "end"
              ? "This closes the session for all participants."
              : "You will leave the current session and return to the dashboard."}
          </DialogDescription>
        </DialogHeader>
        {props.error && <p className="text-xs text-red-400">{props.error}</p>}
        <DialogFooter>
          <Button variant="outline" disabled={props.pending} onClick={() => props.onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={confirmDisabled} onClick={props.onConfirm}>
            {props.pending ? pendingLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
