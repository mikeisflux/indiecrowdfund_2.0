"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, AlertTriangle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/fetch-utils";

// Embeds DC's white-label hosted checkout page
// (https://divinitycoin.com/checkout/cs_...) inside an iframe on our
// pledge step so the user never visually leaves indiecrowdfund.com.
//
// Why an iframe instead of a full-page redirect:
//   - UX continuity: the pledge wizard surrounds the card form just
//     like the prior Stripe-Elements integration did. No third-party
//     URL in the address bar, no jarring nav transition.
//   - Stripe stays hidden from our origin's network tab: the iframe
//     loads divinitycoin.com, and any Stripe.js it pulls in is on
//     DC's origin, not ours.
//
// Completion model: we poll
// POST /api/pledges/[id]/confirm-dc-checkout every POLL_INTERVAL_MS.
// That route calls DC's get-checkout-session and returns:
//   200 + { ok: true }          → success, fire onSuccess
//   202 + { status: "pending" } → still in-flight, keep polling
//   400 + { status: "failed"|"expired"|"canceled" } → fire onFailure
//
// Iframe-blocked fallback: if DC ever sets X-Frame-Options: DENY or
// a frame-ancestors that doesn't include indiecrowdfund.com, the
// iframe paints blank and the user gets stuck. Below the iframe we
// always show a "Trouble loading? Open on DivinityCoin" link that
// does a full-page redirect — same destination, just without the
// embed. Belt-and-suspenders: an onError-style detector kicks the
// user there automatically if the iframe hasn't reported a load
// event after IFRAME_DETECT_MS.

interface DCHostedCheckoutFrameProps {
  checkoutUrl: string;
  pledgeId: string;
  sessionId: string;
  onSuccess: () => void;
  onFailure: (message: string) => void;
}

const POLL_INTERVAL_MS = 3000;
const IFRAME_DETECT_MS = 12000; // give DC ~12s to paint before assuming a frame block

export default function DCHostedCheckoutFrame({
  checkoutUrl,
  pledgeId,
  sessionId,
  onSuccess,
  onFailure,
}: DCHostedCheckoutFrameProps) {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeMaybeBlocked, setIframeMaybeBlocked] = useState(false);
  const finishedRef = useRef(false);

  // Pings the confirm endpoint to check if DC's session is in a
  // terminal state yet. Returns true if polling should stop (terminal
  // outcome reached or non-retriable error), false to keep polling.
  const checkOnce = useCallback(async (): Promise<boolean> => {
    if (finishedRef.current) return true;
    try {
      const res = await apiFetch(`/api/pledges/${pledgeId}/confirm-dc-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.ok) {
        finishedRef.current = true;
        onSuccess();
        return true;
      }

      // 202 = still pending. Keep polling silently.
      if (res.status === 202) return false;

      // 400 with a terminal status — fail the flow with the
      // server-provided message (already cardholder-friendly).
      if (!res.ok && (data.status === "failed" || data.status === "expired" || data.status === "canceled")) {
        finishedRef.current = true;
        onFailure(data.message || `Checkout ${data.status}`);
        return true;
      }

      // 502 (DC down) or other transient — keep polling and let
      // the user retry; the timeout in the parent will eventually
      // surface a generic error.
      return false;
    } catch {
      // Network blip — keep polling.
      return false;
    }
  }, [pledgeId, sessionId, onSuccess, onFailure]);

  // Polling loop. Starts immediately on mount; cleans up on unmount.
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (stopped) return;
      const done = await checkOnce();
      if (done || stopped) return;
      timer = setTimeout(tick, POLL_INTERVAL_MS);
    };

    // Wait one poll interval before the first check so we don't slam
    // DC with a confirm before the user has even seen the iframe.
    timer = setTimeout(tick, POLL_INTERVAL_MS);

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [checkOnce]);

  // Iframe-block detector: cross-origin iframes can't be inspected
  // for X-Frame-Options / CSP violations directly, so we rely on the
  // load event firing within a reasonable window. If it doesn't, we
  // flag the iframe as "maybe blocked" and surface a more prominent
  // fallback CTA. (Note: this is a UX nudge — a determined user can
  // always click the persistent "Open on DivinityCoin" link below
  // the iframe.)
  useEffect(() => {
    if (iframeLoaded) return;
    const t = setTimeout(() => {
      if (!iframeLoaded && !finishedRef.current) {
        setIframeMaybeBlocked(true);
      }
    }, IFRAME_DETECT_MS);
    return () => clearTimeout(t);
  }, [iframeLoaded]);

  return (
    <div className="space-y-3">
      <div className="relative w-full overflow-hidden rounded-lg border border-border bg-card">
        {!iframeLoaded && !iframeMaybeBlocked && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/95 z-10">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Loading secure checkout...</p>
          </div>
        )}
        <iframe
          src={checkoutUrl}
          className="block w-full"
          style={{ height: "min(720px, 80vh)", border: "none" }}
          title="Secure checkout"
          allow="payment"
          onLoad={() => setIframeLoaded(true)}
        />
      </div>

      {iframeMaybeBlocked ? (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-medium text-amber-900 dark:text-amber-100">
              Trouble loading the secure checkout?
            </p>
            <p className="text-amber-800 dark:text-amber-200 mt-1">
              Click below to complete your pledge in a new tab. We&apos;ll
              update your pledge automatically when you finish.
            </p>
            <Button
              variant="outline"
              className="mt-3"
              onClick={() => window.open(checkoutUrl, "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open secure checkout in a new tab
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center">
          Having trouble?{" "}
          <button
            type="button"
            className="underline hover:text-foreground transition-colors"
            onClick={() => window.open(checkoutUrl, "_blank", "noopener,noreferrer")}
          >
            Open secure checkout in a new tab
          </button>
        </p>
      )}
    </div>
  );
}
