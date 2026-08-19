"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { readStorage, removeStorage, writeStorage } from "@/lib/safe-storage";

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
  const dismissedTime = readStorage("local", `${DISMISSED_KEY_PREFIX}${id}`);
  if (dismissedTime) {
    const dismissedAt = parseInt(dismissedTime, 10);
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    if (now - dismissedAt < twentyFourHours) {
      return true;
    }
    removeStorage("local", `${DISMISSED_KEY_PREFIX}${id}`);
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
    // Guarded for the same reason the read above is. In an Android WebView
    // with storage disabled, `localStorage` is null rather than throwing on
    // access, so this was an uncaught "Cannot read properties of null
    // (reading 'setItem')" that aborted the handler before setIsDismissed —
    // the bar refused to close and the reader just kept tapping the X.
    //
    // Dismissal has to happen whether or not it can be remembered: closing
    // the bar is what the reader asked for, persisting it is the nicety.
    writeStorage("local", `${DISMISSED_KEY_PREFIX}${announcement.id}`, Date.now().toString());
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

export function AnnouncementBar({ initialAnnouncements }: AnnouncementBarProps) {
  const pathname = usePathname();
  const [announcements, setAnnouncements] = useState<AnnouncementBarData[]>(initialAnnouncements || []);
  const [isLoading, setIsLoading] = useState(!initialAnnouncements);
  const hasFetched = useRef(false);

  // Don't show on admin pages
  const isAdminPage = pathname?.startsWith("/admin");

  // Fetch announcements only once if not provided via props
  useEffect(() => {
    if (initialAnnouncements || hasFetched.current) {
      return;
    }
    hasFetched.current = true;

    async function fetchAnnouncements() {
      try {
        const response = await fetch("/api/announcement-bar");
        if (!response.ok) {
          console.error("Announcement bar API returned", response.status);
          return;
        }
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          console.error("Announcement bar API returned non-JSON response");
          return;
        }
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
