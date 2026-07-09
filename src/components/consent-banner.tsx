"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import Link from "next/link";
import {
  ConsentPreferences,
  getConsentPreferences,
  setConsentPreferences,
  hasUserConsented,
} from "@/lib/consent";

interface ConsentLink {
  label: string;
  url: string;
}

interface ConsentContent {
  heading: string;
  message: string;
  acceptButtonText: string;
  links: ConsentLink[];
}

const CONSENT_DISMISSED_KEY = "consent_banner_dismissed";
const CONSENT_SESSION_KEY = "consent_banner_shown_session";
const CONSENT_LOGIN_KEY = "consent_banner_login_dismissed";

export function ConsentBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [content, setContent] = useState<ConsentContent | null>(null);
  const [showFrequency, setShowFrequency] = useState("once_per_login");
  const [preferences, setPreferences] = useState<ConsentPreferences>({
    essential: true,
    analytics: true,
    aiTracking: true,
    marketing: true,
  });

  const shouldShow = useCallback(() => {
    if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin")) {
      return false;
    }

    try {
      if (showFrequency === "once_per_session") {
        return !sessionStorage.getItem(CONSENT_SESSION_KEY);
      }

      if (showFrequency === "once_per_login") {
        return !localStorage.getItem(CONSENT_LOGIN_KEY);
      }

      if (showFrequency === "once_per_day") {
        const lastDismissed = localStorage.getItem(CONSENT_DISMISSED_KEY);
        if (lastDismissed) {
          const dismissedAt = parseInt(lastDismissed, 10);
          const twentyFourHours = 24 * 60 * 60 * 1000;
          if (Date.now() - dismissedAt < twentyFourHours) return false;
        }
        return true;
      }
    } catch {
      // localStorage/sessionStorage unavailable (Safari Private Browsing) — show banner
      return true;
    }

    return true;
  }, [showFrequency]);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchBanner() {
      try {
        const response = await fetch("/api/consent-banner", { signal: controller.signal });
        if (!response.ok) return;

        const data = await response.json();
        if (!data.banner) return;

        setContent(data.banner.content as ConsentContent);
        setShowFrequency(data.banner.showFrequency || "once_per_login");
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        // Silently fail
      }
    }

    fetchBanner();

    // Load existing preferences if user already consented before
    if (hasUserConsented()) {
      setPreferences(getConsentPreferences());
    }

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (content && shouldShow()) {
      const timer = setTimeout(() => setIsVisible(true), 1200);
      return () => clearTimeout(timer);
    }
  }, [content, shouldShow]);

  const dismiss = useCallback(() => {
    setIsVisible(false);
    try {
      sessionStorage.setItem(CONSENT_SESSION_KEY, Date.now().toString());
      localStorage.setItem(CONSENT_DISMISSED_KEY, Date.now().toString());
      if (showFrequency === "once_per_login") {
        localStorage.setItem(CONSENT_LOGIN_KEY, Date.now().toString());
      }
    } catch {
      // Storage unavailable — banner will reappear next visit, which is acceptable
    }
  }, [showFrequency]);

  const handleAcceptAll = () => {
    const allAccepted: ConsentPreferences = {
      essential: true,
      analytics: true,
      aiTracking: true,
      marketing: true,
    };
    setConsentPreferences(allAccepted);
    dismiss();
  };

  const handleSavePreferences = () => {
    setConsentPreferences(preferences);
    dismiss();
  };

  if (!isVisible || !content) return null;

  // First link in admin-config is treated as the primary "Learn more"
  // target. Falls back to /privacy-policy if nothing is configured so
  // the link isn't broken on a clean install.
  const primaryLink = content.links?.[0];
  const learnMoreHref = primaryLink?.url || "/privacy-policy";
  const learnMoreLabel = primaryLink?.label || "Learn more";

  // Compact mode (default): single-line bar with OK + Learn more.
  // Mobile users were getting buried under the old multi-paragraph
  // banner — the previous version stacked 4 paragraphs of policy
  // text + 3 inline links + 3 buttons + a 4-toggle preferences grid,
  // which on a 360px-wide screen filled half the viewport and made
  // the "Accept All" button fall below the fold. The redesign pushes
  // all of that detail behind a single tap on "Manage" so the default
  // tap target (Accept) is always reachable in one thumb stroke.
  if (!showPreferences) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-40 animate-in slide-in-from-bottom duration-500">
        <div className="mx-auto max-w-3xl px-2 pb-2 sm:px-4 sm:pb-4">
          <div className="rounded-lg border border-border bg-background/95 backdrop-blur-lg shadow-lg px-3 py-2 sm:px-4 sm:py-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <p className="flex-1 min-w-0 text-xs sm:text-sm text-muted-foreground leading-snug">
                We use cookies to improve your experience.{" "}
                <Link
                  href={learnMoreHref}
                  className="text-primary hover:underline whitespace-nowrap"
                  target={learnMoreHref.startsWith("http") ? "_blank" : undefined}
                  rel={learnMoreHref.startsWith("http") ? "noopener noreferrer" : undefined}
                >
                  {learnMoreLabel}
                </Link>
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPreferences(true)}
                className="hidden sm:inline-flex text-xs h-8 px-2"
              >
                Manage
              </Button>
              <Button
                onClick={handleAcceptAll}
                size="sm"
                className="shrink-0 whitespace-nowrap h-8"
              >
                OK
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Expanded mode: full preferences panel reachable from the "Manage"
  // button on desktop. Still mounted at the bottom but with a backdrop
  // so it's clearly modal — easier to dismiss than the prior inline
  // version that just kept growing the bar in place.
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-xl border border-border bg-background shadow-2xl p-4 sm:p-6 animate-in slide-in-from-bottom duration-300">
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="font-semibold text-base mb-1">{content.heading}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {content.message}
            </p>
            {content.links && content.links.length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                {content.links.map((link, i) => (
                  <Link
                    key={i}
                    href={link.url}
                    className="text-xs text-primary hover:underline"
                    target={link.url.startsWith("http") ? "_blank" : undefined}
                    rel={link.url.startsWith("http") ? "noopener noreferrer" : undefined}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-border pt-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center justify-between gap-3 p-2 rounded-lg bg-muted/50">
                <div>
                  <p className="text-xs font-medium">Essential</p>
                  <p className="text-[11px] text-muted-foreground">Session, security, authentication</p>
                </div>
                <Switch checked disabled className="opacity-60" />
              </div>
              <div className="flex items-center justify-between gap-3 p-2 rounded-lg bg-muted/50">
                <div>
                  <p className="text-xs font-medium">Analytics</p>
                  <p className="text-[11px] text-muted-foreground">Page views, scroll depth, usage stats</p>
                </div>
                <Switch
                  checked={preferences.analytics}
                  onCheckedChange={(checked) =>
                    setPreferences({ ...preferences, analytics: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-3 p-2 rounded-lg bg-muted/50">
                <div>
                  <p className="text-xs font-medium">AI &amp; Personalization</p>
                  <p className="text-[11px] text-muted-foreground">Recommendations, AI-powered features</p>
                </div>
                <Switch
                  checked={preferences.aiTracking}
                  onCheckedChange={(checked) =>
                    setPreferences({ ...preferences, aiTracking: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-3 p-2 rounded-lg bg-muted/50">
                <div>
                  <p className="text-xs font-medium">Marketing</p>
                  <p className="text-[11px] text-muted-foreground">Promotional communications, retargeting</p>
                </div>
                <Switch
                  checked={preferences.marketing}
                  onCheckedChange={(checked) =>
                    setPreferences({ ...preferences, marketing: checked })
                  }
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPreferences(false)}
            >
              Back
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSavePreferences}
            >
              Save Preferences
            </Button>
            <Button
              onClick={handleAcceptAll}
              size="sm"
              className="shrink-0 whitespace-nowrap"
            >
              {content.acceptButtonText || "Accept All"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
