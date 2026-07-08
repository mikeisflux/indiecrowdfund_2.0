"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CheckCircle,
  XCircle,
  Ban,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import type { Retailer } from "../types";

interface ActionConfirmDialogProps {
  retailer: Retailer | null;
  actionType: string;
  actionNotes: string;
  onActionNotesChange: (notes: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isSubmitting: boolean;
}

export function ActionConfirmDialog({
  retailer,
  actionType,
  actionNotes,
  onActionNotesChange,
  open,
  onOpenChange,
  onConfirm,
  isSubmitting,
}: ActionConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {actionType === "APPROVE" && <CheckCircle className="h-5 w-5 text-emerald-600" />}
            {actionType === "REJECT" && <XCircle className="h-5 w-5 text-red-600" />}
            {actionType === "SUSPEND" && <Ban className="h-5 w-5 text-muted-foreground" />}
            {actionType === "REACTIVATE" && <CheckCircle className="h-5 w-5 text-emerald-600" />}
            {actionType === "REQUEST_INFO" && <AlertTriangle className="h-5 w-5 text-blue-600" />}
            {actionType === "APPROVE" && "Approve Retailer Application"}
            {actionType === "REJECT" && "Reject Retailer Application"}
            {actionType === "SUSPEND" && "Suspend Retailer Account"}
            {actionType === "REACTIVATE" && "Reactivate Retailer Account"}
            {actionType === "REQUEST_INFO" && "Request Additional Information"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {actionType === "APPROVE" && (
              <>
                This will approve <strong>{retailer?.businessName}</strong> as a retailer.
                They will receive an access code and be able to place wholesale orders.
              </>
            )}
            {actionType === "REJECT" && (
              <>
                This will reject the application from <strong>{retailer?.businessName}</strong>.
                They will be notified of this decision.
              </>
            )}
            {actionType === "SUSPEND" && (
              <>
                This will suspend <strong>{retailer?.businessName}</strong>&apos;s retailer account.
                They will no longer be able to place orders until reactivated.
              </>
            )}
            {actionType === "REACTIVATE" && (
              <>
                This will reactivate <strong>{retailer?.businessName}</strong>&apos;s retailer account.
                They will be able to place orders again.
              </>
            )}
            {actionType === "REQUEST_INFO" && (
              <>
                This will mark <strong>{retailer?.businessName}</strong>&apos;s application as under review.
                Add notes below to specify what information is needed.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-4">
          <Label htmlFor="notes">
            {actionType === "REJECT" ? "Rejection Reason (optional)" : "Notes (optional)"}
          </Label>
          <Textarea
            id="notes"
            placeholder={
              actionType === "REJECT"
                ? "Provide a reason for rejection..."
                : actionType === "REQUEST_INFO"
                ? "Specify what additional information is needed..."
                : "Add any notes..."
            }
            value={actionNotes}
            onChange={(e) => onActionNotesChange(e.target.value)}
            className="mt-2"
            rows={3}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isSubmitting}
            className={
              actionType === "REJECT" || actionType === "SUSPEND"
                ? "bg-red-600 hover:bg-red-700"
                : "bg-emerald-600 hover:bg-emerald-700"
            }
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                {actionType === "APPROVE" && "Approve Application"}
                {actionType === "REJECT" && "Reject Application"}
                {actionType === "SUSPEND" && "Suspend Account"}
                {actionType === "REACTIVATE" && "Reactivate Account"}
                {actionType === "REQUEST_INFO" && "Request Info"}
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
