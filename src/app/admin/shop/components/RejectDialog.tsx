import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Loader2 } from "lucide-react";

interface RejectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rejectionReason: string;
  onReasonChange: (reason: string) => void;
  onReject: () => void;
  isSubmitting: boolean;
}

export function RejectDialog({
  open,
  onOpenChange,
  rejectionReason,
  onReasonChange,
  onReject,
  isSubmitting,
}: RejectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Reject Book
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Please provide a reason for rejecting this book. This will be sent to the creator.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-foreground">Rejection Reason *</Label>
            <Textarea
              placeholder="Explain why this book is being rejected..."
              value={rejectionReason}
              onChange={(e) => onReasonChange(e.target.value)}
              rows={4}
              className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground/70"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              onReasonChange("");
            }}
            className="border-white/20 text-foreground hover:bg-muted"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onReject}
            disabled={isSubmitting || !rejectionReason.trim()}
          >
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Reject Book
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
