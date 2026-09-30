"use client";

import { useEffect, useState } from "react";
import { XCircle, MessageSquareWarning } from "lucide-react";
import type { ReviewFeedbackItem } from "./review-feedback-gate";

// Persistent notice at the top of the campaign builder while a rejected /
// sent-back campaign is still in draft. The login gate shows the feedback
// once; this keeps it in front of the creator while they fix the campaign,
// and disappears on resubmission.
export function ReviewFeedbackBanner({ projectId }: { projectId: string | null }) {
  const [item, setItem] = useState<ReviewFeedbackItem | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/creator/review-feedback?projectId=${encodeURIComponent(projectId)}&includeAcknowledged=1`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setItem(data.feedback?.[0] || null);
      } catch {
        // Informational only.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (!item) return null;
  const rejected = item.action === "REJECTED";

  return (
    <div className={`container mt-4`}>
      <div
        className={`rounded-lg border p-4 flex gap-3 ${
          rejected
            ? "border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900"
            : "border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900"
        }`}
        role="alert"
      >
        {rejected ? (
          <XCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" aria-hidden="true" />
        ) : (
          <MessageSquareWarning className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" aria-hidden="true" />
        )}
        <div className="min-w-0 text-sm">
          <p className="font-semibold">
            {rejected ? "This campaign was not approved" : "The reviewer asked for changes"}
            {item.reasonLabel ? ` — ${item.reasonLabel}` : ""}
          </p>
          {item.notes && <p className="mt-1 whitespace-pre-wrap">{item.notes}</p>}
          <p className="mt-1 text-muted-foreground">{item.nextStep}</p>
        </div>
      </div>
    </div>
  );
}
