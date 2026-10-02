"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, RefreshCw, Ban, CheckCircle, AlertTriangle, Clock } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/fetch-utils";
import { format } from "date-fns";

interface Recoup {
  id: string;
  pledgeId: string | null;
  kind: "CHARGEBACK" | "OVERPAYMENT";
  disputeId: string | null;
  reason: string | null;
  disputedAmount: number;
  feeAmount: number;
  amount: number;
  status: "PENDING" | "CHARGED" | "FAILED" | "HELD_BACK" | "WAIVED" | "WRITTEN_OFF";
  attempts: number;
  nextAttemptAt: string | null;
  lastError: string | null;
  paymentId: string | null;
  chargedAt: string | null;
  waivedReason: string | null;
  createdAt: string;
  backerNumber: number | null;
  backerName: string | null;
}

const STATUS_BADGE: Record<Recoup["status"], { label: string; className: string; icon: typeof Clock }> = {
  PENDING: { label: "Charging…", className: "bg-blue-100 text-blue-700", icon: Clock },
  CHARGED: { label: "Recouped", className: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
  FAILED: { label: "Card failed — retrying", className: "bg-amber-100 text-amber-700", icon: AlertTriangle },
  HELD_BACK: { label: "Withheld from payout", className: "bg-red-100 text-red-700", icon: Ban },
  WAIVED: { label: "Waived", className: "bg-muted text-muted-foreground", icon: Ban },
  WRITTEN_OFF: { label: "Internal loss (written off)", className: "bg-red-100 text-red-700", icon: Ban },
};

// Chargeback recoups for one project, with the two admin overrides:
// charge the card again right now, or waive the amount.
export function RecoupPanel({
  projectId,
  formatCurrency,
  canCharge,
}: {
  projectId: string;
  formatCurrency: (amount: number) => string;
  canCharge: boolean;
}) {
  const [recoups, setRecoups] = useState<Recoup[] | null>(null);
  const [fee, setFee] = useState<number>(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [waiving, setWaiving] = useState<string | null>(null);
  const [waiveReason, setWaiveReason] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/chargeback-recoups?projectId=${encodeURIComponent(projectId)}`);
      if (!res.ok) return;
      const data = await res.json();
      setRecoups(data.recoups || []);
      setFee(data.fee || 0);
    } catch {
      setRecoups([]);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const charge = async (recoupId: string) => {
    setBusy(recoupId);
    try {
      const res = await apiFetch("/api/admin/chargeback-recoups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "charge", recoupId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Charge failed");
      if (data.ok) toast.success("Recouped from the creator's card");
      else toast.error(`Charge did not go through: ${data.error || data.status}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Charge failed");
    } finally {
      setBusy(null);
    }
  };

  const waive = async (recoupId: string) => {
    if (!waiveReason.trim()) {
      toast.error("Give a reason for the waiver");
      return;
    }
    setBusy(recoupId);
    try {
      const res = await apiFetch("/api/admin/chargeback-recoups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "waive", recoupId, reason: waiveReason.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Waive failed");
      toast.success("Recoup waived");
      setWaiving(null);
      setWaiveReason("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Waive failed");
    } finally {
      setBusy(null);
    }
  };

  if (recoups === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading chargeback recoups…
      </div>
    );
  }
  if (recoups.length === 0) {
    return <p className="text-sm text-muted-foreground">No chargebacks on this campaign.</p>;
  }

  return (
    <div className="space-y-2">
      {recoups.map((r) => {
        const badge = STATUS_BADGE[r.status];
        const Icon = badge.icon;
        const open = r.status === "FAILED" || r.status === "HELD_BACK" || r.status === "PENDING";
        return (
          <div key={r.id} className="rounded-lg border p-3 text-sm space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">
                  {r.kind === "OVERPAYMENT"
                    ? "Overpaid balance"
                    : `${r.backerNumber ? `Backer #${r.backerNumber}` : "Backer"}${r.backerName ? ` · ${r.backerName}` : ""}`}
                  {" · "}{formatCurrency(r.amount)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.kind === "OVERPAYMENT"
                    ? "Paid out, then refunds/chargebacks left this owed back"
                    : `${formatCurrency(r.disputedAmount)} disputed + ${formatCurrency(r.feeAmount)} fee`}
                  {r.reason ? ` · ${r.reason}` : ""}
                  {r.disputeId ? ` · ${r.disputeId}` : ""}
                  {" · "}opened {format(new Date(r.createdAt), "MMM d, yyyy")}
                </p>
                {r.status === "CHARGED" && r.chargedAt && (
                  <p className="text-xs text-emerald-700">
                    Charged {format(new Date(r.chargedAt), "MMM d, yyyy h:mm a")}
                    {r.paymentId ? ` · ${r.paymentId}` : ""}
                  </p>
                )}
                {(r.status === "FAILED" || r.status === "HELD_BACK") && (
                  <p className="text-xs text-red-600">
                    {r.attempts} attempt{r.attempts === 1 ? "" : "s"}
                    {r.lastError ? ` · last: ${r.lastError}` : ""}
                    {r.nextAttemptAt ? ` · next retry ${format(new Date(r.nextAttemptAt), "MMM d")}` : ""}
                  </p>
                )}
                {(r.status === "WAIVED" || r.status === "WRITTEN_OFF") && r.waivedReason && (
                  <p className="text-xs text-muted-foreground">{r.status === "WRITTEN_OFF" ? "Written off" : "Waived"}: {r.waivedReason}</p>
                )}
              </div>
              <Badge className={badge.className}>
                <Icon className="w-3 h-3 mr-1" />
                {badge.label}
              </Badge>
            </div>
            {open && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === r.id || !canCharge}
                  title={canCharge ? undefined : "No verified card on file — the creator must re-enter it first"}
                  onClick={() => charge(r.id)}
                >
                  {busy === r.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                  Charge card now
                </Button>
                {waiving === r.id ? (
                  <>
                    <Input
                      value={waiveReason}
                      onChange={(e) => setWaiveReason(e.target.value)}
                      placeholder="Reason (required)"
                      className="h-8 w-56"
                      maxLength={200}
                    />
                    <Button size="sm" variant="destructive" disabled={busy === r.id} onClick={() => waive(r.id)}>
                      Confirm waive
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setWaiving(null)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => setWaiving(r.id)}>
                    <Ban className="h-3 w-3 mr-1" />
                    Waive
                  </Button>
                )}
              </div>
            )}
          </div>
        );
      })}
      <p className="text-[11px] text-muted-foreground">
        Dispute fee passed through to creators: {formatCurrency(fee)}. Collected amounts are credited back into the balance above.
      </p>
    </div>
  );
}
