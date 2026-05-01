"use client";

import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Printer } from "lucide-react";

// PrintingComics integration stub. The provider's developer docs
// (https://printingcomics.com/developers) need to be reviewed before
// the actual API client + order-submission flow can be wired — this
// page is intentionally a placeholder so the link in the Fulfillment
// nav surfaces the BETA warning before a creator can attempt anything.
//
// When the real integration lands, the rest of this component will
// host: account-link form (API key), project defaults (paper stock,
// finish, page count), batch submission table reading from
// Pledge rows whose status is COMPLETED / chargedImmediately, plus
// status-sync wiring backed by a webhook receiver under
// /api/webhooks/printingcomics.
export function PrintingComicsTab() {
  return (
    <div className="space-y-4">
      {/* Beta warning — must be the FIRST thing the creator sees so
          they don't click through into a half-wired flow and submit a
          real order against a production endpoint. */}
      <div
        role="alert"
        className="flex items-start gap-3 p-4 rounded-lg border-2 border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20"
      >
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" aria-hidden="true" />
        <div className="space-y-1">
          <p className="font-semibold text-amber-900 dark:text-amber-200">
            This is in the testing phase. Do not place an order.
          </p>
          <p className="text-sm text-amber-800 dark:text-amber-300">
            The Printing Comics integration is not yet live. Anything you
            submit here will not actually print or ship. We&apos;ll lift
            this banner once the provider integration has been verified
            end-to-end.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="py-12 flex flex-col items-center text-center space-y-3">
          <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
            <Printer className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
          <h3 className="text-lg font-semibold">Printing Comics — Beta</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Coming soon: connect your Printing Comics account, set
            project-wide print defaults (paper, finish, page count),
            then batch-submit print jobs straight from your fulfillment
            dashboard. Status updates will sync back onto your backer
            list automatically.
          </p>
          <p className="text-xs text-muted-foreground">
            Provider docs:{" "}
            <a
              href="https://printingcomics.com/developers"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              printingcomics.com/developers
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
