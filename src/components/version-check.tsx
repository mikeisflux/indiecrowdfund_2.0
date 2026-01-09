"use client";

import { useEffect, useCallback, useRef } from "react";

// This is set at build time and changes with each deployment
const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID || "development";

const VERSION_KEY = "app_build_id";
const CHECK_INTERVAL = 60000; // Check every 60 seconds (less aggressive)

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

  // Track if we've already refreshed to avoid loops
  const hasRefreshed = useRef(false);

  useEffect(() => {
    // Initial check on mount - only once
    const storedVersion = localStorage.getItem(VERSION_KEY);

    if (storedVersion && storedVersion !== BUILD_ID && !hasRefreshed.current) {
      console.log(`[VersionCheck] Build version mismatch on load: ${storedVersion} -> ${BUILD_ID}`);
      localStorage.setItem(VERSION_KEY, BUILD_ID);
      hasRefreshed.current = true;
      sessionStorage.clear();
      window.location.reload();
      return;
    }

    if (!storedVersion) {
      localStorage.setItem(VERSION_KEY, BUILD_ID);
    }

    // Periodic version check (silent, only reloads on actual version change)
    const intervalId = setInterval(checkVersion, CHECK_INTERVAL);

    // Intercept Server Action errors globally - check both thrown errors and error responses
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
      try {
        const response = await originalFetch.apply(this, args);

        // For POST requests that might be Server Actions, check for version mismatch errors
        // Server Actions return error responses (not thrown), so we need to check the response
        const request = args[0];
        const isPost = (typeof request === 'string' || request instanceof URL)
          ? args[1]?.method?.toUpperCase() === 'POST'
          : request instanceof Request && request.method.toUpperCase() === 'POST';

        if (isPost && !response.ok && !hasRefreshed.current) {
          try {
            // Clone to avoid consuming the response
            const clonedResponse = response.clone();
            const text = await clonedResponse.text();
            const textLower = text.toLowerCase();

            if (
              textLower.includes('server action') ||
              textLower.includes('failed to find') ||
              textLower.includes('older or newer deployment') ||
              textLower.includes('workers')
            ) {
              console.log("[VersionCheck] Server Action version mismatch in response, forcing refresh");
              hasRefreshed.current = true;
              forceRefresh();
            }
          } catch {
            // Ignore errors reading response body
          }
        }

        return response;
      } catch (error) {
        // Check if this looks like a Server Action version mismatch error
        if (error instanceof Error && !hasRefreshed.current) {
          const errorMessage = error.message.toLowerCase();
          if (
            errorMessage.includes('server action') ||
            errorMessage.includes('failed to find') ||
            errorMessage.includes('older or newer deployment') ||
            errorMessage.includes('workers')
          ) {
            console.log("[VersionCheck] Server Action error detected, forcing refresh:", error.message);
            hasRefreshed.current = true;
            forceRefresh();
          }
        }
        throw error;
      }
    };

    return () => {
      clearInterval(intervalId);
      window.fetch = originalFetch;
    };
  }, [checkVersion, forceRefresh]);

  return null;
}
