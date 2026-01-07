"use client";

import { useEffect } from "react";

// This is set at build time and changes with each deployment
const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID || Date.now().toString();

const VERSION_KEY = "app_build_id";

export function VersionCheck() {
  useEffect(() => {
    // Check if we have a stored version
    const storedVersion = localStorage.getItem(VERSION_KEY);

    if (storedVersion && storedVersion !== BUILD_ID) {
      // Version mismatch - clear storage and force reload
      console.log(`[VersionCheck] Build version changed: ${storedVersion} -> ${BUILD_ID}, forcing refresh`);
      localStorage.setItem(VERSION_KEY, BUILD_ID);

      // Clear any cached data that might cause issues
      sessionStorage.clear();

      // Force a hard reload to get fresh server actions
      window.location.reload();
      return;
    }

    if (!storedVersion) {
      // First visit or cleared storage - just store the version
      localStorage.setItem(VERSION_KEY, BUILD_ID);
    }
  }, []);

  return null;
}
