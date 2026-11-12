"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/fetch-utils";
import { format } from "date-fns";

interface Attempt {
  id: string;
  paymentId: string;
  pledgeId: string | null;
  amountCents: number;
  purpose: string;
  requestedBy: string;
  status: string;
  error: string | null;
  createdAt: string;
  pledge: { user: { email: string; name: string | null }; project: { title: string } } | null;
}

// Refunds DivinityCoin never answered. Each one blocks any further refund of
// its payment until the admin looks it up in DC's dashboard and records
// what actually happened. Rendered only when there is something to review.
export function UncertainRefundsPanel({ formatCurrency }: { formatCurrency: (n: number) => string }) {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/dc-refund-attempts", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      setAttempts(data.attempts || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const reconcile = async (a: Attempt, refunded: boolean) => {
    const refundId = refunded ? prompt(`Refund id from the DC dashboard for payment ${a.paymentId} (optional):`) ?? "" : "";
    if (refunded && refundId === null) return;
    setBusy(a.id);
    try {
      const res = await apiFetch("/api/admin/dc-refund-attempts", { method: "POST", json: { attemptId: a.id, refunded, refundId } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed");
      toast.success(refunded ? "Recorded as refunded; payment unblocked" : "Recorded as not refunded; payment unblocked");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  };

  if (!loading && attempts.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-800 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <h3 className="font-semibold">Refunds needing a look</h3>
            <p className="text-xs text-muted-foreground">
              DivinityCoin gave no answer to these. The money may or may not have moved. Open the payment in the DC
              dashboard, then record what you see. Until then nothing else can refund that payment.
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>
      {loading && attempts.length === 0 ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : (
        <div className="divide-y">
          {attempts.map((a) => (
            <div key={a.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 text-sm">
                <p className="font-medium">
                  {formatCurrency(a.amountCents / 100)} · {a.purpose} · <span className="font-mono text-xs">{a.paymentId}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {a.pledge ? `${a.pledge.project.title} · ${a.pledge.user.name || a.pledge.user.email}` : a.pledgeId || "no pledge"} ·{" "}
                  {format(new Date(a.createdAt), "MMM d, h:mm a")} · by {a.requestedBy}
                </p>
                {a.error && <p className="text-xs text-amber-700 dark:text-amber-400">{a.error}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" variant="outline" disabled={busy === a.id} onClick={() => reconcile(a, true)}>
                  {busy === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                  It was refunded
                </Button>
                <Button size="sm" variant="outline" disabled={busy === a.id} onClick={() => reconcile(a, false)}>
                  <XCircle className="h-3 w-3 mr-1" />
                  It was not
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
