"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/fetch-utils";

// Embeds DC's white-label hosted checkout page in an iframe on our
// pledge step so the user never visually leaves indiecrowdfund.com.
//
// DC drives the embed via a postMessage protocol — no polling on our
// side. Messages share `namespace: "divinitycoin-checkout"` and
// `sessionId`. Three event types:
//   - "ready"    — iframe mounted, ok to drop the loading veil.
//   - "resize"   — content height changed; mirror onto the iframe.
//   - "complete" — session reached a terminal state; payload includes
//                  status ("complete" | "failed" | "expired" |
//                  "canceled"), redirectUrl, and (sanity-check)
//                  disableAutoRedirect echoed from the session create.
//
// Nav: the session is created with `disableAutoRedirect: true` so DC
// does NOT top-nav the browser on completion. Their "complete"
// postMessage still fires and our handler owns the transition (hide
// the iframe, server-verify via /confirm-dc-checkout, advance the
// wizard to its success step). If we ever forget to set the flag,
// DC's nav fires synchronously in the same tick as the postMessage
// — no client-side trick (flushSync, removeChild) reliably suppresses
// it. So we treat the echoed flag as load-bearing and log a warning
// if it ever comes back false.
//
// Mobile WebKit (iOS Safari, in-app webviews) is handled inside DC's
// iframe — they detect UA, render a "Continue securely" button, open
// the same session in a top-level popup, and post the result back
// into the iframe. Same "complete" event lands here regardless of
// platform. We don't detect platform or change UI.
//
// No "open in new tab" fallback link: with disableAutoRedirect on,
// any user who completes in a separate top-level tab is stranded on
// DC's success page with no way back (and our wizard would still
// show the broken iframe). The frame-ancestors allowlist on DC's
// side is the actual fix; this component depends on that working.

interface DCHostedCheckoutFrameProps {
  checkoutUrl: string;
  pledgeId: string;
  sessionId: string;
  onSuccess: () => void;
  onFailure: (message: string) => void;
}

const DC_ORIGIN = "https://divinitycoin.com";
const DC_NAMESPACE = "divinitycoin-checkout";
// Initial height before DC's first resize event lands. DC's snippet
// example uses 480px; we match.
const INITIAL_IFRAME_HEIGHT = 480;

type DcMessage =
  | { namespace: typeof DC_NAMESPACE; type: "ready"; sessionId: string }
  | { namespace: typeof DC_NAMESPACE; type: "resize"; sessionId: string; height: number }
  | {
      namespace: typeof DC_NAMESPACE;
      type: "complete";
      sessionId: string;
      status: "complete" | "failed" | "expired" | "canceled";
      redirectUrl?: string;
      disableAutoRedirect?: boolean;
    };

function isDcMessage(data: unknown): data is DcMessage {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return d.namespace === DC_NAMESPACE && typeof d.type === "string";
}

export default function DCHostedCheckoutFrame({
  checkoutUrl,
  pledgeId,
  sessionId,
  onSuccess,
  onFailure,
}: DCHostedCheckoutFrameProps) {
  const [iframeReady, setIframeReady] = useState(false);
  const [iframeHeight, setIframeHeight] = useState(INITIAL_IFRAME_HEIGHT);
  // Latch so a late-arriving duplicate complete (rare DC retry) doesn't
  // double-fire onSuccess / onFailure.
  const finishedRef = useRef(false);

  const handleComplete = useCallback(
    async (status: "complete" | "failed" | "expired" | "canceled") => {
      if (finishedRef.current) return;
      finishedRef.current = true;

      // For terminal failure states the message itself is authoritative —
      // no server verification needed, just surface the reason.
      if (status === "failed") {
        onFailure("Your card couldn't be processed. Please try a different card.");
        return;
      }
      if (status === "expired") {
        onFailure("Checkout session expired. Please start a new pledge.");
        return;
      }
      if (status === "canceled") {
        onFailure("Checkout was cancelled. Your pledge wasn't completed.");
        return;
      }

      // status === "complete". Server-verify via /confirm-dc-checkout —
      // for SETUP-mode this also runs commitDcPledge so the project
      // counters bump before we transition the wizard. For PAYMENT-mode
      // the route just acknowledges; payment.succeeded webhook commits
      // independently. Either way, ok=true means it's safe to show
      // success; the checkout.completed webhook is an idempotent
      // parallel commit.
      try {
        const res = await apiFetch(`/api/pledges/${pledgeId}/confirm-dc-checkout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) {
          onSuccess();
          return;
        }
        // 202 pendingWebhook (PAYMENT mode race with webhook) — treat
        // as success; webhook commits within a couple seconds.
        if (res.status === 202) {
          onSuccess();
          return;
        }
        onFailure(data.message || data.error || "We couldn't finalize your pledge. Please contact support.");
      } catch (err) {
        onFailure(err instanceof Error ? err.message : "Network error finalizing pledge.");
      }
    },
    [pledgeId, sessionId, onSuccess, onFailure]
  );

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== DC_ORIGIN) return;
      if (!isDcMessage(event.data)) return;
      // Stale messages from a previous session (e.g. user navigated
      // backward and resumed) — ignore.
      if (event.data.sessionId !== sessionId) return;

      const msg = event.data;

      if (msg.type === "ready") {
        setIframeReady(true);
        return;
      }

      if (msg.type === "resize") {
        if (typeof msg.height === "number" && msg.height > 0) {
          setIframeHeight(msg.height);
        }
        return;
      }

      if (msg.type === "complete") {
        // Sanity check: we created the session with
        // disableAutoRedirect: true. If DC echoes back false here,
        // their nav is about to fire and yank us off the page —
        // surface it so we catch the regression. Doesn't block our
        // handler from running.
        if (msg.disableAutoRedirect === false) {
          console.warn(
            "[DCHostedCheckoutFrame] DC reported disableAutoRedirect=false on complete — DC may be about to top-nav the browser. Check session creation payload."
          );
        }
        handleComplete(msg.status);
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [sessionId, handleComplete]);

  return (
    <div className="space-y-3">
      <div className="relative w-full overflow-hidden rounded-lg border border-border bg-card">
        {!iframeReady && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/95 z-10">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Loading secure checkout...</p>
          </div>
        )}
        <iframe
          src={checkoutUrl}
          title="Secure checkout"
          allow="payment *; publickey-credentials-get *"
          className="block w-full"
          style={{ height: `${iframeHeight}px`, border: "none", transition: "height 200ms ease" }}
        />
      </div>
    </div>
  );
}
