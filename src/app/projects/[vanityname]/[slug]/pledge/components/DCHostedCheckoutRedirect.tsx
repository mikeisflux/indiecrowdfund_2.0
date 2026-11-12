"use client";

import { useState } from "react";
import { ExternalLink, Loader2, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

// The non-iframe DivinityCoin checkout: hand the whole browser to DC's
// hosted page and let DC send it back to the pledge page's returnUrl
// (?success=true&pledgeId=…&session_id=…), where usePledge's
// handleSuccessRedirect confirms the session server-side.
//
// Used on iPhone/iPad and in-app browsers. The iframe surface puts the
// card field two cross-origin frames deep (ours → DC's → Stripe's), and
// iOS Safari won't give those inputs keyboard focus; a backer tapped the
// field and nothing happened. DC's own popup workaround is blocked by
// in-app browsers. A plain top-level page has neither problem.
//
// A button rather than an automatic navigation: the Grant Program terms
// and statement-descriptor checks above this must be ticked first, and a
// page that jumps away on its own the moment they are looks like a hijack.
export function DCHostedCheckoutRedirect({ checkoutUrl, total }: { checkoutUrl: string; total: number }) {
  const [leaving, setLeaving] = useState(false);

  const go = () => {
    setLeaving(true);
    window.location.assign(checkoutUrl);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Lock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          Secure payment
        </div>
        <p className="text-sm text-muted-foreground">
          You&apos;ll enter your card on Divinity Payments&apos; secure page, then come straight back here to
          finish. Your card details are never stored on IndieCrowdfund.
        </p>
        <Button
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-12 text-base shadow-lg shadow-emerald-600/20"
          size="lg"
          onClick={go}
          disabled={leaving}
        >
          {leaving ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Opening secure checkout...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              Continue to secure checkout · ${total.toFixed(2)}
            </span>
          )}
        </Button>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span>Encrypted end to end. If you come back without paying, your pledge is not placed.</span>
      </div>
    </div>
  );
}
