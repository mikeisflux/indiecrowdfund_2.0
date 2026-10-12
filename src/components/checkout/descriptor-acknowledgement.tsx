"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ShieldAlert, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/fetch-utils";
import {
  DESCRIPTOR_ACK_STATEMENT,
  DESCRIPTOR_TYPED_VALUE,
  STATEMENT_DESCRIPTOR,
  descriptorTypedMatches,
} from "@/lib/payments/descriptor-ack";

// Hard acknowledgement before any payment surface renders: the backer
// types the statement descriptor themselves, and the server records it
// with their IP and browser. Nothing that can run a charge is shown until
// onAcknowledged fires.
export function DescriptorAcknowledgement({
  pledgeId,
  surface,
  onAcknowledged,
}: {
  pledgeId: string | null;
  surface: string;
  onAcknowledged: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  // A new pledge id means a new acknowledgement.
  useEffect(() => {
    setDone(false);
    setTyped("");
  }, [pledgeId]);

  const matches = descriptorTypedMatches(typed);

  const confirm = async () => {
    if (!pledgeId || !matches || saving) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/pledges/${pledgeId}/acknowledge-descriptor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typed: typed.trim(), surface }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not record your acknowledgement");
      setDone(true);
      onAcknowledged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not record your acknowledgement");
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-lg border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800 p-3 flex items-center gap-2 text-sm text-emerald-800 dark:text-emerald-300">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        Statement descriptor confirmed. Your IP address has been logged for this charge.
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border-2 border-red-600 bg-red-50 dark:bg-red-950/40 p-4 space-y-3"
      role="group"
      aria-labelledby="descriptor-ack-title"
    >
      <div className="flex items-start gap-2">
        <ShieldAlert className="h-5 w-5 shrink-0 text-red-700 dark:text-red-400 mt-0.5" aria-hidden="true" />
        <div>
          <p id="descriptor-ack-title" className="font-bold text-red-700 dark:text-red-400 uppercase tracking-wide text-xs">
            Required before payment
          </p>
          <p className="text-red-800 dark:text-red-200 font-semibold leading-snug mt-1">
            {DESCRIPTOR_ACK_STATEMENT}
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="descriptor-ack-input" className="text-red-800 dark:text-red-200 font-medium">
          Type <span className="font-mono font-bold">{DESCRIPTOR_TYPED_VALUE}</span> to confirm
        </Label>
        <div className="flex gap-2">
          <Input
            id="descriptor-ack-input"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                confirm();
              }
            }}
            placeholder={DESCRIPTOR_TYPED_VALUE}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            className={`font-mono bg-white dark:bg-background border-red-400 focus-visible:ring-red-500 ${matches ? "border-emerald-500" : ""}`}
            aria-invalid={typed.length > 0 && !matches}
            disabled={!pledgeId || saving}
          />
          <Button
            type="button"
            onClick={confirm}
            disabled={!pledgeId || !matches || saving}
            className="bg-red-700 hover:bg-red-800 text-white shrink-0"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "I acknowledge"}
          </Button>
        </div>
        <p className="text-xs text-red-700 dark:text-red-300">
          Your card statement will show <span className="font-mono font-bold">{STATEMENT_DESCRIPTOR}</span>.
          {!pledgeId ? " Setting up your pledge…" : typed.length > 0 && !matches ? " That doesn't match yet." : ""}
        </p>
      </div>
    </div>
  );
}
