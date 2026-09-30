"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, XCircle, MessageSquareWarning, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/fetch-utils";
import { toast } from "sonner";

export interface ReviewFeedbackItem {
  reviewId: string;
  projectId: string;
  projectTitle: string;
  editUrl: string;
  action: "REJECTED" | "REQUESTED_CHANGES";
  reasonLabel: string | null;
  nextStep: string;
  notes: string | null;
  reviewedAt: string;
}

// The full-page notice a creator sees on their next visit after a campaign
// was rejected or sent back for changes. Rendered instead of the dashboard
// by the server layout, so it can't be missed. Each item must be
// acknowledged (which records acknowledgedAt) before the dashboard loads;
// the builder keeps showing the same feedback until they resubmit.
export function ReviewFeedbackGate({ feedback: initial }: { feedback: ReviewFeedbackItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  const acknowledge = async (item: ReviewFeedbackItem, thenEdit: boolean) => {
    setBusy(item.reviewId);
    try {
      const res = await apiFetch("/api/creator/review-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId: item.reviewId }),
      });
      if (!res.ok) throw new Error("Could not record that you've read this");
      const remaining = items.filter((i) => i.reviewId !== item.reviewId);
      setItems(remaining);
      if (thenEdit) {
        router.push(item.editUrl);
        return;
      }
      if (remaining.length === 0) router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-muted/30 min-h-[100dvh] sm:px-4 sm:py-8">
      <div className="mx-auto w-full max-w-3xl bg-background border-y sm:rounded-2xl sm:border sm:shadow-xl">
        <div className="border-b px-4 py-5 sm:px-6">
          <h1 className="text-xl font-semibold">Your campaign review needs your attention</h1>
          <p className="text-sm text-muted-foreground mt-1">
            A reviewer looked at your campaign and sent it back. The reason and their notes are below. Read them,
            then go fix the campaign and resubmit it for review.
          </p>
        </div>

        <div className="px-4 sm:px-6 divide-y">
          {items.map((item) => {
            const rejected = item.action === "REJECTED";
            return (
              <div key={item.reviewId} className="py-5 space-y-4">
                <div className="flex items-start gap-3">
                  {rejected ? (
                    <XCircle className="h-6 w-6 shrink-0 text-red-600 mt-0.5" aria-hidden="true" />
                  ) : (
                    <MessageSquareWarning className="h-6 w-6 shrink-0 text-amber-600 mt-0.5" aria-hidden="true" />
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-lg">{item.projectTitle}</p>
                    <p className={rejected ? "text-red-700 font-medium" : "text-amber-700 font-medium"}>
                      {rejected ? "Not approved" : "Changes requested"}
                      {item.reasonLabel ? ` — ${item.reasonLabel}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Reviewed {new Date(item.reviewedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                </div>

                <div className={`rounded-lg border p-4 ${rejected ? "border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900" : "border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900"}`}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    What the reviewer said
                  </p>
                  <p className="whitespace-pre-wrap text-sm">
                    {item.notes || "No additional notes were left. Check the category above and your campaign against the Creator Terms."}
                  </p>
                </div>

                <div className="rounded-lg border p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    What to do next
                  </p>
                  <p className="text-sm">{item.nextStep}</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Your campaign is back in draft. Nothing is visible to backers until it is approved again.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => acknowledge(item, true)} disabled={busy === item.reviewId}>
                    {busy === item.reviewId ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowRight className="h-4 w-4 mr-2" />}
                    I&apos;ve read this — take me to fix it
                  </Button>
                  <Button variant="outline" onClick={() => acknowledge(item, false)} disabled={busy === item.reviewId}>
                    I&apos;ve read this
                  </Button>
                </div>
              </div>
            );
          })}
          {items.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 mx-auto animate-spin mb-2" />
              Loading your dashboard…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
