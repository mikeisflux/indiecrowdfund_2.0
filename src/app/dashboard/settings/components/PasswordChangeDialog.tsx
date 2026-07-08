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
import { PasswordChangeState } from "./types";

interface PasswordChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  passwordChange: PasswordChangeState;
  onPasswordChangeUpdate: (state: PasswordChangeState) => void;
  onSubmit: () => void;
}

export function PasswordChangeDialog({
  open,
  onOpenChange,
  passwordChange,
  onPasswordChangeUpdate,
  onSubmit,
}: PasswordChangeDialogProps) {
  const handleClose = () => {
    onOpenChange(false);
    onPasswordChangeUpdate({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
      isChanging: false,
      error: null,
      success: false,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Change Password</DialogTitle>
          <DialogDescription>
            Enter your current password and choose a new one. New password must be at least 8 characters.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {passwordChange.error && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{passwordChange.error}</span>
            </div>
          )}

          {passwordChange.success && (
            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-2 text-green-600 text-sm">
              <Check className="h-4 w-4 shrink-0" />
              <span>Password changed successfully.</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current Password</Label>
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              value={passwordChange.currentPassword}
              onChange={(e) =>
                onPasswordChangeUpdate({ ...passwordChange, currentPassword: e.target.value, error: null })
              }
              placeholder="Enter your current password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              value={passwordChange.newPassword}
              onChange={(e) =>
                onPasswordChangeUpdate({ ...passwordChange, newPassword: e.target.value, error: null })
              }
              placeholder="At least 8 characters"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={passwordChange.confirmPassword}
              onChange={(e) =>
                onPasswordChangeUpdate({ ...passwordChange, confirmPassword: e.target.value, error: null })
              }
              placeholder="Re-enter new password"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={passwordChange.isChanging}
          >
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={passwordChange.isChanging || passwordChange.success}
          >
            {passwordChange.isChanging ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Changing...
              </>
            ) : (
              "Change Password"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
