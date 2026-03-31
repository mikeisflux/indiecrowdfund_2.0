"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/fetch-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { User } from "../types";

interface SendEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
}

export function SendEmailDialog({ open, onOpenChange, user }: SendEmailDialogProps) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleClose = () => {
    setSubject("");
    setBody("");
    onOpenChange(false);
  };

  const handleSend = async () => {
    if (!user || !subject.trim() || !body.trim()) return;
    setIsSending(true);
    try {
      const res = await apiFetch("/api/admin/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "single",
          to: user.email,
          subject: subject.trim(),
          body: body.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send email");
      }
      toast.success(`Email sent to ${user.email}`);
      handleClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send email");
    } finally {
      setIsSending(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send Email
          </DialogTitle>
          <DialogDescription>
            Send a direct email to this user via the IndieCrowdfund mail system.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-4">
          {/* User badge */}
          <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700 font-medium text-zinc-600 dark:text-zinc-300 text-sm shrink-0">
              {user.name?.charAt(0) || user.email.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{user.name || "No name"}</p>
              <p className="text-xs text-zinc-500 truncate">{user.email}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-to">To</Label>
            <Input id="email-to" value={user.email} readOnly className="bg-muted cursor-default" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-subject">Subject</Label>
            <Input
              id="email-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-body">Message</Label>
            <Textarea
              id="email-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message here..."
              rows={7}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSending}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={isSending || !subject.trim() || !body.trim()}
          >
            {isSending ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Sending...</>
            ) : (
              <><Mail className="h-4 w-4 mr-2" />Send Email</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
