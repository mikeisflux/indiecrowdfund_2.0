"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FileSignature } from "lucide-react";
import { GrantAgreementDialog } from "./grant-agreement-dialog";

interface PendingProject {
  id: string;
  title: string;
  status: string;
}

// Prompts a creator to sign the Grant Program agreement for campaigns that
// don't have one on file (campaigns running when the program shipped, or
// ended ones awaiting payout). Renders nothing when there's nothing to sign.
export function GrantAgreementBanner() {
  const [pending, setPending] = useState<PendingProject[]>([]);
  const [signing, setSigning] = useState<PendingProject | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/creator/grant-agreements/pending");
      if (!res.ok) return;
      const data = await res.json();
      setPending(data.pending || []);
    } catch {
      // Non-fatal — banner is a prompt; the payout gate still enforces.
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (pending.length === 0) return null;

  const funded = pending.filter((p) => p.status === "FUNDED");
  const first = funded[0] || pending[0];

  return (
    <div className="bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-800 px-4 py-3 relative z-40">
      <div className="container flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <FileSignature className="h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>Grant agreement needed.</strong>{" "}
            <span className="hidden sm:inline">
              {funded.length > 0
                ? `Sign the Grant Program agreement for “${first.title}” to receive your funds.`
                : `Sign the Grant Program agreement for “${first.title}” now so your payout isn't delayed when the campaign ends.`}
              {pending.length > 1 ? ` (${pending.length} projects need signatures.)` : ""}
            </span>
            <span className="sm:hidden">Sign to receive your funds.</span>
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="flex-shrink-0 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900"
          onClick={() => setSigning(first)}
        >
          Review &amp; sign
        </Button>
      </div>
      {signing && (
        <GrantAgreementDialog
          open={!!signing}
          onOpenChange={(v) => {
            if (!v) setSigning(null);
          }}
          projectId={signing.id}
          projectTitle={signing.title}
          onAccepted={() => {
            setSigning(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
