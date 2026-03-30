"use client";

import { apiFetch } from "@/lib/fetch-utils";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Send,
  CheckCircle,
  Loader2,
  AlertCircle,
  Paperclip,
} from "lucide-react";
import { Mailbox, EmailSettings, getFileIcon } from "./types";

export function ComposeEmailDialog({
  open,
  onOpenChange,
  mailboxes,
  selectedMailbox,
  settings,
  mode = "new",
  prefill,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mailboxes: Mailbox[];
  selectedMailbox: Mailbox | null;
  settings: EmailSettings | null;
  mode?: "new" | "reply" | "replyAll" | "forward";
  prefill?: { to?: string; subject?: string; body?: string; inReplyTo?: string; attachments?: Array<{ filename: string; data: string; contentType?: string; r2Key?: string }> } | null;
  onSent: () => void;
}) {
  const [fromMailboxId, setFromMailboxId] = useState(selectedMailbox?.id || "");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Suppress unused variable warning
  void settings;

  useEffect(() => {
    if (selectedMailbox) {
      setFromMailboxId(selectedMailbox.id);
    }
  }, [selectedMailbox]);

  // Handle prefill data for reply/forward
  useEffect(() => {
    if (open && prefill) {
      setTo(prefill.to || "");
      setSubject(prefill.subject || "");
      setBody(prefill.body || "");
    } else if (!open) {
      // Reset form when closing
      setTo("");
      setSubject("");
      setBody("");
      setError(null);
      setSuccess(false);
    }
  }, [open, prefill]);

  const handleSend = async () => {
    // Prevent double-submit
    if (isSending) return;

    if (!fromMailboxId || !to || !subject || !body) {
      setError("Please fill in all fields");
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      const response = await apiFetch(`/api/admin/mailboxes/${fromMailboxId}/emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          toEmail: to,
          subject,
          bodyHtml: body.replace(/\n/g, "<br>"),
          bodyText: body,
          sendNow: true,
          // Include attachments for forwarding (server will fetch data from R2)
          attachments: prefill?.attachments,
        }),
      });

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          onOpenChange(false);
          onSent();
          // Reset form
          setTo("");
          setSubject("");
          setBody("");
          setSuccess(false);
        }, 1500);
      } else {
        const data = await response.json();
        setError(data.error || "Failed to send email");
      }
    } catch {
      setError("Failed to send email");
    } finally {
      setIsSending(false);
    }
  };

  if (success) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="sr-only">Email Sent Successfully</DialogTitle>
            <DialogDescription className="sr-only">Your email has been sent.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-8">
            <CheckCircle className="h-12 w-12 text-emerald-500 mb-4" />
            <h3 className="font-medium text-lg">Email Sent!</h3>
            <p className="text-sm text-zinc-500">Your email has been sent to {to}</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "reply" ? "Reply" : mode === "replyAll" ? "Reply All" : mode === "forward" ? "Forward" : "Compose Email"}
          </DialogTitle>
          <DialogDescription>
            {mode === "reply" ? "Send a reply to the original sender." :
             mode === "replyAll" ? "Send a reply to all recipients." :
             mode === "forward" ? "Forward this email to another recipient." :
             "Compose and send a new email message."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label>From</Label>
            <Select value={fromMailboxId} onValueChange={setFromMailboxId}>
              <SelectTrigger>
                <SelectValue placeholder="Select mailbox" />
              </SelectTrigger>
              <SelectContent>
                {mailboxes.map((mailbox) => (
                  <SelectItem key={mailbox.id} value={mailbox.id}>
                    {mailbox.name} ({mailbox.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="to">To</Label>
            <Input
              id="to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Message</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message..."
              className="min-h-[200px]"
            />
          </div>

          {/* Show attachments that will be forwarded */}
          {prefill?.attachments && prefill.attachments.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                Attachments ({prefill.attachments.length})
              </Label>
              <div className="flex flex-wrap gap-2 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border">
                {prefill.attachments.map((att, index) => {
                  const FileTypeIcon = getFileIcon(att.contentType || "");
                  return (
                    <div
                      key={index}
                      className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-zinc-800 rounded-md border text-sm"
                    >
                      <FileTypeIcon className="h-4 w-4 text-zinc-500" />
                      <span className="truncate max-w-[150px]">{att.filename}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                These attachments will be included in the forwarded email.
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={handleSend}
            disabled={isSending}
          >
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
