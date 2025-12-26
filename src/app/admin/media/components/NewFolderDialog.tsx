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
import { FolderPlus } from "lucide-react";

interface NewFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderName: string;
  onFolderNameChange: (name: string) => void;
  onCreate: () => void;
}

export function NewFolderDialog({
  open,
  onOpenChange,
  folderName,
  onFolderNameChange,
  onCreate,
}: NewFolderDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Folder</DialogTitle>
          <DialogDescription>
            Enter a name for the new folder
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="space-y-2">
            <Label>Folder Name</Label>
            <Input
              placeholder="my-folder"
              value={folderName}
              onChange={(e) => onFolderNameChange(e.target.value)}
            />
            <p className="text-xs text-zinc-500">
              Folder will be created when you upload files to it
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onCreate} disabled={!folderName.trim()}>
            <FolderPlus className="mr-2 h-4 w-4" />
            Create & Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
