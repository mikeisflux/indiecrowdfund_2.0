import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Undo2, Loader2 } from "lucide-react";

// Preset reasons an admin can pick when reverting a live book to review.
export const REVERT_REASONS = [
  "Content guideline violation",
  "Copyright or intellectual property concern",
  "Misleading or inaccurate listing details",
  "Low-quality, corrupted, or missing file",
  "Cover image does not meet standards",
  "Incorrect pricing",
  "Missing or incorrect content rating",
  "Other",
];

interface RevertToPendingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason: string;
  onReasonChange: (reason: string) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  onRevert: () => void;
  isSubmitting: boolean;
}

export function RevertToPendingDialog({
  open,
  onOpenChange,
  reason,
  onReasonChange,
  notes,
  onNotesChange,
  onRevert,
  isSubmitting,
}: RevertToPendingDialogProps) {
  const needsNotes = reason === "Other";
  const canSubmit = reason !== "" && (!needsNotes || notes.trim() !== "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className="w-5 h-5 text-amber-500" />
            Revert to Pending Review
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            This removes the book from the live shop and sends it back to the
            review queue. The creator is notified with the reason you select so
            they can correct the issue.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-foreground">Reason *</Label>
            <Select value={reason} onValueChange={onReasonChange}>
              <SelectTrigger className="bg-muted/50 border-border text-foreground">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {REVERT_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-foreground">
              Notes {needsNotes ? "*" : "(optional)"}
            </Label>
            <Textarea
              placeholder="Add any details the creator needs to fix the issue..."
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              rows={3}
              className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground/70"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-white/20 text-foreground hover:bg-muted"
          >
            Cancel
          </Button>
          <Button
            onClick={onRevert}
            disabled={isSubmitting || !canSubmit}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Revert to Pending
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
