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
    sessionStorage.setItem(CONSENT_SESSION_KEY, Date.now().toString());
    localStorage.setItem(CONSENT_DISMISSED_KEY, Date.now().toString());
    if (showFrequency === "once_per_login") {
      localStorage.setItem(CONSENT_LOGIN_KEY, Date.now().toString());
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

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[99] animate-in slide-in-from-bottom duration-500">
      <div className="mx-auto max-w-7xl px-4 pb-4">
        <div className="rounded-xl border border-border bg-background/95 backdrop-blur-lg shadow-2xl p-4 sm:p-6">
          <div className="flex flex-col gap-3">
            {/* Main message */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm mb-1">{content.heading}</h3>
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

            {/* Expandable preferences */}
            {showPreferences && (
              <div className="border-t border-border pt-3 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Essential - always on */}
                  <div className="flex items-center justify-between gap-3 p-2 rounded-lg bg-muted/50">
                    <div>
                      <p className="text-xs font-medium">Essential</p>
                      <p className="text-[11px] text-muted-foreground">Session, security, authentication</p>
                    </div>
                    <Switch checked disabled className="opacity-60" />
                  </div>

                  {/* Analytics */}
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

                  {/* AI Tracking */}
                  <div className="flex items-center justify-between gap-3 p-2 rounded-lg bg-muted/50">
                    <div>
                      <p className="text-xs font-medium">AI & Personalization</p>
                      <p className="text-[11px] text-muted-foreground">Recommendations, AI-powered features</p>
                    </div>
                    <Switch
                      checked={preferences.aiTracking}
                      onCheckedChange={(checked) =>
                        setPreferences({ ...preferences, aiTracking: checked })
                      }
                    />
                  </div>

                  {/* Marketing */}
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
            )}

            {/* Buttons */}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPreferences(!showPreferences)}
                className="text-xs"
              >
                {showPreferences ? "Hide Preferences" : "Manage Preferences"}
              </Button>
              {showPreferences && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSavePreferences}
                >
                  Save Preferences
                </Button>
              )}
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
    </div>
  );
}
