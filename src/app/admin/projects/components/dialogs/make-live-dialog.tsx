"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Zap, Loader2 } from "lucide-react";

interface MakeLiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sendEmail: boolean;
  onSendEmailChange: (send: boolean) => void;
  isSubmitting: boolean;
  onSubmit: () => void;
}

export function MakeLiveDialog({
  open,
  onOpenChange,
  sendEmail,
  onSendEmailChange,
  isSubmitting,
  onSubmit,
}: MakeLiveDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Make Campaign Live</DialogTitle>
          <DialogDescription>
            This will make the campaign live and accepting pledges.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Are you sure you want to make this campaign live? The campaign will be published and start accepting pledges immediately.
          </p>
          <div className="flex items-center gap-2 mt-4">
            <Checkbox
              id="sendEmailMakeLive"
              checked={sendEmail}
              onCheckedChange={(checked) => onSendEmailChange(checked === true)}
            />
            <Label htmlFor="sendEmailMakeLive" className="text-sm">
              Send notification email to creator
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={onSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Making Live...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Make Live
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
