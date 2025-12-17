"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload } from "lucide-react";

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UploadDialog({ open, onOpenChange }: UploadDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Digital File</DialogTitle>
          <DialogDescription>
            Upload a file to distribute to your backers
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground mb-2">
              Drag and drop your file here, or click to browse
            </p>
            <Button variant="outline" size="sm">
              Choose File
            </Button>
          </div>
          <div className="space-y-2">
            <Label>Distribution Rules</Label>
            <Select defaultValue="all">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All backers</SelectItem>
                <SelectItem value="tier">Specific reward tiers</SelectItem>
                <SelectItem value="addon">Add-on purchasers</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="bg-teal-600 hover:bg-teal-700">
            Upload & Distribute
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
