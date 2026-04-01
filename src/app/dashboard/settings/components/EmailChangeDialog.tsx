"use client";

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
import { AlertCircle, Check, Loader2 } from "lucide-react";
import { EmailChangeState } from "./types";

interface EmailChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentEmail: string;
  emailChange: EmailChangeState;
  onEmailChangeUpdate: (state: EmailChangeState) => void;
  onSubmit: () => void;
}

export function EmailChangeDialog({
  open,
  onOpenChange,
  currentEmail,
  emailChange,
  onEmailChangeUpdate,
  onSubmit,
}: EmailChangeDialogProps) {
  const handleClose = () => {
    onOpenChange(false);
    onEmailChangeUpdate({
      newEmail: "",
      confirmEmail: "",
      password: "",
      isChanging: false,
      error: null,
      success: false,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Change Email Address</DialogTitle>
          <DialogDescription>
            Enter your new email address. You&apos;ll need to verify it before the change takes effect.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {emailChange.error && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" />
              {emailChange.error}
            </div>
          )}

          {emailChange.success && (
            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-2 text-green-600 text-sm">
              <Check className="h-4 w-4" />
              Email changed successfully! Please verify your new email.
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="currentEmail">Current Email</Label>
            <Input
              id="currentEmail"
              value={currentEmail}
              disabled
              className="bg-muted"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newEmail">New Email Address</Label>
            <Input
              id="newEmail"
              type="email"
              value={emailChange.newEmail}
              onChange={(e) => onEmailChangeUpdate({ ...emailChange, newEmail: e.target.value, error: null })}
              placeholder="Enter new email address"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmEmail">Confirm New Email</Label>
            <Input
              id="confirmEmail"
              type="email"
              value={emailChange.confirmEmail}
              onChange={(e) => onEmailChangeUpdate({ ...emailChange, confirmEmail: e.target.value, error: null })}
              placeholder="Confirm new email address"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password (optional)</Label>
            <Input
              id="password"
              type="password"
              value={emailChange.password}
              onChange={(e) => onEmailChangeUpdate({ ...emailChange, password: e.target.value })}
              placeholder="Enter your password to confirm"
            />
            <p className="text-xs text-muted-foreground">
              If you signed up via social login, you can leave this empty.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={emailChange.isChanging}
          >
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={emailChange.isChanging || emailChange.success}
          >
            {emailChange.isChanging ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Changing...
              </>
            ) : (
              "Change Email"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
