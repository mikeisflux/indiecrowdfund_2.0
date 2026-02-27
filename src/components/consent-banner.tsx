"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

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
  const [content, setContent] = useState<ConsentContent | null>(null);
  const [showFrequency, setShowFrequency] = useState("once_per_login");

  const shouldShow = useCallback(() => {
    // Don't show on admin pages
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

    // every_visit
    return true;
  }, [showFrequency]);

  useEffect(() => {
    async function fetchBanner() {
      try {
        const response = await fetch("/api/consent-banner");
        if (!response.ok) return;

        const data = await response.json();
        if (!data.banner) return;

        setContent(data.banner.content as ConsentContent);
        setShowFrequency(data.banner.showFrequency || "once_per_login");
      } catch {
        // Silently fail
      }
    }

    fetchBanner();
  }, []);

  useEffect(() => {
    if (content && shouldShow()) {
      // Slight delay so page renders first
      const timer = setTimeout(() => setIsVisible(true), 1200);
      return () => clearTimeout(timer);
    }
  }, [content, shouldShow]);

  const handleAccept = () => {
    setIsVisible(false);
    sessionStorage.setItem(CONSENT_SESSION_KEY, Date.now().toString());
    localStorage.setItem(CONSENT_DISMISSED_KEY, Date.now().toString());
    if (showFrequency === "once_per_login") {
      localStorage.setItem(CONSENT_LOGIN_KEY, Date.now().toString());
    }
  };

  if (!isVisible || !content) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[99] animate-in slide-in-from-bottom duration-500">
      <div className="mx-auto max-w-7xl px-4 pb-4">
        <div className="rounded-xl border border-border bg-background/95 backdrop-blur-lg shadow-2xl p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
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
            <Button
              onClick={handleAccept}
              className="shrink-0 whitespace-nowrap"
              size="sm"
            >
              {content.acceptButtonText || "I Agree"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
