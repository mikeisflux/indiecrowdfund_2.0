"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  Trash2,
  XCircle,
  Loader2,
} from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "default";
  requireConfirmation?: string;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  requireConfirmation,
  onConfirm,
}: ConfirmDialogProps) {
  const [confirmInput, setConfirmInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const isConfirmed = !requireConfirmation || confirmInput === requireConfirmation;

  const handleConfirm = async () => {
    if (!isConfirmed) return;

    setIsLoading(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setIsLoading(false);
      setConfirmInput("");
    }
  };

  const handleClose = () => {
    setConfirmInput("");
    onOpenChange(false);
  };

  const IconComponent = variant === "danger" ? Trash2 : variant === "warning" ? AlertTriangle : XCircle;
  const iconColor = variant === "danger" ? "text-red-500" : variant === "warning" ? "text-amber-500" : "text-gray-500";
  const buttonVariant = variant === "danger" ? "destructive" : variant === "warning" ? "default" : "default";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconComponent className={`h-5 w-5 ${iconColor}`} />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {variant === "danger" && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 mb-4">
              <p className="text-sm text-red-800">
                <strong>Warning:</strong> This action cannot be undone. Please make sure you want to proceed.
              </p>
            </div>
          )}

          {requireConfirmation && (
            <div className="space-y-2">
              <Label>
                Type <strong>{requireConfirmation}</strong> to confirm
              </Label>
              <Input
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder={requireConfirmation}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            {cancelText}
          </Button>
          <Button
            variant={buttonVariant}
            onClick={handleConfirm}
            disabled={!isConfirmed || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              confirmText
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Pre-configured confirmation dialogs
export function CancelOrderDialog({
  open,
  onOpenChange,
  orderId,
  backerName,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  backerName: string;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Cancel Order"
      description={`Are you sure you want to cancel order #${orderId} for ${backerName}? This will remove them from fulfillment.`}
      confirmText="Cancel Order"
      variant="danger"
      requireConfirmation="CANCEL"
      onConfirm={onConfirm}
    />
  );
}

export function DeleteSegmentDialog({
  open,
  onOpenChange,
  segmentName,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  segmentName: string;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete Segment"
      description={`Are you sure you want to delete the "${segmentName}" segment? Backers will not be affected.`}
      confirmText="Delete Segment"
      variant="danger"
      onConfirm={onConfirm}
    />
  );
}

export function BulkActionDialog({
  open,
  onOpenChange,
  action,
  count,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: string;
  count: number;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Confirm ${action}`}
      description={`You are about to ${action.toLowerCase()} ${count} backer${count !== 1 ? "s" : ""}. This action may take a few moments.`}
      confirmText={`${action} ${count} Backer${count !== 1 ? "s" : ""}`}
      variant="warning"
      onConfirm={onConfirm}
    />
  );
}
