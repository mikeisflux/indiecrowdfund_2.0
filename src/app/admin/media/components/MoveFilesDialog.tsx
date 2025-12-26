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
import { Folder } from "lucide-react";

interface MoveFilesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  allFolders: string[];
  onMove: (folder: string) => void;
}

export function MoveFilesDialog({
  open,
  onOpenChange,
  selectedCount,
  allFolders,
  onMove,
}: MoveFilesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move Files</DialogTitle>
          <DialogDescription>
            Select a folder to move {selectedCount} file{selectedCount !== 1 ? "s" : ""} to
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-2">
          {allFolders.map((folder) => (
            <button
              key={folder}
              onClick={() => onMove(folder)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              <Folder className="h-5 w-5 text-zinc-400" />
              <span className="capitalize">{folder}</span>
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
