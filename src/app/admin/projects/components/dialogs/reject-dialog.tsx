"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { XCircle, Loader2 } from "lucide-react";
import { rejectionReasons } from "../types";

interface RejectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rejectionReason: string;
  onRejectionReasonChange: (reason: string) => void;
  reviewNotes: string;
  onReviewNotesChange: (notes: string) => void;
  internalNotes: string;
  onInternalNotesChange: (notes: string) => void;
  sendEmail: boolean;
  onSendEmailChange: (send: boolean) => void;
  isSubmitting: boolean;
  onSubmit: () => void;
}

export function RejectDialog({
  open,
  onOpenChange,
  rejectionReason,
  onRejectionReasonChange,
  reviewNotes,
  onReviewNotesChange,
  internalNotes,
  onInternalNotesChange,
  sendEmail,
  onSendEmailChange,
  isSubmitting,
  onSubmit,
}: RejectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-red-600">Reject Project</DialogTitle>
          <DialogDescription>
            The project will be rejected and the creator will be notified.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Rejection Reason *</Label>
            <Select value={rejectionReason} onValueChange={onRejectionReasonChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                {rejectionReasons.map((reason) => (
                  <SelectItem key={reason.value} value={reason.value}>
                    {reason.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Explanation to Creator *</Label>
            <Textarea
              placeholder="Provide a clear explanation for the rejection..."
              value={reviewNotes}
              onChange={(e) => onReviewNotesChange(e.target.value)}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label>Internal Notes</Label>
            <Textarea
              placeholder="Add internal notes..."
              value={internalNotes}
              onChange={(e) => onInternalNotesChange(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="sendEmailReject"
              checked={sendEmail}
              onCheckedChange={(checked) => onSendEmailChange(checked === true)}
            />
            <Label htmlFor="sendEmailReject" className="text-sm">
              Send rejection email to creator
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onSubmit}
            disabled={isSubmitting || !rejectionReason || !reviewNotes}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <XCircle className="mr-2 h-4 w-4" />
                Reject Project
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
