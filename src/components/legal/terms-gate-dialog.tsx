"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { apiFetch } from "@/lib/fetch-utils";
import { TermsOfServiceContent, TERMS_VERSION } from "./terms-of-service";

// The blocking Terms prompt a creator sees when the Terms have changed.
//
// Rendered *instead of* the dashboard by the server layout, not layered over
// it. A modal on top of the real page can be escaped — close it, hit Escape,
// disable JavaScript — and an agreement you can click past is not an
// agreement. This way the protected content is never sent to the browser at
// all until there is an acceptance on file.
//
// There is no dismiss control on purpose. The way out is to accept, or to
// leave via Sign out / the public site.
// Sign-out used to be an <a href="/api/auth/signout">. That route does not
// exist on this app, and the one that does — /api/auth/logout — is POST-only,
// so a link could never have worked either way. A creator who did not want to
// accept the new Terms had no way out of the gate at all. It is a real POST
// now, with a fallback to the home page if the request fails.
export function TermsGateDialog({ signOutHref }: { signOutHref?: string }) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    // An override is treated as a plain destination, so callers can still send
    // someone somewhere specific.
    if (signOutHref) {
      window.location.href = signOutHref;
      return;
    }
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Leaving matters more than a clean response — fall through and go.
    }
    window.location.href = "/";
  };

  const accept = async () => {
    setSaving(true);
    try {
      const res = await apiFetch("/api/legal/terms-acceptance", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not record your acceptance");
      }
      // The gate is decided on the server, so re-render from there rather than
      // hiding this component locally — that keeps one source of truth.
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not record your acceptance"
      );
      setSaving(false);
    }
  };

  return (
    // Full-bleed on a phone, a centred card from sm up. A phone has no room
    // to spare for a decorative margin around a document this long, and dvh
    // rather than vh so the mobile URL bar cannot push the footer off-screen.
    <div className="bg-muted/30 sm:px-4 sm:py-8">
      <div className="mx-auto flex h-[100dvh] w-full max-w-4xl flex-col overflow-hidden border-y bg-background sm:h-auto sm:min-h-[calc(100dvh-4rem)] sm:rounded-2xl sm:border sm:shadow-xl">
        <div className="border-b px-4 py-4 sm:px-6 sm:py-5">
          <h1 className="text-lg font-semibold tracking-tight sm:text-2xl">
            Our Terms of Service have been updated
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Please review and accept them to continue to your creator dashboard. You only need
            to do this once, until the Terms change again.
          </p>
        </div>

        {/* The full text, inline: linking off to /terms instead would let a
            creator accept something they were never shown. It scrolls within
            the card so the accept controls stay put — on a phone, a footer
            that scrolls away at the end of a document this long means a lot of
            thumbing back down to find it. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 text-sm [&_.prose]:prose-sm sm:px-6 sm:py-6 sm:[&_.prose]:prose-base">
          <TermsOfServiceContent />
        </div>

        {/* Extra bottom padding on small screens keeps the accept button clear
            of the floating support-chat button, which is fixed to the same
            corner. A backer already reported it covering a control there. */}
        <div className="space-y-4 border-t bg-background px-4 pb-24 pt-4 sm:px-6 sm:pb-5 sm:pt-5">
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <Checkbox
              checked={agreed}
              onCheckedChange={(v) => setAgreed(v === true)}
              className="mt-0.5"
              aria-label="I have read and agree to the Terms of Service"
            />
            <span>
              I have read and agree to the IndieCrowdfund Terms of Service
              {" "}
              <span className="text-muted-foreground">(version {TERMS_VERSION})</span>.
            </span>
          </label>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              If you do not agree, you can sign out and contact{" "}
              <a href="mailto:support@indiecrowdfund.com" className="underline">
                support@indiecrowdfund.com
              </a>
              .
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:gap-3">
              <Button
                variant="outline"
                onClick={signOut}
                disabled={signingOut}
                className="w-full sm:w-auto"
              >
                {signingOut ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing out…
                  </>
                ) : (
                  "Sign out"
                )}
              </Button>
              <Button
                onClick={accept}
                disabled={!agreed || saving}
                className="w-full bg-gradient-to-r from-[#05ce78] to-emerald-600 text-white hover:from-[#05ce78]/90 hover:to-emerald-600/90 sm:w-auto"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Accept and continue"
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
