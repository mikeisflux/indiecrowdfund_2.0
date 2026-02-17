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
  initialAnnouncements?: AnnouncementBarData[];
}

const DISMISSED_KEY_PREFIX = "announcement_dismissed_";

function isDismissedInStorage(id: string): boolean {
  try {
    const dismissedTime = localStorage.getItem(`${DISMISSED_KEY_PREFIX}${id}`);
    if (dismissedTime) {
      const dismissedAt = parseInt(dismissedTime, 10);
      const now = Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      if (now - dismissedAt < twentyFourHours) {
        return true;
      }
      localStorage.removeItem(`${DISMISSED_KEY_PREFIX}${id}`);
    }
  } catch {
    // localStorage may not be available
  }
  return false;
}

function SingleAnnouncementBar({ announcement }: { announcement: AnnouncementBarData }) {
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (announcement.id) {
      setIsDismissed(isDismissedInStorage(announcement.id));
    }
  }, [announcement.id]);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(`${DISMISSED_KEY_PREFIX}${announcement.id}`, Date.now().toString());
    setIsDismissed(true);
  }, [announcement.id]);

  if (isDismissed) {
    return null;
  }

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

export function AnnouncementBar({ initialAnnouncements = [] }: AnnouncementBarProps) {
  const pathname = usePathname();
  const [announcements, setAnnouncements] = useState<AnnouncementBarData[]>(initialAnnouncements);
  const [isLoading, setIsLoading] = useState(initialAnnouncements.length === 0);

  // Don't show on admin pages
  const isAdminPage = pathname?.startsWith("/admin");

  // Fetch announcements if not provided
  useEffect(() => {
    if (initialAnnouncements.length > 0) {
      setAnnouncements(initialAnnouncements);
      setIsLoading(false);
      return;
    }

    async function fetchAnnouncements() {
      try {
        const response = await fetch("/api/announcement-bar");
        const data = await response.json();
        setAnnouncements(data.announcements || []);
      } catch (error) {
        console.error("Failed to fetch announcements:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchAnnouncements();
  }, [initialAnnouncements]);

  if (isLoading || isAdminPage || announcements.length === 0) {
    return null;
  }

  return (
    <>
      {announcements.map((announcement) => (
        <SingleAnnouncementBar key={announcement.id} announcement={announcement} />
      ))}
    </>
  );
}
