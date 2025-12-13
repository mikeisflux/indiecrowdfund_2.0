"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle, Store } from "lucide-react";
import { Retailer } from "../types";

type ApprovalAction = "approve" | "reject" | "request_info";

interface ApprovalActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  retailer: Retailer | null;
  action: ApprovalAction | null;
  notes: string;
  onNotesChange: (notes: string) => void;
  onSubmit: () => void;
}

export function ApprovalActionDialog({
  open,
  onOpenChange,
  retailer,
  action,
  notes,
  onNotesChange,
  onSubmit,
}: ApprovalActionDialogProps) {
  if (!retailer || !action) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {action === "approve" && "Approve Retailer"}
            {action === "reject" && "Reject Retailer"}
            {action === "request_info" && "Request Additional Information"}
          </DialogTitle>
          <DialogDescription>
            {action === "approve" && "Approve this retailer application and grant wholesale access."}
            {action === "reject" && "Reject this retailer application. Please provide a reason."}
            {action === "request_info" && "Request additional information from the applicant."}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="flex items-center gap-3 mb-4 p-3 bg-zinc-50 rounded-lg">
            <Store className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="font-medium">{retailer.businessName}</p>
              <p className="text-sm text-zinc-500">{retailer.contactName}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="notes">
                {action === "approve" && "Notes (Optional)"}
                {action === "reject" && "Rejection Reason (Required)"}
                {action === "request_info" && "Information Requested (Required)"}
              </Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => onNotesChange(e.target.value)}
                placeholder={
                  action === "approve"
                    ? "Add any internal notes..."
                    : action === "reject"
                    ? "Please explain why this application is being rejected..."
                    : "What additional information do you need?"
                }
                rows={4}
              />
            </div>

            {action === "approve" && (
              <div className="p-3 bg-emerald-50 rounded-lg text-sm text-emerald-800">
                <CheckCircle className="h-4 w-4 inline mr-2" />
                An access code will be generated and sent to the retailer&apos;s email.
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            className={
              action === "approve"
                ? "bg-emerald-600 hover:bg-emerald-700"
                : action === "reject"
                ? "bg-red-600 hover:bg-red-700"
                : ""
            }
            disabled={
              (action === "reject" || action === "request_info") &&
              !notes.trim()
            }
          >
            {action === "approve" && "Approve Retailer"}
            {action === "reject" && "Reject Application"}
            {action === "request_info" && "Send Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
