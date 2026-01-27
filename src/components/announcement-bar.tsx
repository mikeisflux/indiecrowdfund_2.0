"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";

interface AnnouncementBarData {
  id: string;
  text: string;
  linkUrl: string | null;
  linkText: string | null;
  backgroundColor: string;
  textColor: string;
  dismissible: boolean;
}

interface AnnouncementBarProps {
  initialAnnouncement?: AnnouncementBarData | null;
}

const DISMISSED_KEY_PREFIX = "announcement_dismissed_";

export function AnnouncementBar({ initialAnnouncement = null }: AnnouncementBarProps) {
  const pathname = usePathname();
  const [announcement, setAnnouncement] = useState<AnnouncementBarData | null>(initialAnnouncement);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isLoading, setIsLoading] = useState(!initialAnnouncement);

  // Don't show on admin pages
  const isAdminPage = pathname?.startsWith("/admin");

  // Check if announcement was previously dismissed
  useEffect(() => {
    if (announcement?.id) {
      const dismissedTime = localStorage.getItem(`${DISMISSED_KEY_PREFIX}${announcement.id}`);
      if (dismissedTime) {
        // Check if dismissal was within the last 24 hours
        const dismissedAt = parseInt(dismissedTime, 10);
        const now = Date.now();
        const twentyFourHours = 24 * 60 * 60 * 1000;
        if (now - dismissedAt < twentyFourHours) {
          setIsDismissed(true);
        } else {
          // Clear expired dismissal
          localStorage.removeItem(`${DISMISSED_KEY_PREFIX}${announcement.id}`);
        }
      }
    }
  }, [announcement?.id]);

  // Fetch announcement if not provided
  useEffect(() => {
    if (initialAnnouncement) {
      setAnnouncement(initialAnnouncement);
      setIsLoading(false);
      return;
    }

    async function fetchAnnouncement() {
      try {
        const response = await fetch("/api/announcement-bar");
        const data = await response.json();
        setAnnouncement(data.announcement);
      } catch (error) {
        console.error("Failed to fetch announcement:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchAnnouncement();
  }, [initialAnnouncement]);

  const handleDismiss = useCallback(() => {
    if (announcement?.id) {
      localStorage.setItem(`${DISMISSED_KEY_PREFIX}${announcement.id}`, Date.now().toString());
      setIsDismissed(true);
    }
  }, [announcement?.id]);

  // Don't render anything while loading, if dismissed, on admin pages, or if no announcement
  if (isLoading || isDismissed || isAdminPage || !announcement) {
    return null;
  }

  // Render the link text inline with the main text
  const renderContent = () => {
    if (announcement.linkUrl) {
      return (
        <span>
          {announcement.text}{" "}
          <a
            href={announcement.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-semibold hover:opacity-80 transition-opacity"
            style={{ color: announcement.textColor }}
          >
            {announcement.linkText || announcement.linkUrl}
          </a>
        </span>
      );
    }
    return announcement.text;
  };

  return (
    <div
      className="w-full py-2.5 px-4 text-center text-sm relative"
      style={{
        backgroundColor: announcement.backgroundColor,
        color: announcement.textColor,
      }}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-center">
        <p className="pr-8">{renderContent()}</p>

        {announcement.dismissible && (
          <button
            onClick={handleDismiss}
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-1 hover:opacity-70 transition-opacity"
            aria-label="Dismiss announcement"
            style={{ color: announcement.textColor }}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
