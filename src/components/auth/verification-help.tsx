"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, MailCheck, MailWarning, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/fetch-utils";

/**
 * The "verify your email" helper, shown wherever an unverified account is
 * blocked (the pledge payment step, for one).
 *
 * It tells the truth about delivery. The old button said "Verification email
 * sent! Check your inbox." no matter what happened next; a backer whose
 * signup address ended in ".comm" pressed it three times, every copy bounced
 * on a domain that doesn't exist, and he concluded the site hated him. This
 * shows the address we are sending to, what the mail provider reported for
 * the last attempt, a one-tap fix when the address looks mistyped, and a way
 * to change the address without asking an admin.
 */

interface Status {
  email: string;
  verified: boolean;
  lastSend: { status: string; sentAt: string | null; delivered: boolean; failed: boolean; reason: string | null } | null;
  suggestion: { email: string; reason: string; hard: boolean } | null;
}

export function VerificationHelp() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState<"resend" | "change" | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [newEmail, setNewEmail] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/user/verify-email/status");
      if (res.ok) setStatus(await res.json());
    } catch {
      // Leave the simple resend button available.
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resend = async () => {
    setBusy("resend");
    setNotice(null);
    try {
      const res = await apiFetch("/api/user/verify-email", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to send. Please try again.");
      setNotice({ kind: "ok", text: `Sent to ${status?.email ?? "your address"}. Check the inbox and spam folder.` });
      // The provider's verdict arrives a few seconds later; refresh once.
      setTimeout(load, 6000);
    } catch (err) {
      setNotice({ kind: "error", text: err instanceof Error ? err.message : "Network error. Please try again." });
    } finally {
      setBusy(null);
    }
  };

  const change = async (email: string, confirmed = false) => {
    setBusy("change");
    setNotice(null);
    try {
      const res = await apiFetch("/api/user/verify-email", { method: "PATCH", json: { email, confirmed } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't change the address.");
      setEditing(false);
      setNewEmail("");
      setNotice({ kind: "ok", text: `Address updated to ${data.email || email} and a new link is on its way.` });
      await load();
      setTimeout(load, 6000);
    } catch (err) {
      setNotice({ kind: "error", text: err instanceof Error ? err.message : "Couldn't change the address." });
    } finally {
      setBusy(null);
    }
  };

  const bounced = status?.lastSend?.failed === true;
  const suggestion = status?.suggestion;

  return (
    <div className="mt-2 space-y-2 text-sm">
      {status && (
        <p className="text-muted-foreground">
          We send the link to <span className="font-medium text-foreground">{status.email}</span>.
        </p>
      )}

      {bounced && (
        <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-2 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
          <MailWarning className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">The last email to that address bounced.</p>
            <p className="text-xs">
              {status?.lastSend?.reason
                ? status.lastSend.reason
                : suggestion
                  ? `It looks mistyped: ${suggestion.reason}.`
                  : "The address was rejected by its mail server. Check the spelling, or use a different address."}
            </p>
          </div>
        </div>
      )}

      {suggestion && (
        <div className="flex flex-wrap items-center gap-2">
          <span className={bounced ? "text-foreground" : "text-muted-foreground"}>Did you mean</span>
          <Button size="sm" variant={bounced ? "default" : "outline"} className="h-7" disabled={busy !== null} onClick={() => change(suggestion.email)}>
            {busy === "change" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <MailCheck className="mr-1 h-3 w-3" />}
            Use {suggestion.email}
          </Button>
        </div>
      )}

      {editing ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (newEmail.trim()) change(newEmail.trim());
          }}
        >
          <Input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="correct@email.com"
            className="h-8 w-60"
            autoFocus
            required
          />
          <Button type="submit" size="sm" className="h-8" disabled={busy !== null}>
            {busy === "change" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save & send link"}
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="h-8" onClick={resend} disabled={busy !== null}>
            {busy === "resend" ? (
              <>
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                Sending...
              </>
            ) : (
              "Resend verification email"
            )}
          </Button>
          {status && !status.verified && (
            <Button variant="ghost" size="sm" className="h-8" onClick={() => setEditing(true)}>
              <Pencil className="mr-1 h-3 w-3" />
              Wrong address?
            </Button>
          )}
        </div>
      )}

      {notice && (
        <p className={notice.kind === "ok" ? "text-xs text-green-600 dark:text-green-400" : "text-xs text-red-600 dark:text-red-400"}>{notice.text}</p>
      )}
      {!bounced && (
        <p className="text-xs text-muted-foreground">
          Don&apos;t see it? Check spam or promotions. Search for <span className="font-mono">from:noreply@indiecrowdfund.com</span>.
        </p>
      )}
    </div>
  );
}
