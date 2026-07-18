"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/fetch-utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Lock, LockOpen, Send, Bell, CheckCircle2, Clock, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Backer } from "../../types";

interface OrderLockTabProps {
  projectId: string | null;
  // The full backer list (shared with the Backers tab) so clicking a name can
  // open the exact same detail dialog.
  backers: Backer[];
  onOpenBackerDetail: (backer: Backer) => void;
}

type LockStatus = "UNLOCKED" | "LOCK_REQUESTED" | "LOCKED" | "DECLINED";

interface BackerRow {
  pledgeId: string;
  name: string;
  email: string;
  backerNumber: number | null;
  reward: string | null;
  lockStatus: LockStatus;
}
interface StatusData {
  counts: { eligible: number; requested: number; locked: number; declined: number };
  total: number;
  backers: BackerRow[];
}

const STATUS_META: Record<LockStatus, { label: string; className: string }> = {
  UNLOCKED: { label: "Not sent", className: "bg-muted text-muted-foreground" },
  LOCK_REQUESTED: { label: "Requested", className: "bg-blue-500/15 text-blue-600" },
  LOCKED: { label: "Locked", className: "bg-emerald-500/15 text-emerald-600" },
  DECLINED: { label: "Declined", className: "bg-amber-500/15 text-amber-600" },
};

export function OrderLockTab({ projectId, backers, onOpenBackerDetail }: OrderLockTabProps) {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  // pledgeId currently sending an individual request/reminder.
  const [sendingId, setSendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/creator/indiekit/lock-orders?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" });
      const j = await res.json();
      if (res.ok) setData(j);
    } catch {
      // soft fail
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const send = async (action: "request" | "remind") => {
    if (!projectId) return;
    setBusy(true);
    try {
      const res = await apiFetch("/api/creator/indiekit/lock-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, action }),
      });
      const j = await res.json();
      if (!res.ok) {
        toast.error(j.error || "Failed to send.");
        return;
      }
      toast.success(j.message || "Sent.");
      await load();
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  // Send (or re-send) a lock request to a single backer.
  const sendOne = async (pledgeId: string, action: "request" | "remind") => {
    if (!projectId) return;
    setSendingId(pledgeId);
    try {
      const res = await apiFetch("/api/creator/indiekit/lock-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, action, pledgeIds: [pledgeId] }),
      });
      const j = await res.json();
      if (!res.ok || (j.requested ?? 0) === 0) {
        toast.error(j.error || "Couldn't send the lock request.");
        return;
      }
      toast.success(action === "remind" ? "Reminder sent." : "Lock request sent.");
      await load();
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setSendingId(null);
    }
  };

  // Unlock a single backer's order so they can edit it again.
  const unlockOne = async (pledgeId: string) => {
    if (!projectId) return;
    setSendingId(pledgeId);
    try {
      const res = await apiFetch("/api/creator/indiekit/lock-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, action: "unlock", pledgeIds: [pledgeId] }),
      });
      const j = await res.json();
      if (!res.ok || (j.requested ?? 0) === 0) {
        toast.error(j.error || "Couldn't unlock this order.");
        return;
      }
      toast.success("Order unlocked.");
      await load();
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setSendingId(null);
    }
  };

  // Open the shared backer detail dialog for a row (matched by pledge id).
  const openDetail = (pledgeId: string) => {
    const match = backers.find((b) => b.id === pledgeId);
    if (match) onOpenBackerDetail(match);
  };

  if (!projectId) {
    return <p className="text-sm text-muted-foreground">Select a project to manage order locks.</p>;
  }

  const c = data?.counts;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Lock className="h-5 w-5 text-emerald-500" /> Order Lock
        </h2>
        <p className="text-sm text-muted-foreground">
          Ask backers to confirm their address &amp; selections and lock their order — even while the campaign is live —
          so you can print &amp; ship. Locked backers can no longer change their order and are excluded from the survey.
        </p>
      </div>

      {/* Status counts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {loading ? (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)
        ) : (
          <>
            <StatCard icon={<Clock className="h-4 w-4" />} label="Not sent" value={c?.eligible ?? 0} tone="muted" />
            <StatCard icon={<Send className="h-4 w-4" />} label="Requested" value={c?.requested ?? 0} tone="blue" />
            <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Locked" value={c?.locked ?? 0} tone="emerald" />
            <StatCard icon={<XCircle className="h-4 w-4" />} label="Declined" value={c?.declined ?? 0} tone="amber" />
          </>
        )}
      </div>

      {/* Actions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Send lock requests</CardTitle>
          <CardDescription>
            Requests go to backers who haven&apos;t locked yet (including anyone who declined). Reminders re-ping those
            still pending.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-2">
          <Button onClick={() => send("request")} disabled={busy || !c || c.eligible === 0}>
            <Send className="h-4 w-4 mr-2" />
            Send lock request{c && c.eligible > 0 ? ` to ${c.eligible}` : ""}
          </Button>
          <Button variant="outline" onClick={() => send("remind")} disabled={busy || !c || c.requested === 0}>
            <Bell className="h-4 w-4 mr-2" />
            Remind{c && c.requested > 0 ? ` ${c.requested} pending` : ""}
          </Button>
        </CardContent>
      </Card>

      {/* Backer list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Backers ({data?.total ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : !data || data.backers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No committed backers yet.</p>
          ) : (
            <div className="rounded-lg border divide-y">
              {data.backers.map((b) => {
                const meta = STATUS_META[b.lockStatus];
                const isSending = sendingId === b.pledgeId;
                // Locked backers are done; everyone else can be pinged. A backer
                // already in LOCK_REQUESTED gets a "Remind" (re-ping); others get
                // a fresh "Send lock request".
                const canSend = b.lockStatus !== "LOCKED";
                const sendAction: "request" | "remind" = b.lockStatus === "LOCK_REQUESTED" ? "remind" : "request";
                return (
                  <div key={b.pledgeId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <button
                      type="button"
                      onClick={() => openDetail(b.pledgeId)}
                      className="min-w-0 text-left group"
                      title="View pledge & address details"
                    >
                      <p className="font-medium truncate group-hover:underline">
                        {b.backerNumber != null ? `#${b.backerNumber} ` : ""}{b.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{b.reward || b.email}</p>
                    </button>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={meta.className} variant="secondary">{meta.label}</Badge>
                      {b.lockStatus === "LOCKED" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7"
                          disabled={isSending || busy}
                          onClick={() => unlockOne(b.pledgeId)}
                        >
                          {isSending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <LockOpen className="h-3.5 w-3.5" />
                          )}
                          <span className="ml-1.5">Unlock</span>
                        </Button>
                      ) : canSend ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7"
                          disabled={isSending || busy}
                          onClick={() => sendOne(b.pledgeId, sendAction)}
                        >
                          {isSending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="h-3.5 w-3.5" />
                          )}
                          <span className="ml-1.5">{sendAction === "remind" ? "Remind" : "Send lock request"}</span>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: "muted" | "blue" | "emerald" | "amber" }) {
  const toneCls =
    tone === "emerald" ? "text-emerald-500" : tone === "blue" ? "text-blue-500" : tone === "amber" ? "text-amber-500" : "text-muted-foreground";
  return (
    <div className="rounded-xl border p-3">
      <div className={`flex items-center gap-1.5 text-xs ${toneCls}`}>{icon}<span>{label}</span></div>
      <p className="text-2xl font-bold mt-1">{value.toLocaleString()}</p>
    </div>
  );
}
