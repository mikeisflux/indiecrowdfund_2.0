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
import { User } from "../types";

interface DeleteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  onSubmit: () => void;
  isUpdating: boolean;
}

export function DeleteUserDialog({
  open,
  onOpenChange,
  user,
  onSubmit,
  isUpdating,
}: DeleteUserDialogProps) {
  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete User</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this user? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 font-medium text-red-600">
              {user.name?.charAt(0) || user.email.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-medium text-red-800">{user.name || "No name"}</p>
              <p className="text-sm text-red-600">{user.email}</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-zinc-600">
            This will permanently delete the user account and all associated data including:
          </p>
          <ul className="mt-2 text-sm text-zinc-600 list-disc list-inside space-y-1">
            <li>{user.projectCount} created projects</li>
            <li>{user.pledgeCount} pledges made</li>
            <li>All account settings and preferences</li>
          </ul>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onSubmit}
            disabled={isUpdating}
          >
            {isUpdating ? "Deleting..." : "Delete User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
