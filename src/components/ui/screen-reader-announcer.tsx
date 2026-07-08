"use client";

import { useState, useCallback, createContext, useContext, type ReactNode } from "react";

interface AnnouncerContextType {
  announce: (message: string, priority?: "polite" | "assertive") => void;
}

const AnnouncerContext = createContext<AnnouncerContextType>({
  announce: () => {},
});

export function useAnnounce() {
  return useContext(AnnouncerContext);
}

/**
 * Provides an aria-live region for screen reader announcements.
 * Wrap your app or page with this component and use the `useAnnounce` hook
 * to announce dynamic content changes to assistive technology.
 *
 * Usage:
 *   const { announce } = useAnnounce();
 *   announce("3 items loaded");
 *   announce("Error: payment failed", "assertive");
 */
export function ScreenReaderAnnouncer({ children }: { children: ReactNode }) {
  const [politeMessage, setPoliteMessage] = useState("");
  const [assertiveMessage, setAssertiveMessage] = useState("");

  const announce = useCallback((message: string, priority: "polite" | "assertive" = "polite") => {
    if (priority === "assertive") {
      setAssertiveMessage("");
      // Use setTimeout to ensure DOM update triggers screen reader
      setTimeout(() => setAssertiveMessage(message), 50);
    } else {
      setPoliteMessage("");
      setTimeout(() => setPoliteMessage(message), 50);
    }
  }, []);

  return (
    <AnnouncerContext.Provider value={{ announce }}>
      {children}
      {/* Visually hidden aria-live regions */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {politeMessage}
      </div>
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {assertiveMessage}
      </div>
    </AnnouncerContext.Provider>
  );
}
