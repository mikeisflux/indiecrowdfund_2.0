"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

interface PendingCard {
  id: string;
  title: string;
  status: string;
  hasLegacyCard: boolean;
  editUrl: string;
}

// Asks a creator to (re-)enter their chargeback protection card through the
// DivinityCoin secure form. Shows for campaigns with no card, and for cards
// saved before vaulting — those can't be charged automatically when a
// dispute lands, so the creator would be billed by hand instead.
export function ChargebackCardBanner() {
  const [pending, setPending] = useState<PendingCard[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/creator/chargeback-cards/pending");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setPending(data.pending || []);
      } catch {
        // Banner is a prompt; launch/edit validation still enforces the card.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (pending.length === 0) return null;
  const first = pending[0];
  const reentry = first.hasLegacyCard;

  return (
    <div className="bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-800 px-4 py-3 relative z-40">
      <div className="container flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <ShieldAlert className="h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
          <p className="text-sm text-red-800 dark:text-red-200">
            <strong>{reentry ? "Chargeback card needs re-entry." : "Chargeback card needed."}</strong>{" "}
            <span className="hidden sm:inline">
              {reentry
                ? `We've moved card storage to Divinity Payments' secure vault. Re-enter the protection card for “${first.title}” once so disputes can be handled automatically.`
                : `Add a chargeback protection card for “${first.title}” through the secure form.`}
              {pending.length > 1 ? ` (${pending.length} campaigns.)` : ""}
            </span>
            <span className="sm:hidden">Re-enter it through the secure form.</span>
          </p>
        </div>
        <Link href={`${first.editUrl}?step=payment`} className="flex-shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="border-red-300 dark:border-red-700 text-red-800 dark:text-red-200 hover:bg-red-100 dark:hover:bg-red-900"
          >
            {reentry ? "Re-enter card" : "Add card"}
          </Button>
        </Link>
      </div>
    </div>
  );
}
