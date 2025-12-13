"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Power, Loader2 } from "lucide-react";

interface DeactivateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  onSubmit: () => void;
}

export function DeactivateDialog({
  open,
  onOpenChange,
  isSubmitting,
  onSubmit,
}: DeactivateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Deactivate Campaign</DialogTitle>
          <DialogDescription>
            This will send the project back to review.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Are you sure you want to deactivate this campaign? The campaign will be unpublished and sent back to the review queue.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deactivating...
              </>
            ) : (
              <>
                <Power className="mr-2 h-4 w-4" />
                Deactivate
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
