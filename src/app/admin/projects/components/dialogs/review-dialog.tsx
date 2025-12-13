"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle, RotateCcw, Loader2 } from "lucide-react";

interface ReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reviewAction: "approve" | "changes" | null;
  reviewNotes: string;
  onReviewNotesChange: (notes: string) => void;
  internalNotes: string;
  onInternalNotesChange: (notes: string) => void;
  sendEmail: boolean;
  onSendEmailChange: (send: boolean) => void;
  isSubmitting: boolean;
  onSubmit: () => void;
}

export function ReviewDialog({
  open,
  onOpenChange,
  reviewAction,
  reviewNotes,
  onReviewNotesChange,
  internalNotes,
  onInternalNotesChange,
  sendEmail,
  onSendEmailChange,
  isSubmitting,
  onSubmit,
}: ReviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {reviewAction === "approve" ? "Approve Project" : "Request Changes"}
          </DialogTitle>
          <DialogDescription>
            {reviewAction === "approve"
              ? "The project will be approved and the creator can launch it."
              : "The creator will be notified to make changes before resubmitting."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Notes to Creator</Label>
            <Textarea
              placeholder={reviewAction === "approve"
                ? "Optional: Add any notes for the creator..."
                : "Explain what changes are needed..."}
              value={reviewNotes}
              onChange={(e) => onReviewNotesChange(e.target.value)}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label>Internal Notes (not sent to creator)</Label>
            <Textarea
              placeholder="Add internal notes for other reviewers..."
              value={internalNotes}
              onChange={(e) => onInternalNotesChange(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="sendEmail"
              checked={sendEmail}
              onCheckedChange={(checked) => onSendEmailChange(checked === true)}
            />
            <Label htmlFor="sendEmail" className="text-sm">
              Send email notification to creator
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={isSubmitting}
            className={reviewAction === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : reviewAction === "approve" ? (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Approve Project
              </>
            ) : (
              <>
                <RotateCcw className="mr-2 h-4 w-4" />
                Request Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
