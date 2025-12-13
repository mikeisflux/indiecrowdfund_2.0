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
import { Download } from "lucide-react";
import { EmailLogEntry } from "../types";

interface EmailPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: EmailLogEntry | null;
  onDownloadEmail: (emailId: string) => void;
}

export function EmailPreviewDialog({
  open,
  onOpenChange,
  email,
  onDownloadEmail,
}: EmailPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Email Preview</DialogTitle>
          <DialogDescription>
            {email?.subject || "Email content"}
          </DialogDescription>
        </DialogHeader>
        {email?.htmlContent && (
          <div className="border rounded-lg overflow-auto max-h-[60vh] bg-white">
            <iframe
              srcDoc={email.htmlContent}
              className="w-full h-[500px] border-0"
              title="Email Preview"
            />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {email && (
            <Button onClick={() => onDownloadEmail(email.id)}>
              <Download className="h-4 w-4 mr-2" />
              Download HTML
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
