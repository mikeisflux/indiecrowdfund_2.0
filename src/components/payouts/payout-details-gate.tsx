"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Landmark, CheckCircle2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/fetch-utils";
import { PayoutBankForm } from "./payout-bank-form";

export interface PendingPayoutAccountView {
  processor: string;
  label: string;
  exists: boolean;
  missing: string[];
  prefill: { bankName: string | null; accountType: string | null; bankCountry: string | null; lastFour: string | null };
  projects: { id: string; title: string; status: string }[];
  saveUrl: string;
}

// The blocking "finish your payout details" screen.
//
// Rendered INSTEAD OF the dashboard by the server layout, like the Terms and
// chargeback-card gates: nothing under /dashboard is sent to the browser
// until every payout account is complete. No dismiss control; the way out is
// to save, or to sign out. Applies to every creator on their next visit, so
// legacy accounts saved before the billing address was required are caught
// without anyone having to notice at settlement time.
export function PayoutDetailsGate({ pending: initial }: { pending: PendingPayoutAccountView[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(initial);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [checking, setChecking] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const recheck = useCallback(async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/creator/payout-details/pending", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const still: PendingPayoutAccountView[] = data.pending || [];
      setPending(still);
      if (still.length === 0) router.refresh();
    } finally {
      setChecking(false);
    }
  }, [router]);

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Leaving matters more than a clean response.
    }
    window.location.href = "/";
  };

  const remaining = pending.filter((p) => !done[p.processor]);

  return (
    <div className="bg-muted/30 min-h-[100dvh] sm:px-4 sm:py-8">
      <div className="mx-auto w-full max-w-3xl bg-background border-y sm:rounded-2xl sm:border sm:shadow-xl">
        <div className="border-b px-4 py-5 sm:px-6">
          <div className="flex items-start gap-3">
            <Landmark className="h-6 w-6 shrink-0 text-amber-600 mt-0.5" aria-hidden="true" />
            <div>
              <h1 className="text-xl font-semibold">Finish your payout details to continue</h1>
              <p className="text-sm text-muted-foreground mt-1">
                We can&apos;t send you a settlement until your payout account is complete. Banks require a full
                billing address on the payee record. This takes about a minute, and your dashboard unlocks as soon as
                it&apos;s saved.
              </p>
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <Lock className="h-3 w-3" /> Encrypted at rest and used only to process your payouts.
              </p>
            </div>
          </div>
        </div>

        <div className="px-4 py-2 sm:px-6 divide-y">
          {pending.map((p) => (
            <div key={p.processor} className="py-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <p className="font-medium">{p.label} payout account</p>
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    {p.exists ? `Missing: ${p.missing.join(", ")}` : "No bank account on file"}
                  </p>
                  {p.projects.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      Pays out {p.projects.map((pr) => `“${pr.title}”`).join(", ")}
                    </p>
                  )}
                </div>
                {done[p.processor] && (
                  <span className="flex items-center gap-1 text-sm text-emerald-700 shrink-0">
                    <CheckCircle2 className="h-4 w-4" /> Saved
                  </span>
                )}
              </div>
              {!done[p.processor] && (
                <PayoutBankForm
                  idPrefix={`gate-${p.processor.toLowerCase()}`}
                  saveUrl={p.saveUrl}
                  hasExisting={p.exists}
                  prefill={p.prefill}
                  onSaved={() => {
                    setDone((d) => ({ ...d, [p.processor]: true }));
                    recheck();
                  }}
                />
              )}
            </div>
          ))}
        </div>

        <div className="border-t px-4 py-4 sm:px-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {remaining.length === 0
              ? "All set — loading your dashboard…"
              : `${remaining.length} payout account${remaining.length === 1 ? "" : "s"} still need${remaining.length === 1 ? "s" : ""} attention.`}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={signOut} disabled={signingOut}>
              {signingOut ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Sign out
            </Button>
            <Button size="sm" onClick={recheck} disabled={checking || remaining.length > 0}>
              {checking ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Continue to dashboard
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
