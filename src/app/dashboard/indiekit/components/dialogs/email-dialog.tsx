"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface EmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmailDialog({ open, onOpenChange }: EmailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Email Campaign</DialogTitle>
          <DialogDescription>
            Create a new email to send to your backers
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="campaign-title">Campaign Title</Label>
            <Input id="campaign-title" placeholder="e.g., Shipping Update" />
          </div>
          <div className="space-y-2">
            <Label>Recipients</Label>
            <Select defaultValue="all">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All backers</SelectItem>
                <SelectItem value="survey_pending">Survey pending</SelectItem>
                <SelectItem value="not_shipped">Not shipped</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="bg-teal-600 hover:bg-teal-700">
            Create Campaign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
