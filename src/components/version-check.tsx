"use client";

import { useEffect, useCallback } from "react";

// This is set at build time and changes with each deployment
const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID || "development";

const VERSION_KEY = "app_build_id";
const LAST_CHECK_KEY = "app_version_last_check";
const CHECK_INTERVAL = 30000; // Check every 30 seconds

export function VersionCheck() {
  const forceRefresh = useCallback(() => {
    console.log("[VersionCheck] Forcing hard refresh");
    // Clear session storage
    sessionStorage.clear();
    // Use clean URL without cache-busting params, then hard reload
    const url = new URL(window.location.href);
    // Remove any existing cache-busting params
    url.searchParams.delete('_');
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    // Force reload from server
    window.location.reload();
  }, []);

  const checkVersion = useCallback(async () => {
    try {
      const response = await fetch('/api/version', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });

      if (!response.ok) return;

      const data = await response.json();
      const serverBuildId = data.buildId;
      const storedVersion = localStorage.getItem(VERSION_KEY);

      if (storedVersion && storedVersion !== serverBuildId) {
        console.log(`[VersionCheck] Server version changed: ${storedVersion} -> ${serverBuildId}`);
        localStorage.setItem(VERSION_KEY, serverBuildId);
        forceRefresh();
        return;
      }

      if (!storedVersion) {
        localStorage.setItem(VERSION_KEY, serverBuildId);
      }
    } catch (error) {
      // Silently fail - network issues shouldn't break the app
      console.debug("[VersionCheck] Version check failed:", error);
    }
  }, [forceRefresh]);

  useEffect(() => {
    // Initial check on mount
    const storedVersion = localStorage.getItem(VERSION_KEY);

    if (storedVersion && storedVersion !== BUILD_ID) {
      console.log(`[VersionCheck] Build version mismatch on load: ${storedVersion} -> ${BUILD_ID}`);
      localStorage.setItem(VERSION_KEY, BUILD_ID);
      sessionStorage.clear();
      window.location.reload();
      return;
    }

    if (!storedVersion) {
      localStorage.setItem(VERSION_KEY, BUILD_ID);
    }

    // Periodic version check
    const intervalId = setInterval(checkVersion, CHECK_INTERVAL);

    // Also check on window focus (user returns to tab)
    const handleFocus = () => {
      const lastCheck = localStorage.getItem(LAST_CHECK_KEY);
      const now = Date.now();
      // Only check if last check was more than 10 seconds ago
      if (!lastCheck || now - parseInt(lastCheck) > 10000) {
        localStorage.setItem(LAST_CHECK_KEY, now.toString());
        checkVersion();
      }
    };
    window.addEventListener('focus', handleFocus);

    // Intercept Server Action errors globally
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
      try {
        const response = await originalFetch.apply(this, args);
        return response;
      } catch (error) {
        // Check if this looks like a Server Action version mismatch error
        if (error instanceof Error) {
          const errorMessage = error.message.toLowerCase();
          if (
            errorMessage.includes('server action') ||
            errorMessage.includes('failed to find') ||
            errorMessage.includes('older or newer deployment') ||
            errorMessage.includes('workers')
          ) {
            console.log("[VersionCheck] Server Action error detected, forcing refresh:", error.message);
            forceRefresh();
          }
        }
        throw error;
      }
    };

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      window.fetch = originalFetch;
    };
  }, [checkVersion, forceRefresh]);

  return null;
}
