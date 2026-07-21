"use client";

// Creator-side email tooling for the unified Messages panel. The Messages UI
// is the single surface creators use to talk to backers; under the hood a
// creator's sends go out as REAL email from their @indiecrowdfund.com address
// (the email backend and chat share the same Message table). This file holds
// the pieces that make that work:
//   - filesToAttachments: File[] -> base64 payloads the email APIs accept
//   - EmailSetupDialog:  the claim-your-username gate (creatorEmailHandle)
//   - ComposeEmailDialog: start a brand-new email to any address
//   - BackerSupportDialog: the backer-support lookup (moved here when the
//     old Email tab was retired)

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/fetch-utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AtSign,
  CheckCircle,
  Loader2,
  Mail,
  Paperclip,
  Send,
  X,
} from "lucide-react";
import { SupportTab } from "@/app/dashboard/indiekit/components/tabs";
import type { Backer } from "@/app/dashboard/indiekit/types";

export interface EmailSetupState {
  hasEmailSetup: boolean;
  emailHandle: string | null;
  fullEmail: string | null;
  isCreator: boolean;
  suggestedHandle: string;
}

export interface EmailAttachment {
  filename: string;
  data: string;
  contentType: string;
}

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10MB per file

export async function filesToAttachments(files: File[]): Promise<EmailAttachment[]> {
  return Promise.all(
    files.map(
      (file) =>
        new Promise<EmailAttachment>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            const base64 = dataUrl.split(",")[1] || "";
            resolve({ filename: file.name, data: base64, contentType: file.type });
          };
          reader.readAsDataURL(file);
        })
    )
  );
}

// Shared attachment chip row used above composers.
export function AttachmentChips({
  files,
  onRemove,
}: {
  files: File[];
  onRemove: (index: number) => void;
}) {
  if (files.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {files.map((file, i) => (
        <div
          key={`${file.name}-${i}`}
          className="flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs"
        >
          <Paperclip className="h-3 w-3" />
          <span className="max-w-[150px] truncate">{file.name}</span>
          <span className="text-muted-foreground">({(file.size / 1024).toFixed(0)}KB)</span>
          <button
            type="button"
            onClick={() => onRemove(i)}
            className="ml-1 hover:text-destructive"
            aria-label={`Remove ${file.name}`}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EmailSetupDialog — the "choose your username" gate. A creator must claim
// their handle@indiecrowdfund.com before they can send anything; the send
// APIs enforce this server-side, this dialog is the guided front door.
// ---------------------------------------------------------------------------
export function EmailSetupDialog({
  open,
  onOpenChange,
  suggestedHandle,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestedHandle?: string;
  onComplete: (handle: string, fullEmail: string) => void;
}) {
  const [handle, setHandle] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (open && suggestedHandle && !handle) setHandle(suggestedHandle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, suggestedHandle]);

  const submit = async () => {
    const cleaned = handle.trim().toLowerCase();
    if (!cleaned) {
      toast.error("Please enter a username");
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch("/api/creator/email/setup", {
        method: "POST",
        json: { handle: cleaned },
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to claim that username");
        return;
      }
      setDone(true);
      toast.success("Your email address is ready!");
      onComplete(data.emailHandle, data.fullEmail);
      setTimeout(() => {
        onOpenChange(false);
        setDone(false);
      }, 1500);
    } catch {
      toast.error("Failed to set up your email address");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AtSign className="h-5 w-5 text-primary" />
            Choose your username
          </DialogTitle>
          <DialogDescription>
            Messages you send reach backers as real email from your own
            @indiecrowdfund.com address. Claim your username once — it can&apos;t
            be changed later.
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="flex flex-col items-center py-6 text-center">
            <CheckCircle className="mb-2 h-10 w-10 text-emerald-500" />
            <p className="font-medium">{handle.trim().toLowerCase()}@indiecrowdfund.com</p>
            <p className="text-sm text-muted-foreground">You&apos;re ready to send.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label htmlFor="creator-email-handle">Username</Label>
              <div className="mt-1 flex items-stretch overflow-hidden rounded-lg border border-input focus-within:ring-2 focus-within:ring-ring">
                <Input
                  id="creator-email-handle"
                  value={handle}
                  onChange={(e) =>
                    setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))
                  }
                  placeholder="yourname"
                  autoComplete="off"
                  className="rounded-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submit();
                  }}
                />
                <span className="flex select-none items-center whitespace-nowrap bg-muted px-3 text-sm text-muted-foreground">
                  @indiecrowdfund.com
                </span>
              </div>
            </div>
            <Button onClick={submit} disabled={saving || !handle.trim()} className="w-full">
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Claiming…
                </>
              ) : (
                <>Claim username &amp; continue</>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// ComposeEmailDialog — start a brand-new email conversation (any address).
// ---------------------------------------------------------------------------
export function ComposeEmailDialog({
  open,
  onOpenChange,
  projectId,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  onSent: () => void;
}) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);

  const reset = () => {
    setTo("");
    setSubject("");
    setContent("");
    setFiles([]);
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []).filter((f) => {
      if (f.size > MAX_ATTACHMENT_BYTES) {
        toast.error(`${f.name} exceeds the 10MB limit`);
        return false;
      }
      return true;
    });
    setFiles((prev) => [...prev, ...picked]);
    e.target.value = "";
  };

  const send = async () => {
    if (!to.trim() || !content.trim()) {
      toast.error("Recipient and message are required");
      return;
    }
    setSending(true);
    try {
      const attachments = files.length > 0 ? await filesToAttachments(files) : undefined;
      const res = await apiFetch("/api/creator/email/compose", {
        method: "POST",
        json: {
          to: to.trim(),
          subject: subject.trim() || undefined,
          content: content.trim(),
          projectId: projectId || undefined,
          attachments,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to send");
        return;
      }
      toast.success("Email sent");
      reset();
      onOpenChange(false);
      onSent();
    } catch {
      toast.error("Failed to send");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            New email
          </DialogTitle>
          <DialogDescription>
            Sent from your @indiecrowdfund.com address. Replies land back in Messages.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="compose-to">To</Label>
            <Input
              id="compose-to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="backer@example.com"
            />
          </div>
          <div>
            <Label htmlFor="compose-subject">Subject</Label>
            <Input
              id="compose-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
            />
          </div>
          <div>
            <Label htmlFor="compose-body">Message</Label>
            <Textarea
              id="compose-body"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your message…"
              className="min-h-[140px]"
            />
            <AttachmentChips files={files} onRemove={(i) => setFiles((p) => p.filter((_, idx) => idx !== i))} />
          </div>
          <div className="flex items-center justify-between">
            <label className="cursor-pointer">
              <input type="file" multiple className="hidden" onChange={onFileSelect} />
              <Button type="button" variant="ghost" size="sm" asChild>
                <span>
                  <Paperclip className="mr-1 h-4 w-4" />
                  Attach
                </span>
              </Button>
            </label>
            <Button onClick={send} disabled={sending || !to.trim() || !content.trim()}>
              {sending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Send
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// BackerSupportDialog — the backer-support lookup (find backer, order
// summary, edit shipping address). Self-contained: fetches its own backer
// list so it works from any Messages surface.
// ---------------------------------------------------------------------------
export function BackerSupportDialog({
  open,
  onOpenChange,
  projectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
}) {
  const [backers, setBackers] = useState<Backer[]>([]);
  const [resolvedProjectId, setResolvedProjectId] = useState<string>(projectId || "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (projectId) params.set("projectId", projectId);
        const res = await fetch(`/api/creator/indiekit?${params}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setBackers(data.backers || []);
        setResolvedProjectId(projectId || data.projects?.[0]?.id || "");
      } catch {
        // Non-fatal — the tab renders an empty state.
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Backer Support</DialogTitle>
          <DialogDescription>
            Look up a backer, review their order, and fix shipping details.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <SupportTab backers={backers} projectId={resolvedProjectId} onRefresh={() => {}} />
        )}
      </DialogContent>
    </Dialog>
  );
}
