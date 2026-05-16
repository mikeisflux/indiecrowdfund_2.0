"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
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
//                  "canceled") and a redirectUrl.
//
// Default DC behavior on complete: top-nav the browser to redirectUrl
// (which would unmount the iframe + reload the whole page). To keep
// the user inline on our pledge wizard's success step, we
// synchronously remove the iframe from the DOM the moment the
// "complete" message fires — DC's docs confirm a synchronous handler
// runs before their nav and removal aborts it. We use ReactDOM.flushSync
// so the React unmount commits in the same tick the message handler
// runs in.
//
// Mobile WebKit (iOS Safari + in-app webviews) is handled entirely
// inside DC's iframe — they detect UA, render a "Continue securely"
// button, open the same checkout URL in a top-level popup, and post
// the same "complete" message back from the popup. We don't need to
// detect platform or change UI.
//
// The "Open in a new tab" fallback link below the iframe is a
// belt-and-suspenders escape for users who hit unusual browser
// behavior — same checkout URL, just as a top-level redirect. On
// return, the existing handleSuccessRedirect picks up DC's
// ?session_id query param and dispatches /confirm-dc-checkout there.

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
  // Drives the iframe's presence in JSX. flushSync({ () => setShowIframe(false) })
  // commits the unmount synchronously in the same tick the message
  // arrives, which aborts DC's top-nav.
  const [showIframe, setShowIframe] = useState(true);
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
        // Synchronously unmount the iframe so DC's queued top-nav
        // sees no iframe to nav and bails. flushSync forces React to
        // commit the unmount in this same tick instead of batching.
        flushSync(() => setShowIframe(false));
        // Now async: verify + transition the wizard.
        handleComplete(msg.status);
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [sessionId, handleComplete]);

  return (
    <div className="space-y-3">
      {showIframe ? (
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
      ) : (
        // Iframe was torn down by a complete message. The parent
        // wizard transitions to its success step within a few hundred
        // ms (after /confirm-dc-checkout responds), so this fallback
        // copy is mostly cosmetic — it's only visible during the
        // brief window between iframe-removal and wizard transition.
        <div className="flex flex-col items-center justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Finalizing your pledge...</p>
        </div>
      )}

      {showIframe && (
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
