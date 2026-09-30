"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldAlert, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/fetch-utils";
import { ChargebackCardSection } from "@/components/project/builder/payment-sections/chargeback-card-section";
import type { ChargebackCardStatus } from "@/components/project/builder/payment-sections/types";

interface PendingCard {
  id: string;
  title: string;
  status: string;
  hasLegacyCard: boolean;
}

// The blocking chargeback-card prompt a creator sees when any launched or
// launch-ready campaign has no card in the DivinityCoin vault.
//
// Rendered INSTEAD OF the dashboard by the server layout, same as the Terms
// gate: the protected pages are never sent to the browser until every
// campaign's card is verified. There is no dismiss control. The way out is
// to save the card(s), or to sign out.
export function ChargebackCardGate({ pending: initial }: { pending: PendingCard[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingCard[]>(initial);
  const [statuses, setStatuses] = useState<Record<string, ChargebackCardStatus>>({});
  const [signingOut, setSigningOut] = useState(false);
  const [checking, setChecking] = useState(false);

  // One status object per campaign so each embedded form is independent.
  useEffect(() => {
    setStatuses((prev) => {
      const next = { ...prev };
      for (const p of pending) {
        if (!next[p.id]) {
          next[p.id] = {
            saved: p.hasLegacyCard,
            loading: false,
            vaulted: false,
            lastFour: null,
            brand: null,
            expMonth: null,
            expYear: null,
          };
        }
      }
      return next;
    });
  }, [pending]);

  const recheck = useCallback(async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/creator/chargeback-cards/pending", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const still: PendingCard[] = data.pending || [];
      setPending(still);
      if (still.length === 0) {
        // The gate is decided on the server; re-render from there.
        router.refresh();
      }
    } finally {
      setChecking(false);
    }
  }, [router]);

  // When a form reports vaulted, re-ask the server which campaigns remain.
  useEffect(() => {
    const anyVaulted = pending.some((p) => statuses[p.id]?.vaulted);
    if (anyVaulted) recheck();
    // statuses is the trigger; pending/recheck are stable enough per render.
  }, [statuses, pending, recheck]);

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

  const remaining = pending.filter((p) => !statuses[p.id]?.vaulted);

  return (
    <div className="bg-muted/30 min-h-[100dvh] sm:px-4 sm:py-8">
      <div className="mx-auto w-full max-w-3xl bg-background border-y sm:rounded-2xl sm:border sm:shadow-xl">
        <div className="border-b px-4 py-5 sm:px-6">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-6 w-6 shrink-0 text-red-600 mt-0.5" aria-hidden="true" />
            <div>
              <h1 className="text-xl font-semibold">Verify your chargeback protection card to continue</h1>
              <p className="text-sm text-muted-foreground mt-1">
                We&apos;ve moved card storage to Divinity Payments&apos; secure vault. Your card number and security
                code go directly to Divinity Payments and are never stored on IndieCrowdfund. Each campaign below
                needs its card entered once before you can use your dashboard. Nothing is charged now; the card is
                only used if a backer&apos;s bank reverses a pledge.
              </p>
            </div>
          </div>
        </div>

        <div className="px-4 py-2 sm:px-6 divide-y">
          {pending.map((p) => {
            const status = statuses[p.id];
            if (!status) return null;
            return (
              <div key={p.id} className="py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{p.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.status === "LIVE" ? "Live campaign" : p.status === "FUNDED" ? "Funded campaign" : p.status === "PAUSED" ? "Paused campaign" : "Ready to launch"}
                    </p>
                  </div>
                  {status.vaulted && (
                    <span className="flex items-center gap-1 text-sm text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" /> Verified
                    </span>
                  )}
                </div>
                {!status.vaulted && (
                  <ChargebackCardSection
                    projectId={p.id}
                    chargebackCardStatus={status}
                    setChargebackCardStatus={(update) =>
                      setStatuses((prev) => ({
                        ...prev,
                        [p.id]: typeof update === "function" ? update(prev[p.id]) : update,
                      }))
                    }
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="border-t px-4 py-4 sm:px-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {remaining.length === 0
              ? "All set — loading your dashboard…"
              : `${remaining.length} campaign${remaining.length === 1 ? "" : "s"} still need${remaining.length === 1 ? "s" : ""} a verified card.`}
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
